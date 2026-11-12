"""Quadruped limbs as closed primitives: tapered capsules along each joint chain and paw ellipsoids.

Each chain lists skeleton points with elliptical radii [lateral, in-plane] in cm (lateral along X,
in-plane perpendicular to the segment inside its vertical plane), given for the left side and
mirrored. Every segment becomes its own closed capsule and every paw its own ellipsoid, so the SDF
union (sdf_union.py) can merge them with the body loft into one surface.
"""
import math

import bmesh
import bpy
from mathutils import Vector

from .common import P


def _frame(t):
    """Lateral and in-plane unit axes for a segment direction t (lateral stays close to +X)."""
    lx = Vector((1, 0, 0)) - t * t.x
    if lx.length < 1e-6:
        lx = Vector((0, 0, 1)) - t * t.z
    lx.normalize()
    return lx, t.cross(lx).normalized()


def _ring(bm, c, lx, lp, rx, rp, n):
    return [bm.verts.new(c + lx * (rx * math.cos(2 * math.pi * j / n)) + lp * (rp * math.sin(2 * math.pi * j / n)))
            for j in range(n)]


def capsule(name, a, b, ra, rb, n, cap, along):
    """Closed mesh: elliptical cone from a (radii ra) to b (radii rb) with half-ellipsoid end caps."""
    t = (b - a).normalized()
    lx, lp = _frame(t)
    bm = bmesh.new()
    rings = []
    # cap at a (pointing away from b), then the cone, then the cap at b
    for i in range(cap, 0, -1):
        phi = math.pi / 2 * i / (cap + 1)
        depth = min(ra) * math.sin(phi)
        rings.append(_ring(bm, a - t * depth, lx, lp, ra[0] * math.cos(phi), ra[1] * math.cos(phi), n))
    for i in range(along + 1):
        s = i / along
        r = [ra[k] + (rb[k] - ra[k]) * s for k in (0, 1)]
        rings.append(_ring(bm, a.lerp(b, s), lx, lp, r[0], r[1], n))
    for i in range(1, cap + 1):
        phi = math.pi / 2 * i / (cap + 1)
        depth = min(rb) * math.sin(phi)
        rings.append(_ring(bm, b + t * depth, lx, lp, rb[0] * math.cos(phi), rb[1] * math.cos(phi), n))
    for r0, r1 in zip(rings, rings[1:]):
        for j in range(n):
            bm.faces.new((r0[j], r0[(j + 1) % n], r1[(j + 1) % n], r1[j]))
    pa = bm.verts.new(a - t * min(ra))
    pb = bm.verts.new(b + t * min(rb))
    for j in range(n):
        bm.faces.new((rings[0][(j + 1) % n], rings[0][j], pa))
        bm.faces.new((rings[-1][j], rings[-1][(j + 1) % n], pb))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(name, bm)


def ellipsoid(name, centre, radii, segments):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments[0], v_segments=segments[1], radius=1.0)
    for v in bm.verts:
        v.co = centre + Vector((v.co.x * radii[0], v.co.y * radii[1], v.co.z * radii[2]))
    return _object(name, bm)


def _object(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def _r(r):
    return (r * 0.01, r * 0.01) if isinstance(r, (int, float)) else (r[0] * 0.01, r[1] * 0.01)


def build_limbs(oid, cfg, skeleton):
    """Limb primitives for both sides as temporary objects, one list per chain and side (a paw joins
    the list of its `chain`)."""
    n, cap, along = cfg.get("ringVerts", 16), cfg.get("capRings", 4), cfg.get("alongRings", 4)
    groups = []
    for side, sfx in ((1, "L"), (-1, "R")):
        for chain in cfg["chains"]:
            pts = []
            for name, r in chain["points"]:
                x, f, z = skeleton[name + ".L"]
                pts.append((P(x * side, f, z), _r(r)))
            group = [capsule(f"{oid}_tmp_{chain['name']}{i}_{sfx}", a, b, ra, rb, n, cap, along)
                     for i, ((a, ra), (b, rb)) in enumerate(zip(pts, pts[1:]))]
            for i, paw in enumerate(cfg.get("paws", [])):
                if paw["chain"] != chain["name"]:
                    continue
                x, f, z = paw["centre"]
                group.append(ellipsoid(f"{oid}_tmp_{chain['name']}_paw{i}_{sfx}", P(x * side, f, z),
                                       [r * 0.01 for r in paw["radiiCm"]], cfg.get("pawSegments", [24, 12])))
            groups.append(group)
    return groups
