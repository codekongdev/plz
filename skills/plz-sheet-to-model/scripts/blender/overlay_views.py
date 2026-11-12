"""Overlay the model's silhouettes on the sheet views, pixel for pixel (headless Blender).

  blender -b <model.blend> -P overlay_views.py -- <model spec.json> <work dir> <out dir> [views...]

Renders each view (default side, front, back, top) with an orthographic camera on the view's own
pixel grid, using the same mapping as the projection texture (measure.json), and writes
<out>/overlay_<view>.png: sheet image dimmed where both agree, red where only the model is, blue
where only the sheet is. Prints and writes <out>/overlay.json with IoU and the two error areas
(cm^2). Use it to place legs, ears and other hand-set parts.
"""
import json
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector


def _camera(view, v, beak_f):
    k, W, H = v["px"], v["W"], v["H"]
    if view == "side":
        f_c, z_c = (W / 2 - v["pivot"] - 0.5) / k, (v["ground"] + 1 - H / 2) / k
        return Vector((-1, -f_c / 100, z_c / 100)), Vector((1, 0, 0)), Vector((0, 0, 1))
    if view in ("front", "back"):
        x_c, z_c = (W / 2 - v["centre"] - 0.5) / k, (v["ground"] + 1 - H / 2) / k
        if view == "front":
            return Vector((x_c / 100, -1, z_c / 100)), Vector((0, 1, 0)), Vector((0, 0, 1))
        return Vector((-x_c / 100, 1, z_c / 100)), Vector((0, -1, 0)), Vector((0, 0, 1))
    if view == "top":
        f_c, x_c = (W / 2 - v["beakCol"] - 1) / k + beak_f, (v["centreRow"] + 0.5 - H / 2) / k
        return Vector((x_c / 100, -f_c / 100, 1)), Vector((0, 0, -1)), Vector((1, 0, 0))
    raise SystemExit(f"no overlay mapping for view '{view}'")


def _pixels(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(h, w, 4)[::-1]


def _save(rgb, path):
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=False)
    rgba = np.dstack([rgb, np.ones((h, w), np.float32)])[::-1]
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def main(argv):
    spec_path, work, out = (os.path.abspath(a) for a in argv[:3])
    views = argv[3:] or ["side", "front", "back", "top"]
    os.makedirs(out, exist_ok=True)
    spec = json.load(open(spec_path))
    meas = json.load(open(os.path.join(work, "measure.json")))
    sheet = meas["sheet"]
    scene = bpy.context.scene
    for arm in bpy.data.armatures:
        arm.pose_position = 'REST'
    scene.render.engine = 'BLENDER_WORKBENCH'
    sh = scene.display.shading
    sh.light, sh.color_type, sh.single_color = 'FLAT', 'SINGLE', (1, 1, 1)
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'Standard'
    cam_data = bpy.data.cameras.new("overlay_cam")
    cam_data.type = 'ORTHO'
    cam_data.clip_end = 10
    cam = bpy.data.objects.new("overlay_cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    result = {}
    for view in views:
        v = meas["views"][view]
        loc, d, up = _camera(view, v, meas["beakF"])
        right = d.cross(up)
        cam.matrix_world = Matrix.Translation(loc) @ Matrix((right, up, -d)).transposed().to_4x4()
        cam_data.ortho_scale = max(v["W"], v["H"]) / v["px"] / 100
        scene.render.resolution_x, scene.render.resolution_y = v["W"], v["H"]
        sil_path = os.path.join(out, f"silhouette_{view}.png")
        scene.render.filepath = sil_path
        bpy.ops.render.render(write_still=True)
        model = _pixels(sil_path)[..., 3] > 0.5
        ref = _pixels(os.path.join(sheet, spec["views"][view]))
        sheet_m = ref[..., 3] > 0.5
        rgb = 0.35 + 0.4 * ref[..., :3] * sheet_m[..., None]
        rgb[model & ~sheet_m] = (0.9, 0.1, 0.1)
        rgb[sheet_m & ~model] = (0.1, 0.3, 0.95)
        _save(rgb.astype(np.float32), os.path.join(out, f"overlay_{view}.png"))
        cm2 = 1 / v["px"] ** 2
        result[view] = {"iou": round(float((model & sheet_m).sum() / max((model | sheet_m).sum(), 1)), 4),
                        "modelOnlyCm2": round(float((model & ~sheet_m).sum() * cm2), 1),
                        "sheetOnlyCm2": round(float((sheet_m & ~model).sum() * cm2), 1)}
        print("OVERLAY", view, result[view])
    with open(os.path.join(out, "overlay.json"), "w") as fh:
        json.dump(result, fh, indent=1)


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1:])
