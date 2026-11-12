"""Measure which way each bone's tip moves for a positive local X / Z rotation, in glTF axes
(+X the model's left, +Y up, +Z front), and turn a template's `rotationSigns` into +1/-1.

Engine side, from the exported file (any Python 3, no Blender):
    python3 rig_axes.py --glb X.glb [--action pose_stand] [--template quadruped] [--out axes.json]
Authoring side, from the rig (Blender; IK and copy-rotation switched off):
    blender -b --factory-startup -P rig_axes.py -- --blend X.blend [--template quadruped] [--out axes.json]

A rotation is applied the way an engine bends a bone: local quaternion * axis-angle(local axis, +deg), on
top of the action's first keyframe (glb) or the bind pose (blend). The tip is the bone's tail (in the glb
the local +Y axis; the script checks that child joints sit on +Y, which is how Blender exports bones).
Prints `AXES` lines per bone and `SIGN meaning +1|-1|MIXED` lines, and writes the table to --out.
"""
import argparse
import json
import math
import struct
import sys

COMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
AXIS_NAMES = ("X", "Y", "Z")


# ---- small vector / quaternion helpers (x, y, z, w quaternions, row-major 3x3) -----------------

def q_mul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz)


def q_axis(axis, deg):
    h = math.radians(deg) / 2
    v = [0.0, 0.0, 0.0]
    v[axis] = math.sin(h)
    return (v[0], v[1], v[2], math.cos(h))


def q_rotate(q, v):
    x, y, z, w = q
    p = q_mul(q_mul(q, (v[0], v[1], v[2], 0.0)), (-x, -y, -z, w))
    return p[:3]


def unit(v):
    n = math.sqrt(sum(c * c for c in v)) or 1.0
    return tuple(c / n for c in v)


def dominant(v):
    """'+Z (0.97)': the glTF axis the vector mostly points along and the share of its length."""
    v = unit(v)
    i = max(range(3), key=lambda k: abs(v[k]))
    return f"{'+' if v[i] >= 0 else '-'}{AXIS_NAMES[i]} ({abs(v[i]):.2f})"


# ---- glb ----------------------------------------------------------------------------------------

def read_glb(path):
    with open(path, "rb") as fh:
        b = fh.read()
    if b[:4] != b"glTF":
        raise SystemExit(f"{path}: not a binary glTF")
    clen, = struct.unpack("<I", b[12:16])
    g = json.loads(b[20:20 + clen])
    off = 20 + clen
    blen, = struct.unpack("<I", b[off:off + 4])
    return g, b[off + 8:off + 8 + blen]


