"""Bird wing parts: folded-wing shells and spread wings.

Folded shells: faces of the subdivided body inside the wing outline (side view, dilated) are copied,
pushed out along the surface normal, then cut exactly on the outline with geometry (edge splits at
the signed-distance zero crossing) so the shell can keep the opaque JPEG body texture. The shell
keeps the body UVs and uses the 'folded' bake, so the standing bird looks unchanged.

Spread wings: a cambered, tapered airfoil lofted along the span from the glide-view planform, in a
'spread frame' (x span, f forward in glide-view coordinates, zz up) that is shifted, pitched and
given dihedral to sit on the standing body's shoulder. UVs are the planar glide-view projection;
the feather gaps come from the texture alpha (glTF alphaMode MASK).
"""
import math

import bmesh
import bpy
from mathutils import Vector


# ---------------------------------------------------------------- outline geometry (f, z cm)
def outline_fz(poly_px, side_view):
    s = side_view
    return [((x - s["pivot"] - 0.5) / s["px"], (s["ground"] + 1 - y) / s["px"]) for x, y in poly_px]


def _inside(poly, f, z):
    c = False
    for (f1, z1), (f2, z2) in zip(poly, poly[1:] + poly[:1]):
        if (z1 > z) != (z2 > z) and f < f1 + (z - z1) * (f2 - f1) / (z2 - z1):
            c = not c
    return c


def _dist(poly, f, z):
    best = 1e9
    for (f1, z1), (f2, z2) in zip(poly, poly[1:] + poly[:1]):
        df, dz = f2 - f1, z2 - z1
        L2 = df * df + dz * dz
        t = max(0, min(1, ((f - f1) * df + (z - z1) * dz) / L2)) if L2 else 0
        best = min(best, math.hypot(f - (f1 + t * df), z - (z1 + t * dz)))
    return best


def signed_distance(poly, co):
    f, z = -co.y * 100, co.z * 100
    d = _dist(poly, f, z)
    return -d if _inside(poly, f, z) else d


# ---------------------------------------------------------------- folded shells
def build_fold_shells(oid, body, poly, dilate_cm, offset_cm, mat, parent):
    dg = bpy.context.evaluated_depsgraph_get()
    src = bpy.data.meshes.new_from_object(body.evaluated_get(dg))   # viewport subdivision level
    out = {}
    for side, sfx in ((1, "L"), (-1, "R")):
        name = f"{oid}_wing_fold_{sfx}"
        bm = bmesh.new()
        bm.from_mesh(src)
        bm.faces.ensure_lookup_table()
        keep = set()
        for f in bm.faces:
            c = f.calc_center_median()
            if c.x * side >= 0:
                fz = (-c.y * 100, c.z * 100)
                if _inside(poly, *fz) or _dist(poly, *fz) < dilate_cm:
                    keep.add(f.index)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context='FACES')
        for v in bm.verts:                       # normals are still the body's
            v.co += v.normal * offset_cm * 0.01
        _cut_on_outline(bm, poly)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.parent = parent
        for p in me.polygons:
            p.use_smooth = True
        me.materials.append(mat)
        out["wing_fold." + sfx] = ob
    bpy.data.meshes.remove(src)
    return out


def _cut_on_outline(bm, poly):
    """Split edges where the signed distance changes sign, connect the new vertices inside each
    face and delete the outside faces. bmesh.utils.edge_split interpolates the UVs."""
    s = {}
    for v in bm.verts:
        d = signed_distance(poly, v.co)
        s[v] = d if abs(d) > 1e-4 else 1e-4
    crossing = [e for e in bm.edges if s[e.verts[0]] * s[e.verts[1]] < 0]
    newv = set()
    for e in crossing:
        v0, v1 = e.verts
        t = s[v0] / (s[v0] - s[v1])
        _, nv = bmesh.utils.edge_split(e, v0, t)
        s[nv] = 0.0
        newv.add(nv)
    for f in list(bm.faces):
        vs = [v for v in f.verts if v in newv]
        if len(vs) == 2 and not any(e.other_vert(vs[0]) == vs[1] for e in vs[0].link_edges):
            bmesh.utils.face_split(f, vs[0], vs[1])
    outside = [f for f in bm.faces if sum(s[v] for v in f.verts) / len(f.verts) > 0]
    bmesh.ops.delete(bm, geom=outside, context='FACES')


