"""glTF export of the rig and its parts, and saving the .blend with every image packed."""
import bpy

from .common import log


def select_rig(rig):
    for ob in bpy.context.scene.objects:
        ob.select_set(False)
    rig.select_set(True)
    for c in rig.children:
        c.select_set(True)
    bpy.context.view_layer.objects.active = rig


def export_glb(rig, path, settings):
    ad = rig.animation_data
    if ad:
        ad.action = None
    bpy.context.scene.frame_set(1)
    select_rig(rig)
    s = dict(settings)
    result = bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_apply=s.get("apply_modifiers", True), export_yup=True,
        export_image_format=s.get("image_format", 'JPEG'), export_jpeg_quality=s.get("jpeg_quality", 90),
        export_cameras=False, export_lights=False, export_skins=True,
        export_def_bones=s.get("deform_bones_only", True), export_animations=True,
        export_animation_mode=s.get("animation_mode", 'NLA_TRACKS'), export_morph=s.get("morph", False))
    log("export", path, result)
    if 'FINISHED' not in result:
        raise SystemExit(f"glTF export failed: {result}")


def save_blend(path):
    for img in bpy.data.images:
        if img.source == 'FILE' and not img.packed_file:
            img.pack()
            log("packed", img.name)
    bpy.context.preferences.filepaths.save_version = 0  # no .blend1 backups next to deliverables
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
    log("saved", path)
