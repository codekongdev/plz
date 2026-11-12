"""Sweep bone rotations and count self-crossing face pairs, to find how far a joint can bend cleanly.

blender -b --factory-startup -P sweep_limits.py -- --blend X.blend --out sweep.json \
    --vary "upper_arm.*:X:-80:40:10" [--vary "forearm.*:X:0,30,60,90"] [--hold "spine:X:5"] \
    [--mesh cat_body] [--near upper_arm,forearm,chest]

--vary BONE:AXIS:VALUES  VALUES is FROM:TO:STEP or a comma list (degrees, pose-bone local Euler axis
                         X, Y or Z). Two --vary give a grid. `.*` means both sides (same angle).
--hold BONE:AXIS:DEG     a fixed rotation applied in every sample.
--near a,b,...           also count only pairs where a crossing face's dominant vertex group starts
                         with one of these names (the joint's neighbourhood); default all pairs.
--base ACTION            start every sample from that action's first frame (e.g. pose_stand, whose
                         arms differ from an A-pose bind) and add the angles on top as an engine does
                         (base * local rotation). Without it the samples start from the bind pose.
IK and copy-rotation constraints are switched off so the angles are pure FK, like an engine.
The bind pose's own crossings are the baseline: `new` counts the pairs a sample adds (the number to
read for a model with crossings built in, such as hair cards or layered clothes).
Prints one `SWEEP` line per sample and writes the table to --out.
"""
import argparse
import itertools
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

from riglib.common import expand, log, script_args  # noqa: E402
from riglib.selfcheck import SelfCheck  # noqa: E402

AXES = {"X": 0, "Y": 1, "Z": 2}


def parse_values(text):
    if ":" in text:
        lo, hi, step = (float(v) for v in text.split(":"))
        if step <= 0:
            raise SystemExit(f"step must be positive: {text}")
        n = int(math.floor((hi - lo) / step + 1e-9)) + 1
        return [lo + i * step for i in range(n)]
    return [float(v) for v in text.split(",")]


def parse_spec(text, many):
    parts = text.split(":", 2)
    if len(parts) != 3 or parts[1] not in AXES:
        raise SystemExit(f"expected BONE:AXIS:VALUES with AXIS in X/Y/Z, got '{text}'")
    bone, axis, values = parts
    return bone, AXES[axis], parse_values(values) if many else [float(values)]


def pose_bone_names(rig, name):
    names = expand([name])
    missing = [n for n in names if n not in rig.pose.bones]
    if missing:
        raise SystemExit(f"bones not in {rig.name}: {missing}")
    return names


def set_rotation(rig, specs, base=None):
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.location, pb.rotation_euler, pb.scale = (0, 0, 0), (0, 0, 0), (1, 1, 1)
    if base is None:
        for names, axis, deg in specs:
            for n in names:
                e = list(rig.pose.bones[n].rotation_euler)
                e[axis] += math.radians(deg)
                rig.pose.bones[n].rotation_euler = e
    else:
        from mathutils import Quaternion, Vector
        for pb in rig.pose.bones:
            pb.rotation_mode = 'QUATERNION'
            pb.location = base[pb.name][0]
            pb.rotation_quaternion = base[pb.name][1]
        for names, axis, deg in specs:
            for n in names:
                e = [0.0, 0.0, 0.0]
                e[axis] = 1.0
                pb = rig.pose.bones[n]
                pb.rotation_quaternion = pb.rotation_quaternion @ Quaternion(Vector(e), math.radians(deg))
    bpy.context.view_layer.update()


def base_pose(rig, name):
    """{bone: (location, quaternion)} of an action's first frame."""
    act = bpy.data.actions.get(name)
    if act is None:
        raise SystemExit(f"action '{name}' not in the blend")
    ad = rig.animation_data or rig.animation_data_create()
    ad.action = act
    if hasattr(ad, "action_slot") and ad.action_slot is None and len(act.slots):
        ad.action_slot = act.slots[0]
    bpy.context.scene.frame_set(int(act.frame_range[0]))
    out = {pb.name: (pb.location.copy(), pb.rotation_euler.to_quaternion()) for pb in rig.pose.bones}
    ad.action = None
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--blend", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--vary", action="append", required=True)
    ap.add_argument("--hold", action="append", default=[])
    ap.add_argument("--mesh")
    ap.add_argument("--near", default="")
    ap.add_argument("--base")
    a = script_args(ap)
    if len(a.vary) > 2:
        raise SystemExit("at most two --vary")
    bpy.ops.wm.open_mainfile(filepath=os.path.abspath(a.blend))
    rig = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    if rig is None:
        raise SystemExit("no armature found")
    if rig.animation_data:
        rig.animation_data.action = None
        for t in rig.animation_data.nla_tracks:
            t.mute = True
    for pb in rig.pose.bones:
        for c in pb.constraints:
            if c.type in ('IK', 'COPY_ROTATION'):
                c.influence = 0.0
    meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.parent == rig]
    if a.mesh:
        meshes = [o for o in meshes if o.name == a.mesh]
    else:
        meshes = [max(meshes, key=lambda o: len(o.data.polygons))]
    if not meshes:
        raise SystemExit(f"mesh not found: {a.mesh}")
    mesh = meshes[0]
    check = SelfCheck([mesh])
    set_rotation(rig, [])
    check.set_baseline(bpy.context.evaluated_depsgraph_get())
    base = base_pose(rig, a.base) if a.base else None
    near = tuple(n for n in a.near.split(",") if n)
    vary = [parse_spec(v, True) for v in a.vary]
    hold = [(pose_bone_names(rig, b), ax, vals[0]) for b, ax, vals in (parse_spec(h, False) for h in a.hold)]
    rows = []
    for combo in itertools.product(*[vals for _, _, vals in vary]):
        specs = hold + [(pose_bone_names(rig, b), ax, deg) for (b, ax, _), deg in zip(vary, combo)]
        set_rotation(rig, specs, base)
        res = check.run(bpy.context.evaluated_depsgraph_get(), near)[mesh.name]
        n_near = res["near"] if near else res["pairs"]
        row = {"angles": dict(zip([b for b, _, _ in vary], combo)), "pairs": res["pairs"], "near": n_near,
               "new": res["new"], "where": res["where"], "newWhere": res["newWhere"]}
        rows.append(row)
        log("SWEEP", " ".join(f"{v.split(':')[0]}={d:g}" for v, d in zip(a.vary, combo)),
            "| pairs", res["pairs"], "| near", n_near, "| new", res["new"], dict(list(res["newWhere"].items())[:4]))
    with open(a.out, "w") as fh:
        json.dump({"blend": a.blend, "mesh": mesh.name, "vary": a.vary, "hold": a.hold, "near": a.near,
                   "base": a.base, "rows": rows}, fh, indent=1)
    log("sweep", a.out, len(rows), "samples")


if __name__ == "__main__":
    main()
