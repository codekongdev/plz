"""Quadruped body plan: one connected skin for body, head, neck, tail and four legs.

1. The body + tail loft (legs and ears cut from the silhouettes) and the limb capsules/paws are
   unioned as signed distance grids and filleted at the leg roots (sdf_union.py).
2. Eyes go into the head surface, ears are separate thin shells (ears.py).
3. Body and ears are unwrapped together (Smart UV Project, deterministic) and the view projection
   is baked into one shared texture.
4. Landmarks: the spec skeleton, tail points spaced by arc length on the side centre line, ear
   base/tip, eye centres, nose_tip and crown; every joint is checked to lie inside the volume.
"""
import math
import os

import bpy
from mathutils import Vector

from . import ears, eyes, limbs, loft, output, sdf_union, texture
from .common import P, load_image, sided, textured


def _loft_object(oid, meas, spec):
    """The single-axis loft with its subdivision applied, as a temporary object at identity."""
    clamp = meas.get("clampHalfWidth") or meas["frontHalfWidth"]
    ob = loft.build_body(f"{oid}_tmp_loft", meas["profile"], clamp, spec["loft"], None)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.meshes.remove(old)
    me.name = f"{oid}_tmp_loft"
    tmp = bpy.data.objects.new(me.name, me)
    bpy.context.scene.collection.objects.link(tmp)
    return tmp


def _decimate(ob, max_tris):
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if not max_tris or tris <= max_tris:
        return
    mod = ob.modifiers.new("Decimate", 'DECIMATE')
    mod.ratio = max_tris / tris
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.remove(mod)
    ob.data = me
    bpy.data.meshes.remove(old)
    me.name = ob.name


def _unwrap(objs, cfg):
    """Smart UV Project over several meshes at once, so their islands share one texture."""
    for ob in bpy.context.scene.objects:
        ob.select_set(False)
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(cfg.get("angleDeg", 66)),
                             island_margin=cfg.get("islandMargin", 0.002), area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')


def _assign(objs, mat):
    for ob in objs:
        ob.data.materials.clear()
        ob.data.materials.append(mat)


def tail_points(centre, base, cfg, tail_f):
    """Points spaced evenly by arc length from `base` (x, f, z cm, inside the rump) along the side
    centre line (f, z), which is used from f = startCm back to endInsetCm before the tail tip."""
    end_f = tail_f + cfg["endInsetCm"]
    path = [(base[1], base[2])] + [(f, z) for f, z in sorted(centre, reverse=True) if end_f <= f <= cfg["startCm"]]
    acc = [0.0]
    for (f0, z0), (f1, z1) in zip(path, path[1:]):
        acc.append(acc[-1] + math.hypot(f1 - f0, z1 - z0))
    names = cfg.get("points", ["tail_a", "tail_b", "tail_c", "tail_end"])
    out = {}
    for k, name in enumerate(names, start=1):
        s = acc[-1] * k / len(names)
        i = next(j for j in range(len(acc) - 1) if acc[j + 1] >= s - 1e-9)
        t = (s - acc[i]) / max(acc[i + 1] - acc[i], 1e-9)
        (f0, z0), (f1, z1) = path[i], path[i + 1]
        out[name] = P(0.0, f0 + (f1 - f0) * t, z0 + (z1 - z0) * t)
    return out


def _surface_points(body, head_f):
    """nose_tip (most forward vertex) and crown (highest vertex in front of head_base)."""
    vs = [v.co for v in body.data.vertices]
    head = [v for v in vs if -v.y * 100 >= head_f] or vs
    out = {"nose_tip": min(vs, key=lambda c: c.y).copy(), "crown": max(head, key=lambda c: c.z).copy()}
    for c in out.values():
        c.x = 0.0           # midline features; the voxel surface has two mirror vertices at ±half a voxel
    return out


# points the quadruped rig template reads (references/conventions.md); sided ones get .L/.R
CENTRE_POINTS = ("hip", "spine_mid", "chest", "neck_base", "head_base", "snout", "tail_base",
                 "tail_a", "tail_b", "tail_c", "tail_end", "nose_tip", "crown")
SIDED_POINTS = ("eye", "ear_base", "ear_tip", "shoulder", "elbow", "wrist", "front_toe",
                "hip_joint", "knee", "hock", "hind_ball", "hind_toe")


def _check_spec(spec):
    missing = [k for k in ("limbs", "union", "skeleton", "tail", "eyes", "texture") if k not in spec]
    missing += [f"skeleton.{k}" for k in ("tail_base", "head_base") if k not in spec.get("skeleton", {})]
    if missing:
        raise SystemExit(f"quadruped spec is missing: {', '.join(missing)} (see references/spec-format.md)")


def _skin(oid, spec, meas, root):
    """Body loft + limb primitives -> one connected, filleted mesh object."""
    groups = limbs.build_limbs(oid, spec["limbs"], spec["skeleton"])
    me = sdf_union.union_mesh(f"{oid}_body", [_loft_object(oid, meas, spec)], groups, spec["union"])
    body = bpy.data.objects.new(f"{oid}_body", me)
    bpy.context.scene.collection.objects.link(body)
    body.parent = root
    _decimate(body, spec["union"].get("maxTris"))
    return body


