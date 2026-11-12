"""Rig a mesh model from landmarks and a body-plan template (headless Blender).

blender -b --factory-startup -P rig_model.py -- \
    --model in.blend|in.glb --landmarks lm.json --template bird --out DIR [--name NAME] [--no-export]

Writes DIR/NAME.blend (images packed, test action kept), DIR/NAME.glb (deform bones, base-pose
animations only) and DIR/NAME.rig-report.json.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

from riglib.armature import add_ik, build_armature, required_points  # noqa: E402
from riglib.common import Landmarks, expand, load_template, log, script_args  # noqa: E402
from riglib.exporter import export_glb, save_blend  # noqa: E402
from riglib.poses import make_base_poses, make_test_action, reset  # noqa: E402
from riglib.weights import apply_weights  # noqa: E402


def load_model(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".blend":
        bpy.ops.wm.open_mainfile(filepath=path)
    elif ext in (".glb", ".gltf"):
        for ob in list(bpy.data.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.ops.import_scene.gltf(filepath=path)
    else:
        raise SystemExit(f"unsupported model format: {path}")


def strip_old_rig(lm, rig_name):
    """Allow re-rigging: drop an existing rig, armature modifiers and vertex groups on parts."""
    for role, name in lm.parts.items():
        ob = bpy.data.objects.get(name)
        if ob is None:
            continue
        for m in [m for m in ob.modifiers if m.type == 'ARMATURE']:
            ob.modifiers.remove(m)
        ob.vertex_groups.clear()
    old = bpy.data.objects.get(rig_name)
    if old:
        for c in list(old.children):
            mw = c.matrix_world.copy()
            c.parent = None
            c.matrix_world = mw
        bpy.data.objects.remove(old, do_unlink=True)


def check_inputs(template, lm):
    missing = lm.missing(required_points(template))
    roles = []
    for rule in template["weights"]:
        if not rule.get("optional"):
            roles.extend(expand([rule["part"]]))
    absent = [r for r in roles if r not in lm.parts or bpy.data.objects.get(lm.parts[r]) is None]
    if missing or absent:
        raise SystemExit(f"landmarks incomplete for template '{template['name']}': "
                         f"missing points {missing}, missing parts {absent}")


def report(rig, lm, out_path):
    parts = {}
    for role, name in lm.parts.items():
        ob = bpy.data.objects.get(name)
        if ob is None or ob.type != 'MESH':
            continue
        unweighted = sum(1 for v in ob.data.vertices if sum(g.weight for g in v.groups) < 1e-4)
        parts[role] = {"object": name, "verts": len(ob.data.vertices), "unweighted": unweighted,
                       "groups": [g.name for g in ob.vertex_groups],
                       "modifiers": [m.type for m in ob.modifiers]}
    data = {"rig": rig.name, "bones": [b.name for b in rig.data.bones],
            "deform": [b.name for b in rig.data.bones if b.use_deform],
            "actions": sorted(a.name for a in bpy.data.actions),
            "nla": [t.name for t in rig.animation_data.nla_tracks], "parts": parts}
    with open(out_path, "w") as fh:
        json.dump(data, fh, indent=1)
    bad = {k: v["unweighted"] for k, v in parts.items() if v["unweighted"]}
    log("report", out_path, "| deform bones", len(data["deform"]), "| unweighted verts", bad or "none")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--landmarks", required=True)
    ap.add_argument("--template", default="bird")
    ap.add_argument("--out", required=True)
    ap.add_argument("--name")
    ap.add_argument("--no-export", action="store_true")
    a = script_args(ap)
    template = load_template(a.template)
    lm = Landmarks(a.landmarks)
    name = a.name or f"{lm.id}_{lm.version}"
    rig_name = f"{lm.id}_rig"
    os.makedirs(a.out, exist_ok=True)

    load_model(os.path.abspath(a.model))
    strip_old_rig(lm, rig_name)
    check_inputs(template, lm)

    rig = build_armature(rig_name, template, lm)
    add_ik(rig, template)
    apply_weights(rig, template, lm)
    root = bpy.data.objects.get(f"{lm.id}_root")
    if root and root.type == 'EMPTY' and not root.children:
        bpy.data.objects.remove(root, do_unlink=True)
        log("removed empty", f"{lm.id}_root")

    test = make_test_action(rig, template)
    make_base_poses(rig, template)
    if test:
        test.use_fake_user = True
    bpy.context.scene.frame_set(1)

    if not a.no_export:
        export_glb(rig, os.path.join(a.out, name + ".glb"), template.get("export", {}))
        reset(rig)  # the exporter leaves the last exported animation in the pose; save in bind pose
        bpy.context.scene.frame_set(1)
    save_blend(os.path.join(a.out, name + ".blend"))
    report(rig, lm, os.path.join(a.out, name + ".rig-report.json"))
    log("RIG_OK", name)


if __name__ == "__main__":
    main()