def first_key(g, binc, acc_index):
    a = g["accessors"][acc_index]
    if a.get("componentType") != 5126:
        raise SystemExit("only float animation outputs are supported")
    bv = g["bufferViews"][a["bufferView"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    n = COMP[a["type"]]
    return list(struct.unpack(f"<{n}f", binc[start:start + 4 * n]))


def glb_frames(path, action):
    """{joint name: (world position, world rotation quaternion)} with `action`'s first keyframe applied,
    plus each joint's local rotation and parent world rotation so a local bend can be re-evaluated."""
    g, binc = read_glb(path)
    nodes = g["nodes"]
    trs = [{"t": n.get("translation", [0, 0, 0]), "r": n.get("rotation", [0, 0, 0, 1])} for n in nodes]
    anims = {a["name"]: a for a in g.get("animations", [])}
    if action:
        if action not in anims:
            raise SystemExit(f"action '{action}' not in glb (has {sorted(anims)})")
        an = anims[action]
        for c in an["channels"]:
            path_ = c["target"]["path"]
            if path_ in ("translation", "rotation"):
                trs[c["target"]["node"]][path_[0]] = first_key(g, binc, an["samplers"][c["sampler"]]["output"])
    parent = {c: i for i, n in enumerate(nodes) for c in n.get("children", [])}
    world = {}

    def world_of(i):
        if i not in world:
            if i in parent:
                pp, pq = world_of(parent[i])
                rot = q_mul(pq, tuple(trs[i]["r"]))
                pos = tuple(p + d for p, d in zip(pp, q_rotate(pq, trs[i]["t"])))
            else:
                rot, pos = tuple(trs[i]["r"]), tuple(trs[i]["t"])
            world[i] = (pos, rot)
        return world[i]

    joints = g["skins"][0]["joints"] if g.get("skins") else []
    out, on_axis, parents = {}, 0, 0
    for i in joints:
        pos, rot = world_of(i)
        p_rot = world_of(parent[i])[1] if i in parent else (0, 0, 0, 1)
        out[nodes[i].get("name", f"node{i}")] = {"pos": pos, "rot": rot, "local": tuple(trs[i]["r"]), "parent": p_rot}
        devs = [math.degrees(math.acos(max(-1.0, min(1.0, unit(trs[c]["t"])[1]))))
                for c in nodes[i].get("children", []) if c in joints and math.sqrt(sum(v * v for v in trs[c]["t"])) > 1e-6]
        if devs:  # a connected child (head on this bone's tail) sits on local +Y
            parents += 1
            on_axis += min(devs) < 0.5
    return out, (on_axis, parents)


def glb_axes(path, action, deg):
    frames, on_axis = glb_frames(path, action)
    rows = {}
    for name, f in frames.items():
        tip = q_rotate(f["rot"], (0, 1, 0))
        row = {"x_axis": q_rotate(f["rot"], (1, 0, 0)), "bone_dir": tip, "z_axis": q_rotate(f["rot"], (0, 0, 1))}
        for axis in (0, 2):
            rot = q_mul(f["parent"], q_mul(f["local"], q_axis(axis, deg)))
            row[f"tip_{AXIS_NAMES[axis]}"] = unit(tuple(a - b for a, b in zip(q_rotate(rot, (0, 1, 0)), tip)))
        rows[name] = row
    return rows, on_axis


# ---- blend (inside Blender) --------------------------------------------------------------------

def to_gltf(v):
    """Blender world vector -> glTF axes (x, z, -y)."""
    return (v[0], v[2], -v[1])


def blend_axes(path, deg):
    import bpy
    from mathutils import Euler
    bpy.ops.wm.open_mainfile(filepath=path)
    rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    if rig.animation_data:
        rig.animation_data.action = None
        for t in rig.animation_data.nla_tracks:
            t.mute = True
    for pb in rig.pose.bones:
        for c in pb.constraints:
            if c.type in ('IK', 'COPY_ROTATION'):
                c.influence = 0.0
        pb.rotation_mode = 'XYZ'
        pb.location, pb.rotation_euler, pb.scale = (0, 0, 0), (0, 0, 0), (1, 1, 1)
    bpy.context.view_layer.update()
    rows = {}
    for b in rig.data.bones:
        if not b.use_deform:
            continue
        pb = rig.pose.bones[b.name]
        m = rig.matrix_world @ pb.matrix
        base_tip = (rig.matrix_world @ pb.tail) - (rig.matrix_world @ pb.head)
        row = {"x_axis": to_gltf(m.col[0][:3]), "bone_dir": to_gltf(unit(base_tip)), "z_axis": to_gltf(m.col[2][:3])}
        for axis in (0, 2):
            e = [0.0, 0.0, 0.0]
            e[axis] = math.radians(deg)
            pb.rotation_euler = Euler(e)
            bpy.context.view_layer.update()
            tip = (rig.matrix_world @ pb.tail) - (rig.matrix_world @ pb.head)
            row[f"tip_{AXIS_NAMES[axis]}"] = to_gltf(unit(tip - base_tip))
            pb.rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()
        rows[b.name] = row
    return rows


# ---- meanings ----------------------------------------------------------------------------------

def expand(names):
    out = []
    for n in names:
        out.extend([n[:-2] + ".L", n[:-2] + ".R"] if n.endswith(".*") else [n])
    return out


def sanitize(name):
    return "".join(ch for ch in name if ch.isalnum() or ch == "_")


def find(rows, name):
    """Bone row by Blender name; glTF importers may drop dots, so also try the sanitized name."""
    if name in rows:
        return rows[name]
    return next((r for k, r in rows.items() if sanitize(k) == sanitize(name)), None)


def signs(rows, meanings):
    out = {}
    for meaning, m in meanings.items():
        axis, want = m["axis"], m["tipMoves"]
        idx = AXIS_NAMES.index(want[1])
        sgn = 1.0 if want[0] == "+" else -1.0
        per = {}
        for bone in expand(m["bones"]):
            r = find(rows, bone)
            if r is None:
                per[bone] = None
                continue
            c = sgn * r[f"tip_{axis}"][idx]
            per[bone] = {"sign": 1 if c > 0 else -1, "share": round(abs(c), 3)}
        vals = {p["sign"] for p in per.values() if p}
        missing = [b for b, p in per.items() if p is None]
        verdict = "MISSING" if missing else (vals.pop() if len(vals) == 1 else "MIXED")
        out[meaning] = {"sign": verdict, "axis": axis, "tipMoves": want, "bones": per,
                        "minShare": min((p["share"] for p in per.values() if p), default=0.0)}
    return out


def load_template(name):
    import os
    path = name if os.path.exists(name) else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "templates", name + ".json")
    with open(path) as fh:
        return json.load(fh)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("--glb")
    ap.add_argument("--blend")
    ap.add_argument("--action", default="pose_stand")
    ap.add_argument("--template")
    ap.add_argument("--deg", type=float, default=10.0)
    ap.add_argument("--out")
    a = ap.parse_args(argv)
    if bool(a.glb) == bool(a.blend):
        raise SystemExit("give exactly one of --glb or --blend")
    if a.glb:
        rows, on_axis = glb_axes(a.glb, a.action or None, a.deg)
        print(f"AXES source glb {a.glb} action {a.action} | {on_axis[0]}/{on_axis[1]} parent joints have a "
              "child on local +Y (bone direction = +Y)")
    else:
        import os
        rows = blend_axes(os.path.abspath(a.blend), a.deg)
        print(f"AXES source blend {a.blend} (bind pose, IK off)")
    for name, r in rows.items():
        print(f"AXES {name:14s} bone {dominant(r['bone_dir']):12s} localX {dominant(r['x_axis']):12s} "
              f"+X tip {dominant(r['tip_X']):12s} +Z tip {dominant(r['tip_Z'])}")
    result = {"source": a.glb or a.blend, "deg": a.deg, "frame": "glTF: +X left, +Y up, +Z front",
              "bones": {k: {kk: [round(c, 4) for c in vv] for kk, vv in v.items()} for k, v in rows.items()}}
    if a.template:
        meanings = load_template(a.template).get("rotationSigns", {}).get("meanings", {})
        result["signs"] = signs(rows, meanings)
        for meaning, s in result["signs"].items():
            print(f"SIGN {meaning:16s} {str(s['sign']):>7s}  (local {s['axis']}+ moves tip {s['tipMoves']}; "
                  f"min share {s['minShare']:.2f}; {len(s['bones'])} bones)")
    if a.out:
        with open(a.out, "w") as fh:
            json.dump(result, fh, indent=1)
        print("AXES_OK", a.out)


if __name__ == "__main__":
    main()
