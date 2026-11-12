"""glTF export, .blend save, landmarks.json and report.json."""
import json
import os

import bpy
from mathutils import Vector


def descendants(ob):
    out = [ob]
    for c in ob.children:
        out += descendants(c)
    return out


def evaluated_stats(objs):
    """World bounds (cm) and triangle count of each mesh as exported (modifiers applied)."""
    dg = bpy.context.evaluated_depsgraph_get()
    stats = {}
    for ob in objs:
        if ob.type != 'MESH':
            continue
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        lo, hi = [1e9] * 3, [-1e9] * 3
        for v in me.vertices:
            w = ob.matrix_world @ v.co
            for i in range(3):
                lo[i] = min(lo[i], w[i])
                hi[i] = max(hi[i], w[i])
        stats[ob.name] = {"tris": sum(len(p.vertices) - 2 for p in me.polygons),
                          "verts": len(ob.data.vertices), "faces": len(ob.data.polygons),
                          "boundsCm": [[round(a * 100, 3) for a in lo], [round(b * 100, 3) for b in hi]]}
        ev.to_mesh_clear()
    return stats


def body_extremes(body):
    """beak_tip / tail_tip / crown measured on the exported (subdivided) body surface."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    me = ev.to_mesh()
    pts = [body.matrix_world @ v.co for v in me.vertices]
    ev.to_mesh_clear()
    return {"beak_tip": min(pts, key=lambda p: p.y), "tail_tip": max(pts, key=lambda p: p.y),
            "crown": max(pts, key=lambda p: p.z)}


def export_glb(root, path, cfg):
    for ob in bpy.context.scene.objects:
        ob.select_set(False)
    for ob in descendants(root):
        ob.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_image_format='JPEG', export_jpeg_quality=cfg["jpegQuality"],
                              export_cameras=False, export_lights=False, export_animations=False)


def save_blend(path):
    for img in bpy.data.images:
        if img.source in ('FILE', 'GENERATED') and img.has_data and not img.packed_file:
            img.pack()
    bpy.context.preferences.filepaths.save_version = 0      # no .blend1 backups next to the outputs
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)


def write_json(path, data):
    with open(path, "w") as fh:
        json.dump(data, fh, indent=1, ensure_ascii=False)


def landmarks(spec, points, parts, regions):
    return {"id": spec["id"], "version": spec["version"], "units": "m",
            "axes": {"up": "+Z", "forward": "-Y", "left": "+X"}, "bodyPlan": spec.get("bodyPlan", "generic"),
            "points": {k: [round(c, 6) for c in v] for k, v in sorted(points.items())},
            "parts": parts, "regions": regions}


# Labels that mark an eye landmark in the sheet's measurements.json ("\ub208" is the Korean word for eye,
# kept as an escape so sheets that use Korean labels still match).
EYE_LABELS = ("\ub208", "eye", "Eye")


def report(spec, meas_sheet, stats, body_name, eye_centre, files, span_cm=None, dims_from=None):
    """Dimensions come from the body mesh, or from the union of `dims_from` meshes (e.g. body + ears
    when the ears set the height)."""
    names = dims_from or [body_name]
    b = [[min(stats[n]["boundsCm"][0][i] for n in names) for i in range(3)],
         [max(stats[n]["boundsCm"][1][i] for n in names) for i in range(3)]]
    length, height, width = b[1][1] - b[0][1], b[1][2], b[1][0] - b[0][0]
    rep = {"id": spec["id"], "version": spec["version"],
           "bodyCm": {"length": round(length, 2), "height": round(height, 2), "width": round(width, 2)},
           "objects": stats, "trisTotal": sum(s["tris"] for s in stats.values()),
           "files": {k: os.path.getsize(v) for k, v in files.items()}}
    if eye_centre is not None:
        rep["eyeCm"] = {"height": round(eye_centre.z * 100, 2), "lateral": round(eye_centre.x * 100, 2),
                        "forward": round(-eye_centre.y * 100, 2)}
    # comparison with the sheet's measurements.json
    vc = meas_sheet["views_cm"]
    cmp = [("length", length, meas_sheet["base_cm"]["length"]), ("height", height, meas_sheet["base_cm"]["height"]),
           ("width vs front", width, vc["front"]["width"]), ("width vs back", width, vc["back"]["width"]),
           ("width vs top", width, vc["top"]["height"])]
    if eye_centre is not None:
        for lm in meas_sheet.get("landmarks_cm", []):
            if lm.get("label") not in EYE_LABELS:
                continue
            cmp.append((f"eye height vs {lm['view']}", eye_centre.z * 100, lm["cm"]))
    if span_cm is not None and "spread" in vc:
        cmp.append(("wing span vs spread", span_cm, vc["spread"]["width"]))
    rep["vsSheet"] = [{"item": n, "model": round(a, 2), "sheet": round(s, 2), "diffPct": round((a - s) / s * 100, 1)}
                      for n, a, s in cmp]
    return rep


def _hits(bvh, origin, direction):
    """Number of surface crossings along a ray (parity tells inside/outside of a closed mesh)."""
    n, o = 0, origin.copy()
    while True:
        loc, _, _, _ = bvh.ray_cast(o, direction)
        if loc is None:
            return n
        n += 1
        o = loc + direction * 1e-5


def inside_check(points, owners):
    """For each point name in `owners` (name -> closed mesh object): is the point inside that mesh
    (majority of three ray parities) and how deep below the surface (cm). Joints must sit inside the
    volume, not on the skin. Objects must be at identity transform (parts of <id>_root)."""
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    trees = {}
    dirs = [Vector(d).normalized() for d in ((0.31, 0.53, 0.79), (-0.67, 0.21, -0.71), (0.12, -0.93, 0.35))]
    out = {}
    for name in sorted(owners):
        ob = owners[name]
        if ob.name not in trees:
            trees[ob.name] = BVHTree.FromObject(ob, dg)
        bvh = trees[ob.name]
        p = points[name]
        votes = sum(_hits(bvh, p, d) % 2 for d in dirs)
        _, _, _, dist = bvh.find_nearest(p)
        out[name] = {"inside": votes >= 2, "depthCm": round(dist * 100, 2), "mesh": ob.name}
    return out
