"""Single-axis loft: one closed mesh from cross-sections along the body axis.

Each station (f, zTop, zBottom, halfWidth) comes from the side silhouette (top/bottom) and the
top silhouette (half width). The ring is a superellipse, softly clamped by the front silhouette's
half width at that height (or the widest of `clampViews`), so the views agree. `frontClamp: false`
turns the clamp off; `upperTaper` narrows the upper part of the sections in an f range (a face in
front of the eyes). Suits bodies that read as one tube along the length (birds, fish, rodents);
quadrupeds add their legs as separate primitives and merge them (limbs.py, sdf_union.py).
"""
import math

import bmesh
import bpy
from mathutils import Vector

from .common import P


def _S(t, n):
    return math.copysign(abs(t) ** (2.0 / n), t)


def _smin(a, b, k):
    m = min(a, b)
    return m - k * math.log(math.exp(-(a - m) / k) + math.exp(-(b - m) / k))


def _front_hw(table, z):
    if z <= table[0][0]:
        return 99.0
    if z >= table[-1][0]:
        return table[-1][1]
    for (z0, w0), (z1, w1) in zip(table, table[1:]):
        if z0 <= z <= z1:
            return w0 + (w1 - w0) * (z - z0) / (z1 - z0)


def _interp(table, x):
    if x <= table[0][0]:
        return table[0][1]
    for (x0, y0), (x1, y1) in zip(table, table[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return table[-1][1]


def _taper(cfg, f, t):
    """Width factor for the upper part of a section: 1 - amount(f) * smoothstep(fromT, 1, t), where
    t is the relative height in the section (-1 bottom, 1 top). Narrows a nose bridge or face in
    front of the eyes, which no silhouette shows (the wide whisker pads below hide it)."""
    a = _interp(cfg["table"], f)
    if a <= 0:
        return 1.0
    t0 = cfg.get("fromT", -0.2)
    u = max(0.0, min(1.0, (t - t0) / (1 - t0)))
    return max(1 - a * u * u * (3 - 2 * u), cfg.get("min", 0.05))


def build_body(name, prof, front, loft, parent):
    N = loft["rings"]
    tip = loft["tipExponent"]
    k = loft.get("frontClampSoftCm")
    clamp = loft.get("frontClamp", True)
    taper = loft.get("upperTaper")
    bm = bmesh.new()
    rings = []
    for f, zt, zb, hw in prof:
        zc, hh = (zt + zb) / 2, max((zt - zb) / 2, 0.02)
        n = tip["n"] if f > tip["fromCm"] else loft["exponent"]
        ring = []
        for j in range(N):
            th = 2 * math.pi * j / N
            z = zc + hh * _S(math.sin(th), n)
            lat = hw * _S(math.cos(th), n)
            if taper:
                lat *= _taper(taper, f, _S(math.sin(th), n))
            w = _smin(abs(lat), _front_hw(front, z), k) if clamp else abs(lat)
            ring.append(bm.verts.new(P(math.copysign(w, lat), f, z)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for j in range(N):
            bm.faces.new((a[j], a[(j + 1) % N], b[(j + 1) % N], b[j]))
    cap = loft["capOffsetCm"]
    f0, zt0, zb0, _ = prof[0]
    back = bm.verts.new(P(0, f0 - cap["back"], (zt0 + zb0) / 2))
    f1, zt1, zb1, _ = prof[-1]
    front_v = bm.verts.new(P(0, f1 + cap["front"], (zt1 + zb1) / 2))
    for j in range(N):
        bm.faces.new((rings[0][(j + 1) % N], rings[0][j], back))
        bm.faces.new((rings[-1][j], rings[-1][(j + 1) % N], front_v))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = parent
    for p in me.polygons:
        p.use_smooth = True
    sub = ob.modifiers.new("Subdivision", 'SUBSURF')
    sub.levels = loft["subdiv"]
    sub.render_levels = loft["subdiv"]
    _uv(me, N, loft["uvSeamIndex"], loft["uvPad"])
    return ob


def _uv(me, N, seam, pad):
    """One island: u around the ring (seam on ring index `seam`, the belly line), v by arc length
    of the ring centroids, so texel density follows the body and the head gets plenty."""
    nr = (len(me.vertices) - 2) // N
    cent = []
    for i in range(nr):
        c = Vector()
        for j in range(N):
            c += me.vertices[i * N + j].co
        cent.append(c / N)
    acc = [0.0]
    for a, b in zip(cent, cent[1:]):
        acc.append(acc[-1] + (b - a).length)
    L = acc[-1]
    vring = [pad + (1 - 2 * pad) * a / L for a in acc]

    def vu(vi):
        if vi >= nr * N:
            return None
        i, j = divmod(vi, N)
        return ((j - seam) % N) / N, vring[i]

    uvl = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    for p in me.polygons:
        vals = [vu(me.loops[li].vertex_index) for li in p.loop_indices]
        us = [v[0] for v in vals if v]
        fix = max(us) - min(us) > 0.5
        out = []
        for v in vals:
            if v is None:
                out.append(None)
                continue
            out.append((v[0] + (1.0 if fix and v[0] < 0.5 else 0.0), v[1]))
        real = [o for o in out if o]
        for li, o in zip(p.loop_indices, out):
            if o is None:
                vi = me.loops[li].vertex_index
                o = (sum(r[0] for r in real) / len(real), pad * 0.5 if vi == nr * N else 1.0 - pad * 0.5)
            uvl.data[li].uv = (0.002 + 0.996 * o[0], o[1])