def _textures(oid, spec, meas, work, body, ear_obs):
    """UVs and projection bakes: the body from the filled view copies (tex_<view>_body.png: no
    painted eyes, no ear drawn in front of the head), the ears from the plain views."""
    tex_cfg = spec["texture"]
    views = ("side", "top", "front", "back")
    plain = {k: load_image(f"{oid}_proj_{k}", f"{work}/tex_{k}.png") for k in views}
    body_img = {k: (load_image(f"{oid}_proj_{k}_body", f"{work}/tex_{k}_body.png")
                    if os.path.exists(f"{work}/tex_{k}_body.png") else plain[k]) for k in views}
    _unwrap([body], spec.get("uv", {}))
    m_body = texture.build_projection(f"{oid}_project_body", 'folded', meas, body_img, tex_cfg["blendPower"])
    albedo = texture.bake_objects([body], m_body, f"{oid}_body_albedo", tex_cfg, f"{work}/{oid}_body_albedo.png")
    _assign([body], textured(f"{oid}_{spec.get('materials', {}).get('body', 'body')}", albedo,
                             tex_cfg["roughness"], tex_cfg["specular"]))
    if ear_obs:
        _unwrap(ear_obs, spec.get("uv", {}))
        m_ear = texture.build_projection(f"{oid}_project_ears", 'folded', meas, plain, tex_cfg["blendPower"])
        ear_cfg = dict(tex_cfg, size=spec["ears"].get("textureSize", 512))
        ear_albedo = texture.bake_objects(ear_obs, m_ear, f"{oid}_ear_albedo", ear_cfg, f"{work}/{oid}_ear_albedo.png")
        _assign(ear_obs, textured(f"{oid}_ear", ear_albedo, tex_cfg["roughness"], tex_cfg["specular"]))


def _landmarks(spec, meas, body, eye_parts, ear_parts):
    """(points, parts, inside report). Joints are checked to lie inside the body (ear tips: the ear)."""
    skel = spec["skeleton"]
    points = {}
    for name, (x, f, z) in skel.items():
        if name.endswith(".L"):
            points.update(sided(skel, name[:-2]))
        elif not name.endswith(".R"):
            points[name] = P(x, f, z)
    points.update(tail_points(meas["sideCentre"], skel["tail_base"], spec["tail"], meas["tailF"]))
    for k, (ob, c) in eye_parts.items():
        points[k] = c
    for k, (ob, base, tip) in ear_parts.items():
        points["ear_base" + k[-2:]], points["ear_tip" + k[-2:]] = base, tip
    points.update(_surface_points(body, skel["head_base"][1]))
    points = {k: v + Vector() for k, v in points.items()}       # -0.0 -> 0.0 in the JSON
    parts = {"body": body.name}
    parts.update({k: ob.name for k, (ob, c) in eye_parts.items()})
    parts.update({k: v[0].name for k, v in ear_parts.items()})
    skip = set(eye_parts) | {"nose_tip", "crown"}
    owners = {n: body for n in points if n not in skip and not n.startswith("ear_tip")}
    owners.update({n: ear_parts["ear." + n[-1]][0] for n in points if n.startswith("ear_tip")})
    return points, parts, output.inside_check(points, owners)


def build(spec, meas, meas_sheet, work, stem, root):
    _check_spec(spec)
    oid = spec["id"]
    body = _skin(oid, spec, meas, root)
    e = spec["eyes"].get("position") or [meas["eye"]["f"], meas["eye"]["z"]]
    eye_parts = eyes.build_eyes(oid, e, spec["eyes"], body, root)
    ear_parts = ears.build_ears(oid, spec["ears"], root) if spec.get("ears") else {}
    ear_obs = [v[0] for _, v in sorted(ear_parts.items())]
    _textures(oid, spec, meas, work, body, ear_obs)
    points, parts, inside = _landmarks(spec, meas, body, eye_parts, ear_parts)
    wanted = list(CENTRE_POINTS) + [f"{n}.{s}" for n in SIDED_POINTS for s in "LR"]
    missing = [n for n in wanted if n not in points]
    if missing:
        print("WARNING landmarks missing for the quadruped template:", missing)

    stats = output.evaluated_stats(output.descendants(root))
    output.export_glb(root, stem + ".glb", spec["export"])
    output.write_json(stem + ".landmarks.json", output.landmarks(spec, points, parts, {}))
    output.save_blend(stem + ".blend")
    rep = output.report(spec, meas_sheet, stats, body.name, eye_parts["eye.L"][1],
                        {"glb": stem + ".glb", "blend": stem + ".blend"},
                        dims_from=[body.name] + [ob.name for ob in ear_obs])
    rep["landmarksInside"] = inside
    rep["landmarksOutside"] = sorted(n for n, r in inside.items() if not r["inside"])
    rep["landmarksMissing"] = missing
    output.write_json(stem + ".report.json", rep)
    print("BUILD_OK", stem, "tris", rep["trisTotal"], "body", rep["bodyCm"],
          "outside", rep["landmarksOutside"], "missing", missing)
