"""Eyeballs: UV spheres sunk into the head at the detected eye position.

The eye height and forward position come from the side view (colour detection) or the spec; the
lateral position is where a ray from the side hits the head surface. The sphere's pole is turned
to the outward surface normal so the pupil (faces within pupilDeg of the pole) is a clean circle;
selecting pupil faces on an unaligned sphere gives a jagged square.

Forward-facing eyes (cats) set `gazeDeg` (yaw outward from straight ahead) and `lateralCm`: the ray
then comes in along the gaze towards (lateralCm, f, z) and the pupil looks along the gaze.
`pupilShape: "slit"` with `pupilDeg: [half width, half height]` makes a vertical slit; the sphere's
pole is then horizontal so the latitude rings give the slit straight sides. `rim` colours the faces
more than `fromDeg` from the gaze axis (the eyelid line around the visible cap).
"""
import math

import bmesh
import bpy
from mathutils import Vector

from .common import principled, srgb


def build_eyes(oid, eye_fz, cfg, body, parent):
    f, z = eye_fz
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    gaze = None
    if cfg.get("gazeDeg") is not None:
        yaw = math.radians(cfg["gazeDeg"])
        gaze = Vector((math.sin(yaw), -math.cos(yaw), 0))
        target = Vector((cfg["lateralCm"] * 0.01, -f * 0.01, z * 0.01))
        hit, loc, nrm, _ = ev.ray_cast(target + gaze * 0.2, -gaze)
    else:
        ox = max(v[0] for v in body.bound_box) + 0.01
        hit, loc, nrm, _ = ev.ray_cast(Vector((ox, -f * 0.01, z * 0.01)), Vector((-1, 0, 0)))
    if not hit:
        raise SystemExit(f"eye ray at f={f} z={z} cm missed the head")
    iris = principled(f"{oid}_iris", srgb(cfg["iris"]), cfg["irisRoughness"])
    pupil = principled(f"{oid}_pupil", srgb(cfg["pupil"]), cfg["pupilRoughness"])
    R = cfg["radiusCm"] * 0.01
    useg, vseg = cfg["segments"]
    cos_p = None if cfg.get("pupilShape") == "slit" else math.cos(math.radians(cfg["pupilDeg"]))
    out = {}
    slit = cfg.get("pupilShape") == "slit"
    rim_cfg = cfg.get("rim")       # dark band where the eyeball meets the skin (cat eyelid line)
    rim = principled(f"{oid}_eye_rim", srgb(rim_cfg["colour"]), rim_cfg.get("roughness", 0.5)) if rim_cfg else None
    cos_rim = math.cos(math.radians(rim_cfg["fromDeg"])) if rim_cfg else None
    for side, sfx in ((1, "L"), (-1, "R")):
        nn = Vector((nrm.x * side, nrm.y, nrm.z)).normalized()
        if gaze is None:
            centre = Vector((loc.x * side, -f * 0.01, z * 0.01)) - nn * cfg["insetCm"] * 0.01
            axis = nn
        else:
            centre = Vector((loc.x * side, loc.y, loc.z)) - nn * cfg["insetCm"] * 0.01
            axis = Vector((gaze.x * side, gaze.y, gaze.z))
        right = axis.cross(Vector((0, 0, 1))).normalized() if slit else None
        rot = Vector((0, 0, 1)).rotation_difference(right if slit else axis).to_matrix().to_4x4()
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=useg, v_segments=vseg, radius=R, matrix=rot)
        name = f"{oid}_eye_{sfx}"
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(iris)
        me.materials.append(pupil)
        if rim:
            me.materials.append(rim)
        for p in me.polygons:
            p.use_smooth = True
            if slit:
                p.material_index = 1 if _in_slit(p.center.normalized(), axis, right, cfg["pupilDeg"]) else 0
            else:
                p.material_index = 1 if p.center.normalized().dot(axis) > cos_p else 0
            if rim and p.center.normalized().dot(axis) < cos_rim:
                p.material_index = 2
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.parent = parent
        ob.location = centre
        out["eye." + sfx] = (ob, centre.copy())
    return out


def _in_slit(d, axis, right, half_deg):
    """Vertical slit: horizontal angle within half_deg[0] and vertical angle within half_deg[1]
    (elliptic), measured from the gaze axis."""
    if d.dot(axis) <= 0:
        return False
    up = right.cross(axis)
    lat = math.degrees(math.asin(max(-1.0, min(1.0, d.dot(right)))))
    lon = math.degrees(math.atan2(d.dot(up), d.dot(axis)))
    return (lat / half_deg[0]) ** 2 + (lon / half_deg[1]) ** 2 < 1
