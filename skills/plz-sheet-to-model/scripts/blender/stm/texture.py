"""Projection material (views projected by surface direction) and EMIT baking into the body UVs.

Each surface point takes the side view for sideways and downward normals, the top view for
upward, the front/back views for forward/backward normals, weighted by |normal component|^power.
Mode 'folded' gives the body as seen in the sheet. Mode 'wingless' (bird wings) replaces the
folded wing area, found by projecting tex_wingmask with the side mapping, with the filled flank
on the sides and the glide view on top, i.e. what the spread wings uncover.
"""
import bpy


def build_projection(mat_name, mode, meas, images, power):
    V = meas["views"]
    beak_f, tail_f = meas["beakF"], meas["tailF"]
    m = bpy.data.materials.get(mat_name) or bpy.data.materials.new(mat_name)
    m.use_nodes = True
    m.use_fake_user = True
    nt = m.node_tree
    nt.nodes.clear()

    def L(a, b):
        nt.links.new(a, b)

    def node(t):
        return nt.nodes.new(t)

    def fm(op, a, b=None, c=None):
        n = node("ShaderNodeMath"); n.operation = op
        for i, v in enumerate((a, b, c)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                L(v, n.inputs[i])
        return n.outputs[0]

    def tex(key, u, v):
        cmb = node("ShaderNodeCombineXYZ"); L(u, cmb.inputs[0]); L(v, cmb.inputs[1])
        t = node("ShaderNodeTexImage"); t.image = images[key]
        t.extension = 'EXTEND'; t.interpolation = 'Linear'; L(cmb.outputs[0], t.inputs[0])
        return t.outputs["Color"]

    def mix(a, b, fac):
        n = node("ShaderNodeMix"); n.data_type = 'RGBA'
        L(fac, n.inputs["Factor"]); L(a, n.inputs[6]); L(b, n.inputs[7])
        return n.outputs[2]

    def vscale(c, w):
        n = node("ShaderNodeVectorMath"); n.operation = 'SCALE'; L(c, n.inputs[0]); L(w, n.inputs["Scale"])
        return n.outputs[0]

    def vadd(a, c):
        n = node("ShaderNodeVectorMath"); n.operation = 'ADD'; L(a, n.inputs[0]); L(c, n.inputs[1])
        return n.outputs[0]

    tc = node("ShaderNodeTexCoord")
    sep = node("ShaderNodeSeparateXYZ"); L(tc.outputs["Object"], sep.inputs[0])
    X, Y, Z = sep.outputs[0], sep.outputs[1], sep.outputs[2]

    # pixel-edge mappings (f = -100Y, x = 100X, z = 100Z), see measure_views.py
    s = V["side"]; k = s["px"]
    su = fm('MULTIPLY_ADD', Y, -100 * k / s["W"], (s["pivot"] + 0.5) / s["W"])
    sv = fm('MULTIPLY_ADD', Z, 100 * k / s["H"], 1 - (s["ground"] + 1) / s["H"])
    t = V["top"]; k = t["px"]
    tu = fm('MULTIPLY_ADD', Y, -100 * k / t["W"], (t["beakCol"] + 1 - beak_f * k) / t["W"])
    tv = fm('MULTIPLY_ADD', X, 100 * k / t["H"], 1 - (t["centreRow"] + 0.5) / t["H"])
    fr = V["front"]; k = fr["px"]
    fu = fm('MULTIPLY_ADD', X, 100 * k / fr["W"], (fr["centre"] + 0.5) / fr["W"])
    fv = fm('MULTIPLY_ADD', Z, 100 * k / fr["H"], 1 - (fr["ground"] + 1) / fr["H"])
    b = V["back"]; k = b["px"]
    bu = fm('MULTIPLY_ADD', X, -100 * k / b["W"], (b["centre"] + 0.5) / b["W"])
    bv = fm('MULTIPLY_ADD', Z, 100 * k / b["H"], 1 - (b["ground"] + 1) / b["H"])

    if mode == 'folded':
        c_side, c_top = tex("side", su, sv), tex("top", tu, tv)
        c_front, c_back = tex("front", fu, fv), tex("back", bu, bv)
    elif mode == 'wingless':
        mask = tex("wingmask", su, sv)
        c_side = mix(tex("side", su, sv), tex("side_flank", su, sv), mask)
        sp = V["spread"]; k = sp["px"]
        # glide view aligned by the tail tip: row = tailRow + 1 - (f - tailF) * k
        c_spread = tex("spread_rgb", fm('MULTIPLY_ADD', X, -100 * k / sp["W"], (sp["centre"] + 0.5) / sp["W"]),
                       fm('MULTIPLY_ADD', Y, -100 * k / sp["H"], 1 - (sp["tailRow"] + 1 + tail_f * k) / sp["H"]))
        c_top = mix(tex("top", tu, tv), c_spread, mask)
        c_front = mix(tex("front", fu, fv), tex("side_flank", su, sv), mask)
        c_back = mix(tex("back", bu, bv), tex("side_flank", su, sv), mask)
    else:
        raise ValueError(mode)

    geo = node("ShaderNodeNewGeometry")
    ns = node("ShaderNodeSeparateXYZ"); L(geo.outputs["Normal"], ns.inputs[0])
    nx, ny, nz = ns.outputs[0], ns.outputs[1], ns.outputs[2]
    w_side = fm('ADD', fm('POWER', fm('ABSOLUTE', nx), power), fm('POWER', fm('MAXIMUM', fm('MULTIPLY', nz, -1), 0), power))
    w_top = fm('POWER', fm('MAXIMUM', nz, 0), power)
    w_front = fm('POWER', fm('MAXIMUM', fm('MULTIPLY', ny, -1), 0), power)
    w_back = fm('POWER', fm('MAXIMUM', ny, 0), power)
    acc = vadd(vadd(vscale(c_side, w_side), vscale(c_top, w_top)), vadd(vscale(c_front, w_front), vscale(c_back, w_back)))
    wsum = fm('ADD', fm('ADD', w_side, w_top), fm('ADD', w_front, w_back))
    col = vscale(acc, fm('DIVIDE', 1.0, wsum))
    emi = node("ShaderNodeEmission"); L(col, emi.inputs["Color"])
    out = node("ShaderNodeOutputMaterial"); L(emi.outputs[0], out.inputs["Surface"])
    return m


def bake(body, mat, img_name, tex_cfg, bake_levels, save_path):
    """EMIT-bake `mat` on `body` into a new sRGB image (from the subdivision render level)."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = tex_cfg["samples"]
    scene.cycles.device = 'CPU'
    scene.render.bake.margin = tex_cfg["marginPx"]
    scene.render.bake.use_clear = True
    size = tex_cfg["size"]
    img = bpy.data.images.new(img_name, size, size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'sRGB'
    nt = mat.node_tree
    tn = nt.nodes.get("BakeTarget") or nt.nodes.new("ShaderNodeTexImage")
    tn.name = "BakeTarget"; tn.image = img
    for n in nt.nodes:
        n.select = False
    tn.select = True
    nt.nodes.active = tn
    sub = body.modifiers["Subdivision"]
    keep = sub.render_levels
    sub.render_levels = bake_levels
    body.data.materials.clear()
    body.data.materials.append(mat)
    for ob in scene.objects:
        ob.select_set(False)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.bake(type='EMIT')
    sub.render_levels = keep
    img.filepath_raw = save_path
    img.file_format = 'PNG'
    img.save()
    img.pack()
    return img


def bake_objects(objs, mat, img_name, tex_cfg, save_path):
    """EMIT-bake `mat` on several meshes that share one UV layout (packed together) into one new
    sRGB image. Used when the meshes have no subdivision modifier (the quadruped union body, ears)."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = tex_cfg["samples"]
    scene.cycles.device = 'CPU'
    scene.render.bake.margin = tex_cfg["marginPx"]
    scene.render.bake.use_clear = True
    size = tex_cfg["size"]
    img = bpy.data.images.new(img_name, size, size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'sRGB'
    nt = mat.node_tree
    tn = nt.nodes.get("BakeTarget") or nt.nodes.new("ShaderNodeTexImage")
    tn.name = "BakeTarget"; tn.image = img
    for n in nt.nodes:
        n.select = False
    tn.select = True
    nt.nodes.active = tn
    for ob in scene.objects:
        ob.select_set(False)
    for ob in objs:
        ob.data.materials.clear()
        ob.data.materials.append(mat)
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.bake(type='EMIT')
    img.filepath_raw = save_path
    img.file_format = 'PNG'
    img.save()
    img.pack()
    return img
