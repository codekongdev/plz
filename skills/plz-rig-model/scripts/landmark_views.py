"""For models without landmarks.json: render side/front/top orthographic views with a cm grid and
write a landmarks skeleton to fill in.

blender -b --factory-startup -P landmark_views.py -- --model in.blend|in.glb --out DIR \
        [--template bird] [--id NAME] [--px-per-cm 40]

Writes DIR/<view>.png, DIR/views.json (pixel -> cm formula per view) and DIR/landmarks.todo.json
(required point names = null, measured extremes filled, mesh objects with bounds for `parts`).
Grid: thin line every 1 cm, bold every 5 cm, bold lines labelled in cm.
side: front to the right, up = z. front: subject's left to the right, up = z.
top: seen from above, front up, subject's left on the image LEFT.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from bpy_extras.object_utils import world_to_camera_view  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from riglib.armature import required_points  # noqa: E402
from riglib.common import load_template, log, script_args  # noqa: E402

# name: (towards-camera direction, image up, horizontal, vertical); each axis is
# (world axis, sign, label, label sign): image coordinate = world[axis] * sign, label value = image coordinate * label sign
VIEWS = {
    "side": (Vector((-1, 0, 0)), Vector((0, 0, 1)), (1, -1, "f", 1), (2, 1, "z", 1)),
    "front": (Vector((0, -1, 0)), Vector((0, 0, 1)), (0, 1, "x", 1), (2, 1, "z", 1)),
    "top": (Vector((0, 0, 1)), Vector((0, -1, 0)), (0, -1, "x", -1), (1, -1, "f", 1)),
}


def basis(towards, up):
    """Rotation whose local Z points `towards` the camera and local Y is `up` (camera and labels)."""
    z = towards.normalized()
    x = up.cross(z).normalized()
    y = z.cross(x)
    return Matrix((x, y, z)).transposed().to_4x4()


def material(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    return m


def bar(a, b, width, normal, mat):
    d = (b - a).normalized()
    side = d.cross(normal).normalized() * width / 2
    me = bpy.data.meshes.new("lv_bar")
    me.from_pydata([a - side, b - side, b + side, a + side], [], [(0, 1, 2, 3)])
    me.materials.append(mat)
    ob = bpy.data.objects.new("lv_bar", me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def label(text, pos, rot, mat, size):
    cu = bpy.data.curves.new("lv_lbl", 'FONT')
    cu.body, cu.size, cu.align_x, cu.align_y = text, size, 'CENTER', 'CENTER'
    cu.materials.append(mat)
    ob = bpy.data.objects.new("lv_lbl", cu)
    bpy.context.scene.collection.objects.link(ob)
    ob.matrix_world = Matrix.Translation(pos) @ rot
    return ob


def bounds(meshes):
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for ob in meshes:
        ev = ob.evaluated_get(dg)
        pts.extend(ev.matrix_world @ Vector(c) for c in ev.bound_box)
    return (Vector([min(p[i] for p in pts) for i in range(3)]),
            Vector([max(p[i] for p in pts) for i in range(3)]))


def render_view(name, lo, hi, ppc, out):
    towards, up, (hi_ax, hs, hname, hl), (vi_ax, vs, vname, vl) = VIEWS[name]
    sc = bpy.context.scene
    m = 0.02
    hvals = sorted((lo[hi_ax] * hs, hi[hi_ax] * hs))
    vvals = sorted((lo[vi_ax] * vs, hi[vi_ax] * vs))
    h0, h1, v0, v1 = hvals[0] - m, hvals[1] + m, vvals[0] - m, vvals[1] + m
    sc.render.resolution_x = int(round((h1 - h0) * 100 * ppc))
    sc.render.resolution_y = int(round((v1 - v0) * 100 * ppc))
    depth = 3 - hi_ax - vi_ax
    back = (lo[depth] - 0.01) if towards[depth] > 0 else (hi[depth] + 0.01)

    def at(hv, vv, d=back):
        p = Vector((0.0, 0.0, 0.0))
        p[hi_ax], p[vi_ax], p[depth] = hv * hs, vv * vs, d
        return p

    cam = bpy.data.objects.get("lv_cam") or bpy.data.objects.new("lv_cam", bpy.data.cameras.new("lv_cam"))
    if cam.name not in sc.collection.objects:
        sc.collection.objects.link(cam)
    cam.data.type, cam.data.sensor_fit, cam.data.ortho_scale = 'ORTHO', 'HORIZONTAL', h1 - h0
    cam.data.clip_start, cam.data.clip_end = 0.001, 20
    rot = basis(towards, up)
    cam.matrix_world = Matrix.Translation(at((h0 + h1) / 2, (v0 + v1) / 2, 0) + towards * 5) @ rot
    sc.camera = cam
    thin, bold, ink = (material("lv_thin", (0.62, 0.66, 0.70)), material("lv_bold", (0.25, 0.30, 0.36)),
                       material("lv_ink", (0.05, 0.05, 0.05)))
    made = []
    for k in range(int(h0 * 100) - 1, int(h1 * 100) + 2):
        five = k % 5 == 0
        made.append(bar(at(k / 100, v0), at(k / 100, v1), 0.0008 if five else 0.0003, towards, bold if five else thin))
        if five:
            made.append(label(str(k * hl), at(k / 100, v1 - 0.008) + towards * 0.002, rot, ink, 0.007))
    for k in range(int(v0 * 100) - 1, int(v1 * 100) + 2):
        five = k % 5 == 0
        made.append(bar(at(h0, k / 100), at(h1, k / 100), 0.0008 if five else 0.0003, towards, bold if five else thin))
        if five:
            made.append(label(str(k * vl), at(h0 + 0.008, k / 100) + towards * 0.002, rot, ink, 0.007))
    bpy.context.view_layer.update()
    path = os.path.join(out, f"{name}.png")
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    o = world_to_camera_view(sc, cam, at(0, 0))
    u0, v0px = o.x * sc.render.resolution_x, (1 - o.y) * sc.render.resolution_y
    for ob in made:
        bpy.data.objects.remove(ob, do_unlink=True)
    hsig, vsig = ("" if hl > 0 else "-"), ("" if vl > 0 else "-")
    log("view", name, path, f"{sc.render.resolution_x}x{sc.render.resolution_y}")
    return {"image": path, "px_per_cm": ppc, "origin_px": [round(u0, 1), round(v0px, 1)],
            "formula": f"{hname} = {hsig}(u - {u0:.1f}) / {ppc}, {vname} = {vsig}({v0px:.1f} - v) / {ppc}  (cm)"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--template", default="bird")
    ap.add_argument("--id")
    ap.add_argument("--px-per-cm", type=float, default=40.0)
    a = script_args(ap)
    os.makedirs(a.out, exist_ok=True)
    path = os.path.abspath(a.model)
    if path.endswith(".blend"):
        bpy.ops.wm.open_mainfile(filepath=path)
    else:
        for ob in list(bpy.data.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.ops.import_scene.gltf(filepath=path)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light, sc.display.shading.color_type = 'STUDIO', 'TEXTURE'
    sc.render.resolution_percentage = 100
    sc.world = sc.world or bpy.data.worlds.new("lv_world")
    sc.world.color = (0.92, 0.93, 0.94)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH' and not o.hide_render]
    lo, hi = bounds(meshes)
    views = {v: render_view(v, lo, hi, a.px_per_cm, a.out) for v in VIEWS}

    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for ob in meshes:
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        pts.extend(ev.matrix_world @ v.co for v in me.vertices)
        ev.to_mesh_clear()
    measured = {"beak_tip": min(pts, key=lambda p: p.y), "tail_tip": max(pts, key=lambda p: p.y),
                "crown": max(pts, key=lambda p: p.z)}
    template = load_template(a.template)
    objects = {}
    for o in meshes:
        olo, ohi = bounds([o])
        objects[o.name] = {"min_cm_xfz": [round(olo.x * 100, 2), round(-ohi.y * 100, 2), round(olo.z * 100, 2)],
                           "max_cm_xfz": [round(ohi.x * 100, 2), round(-olo.y * 100, 2), round(ohi.z * 100, 2)]}
    todo = {"id": a.id or os.path.splitext(os.path.basename(path))[0], "version": "v001", "units": "m",
            "axes": {"up": "+Z", "forward": "-Y", "left": "+X"}, "bodyPlan": template.get("bodyPlan"),
            "points": {**{n: None for n in required_points(template)},
                       **{k: [round(c, 5) for c in v] for k, v in measured.items()}},
            "parts": {}, "regions": {}, "_mesh_objects": objects,
            "_how": "Fill points in metres (x, -f/100, z/100 from the cm read off the views), map template part "
                    "roles to object names in parts, delete keys starting with '_'. See references/conventions.md."}
    with open(os.path.join(a.out, "views.json"), "w") as fh:
        json.dump(views, fh, indent=1)
    with open(os.path.join(a.out, "landmarks.todo.json"), "w") as fh:
        json.dump(todo, fh, indent=1)
    log("LANDMARK_VIEWS_OK", a.out, "| points to fill:", sum(1 for v in todo["points"].values() if v is None))


if __name__ == "__main__":
    main()
