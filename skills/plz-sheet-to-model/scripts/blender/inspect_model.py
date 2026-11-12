"""Dump a model .blend for checks and comparisons (headless; rigged files are read in rest pose).

  blender -b <model.blend> -P inspect_model.py -- <dump dir> [--size 800] [--no-render]

Writes <dump dir>/stats.json (per mesh: verts, faces, exported tris, world bounds in cm; eye
centres; body extremes), <dump dir>/images/<name>.png (every packed or generated image of 256 px
or more) and Workbench renders render_<view>.png for left, front, top, back and three_quarter,
framed on the meshes' projected extent so two builds of the same subject frame identically.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

VIEWS = {"left": (-1, 0, 0), "front": (0, -1, 0), "top": (0, 0, 1), "back": (0, 1, 0),
         "three_quarter": (-0.8, -0.5, 0.35)}


def main(argv):
    out = os.path.abspath(argv[0])
    size = int(argv[argv.index("--size") + 1]) if "--size" in argv else 800
    os.makedirs(os.path.join(out, "images"), exist_ok=True)
    scene = bpy.context.scene
    for arm in bpy.data.armatures:          # rigged files: compare the bind shape, not a left-over pose
        arm.pose_position = 'REST'
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    meshes = [o for o in scene.objects if o.type == 'MESH' and o.visible_get()]
    stats, corners = {}, []
    for ob in meshes:
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        pts = [ob.matrix_world @ v.co for v in me.vertices]
        lo = [min(p[i] for p in pts) for i in range(3)]
        hi = [max(p[i] for p in pts) for i in range(3)]
        corners += [Vector((x, y, z)) for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]
        stats[ob.name] = {"verts": len(ob.data.vertices), "faces": len(ob.data.polygons),
                          "tris": sum(len(p.vertices) - 2 for p in me.polygons),
                          "boundsCm": [[round(a * 100, 4) for a in lo], [round(b * 100, 4) for b in hi]],
                          "location": [round(c, 6) for c in ob.matrix_world.translation],
                          "materials": [m.name if m else None for m in ob.data.materials]}
        if ob.name.endswith("_body"):
            stats[ob.name]["extremes"] = {
                "beak_tip": [round(c, 6) for c in min(pts, key=lambda p: p.y)],
                "tail_tip": [round(c, 6) for c in max(pts, key=lambda p: p.y)],
                "crown": [round(c, 6) for c in max(pts, key=lambda p: p.z)]}
        ev.to_mesh_clear()
    with open(os.path.join(out, "stats.json"), "w") as fh:
        json.dump(stats, fh, indent=1)

    for img in bpy.data.images:
        if img.source not in ('FILE', 'GENERATED') or min(img.size) < 256:
            continue
        _ = img.pixels[0]                    # packed images load lazily in background mode
        if img.has_data:                     # re-pointing the path is fine: the .blend is never saved
            img.filepath_raw = os.path.join(out, "images", img.name + ".png")
            img.file_format = 'PNG'
            img.save()

    if "--no-render" in argv:
        return
    scene.render.engine = 'BLENDER_WORKBENCH'
    sh = scene.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'TEXTURE'
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.film_transparent = False
    centre = Vector([(min(c[i] for c in corners) + max(c[i] for c in corners)) / 2 for i in range(3)])
    cam_data = bpy.data.cameras.new("inspect_cam")
    cam_data.type = 'ORTHO'
    cam = bpy.data.objects.new("inspect_cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    for name, d in VIEWS.items():
        d = Vector(d).normalized()
        rot = (-d).to_track_quat('-Z', 'Y')
        right, up = rot @ Vector((1, 0, 0)), rot @ Vector((0, 1, 0))
        ext = max(max(abs((c - centre).dot(right)) for c in corners), max(abs((c - centre).dot(up)) for c in corners))
        cam.rotation_mode = 'QUATERNION'
        cam.rotation_quaternion = rot
        cam.location = centre + d * 2.0
        cam_data.ortho_scale = ext * 2 * 1.06
        cam_data.clip_end = 10
        scene.render.filepath = os.path.join(out, f"render_{name}.png")
        bpy.ops.render.render(write_still=True)
    print("INSPECT_OK", out)


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1:])
