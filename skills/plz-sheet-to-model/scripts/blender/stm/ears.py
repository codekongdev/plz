"""Ears as separate thin shells (a voxel union would erase them).

An ear is a curved triangle: the base runs from the medial rim to the lateral rim and bulges
backwards by `cupCm` (the back of the ear), the rim runs straight to the tip while the cup depth
fades as (1 - v)^cupPower, and the shell has `thicknessCm` towards the opening, tapering to the tip. The base is extended `sinkCm`
into the head so no gap shows. Points are given for the left ear (x, f, z cm) and mirrored.
"""
import bmesh
import bpy
from mathutils import Vector

from .common import P


def _surface(cfg, side):
    def pt(key):
        x, f, z = cfg[key]
        return P(x * side, f, z)

    med, lat, tip = pt("medialBase"), pt("lateralBase"), pt("tip")
    cx, cf, cz = cfg.get("cupDir", [0, -1, 0])
    cup = P(cx * side, cf, cz).normalized() * cfg["cupCm"] * 0.01

    def rim(u):
        return med.lerp(lat, u)

    def bulge(u):
        return cup * (4 * u * (1 - u))

    return rim, bulge, tip, -cup.normalized()


def build_ears(oid, cfg, parent):
    """Return {"ear.L": (object, base point, tip point), "ear.R": ...}."""
    nu, nv = cfg.get("segments", [10, 10])
    sink, thick = cfg["sinkCm"] * 0.01, cfg["thicknessCm"] * 0.01
    out = {}
    for side, sfx in ((1, "L"), (-1, "R")):
        rim, bulge, tip, opening = _surface(cfg, side)
        power = cfg.get("cupPower", 1.0)
        # v runs from -sink (inside the head) through 0 (base) to 1 (tip); the tip is one shared vertex.
        # The rim runs straight to the tip; the cup depth fades as (1 - v)^cupPower (< 1 keeps the
        # back of the ear full higher up, the convex back edge seen from the side)
        b0 = [rim(i / nu) + bulge(i / nu) for i in range(nu + 1)]
        vs = [-1.0] + [j / nv for j in range(nv)]

        def S(i, v):
            if v < 0:
                b = b0[i]
                return b + (b - tip).normalized() * sink
            u = i / nu
            return rim(u).lerp(tip, v) + bulge(u) * (1 - v) ** power

        bm = bmesh.new()
        outer = [[bm.verts.new(S(i, v)) for i in range(nu + 1)] for v in vs]
        inner = [[bm.verts.new(S(i, v) + opening * thick * (1 - max(v, 0)) ** 0.7) for i in range(nu + 1)] for v in vs]
        t = bm.verts.new(tip)
        for a, b in zip(range(len(vs)), range(1, len(vs))):
            for i in range(nu):
                bm.faces.new((outer[a][i], outer[b][i], outer[b][i + 1], outer[a][i + 1]))
                bm.faces.new((inner[a][i], inner[a][i + 1], inner[b][i + 1], inner[b][i]))
            for i in (0, nu):                          # side rims
                bm.faces.new((outer[a][i], inner[a][i], inner[b][i], outer[b][i]))
        for i in range(nu):                            # to the tip
            bm.faces.new((outer[-1][i], t, outer[-1][i + 1]))
            bm.faces.new((inner[-1][i], inner[-1][i + 1], t))
        bm.faces.new((outer[-1][0], inner[-1][0], t))
        bm.faces.new((outer[-1][nu], t, inner[-1][nu]))
        for i in range(nu):                            # bottom rim, inside the head
            bm.faces.new((outer[0][i], outer[0][i + 1], inner[0][i + 1], inner[0][i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        name = f"{oid}_ear_{sfx}"
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.use_smooth = True
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.parent = parent
        # joints: base = centre of the sunk base row (inside the head), tip = on the ear's mid line
        # at tipJointT, halfway through the shell
        ear_base = sum((S(i, -1.0) for i in range(nu + 1)), Vector()) / (nu + 1) + opening * thick * 0.5
        tj = cfg.get("tipJointT", 0.85)
        ear_tip = rim(0.5).lerp(tip, tj) + bulge(0.5) * (1 - tj) ** power + opening * thick * 0.5 * (1 - tj) ** 0.7
        out["ear." + sfx] = (ob, ear_base, ear_tip)
    return out