# ---------------------------------------------------------------- spread wings
class SpreadFrame:
    """Glide-view coordinates (x span cm, f_img cm, zz cm up) -> standing-body coordinates."""

    def __init__(self, frame):
        self.shift = frame["shiftCm"]
        self.fs = frame["shoulderFCm"]
        self.zs = frame["shoulderZCm"]
        self.pitch = math.radians(frame["pitchDeg"])
        self.dihed = math.radians(frame["dihedralDeg"])
        self.root = frame["rootXCm"]

    def xfz(self, x, f_img, zz):
        f_rel = f_img + self.shift - self.fs
        zz = zz + (x - self.root) * math.tan(self.dihed)
        f = self.fs + f_rel * math.cos(self.pitch) - zz * math.sin(self.pitch)
        z = self.zs + zz * math.cos(self.pitch) + f_rel * math.sin(self.pitch)
        return x, f, z

    def world(self, x, f_img, zz, side):
        x, f, z = self.xfz(x, f_img, zz)
        return Vector((side * x * 0.01, -f * 0.01, z * 0.01))


def _thickness(table, x):
    for (x0, t0), (x1, t1) in zip(table, table[1:]):
        if x <= x1:
            return t0 + (t1 - t0) * (x - x0) / (x1 - x0)
    return table[-1][1]


def _chord_thickness(c):
    """Bird wing section: thick arm near the leading edge, thin feathers to the trailing edge."""
    return math.exp(-((c - 0.12) / 0.2) ** 2) * math.sqrt(max(1 - c, 0)) + 0.04 * (1 - c)


def build_spread_wings(oid, plan, cfg, spread_view, tail_f, mats, parent):
    fr = SpreadFrame(cfg["frame"])
    sp = spread_view
    k = sp["px"]
    M = cfg["chordSamples"]
    span_tip = cfg["tip"]["xCm"]
    cam = cfg["camber"]

    def uv_of(x, f_img, side):
        col = sp["centre"] + 0.5 - side * x * k
        row = sp["tailRow"] + 1 - (f_img - tail_f) * k
        return (col / sp["W"], 1 - row / sp["H"])

    cs = [(1 - math.cos(math.pi * i / (M - 1))) / 2 for i in range(M)]   # 0 = leading edge
    loop_c = list(reversed(cs)) + cs[1:-1]                                # upper te->le, lower le->te
    loop_up = [True] * M + [False] * (M - 2)
    out = {}
    for side, sfx in ((1, "L"), (-1, "R")):
        name = f"{oid}_wing_{sfx}"
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new("UVMap")
        rings, uvr = [], []
        for x, le, te in plan:
            chord = le - te
            T = _thickness(cfg["thickness"], x)
            A = cam["root"] - cam["tipDrop"] * min(x / span_tip, 1)
            ring, ringuv = [], []
            for c, up in zip(loop_c, loop_up):
                f_img = le - c * chord
                camber = A * chord * math.sin(math.pi * c) * (1 - 0.3 * c)
                t = T * _chord_thickness(c)
                zz = camber + (t / 2 if up else -t / 2)
                ring.append(bm.verts.new(fr.world(x, f_img, zz, side)))
                ringuv.append(uv_of(x, f_img, side))
            rings.append(ring)
            uvr.append(ringuv)
        n = len(loop_c)
        for i in range(len(rings) - 1):
            for j in range(n):
                j2 = (j + 1) % n
                vs = (rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j])
                ij = [(i, j), (i, j2), (i + 1, j2), (i + 1, j)]
                if side < 0:
                    vs = tuple(reversed(vs))
                    ij = list(reversed(ij))
                f = bm.faces.new(vs)
                for loop, (a, b) in zip(f.loops, ij):
                    loop[uvl].uv = uvr[a][b]
                f.material_index = 0 if (loop_up[j] and loop_up[j2]) else 1
        for i in (0, len(rings) - 1):
            vs = rings[i] if (i == 0) == (side > 0) else list(reversed(rings[i]))
            f = bm.faces.new(vs)
            for loop in f.loops:
                loop[uvl].uv = uvr[i][rings[i].index(loop.vert)]
            f.material_index = 1
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(mats["top"])
        me.materials.append(mats["under"])
        for p in me.polygons:
            p.use_smooth = True
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.parent = parent
        out["wing_spread." + sfx] = ob
    joints = {}
    for jn, (x, f_img, zz) in cfg["joints"].items():
        for side, sfx in ((1, "L"), (-1, "R")):
            joints[f"{jn}.{sfx}"] = fr.world(x, f_img, zz, side)
    return out, joints
