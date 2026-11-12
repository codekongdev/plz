"""Render a rigged model's rest, base poses and test poses to PNGs (headless Workbench, texture colour).

blender -b --factory-startup -P render_poses.py -- --blend X.blend --out DIR [--prefix NAME]
        [--view 0.85,-0.45,0.3] [--res 800x600] [--poses rest,pose_ground,pose_flight,rig_test]
        [--intersections]
Round trip of an exported file (re-import into an empty scene, list skins/actions, render):
blender -b --factory-startup -P render_poses.py -- --glb X.glb --out DIR [--prefix NAME]

--poses defaults to rest, the base poses (NLA tracks, in order) and rig_test; on a --glb, every action.
--view is the direction from the model towards the camera (Blender axes; -Y is the model's front).
--intersections counts each skinned mesh's self-crossing face pairs in every pose (line `INTERSECT`,
and DIR/PREFIX_intersections.json), attributed to the dominant vertex group of each crossing face.
The rest pose is the baseline: "new" counts only the pairs a pose adds, which is the number to read
for a model that comes with crossings built in (hair cards, layered clothes). --mark also renders
PREFIX_<pose>_cross.png with the faces of the new pairs in red.
Each pose is framed on its own deformed bounds, so two models rendered with the same arguments
are directly comparable.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from riglib.common import log, script_args  # noqa: E402
from riglib.selfcheck import SelfCheck, crossing_pairs  # noqa: E402


def setup_render(res):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'TEXTURE'
    w, h = (int(v) for v in res.split("x"))
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = w, h, 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    if sc.world is None:
        sc.world = bpy.data.worlds.new("rm_world")
    sc.world.color = (0.22, 0.22, 0.22)
    cam = bpy.data.objects.get("rm_cam") or bpy.data.objects.new("rm_cam", bpy.data.cameras.new("rm_cam"))
    if cam.name not in sc.collection.objects:
        sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.clip_start, cam.data.clip_end = 0.001, 20.0
    sc.camera = cam
    return cam


def frame_camera(cam, meshes, view):
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for ob in meshes:
        ev = ob.evaluated_get(dg)
        pts.extend(ev.matrix_world @ Vector(c) for c in ev.bound_box)
    centre = sum(pts, Vector()) / len(pts)
    d = Vector(view).normalized()
    radius = max((p - centre).length for p in pts)
    cam.location = centre + d * (radius * 4 + 0.5)
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    loc = [inv @ p for p in pts]
    xs, ys = [p.x for p in loc], [p.y for p in loc]
    shift = cam.matrix_world.to_3x3() @ Vector(((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, 0))
    cam.location += shift
    sc = bpy.context.scene
    aspect = sc.render.resolution_x / sc.render.resolution_y
    cam.data.ortho_scale = max(max(xs) - min(xs), (max(ys) - min(ys)) * aspect) * 1.12


def use_action(rig, act, frame):
    ad = rig.animation_data or rig.animation_data_create()
    for t in ad.nla_tracks:
        t.mute = True
    ad.action = act
    if act is not None and hasattr(ad, "action_slot") and ad.action_slot is None and len(act.slots):
        ad.action_slot = act.slots[0]
    if act is None:  # bind pose: the stored pose may hold whatever was evaluated last (e.g. by an export)
        for pb in rig.pose.bones:
            pb.location, pb.scale = (0, 0, 0), (1, 1, 1)
            pb.rotation_quaternion, pb.rotation_euler = (1, 0, 0, 0), (0, 0, 0)
    bpy.context.scene.frame_set(frame)


def pose_list(spec, rig, from_glb):
    """`auto`: rest, base poses in NLA order (every action on a glb), then rig_test if present."""
    if spec != "auto":
        return [p.strip() for p in spec.split(",") if p.strip()]
    if from_glb:
        return ["rest"] + sorted(a.name for a in bpy.data.actions)
    ad = rig.animation_data
    base = [t.strips[0].action.name for t in ad.nla_tracks if t.strips and t.strips[0].action] if ad else []
    return ["rest"] + base + (["rig_test"] if bpy.data.actions.get("rig_test") else [])


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    log("rendered", path)


def mark_render(meshes, check, depsgraph, path):
    """The same picture with the faces of crossing pairs in red (new ones against the rest pose when a
    baseline is set): tells a skin-on-skin contact line from a face that broke through."""
    red = bpy.data.materials.get("rm_cross") or bpy.data.materials.new("rm_cross")
    red.diffuse_color = (0.9, 0.05, 0.05, 1.0)
    saved = []
    for ob in meshes:
        pairs = crossing_pairs(ob, depsgraph)
        pairs -= check.baseline.get(ob.name, set())
        faces = {i for p in pairs for i in p}
        if not faces:
            continue
        me = ob.data
        me.materials.append(red)
        slot = len(me.materials) - 1
        old = [0] * len(me.polygons)
        me.polygons.foreach_get("material_index", old)
        saved.append((ob, slot, old))
        new = [slot if i in faces else m for i, m in enumerate(old)]
        me.polygons.foreach_set("material_index", new)
        me.update()
    if not saved:
        return
    render(path)
    for ob, slot, old in saved:
        ob.data.polygons.foreach_set("material_index", old)
        ob.data.materials.pop(index=slot)
        ob.data.update()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--blend")
    ap.add_argument("--glb")
    ap.add_argument("--out", required=True)
    ap.add_argument("--prefix", default="pose")
    ap.add_argument("--view", default="0.85,-0.45,0.3")
    ap.add_argument("--res", default="800x600")
    ap.add_argument("--poses", default="auto")
    ap.add_argument("--intersections", action="store_true")
    ap.add_argument("--mark", action="store_true")
    a = script_args(ap)
    a.intersections = a.intersections or a.mark
    os.makedirs(a.out, exist_ok=True)
    if a.blend:
        bpy.ops.wm.open_mainfile(filepath=os.path.abspath(a.blend))
    elif a.glb:
        for ob in list(bpy.data.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.ops.import_scene.gltf(filepath=os.path.abspath(a.glb))
    else:
        raise SystemExit("give --blend or --glb")
    rig = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    if rig is None:
        raise SystemExit("no armature found")
    meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.parent == rig]
    skinned = [o.name for o in meshes if any(m.type == 'ARMATURE' and m.object == rig for m in o.modifiers)]
    log("ROUNDTRIP" if a.glb else "MODEL", "armature", rig.name, len(rig.data.bones), "bones |",
        len(skinned), "skinned meshes |", "actions", sorted(x.name for x in bpy.data.actions))
    for ob in bpy.data.objects:  # importer bone shapes etc. stay out of the picture
        if ob.type == 'MESH' and ob not in meshes:
            ob.hide_render = True
    cam = setup_render(a.res)
    view = [float(v) for v in a.view.split(",")]
    check = SelfCheck(meshes) if a.intersections else None
    counts = {}
    for pose in pose_list(a.poses, rig, bool(a.glb)):
        if pose == "rest":
            jobs = [(None, 1, "rest")]
        else:
            act = bpy.data.actions.get(pose)
            if act is None:
                log("no action", pose, "- skipped")
                continue
            first, last = (int(round(v)) for v in act.frame_range)
            marks = {m.frame: m.name.replace(" ", "_") for m in getattr(act, "pose_markers", [])}
            jobs = [(act, f, pose if first == last else f"{pose}_{f}" + (f"_{marks[f]}" if f in marks else ""))
                    for f in range(first, last + 1)]
        for act, frame, label in jobs:
            use_action(rig, act, frame)
            frame_camera(cam, meshes, view)
            render(os.path.join(a.out, f"{a.prefix}_{label}.png"))
            if check:
                dg = bpy.context.evaluated_depsgraph_get()
                if label == "rest":
                    check.set_baseline(dg)
                counts[label] = check.run(dg)
                for name, c in counts[label].items():
                    extra = ["| new vs rest", c["new"], dict(list(c["newWhere"].items())[:6])] if "new" in c else []
                    log("INTERSECT", label, name, c["pairs"], "pairs", dict(list(c["where"].items())[:8]), *extra)
                if a.mark and label != "rest":
                    mark_render(meshes, check, dg, os.path.join(a.out, f"{a.prefix}_{label}_cross.png"))
    if check:
        path = os.path.join(a.out, f"{a.prefix}_intersections.json")
        with open(path, "w") as fh:
            json.dump(counts, fh, indent=1)
        log("intersections", path)


if __name__ == "__main__":
    main()
