"""Shared helpers for the headless Blender build (units, colours, materials)."""
import json
import math

import bpy
from mathutils import Vector


def load_json(path):
    with open(path) as fh:
        return json.load(fh)


def P(x, f, z):
    """Spec coordinates (x lateral +left, f forward, z up; cm) -> Blender metres (forward = -Y)."""
    return Vector((x * 0.01, -f * 0.01, z * 0.01))


def to_fz(co):
    """Blender point -> (f, z) in cm."""
    return -co.y * 100, co.z * 100


def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def sided(points, name):
    """Return {name.L: P, name.R: mirrored P} for a spec point given on the left side."""
    x, f, z = points[name + ".L"]
    return {name + ".L": P(x, f, z), name + ".R": P(-x, f, z)}


def principled(name, rgb, rough=0.5):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = rough
    m.diffuse_color = (*rgb, 1)
    m.use_backface_culling = True
    return m


def textured(name, img, rough, spec_level, clip=False, uv="UVMap"):
    """Principled material with one image as base colour. clip=True routes the image alpha through
    a Math Round node, which the glTF exporter writes as alphaMode MASK (cutoff 0.5)."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    uvn = nt.nodes.new("ShaderNodeUVMap"); uvn.uv_map = uv; uvn.location = (-700, 0)
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img; tex.location = (-450, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled"); bsdf.location = (0, 0)
    out = nt.nodes.new("ShaderNodeOutputMaterial"); out.location = (300, 0)
    nt.links.new(uvn.outputs[0], tex.inputs[0])
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if clip:
        rnd = nt.nodes.new("ShaderNodeMath"); rnd.operation = 'ROUND'; rnd.location = (-200, -250)
        nt.links.new(tex.outputs["Alpha"], rnd.inputs[0])
        nt.links.new(rnd.outputs[0], bsdf.inputs["Alpha"])
    m.surface_render_method = 'DITHERED'
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = spec_level
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    m.use_backface_culling = True
    return m


def load_image(name, path, colorspace='sRGB', alpha_straight=False):
    img = bpy.data.images.load(path)
    img.name = name
    img.colorspace_settings.name = colorspace
    if alpha_straight:
        img.alpha_mode = 'STRAIGHT'
    return img


def link(ob, parent=None):
    bpy.context.scene.collection.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    return ob


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def deg(a):
    return math.radians(a)
