"""Base-pose actions (pushed to muted NLA tracks for export) and the test-pose action."""
import math

import bpy
from mathutils import Euler

from .common import SIDES, action_fcurves, cm_to_world, expand, log


def reset(rig):
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)


def _move(rig, name, xfz_cm):
    """Offset a pose bone by (x, f, z) cm in world axes, written as bone-local location."""
    b = rig.data.bones[name]
    rig.pose.bones[name].location = b.matrix_local.to_3x3().inverted() @ cm_to_world(*xfz_cm)


DEFAULT_HIDE_SCALE = 0.001


def _aim(rig, name, xfz):
    """Turn a pose bone (shortest swing, no added twist) so its head->tail points along (x, f, z) in
    world axes. On a .R bone x is mirrored, so one entry serves both sides of `name.*`."""
    side = name[-2:] if name[-2:] in SIDES else None
    x, f, z = xfz
    target = cm_to_world(-x if side == ".R" else x, f, z).normalized()
    bpy.context.view_layer.update()  # the parent's pose (an earlier aim) must be evaluated first
    pb = rig.pose.bones[name]
    current = (pb.tail - pb.head).normalized()
    swing = current.rotation_difference(target).to_matrix()
    m = pb.matrix.copy()
    rotated = (swing @ m.to_3x3()).to_4x4()
    rotated.translation = m.translation
    pb.matrix = rotated
    bpy.context.view_layer.update()


def apply(rig, pose, hide_scale=DEFAULT_HIDE_SCALE, order="XYZ"):
    """`hide`: shrink bones (and their children) to `hide_scale`, not 0. With a zero-scaled parent the
    glTF exporter (which derives local transforms from world matrices) writes undefined child
    translations/rotations, and engines interpolate them in crossfades. `scale0` is the old exact-0 form.
    `aim` turns bones to world directions in the listed order (parents first), e.g. a humanoid's A-pose
    arms down to the sides. `rotate` is added on top of a rotation the bone already has (from the base
    pose), the way an engine bends a bone: base * local rotation. `order` is the Euler order of the
    `rotate` angles (the template's `rotateOrder`); "ZYX" equals an engine that bends about local X,
    then Y, then Z."""
    for n in expand(pose.get("hide", [])):
        rig.pose.bones[n].scale = (hide_scale,) * 3
    for n in expand(pose.get("scale0", [])):
        rig.pose.bones[n].scale = (0, 0, 0)
    for n, v in pose.get("move", {}).items():
        for name in expand([n]):
            _move(rig, name, v)
    for n, xfz in pose.get("aim", {}).items():
        for name in expand([n]):
            _aim(rig, name, xfz)
    for n, deg in pose.get("rotate", {}).items():
        for name in expand([n]):
            pb = rig.pose.bones[name]
            local = Euler([math.radians(a) for a in deg], order)
            if any(abs(a) > 1e-9 for a in pb.rotation_euler) or order != 'XYZ':
                pb.rotation_euler = (pb.rotation_euler.to_quaternion() @ local.to_quaternion()).to_euler('XYZ')
            else:  # nothing to add to: keep the exact Euler values (bird and quadruped keys stay as they were)
                pb.rotation_euler = local


def key_all(rig, frame):
    for pb in rig.pose.bones:
        for prop in ("location", "rotation_euler", "scale"):
            pb.keyframe_insert(prop, frame=frame)


def new_action(rig, name):
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    if rig.animation_data is None:
        rig.animation_data_create()
    rig.animation_data.action = act
    reset(rig)
    return act


def ik_constraints(rig, template):
    """The IK constraints and their copy-rotation followers that `add_ik` made from the template."""
    out = []
    for ik in template.get("ik", []):
        for side in SIDES if ik.get("sided", True) else ("",):
            out.append(rig.pose.bones[ik["bone"] + side].constraints["IK"])
            if ik.get("copyRotation"):
                out.append(rig.pose.bones[ik["copyRotation"] + side].constraints["Copy Rotation"])
    return out


def _ik_switch(spec):
    """Per-frame IK on/off (`ik` on the action, overridable per frame). None when every frame keeps
    IK on, so templates that never switch it (bird) get no influence curves."""
    default = spec.get("ik", True)
    flags = [bool(f.get("ik", default)) for f in spec["frames"]]
    return None if all(flags) else flags


def make_test_action(rig, template):
    """Test poses. A frame with IK off keys the IK and copy-rotation influences to 0 so the leg bones
    take their FK rotations, which is how an engine without IK drives them."""
    spec = template.get("testPoses")
    if not spec:
        return None
    base = {p["name"]: p for p in template.get("basePoses", [])}
    hide = template.get("hideScale", DEFAULT_HIDE_SCALE)
    order = template.get("rotateOrder", "XYZ")
    act = new_action(rig, spec.get("action", "rig_test"))
    switch = _ik_switch(spec)
    cons = ik_constraints(rig, template) if switch else []
    for i, frame in enumerate(spec["frames"], start=1):
        reset(rig)
        if frame.get("base"):
            apply(rig, base[frame["base"]], hide, order)
        apply(rig, frame, hide, order)
        key_all(rig, i)
        if frame.get("label"):  # render_poses.py names the picture after it
            act.pose_markers.new(frame["label"]).frame = i
        for c in cons:
            c.influence = 1.0 if switch[i - 1] else 0.0
            c.keyframe_insert("influence", frame=i)
    for c in cons:  # the stored value is what the base poses and the export see
        c.influence = 1.0
    interp = spec.get("interpolation", "CONSTANT")
    for fc in action_fcurves(act):
        for kp in fc.keyframe_points:
            kp.interpolation = interp
    bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, len(spec["frames"])
    log("test action", act.name, len(spec["frames"]), "frames:", [f.get("label", "") for f in spec["frames"]])
    return act


def make_base_poses(rig, template):
    acts = []
    hide = template.get("hideScale", DEFAULT_HIDE_SCALE)
    order = template.get("rotateOrder", "XYZ")
    for pose in template.get("basePoses", []):
        act = new_action(rig, pose["name"])
        apply(rig, pose, hide, order)
        key_all(rig, 1)
        acts.append(act)
    ad = rig.animation_data
    ad.action = None
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    for act in acts:
        tr = ad.nla_tracks.new()
        tr.name = act.name
        tr.strips.new(act.name, 1, act)
        tr.mute = True
    reset(rig)
    log("base poses", [a.name for a in acts])
    return acts
