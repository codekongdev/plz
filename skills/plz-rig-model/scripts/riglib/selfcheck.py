"""Self-intersection count of a deformed mesh: pairs of faces that cross each other.

Faces that share a vertex touch by construction and are not counted. Each crossing face is
attributed to the vertex group with the largest summed weight over its vertices, so a count can
be read as "where": `upper_arm.L 12, chest 9` means skin around the left upper arm runs into
skin weighted to the chest.
"""
from collections import Counter

import bmesh
from mathutils.bvhtree import BVHTree


def _dominant_groups(ob):
    """Face index -> name of the vertex group with the largest summed weight on its vertices."""
    names = {g.index: g.name for g in ob.vertex_groups}
    vert_best = []
    for v in ob.data.vertices:
        best = max(v.groups, key=lambda g: g.weight, default=None)
        vert_best.append((names.get(best.group), best.weight) if best else (None, 0.0))
    out = []
    for poly in ob.data.polygons:
        acc = Counter()
        for vi in poly.vertices:
            name, w = vert_best[vi]
            if name:
                acc[name] += w
        out.append(acc.most_common(1)[0][0] if acc else "-")
    return out


def crossing_pairs(ob, depsgraph):
    """Set of (i, j) face index pairs that cross in the evaluated mesh of `ob`."""
    ev = ob.evaluated_get(depsgraph)
    me = ev.to_mesh()
    bm = bmesh.new()
    bm.from_mesh(me)
    ev.to_mesh_clear()
    bm.faces.ensure_lookup_table()
    tree = BVHTree.FromBMesh(bm)
    vsets = [frozenset(v.index for v in f.verts) for f in bm.faces]
    pairs = {(min(i, j), max(i, j)) for i, j in tree.overlap(tree) if i != j and not (vsets[i] & vsets[j])}
    bm.free()
    return pairs


def count_self_intersections(ob, depsgraph, groups=None, near=()):
    """(pairs, Counter of dominant groups over the crossing faces, pairs touching `near`) for the
    evaluated mesh of `ob`. `near` is a tuple of group-name prefixes; a pair counts when either face's
    dominant group starts with one of them."""
    ev = ob.evaluated_get(depsgraph)
    me = ev.to_mesh()
    bm = bmesh.new()
    bm.from_mesh(me)
    ev.to_mesh_clear()
    bm.faces.ensure_lookup_table()
    tree = BVHTree.FromBMesh(bm)
    vsets = [frozenset(v.index for v in f.verts) for f in bm.faces]
    pairs = {(min(i, j), max(i, j)) for i, j in tree.overlap(tree) if i != j and not (vsets[i] & vsets[j])}
    bm.free()
    where, n_near = Counter(), 0
    if groups is not None and len(groups) >= len(vsets):
        for i, j in pairs:
            where[groups[i]] += 1
            where[groups[j]] += 1
            if near and (groups[i].startswith(near) or groups[j].startswith(near)):
                n_near += 1
    return len(pairs), where, n_near


class SelfCheck:
    """Counts crossings on a fixed set of meshes; face->group attribution is computed once."""

    def __init__(self, meshes):
        self.meshes = [ob for ob in meshes if len(ob.data.polygons) > 0]
        self.groups = {ob.name: _dominant_groups(ob) for ob in self.meshes}
        self.baseline = {}

    def set_baseline(self, depsgraph):
        """Remember the crossings of the current pose (the bind pose): a model that comes with overlaps
        built in (hair cards on the scalp, layered clothes) is then judged by what each pose adds."""
        self.baseline = {ob.name: crossing_pairs(ob, depsgraph) for ob in self.meshes}

    def run(self, depsgraph, near=()):
        """{mesh: {"pairs", "where" (crossing faces per dominant group, largest first), "near"}}, plus
        "new" and "newWhere" (pairs absent from the baseline) once `set_baseline` has been called."""
        out = {}
        for ob in self.meshes:
            n, where, n_near = count_self_intersections(ob, depsgraph, self.groups[ob.name], near)
            out[ob.name] = {"pairs": n, "where": dict(where.most_common()), "near": n_near}
            if ob.name in self.baseline:
                fresh = crossing_pairs(ob, depsgraph) - self.baseline[ob.name]
                g = self.groups[ob.name]
                new_where = Counter()
                for i, j in fresh:
                    new_where[g[i]] += 1
                    new_where[g[j]] += 1
                out[ob.name]["new"] = len(fresh)
                out[ob.name]["newWhere"] = dict(new_where.most_common())
        return out
