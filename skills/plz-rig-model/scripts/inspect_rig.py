"""Dump a rigged model to JSON, or compare two dumps (regression check against a previous version).

Dump (Blender):   blender -b --factory-startup -P inspect_rig.py -- dump --blend X.blend [--glb X.glb] --out X.json
Compare (any Python 3):  python3 inspect_rig.py compare old.json new.json
"""
import json
import struct
import sys

COMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path):
    """Joints, node hierarchy with rest TRS, and animation samplers from a .glb (float accessors only)."""
    with open(path, "rb") as fh:
        b = fh.read()
    clen, = struct.unpack("<I", b[12:16])
    g = json.loads(b[20:20 + clen])
    off = 20 + clen
    blen, = struct.unpack("<I", b[off:off + 4])
    binc = b[off + 8:off + 8 + blen]

    def acc(i):
        a = g["accessors"][i]
        bv = g["bufferViews"][a["bufferView"]]
        n = a["count"] * COMP[a["type"]]
        start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        return list(struct.unpack(f"<{n}f", binc[start:start + 4 * n]))

    names = [n.get("name") for n in g["nodes"]]
    parent = {}
    for i, n in enumerate(g["nodes"]):
        for c in n.get("children", []):
            parent[names[c]] = names[i]
    nodes = {names[i]: {"parent": parent.get(names[i]), "t": n.get("translation", [0, 0, 0]),
                        "r": n.get("rotation", [0, 0, 0, 1]), "s": n.get("scale", [1, 1, 1]),
                        "children": [names[c] for c in n.get("children", [])]}
             for i, n in enumerate(g["nodes"])}
    anims = {}
    for an in g.get("animations", []):
        ch = {}
        for c in an["channels"]:
            s = an["samplers"][c["sampler"]]
            times, values = acc(s["input"]), acc(s["output"])
            ch[f"{names[c['target']['node']]}.{c['target']['path']}"] = {
                "times": times, "values": values, "width": len(values) // max(len(times), 1)}
        anims[an["name"]] = ch
    skins = [[names[j] for j in s["joints"]] for s in g.get("skins", [])]
    mats = [(m["name"], m.get("alphaMode", "OPAQUE"), m.get("doubleSided", False)) for m in g["materials"]]
    return {"bytes": len(b), "skins": skins, "animations": anims, "materials": mats, "nodes": nodes,
            "scenes": [[names[i] for i in sc.get("nodes", [])] for sc in g.get("scenes", [])],
            "meshes": [m["name"] for m in g["meshes"]]}


def dump(args):
    import bpy

    from os.path import abspath
    blend = args[args.index("--blend") + 1]
    out = args[args.index("--out") + 1]
    bpy.ops.wm.open_mainfile(filepath=abspath(blend))
    rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    bones = {b.name: {"parent": b.parent.name if b.parent else None, "deform": b.use_deform,
                      "connect": b.use_connect, "head": list(b.head_local), "tail": list(b.tail_local),
                      "z": list(b.matrix_local.col[2][:3])} for b in rig.data.bones}
    cons = {pb.name: [(c.type, getattr(c, "subtarget", ""), getattr(c, "chain_count", 0)) for c in pb.constraints]
            for pb in rig.pose.bones if pb.constraints}
    objects = {}
    for ob in bpy.data.objects:
        if ob.type != 'MESH' or ob.parent != rig:
            continue
        n = len(ob.data.vertices)
        w = {g.name: [0.0] * n for g in ob.vertex_groups}
        for v in ob.data.vertices:
            for ge in v.groups:
                w[ob.vertex_groups[ge.group].name][v.index] = ge.weight
        objects[ob.name] = {"verts": n, "groups": [g.name for g in ob.vertex_groups],
                            "modifiers": [m.type for m in ob.modifiers], "weights": w}
    import os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # not rsplit("/"): Windows paths use "\"
    from riglib.common import action_fcurves
    actions = {}
    for a in bpy.data.actions:
        actions[a.name] = {"fake_user": a.use_fake_user, "curves": {
            f"{fc.data_path}[{fc.array_index}]": [[k.co[0], k.co[1], k.interpolation] for k in fc.keyframe_points]
            for fc in action_fcurves(a)}}
    ad = rig.animation_data
    nla = [[t.name, t.mute, [[s.action.name, s.frame_start] for s in t.strips]] for t in ad.nla_tracks] if ad else []
    posed = [pb.name for pb in rig.pose.bones
             if pb.location.length > 1e-6 or abs(pb.scale.length - 3 ** 0.5) > 1e-6
             or max(abs(v) for v in pb.rotation_euler) > 1e-6
             or abs(pb.rotation_quaternion[0] - 1) > 1e-6]
    data = {"rig": rig.name, "bones": bones, "constraints": cons, "objects": objects, "actions": actions, "nla": nla,
            "active_action": ad.action.name if ad and ad.action else None, "stored_pose_bones": posed}
    if "--glb" in args:
        data["glb"] = read_glb(args[args.index("--glb") + 1])
    with open(out, "w") as fh:
        json.dump(data, fh)
    print("DUMP_OK", out, len(bones), "bones", len(objects), "skinned objects", len(actions), "actions")


HIDE_MAX = 0.01  # scales at or below this hide a part (templates' hideScale, default 0.001)
# The exporter rebuilds child local transforms from float32 world matrices, so under a parent scaled to
# hideScale the error grows by 1/hideScale (about 2e-5 m at 0.001). 1e-4 m = 0.1 mm.
REST_TOL = 1e-4


def _hide_pair(x, y):
    """Old/new key values that differ only because a hide scale moved between 0 and a small epsilon."""
    lo, hi = sorted((abs(x), abs(y)))
    return lo <= 1e-9 and hi <= HIDE_MAX


def _zero_scaled(anim, node):
    s = anim.get(f"{node}.scale")
    return s is not None and max(abs(v) for v in s["values"]) <= 1e-9


def _ancestors(nodes, name):
    out, p = [], nodes.get(name, {}).get("parent")
    while p:
        out.append(p)
        p = nodes.get(p, {}).get("parent")
    return out


def _compare_glb_animations(ga, gb):
    """Max channel difference, explaining the two known causes instead of failing on them:
    hide scale 0 -> epsilon, and child transforms that were undefined under a zero-scaled parent."""
    ok, vd, hide, undefined, rest_dev = True, 0.0, [], [], 0.0
    for an in sorted(set(ga["animations"]) & set(gb["animations"])):
        aa, ab = ga["animations"][an], gb["animations"][an]
        for ch in sorted(set(aa) | set(ab)):
            va, vb = aa.get(ch), ab.get(ch)
            # A changed sampler time (for example 1 s became 10 s) is a difference even when the values match.
            if (va is None or vb is None or len(va["values"]) != len(vb["values"])
                    or len(va["times"]) != len(vb["times"]) or _maxdiff(va["times"], vb["times"]) > 1e-5):
                vd = max(vd, 1.0)
                continue
            pairs = [(x, y) for x, y in zip(va["values"], vb["values"]) if abs(x - y) > 1e-5]
            if not pairs:
                continue
            node, path = ch.rsplit(".", 1)
            if path == "scale" and all(_hide_pair(x, y) for x, y in pairs):
                hide.append(f"{an}:{node}")
                continue
            zero_old = [p for p in _ancestors(ga["nodes"], node) if _zero_scaled(aa, p)]
            zero_new = [p for p in _ancestors(gb["nodes"], node) if _zero_scaled(ab, p)]
            if zero_old and not zero_new:
                undefined.append(f"{an}:{ch}")
                rest = gb["nodes"][node][{"translation": "t", "rotation": "r", "scale": "s"}[path]]
                w = vb["width"]
                for i in range(0, len(vb["values"]), w):
                    cur = vb["values"][i:i + w]
                    if path == "rotation" and sum(c * r for c, r in zip(cur, rest)) < 0:
                        cur = [-c for c in cur]  # q and -q are the same rotation
                    rest_dev = max(rest_dev, _maxdiff(cur, rest))
                continue
            vd = max(vd, max(abs(x - y) for x, y in pairs))
    print(("PASS " if vd <= 1e-5 else "FAIL ") + f"glb animation data  max diff {vd:.2e}"
          + (" (excluding the known differences below)" if hide or undefined else ""))
    ok &= vd <= 1e-5
    if hide:
        print(f"INFO glb hide scale changed (0 <-> <= {HIDE_MAX}): {hide} - intentional")
    if undefined:
        good = rest_dev <= REST_TOL
        print(("PASS " if good else "FAIL ") + f"glb children of zero-scaled bones in the OLD file ({len(undefined)} channels) "
              f"now hold their rest-local transform (max dev {rest_dev:.2e} <= {REST_TOL:g}); the old values were undefined")
        ok &= good
    return ok


def _maxdiff(a, b):
    return max((abs(x - y) for x, y in zip(a, b)), default=0.0)


def compare(a_path, b_path):
    a, b = json.load(open(a_path)), json.load(open(b_path))
    ok = True

    def check(label, cond, detail=""):
        nonlocal ok
        ok &= bool(cond)
        print(("PASS " if cond else "FAIL ") + label + (f"  {detail}" if detail else ""))

    check("bone names", set(a["bones"]) == set(b["bones"]), f"{len(a['bones'])} vs {len(b['bones'])}")
    common = set(a["bones"]) & set(b["bones"])
    same_flags = all(a["bones"][n][k] == b["bones"][n][k] for n in common for k in ("parent", "deform", "connect"))
    check("bone parents/deform/connect", same_flags)
    pos = max((_maxdiff(a["bones"][n][k], b["bones"][n][k]) for n in common for k in ("head", "tail", "z")), default=0)
    check("bone head/tail/roll axis <= 0.1 mm", pos <= 1e-4, f"max {pos * 1000:.4f} mm (z-axis diff unitless)")
    check("constraints", a["constraints"] == b["constraints"])
    check("skinned objects", set(a["objects"]) == set(b["objects"]))
    for name in sorted(set(a["objects"]) & set(b["objects"])):
        oa, ob = a["objects"][name], b["objects"][name]
        check(f"{name}: verts/groups/modifiers",
              oa["verts"] == ob["verts"] and oa["groups"] == ob["groups"] and oa["modifiers"] == ob["modifiers"],
              f"groups {oa['groups'] == ob['groups']} mods {oa['modifiers']} vs {ob['modifiers']}")
        if oa["verts"] != ob["verts"]:
            continue
        diffs = [abs(x - y) for g in oa["weights"] if g in ob["weights"]
                 for x, y in zip(oa["weights"][g], ob["weights"][g])]
        mx = max(diffs, default=0.0)
        mean = sum(diffs) / len(diffs) if diffs else 0.0
        check(f"{name}: weights", mx <= 1e-3, f"max {mx:.2e} mean {mean:.2e}")
    check("action names", set(a["actions"]) == set(b["actions"]), f"{sorted(a['actions'])} vs {sorted(b['actions'])}")
    for name in sorted(set(a["actions"]) & set(b["actions"])):
        ca, cb = a["actions"][name]["curves"], b["actions"][name]["curves"]
        same_keys = set(ca) == set(cb)
        frames = all([k[0] for k in ca[c]] == [k[0] for k in cb[c]] for c in set(ca) & set(cb))
        # Keyframe interpolation (CONSTANT, BEZIER, ...) changes the poses between keys.
        interp = all([k[2] for k in ca[c]] == [k[2] for k in cb[c]] for c in set(ca) & set(cb))
        frames = frames and interp
        vd, hidden = 0.0, []
        for c in set(ca) & set(cb):
            pairs = [(x[1], y[1]) for x, y in zip(ca[c], cb[c]) if abs(x[1] - y[1]) > 1e-5]
            if pairs and c.endswith("scale" + c[c.rindex("["):]) and all(_hide_pair(x, y) for x, y in pairs):
                hidden.append(c)
            elif pairs:
                vd = max(vd, max(abs(x - y) for x, y in pairs))
        check(f"action {name}: curves/frames/values", same_keys and frames and vd <= 1e-5,
              f"{len(ca)} vs {len(cb)} curves, max value diff {vd:.2e}"
              + (f" (excluding {len(hidden)} hide-scale curves)" if hidden else ""))
        if hidden:
            bones = sorted({h.split('"')[1] for h in hidden if '"' in h})
            print(f"INFO action {name}: hide scale changed (0 <-> <= {HIDE_MAX}) on {bones} - intentional, "
                  "see references/lessons.md")
    check("NLA tracks", a["nla"] == b["nla"], f"{a['nla']} vs {b['nla']}")
    for label, d in (("old", a), ("new", b)):
        posed = d.get("stored_pose_bones", [])
        print(f"INFO {label} file opens {'in bind pose' if not posed else f'posed ({len(posed)} bones off bind)'}")
    if "glb" in a and "glb" in b:
        ga, gb = a["glb"], b["glb"]
        check("glb joints", ga["skins"] == gb["skins"], f"{[len(s) for s in ga['skins']]} joints")
        check("glb meshes/materials", ga["meshes"] == gb["meshes"] and ga["materials"] == gb["materials"])
        common_nodes = set(ga["nodes"]) & set(gb["nodes"])
        same_tree = set(ga["nodes"]) == set(gb["nodes"]) and all(
            ga["nodes"][n]["parent"] == gb["nodes"][n]["parent"] for n in common_nodes)
        check("glb node hierarchy", same_tree, f"{len(ga['nodes'])} vs {len(gb['nodes'])} nodes")
        # A rotation and its negation are the same rotation, so accept either sign.
        rest = max((min(_maxdiff(ga["nodes"][n]["r"], gb["nodes"][n]["r"]),
                        _maxdiff(ga["nodes"][n]["r"], [-x for x in gb["nodes"][n]["r"]]))
                    if k == "r" else _maxdiff(ga["nodes"][n][k], gb["nodes"][n][k])
                    for n in common_nodes for k in ("t", "r", "s")), default=0.0)
        check("glb rest transforms", rest <= REST_TOL, f"max dev {rest:.2e}")
        check("glb animation names", set(ga["animations"]) == set(gb["animations"]), f"{sorted(ga['animations'])}")
        if any(not isinstance(v, dict) for an in (ga, gb) for ch in an["animations"].values() for v in ch.values()):
            print("FAIL glb animation data  dump made by an older inspect_rig.py; dump again")
            ok = False
        else:
            ok &= _compare_glb_animations(ga, gb)
        print(f"INFO glb bytes {ga['bytes']} vs {gb['bytes']}")
    print("RESULT", "MATCH" if ok else "DIFFERENT")
    return ok


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    if argv and argv[0] == "dump":
        dump(argv[1:])
    elif argv and argv[0] == "compare":
        sys.exit(0 if compare(argv[1], argv[2]) else 1)
    else:
        print(__doc__)
        sys.exit(2)
