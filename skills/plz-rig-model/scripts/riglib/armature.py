"""Armature creation from a template's landmark-pair bone list, plus IK controls."""
import bpy
from mathutils import Vector

from .common import SIDES, log


def _endpoint(spec, lm, side):
    """A bone end is a landmark name, or {"from": name, "forward_cm": d} (d cm towards -Y)."""
    if isinstance(spec, str):
        return lm.point(spec + side if side and spec != "origin" else spec)
    base = lm.point(spec["from"] + side if side and spec["from"] != "origin" else spec["from"])
    return base + Vector((0.0, -spec.get("forward_cm", 0.0) * 0.01, 0.0))


def bone_plan(template):
    """Ordered (name, head, tail, parent, deform, side) list: centre bones, then each side."""
    bones = template["bones"]
    sided = {b["name"] for b in bones if b.get("sided")}
    plan = [(b["name"], b["head"], b["tail"], b.get("parent"), b.get("deform", True), None)
            for b in bones if not b.get("sided")]
    for side in SIDES:
        for b in bones:
            if not b.get("sided"):
                continue
            parent = b.get("parent")
            if parent in sided:
                parent = parent + side
            plan.append((b["name"] + side, b["head"], b["tail"], parent, b.get("deform", True), side))
    return plan


def required_points(template):
    names = set()
    for _, head, tail, _, _, side in bone_plan(template):
        for spec in (head, tail):
            base = spec if isinstance(spec, str) else spec["from"]
            if base != "origin":
                names.add(base + side if side else base)
    return sorted(names)


def build_armature(rig_name, template, lm):
    old = bpy.data.objects.get(rig_name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    arm = bpy.data.armatures.get(rig_name) or bpy.data.armatures.new(rig_name)
    rig = bpy.data.objects.new(rig_name, arm)
    bpy.context.scene.collection.objects.link(rig)
    for ob in bpy.context.scene.objects:
        ob.select_set(False)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones
    for b in list(eb):
        eb.remove(b)
    for name, head, tail, parent, deform, side in bone_plan(template):
        b = eb.new(name)
        b.head = _endpoint(head, lm, side)
        b.tail = _endpoint(tail, lm, side)
        b.roll = 0.0
        b.use_deform = deform
        if parent:
            b.parent = eb[parent]
            b.use_connect = (b.head - eb[parent].tail).length < 1e-5
    bpy.ops.object.mode_set(mode='OBJECT')
    arm.display_type = template.get("display", "STICK")
    rig.show_in_front = True
    log("armature", rig_name, len(arm.bones), "bones")
    return rig


def add_ik(rig, template):
    for ik in template.get("ik", []):
        for side in SIDES if ik.get("sided", True) else ("",):
            pb = rig.pose.bones[ik["bone"] + side]
            c = pb.constraints.get("IK") or pb.constraints.new('IK')
            c.target = rig
            c.subtarget = ik["target"] + side
            c.chain_count = ik.get("chain", 2)
            follow = ik.get("copyRotation")
            if follow:
                fb = rig.pose.bones[follow + side]
                cr = fb.constraints.get("Copy Rotation") or fb.constraints.new('COPY_ROTATION')
                cr.target = rig
                cr.subtarget = ik["target"] + side
