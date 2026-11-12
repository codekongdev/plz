"""Bring a model that already has a rig (FBX or glTF, bought or downloaded) into the shared conventions,
ready for rig_model.py with a template whose body rule is `source_groups` (headless Blender).

blender -b --factory-startup -P import_rigged.py -- \
    --model in.fbx|in.glb --spec model/spec.json --template humanoid --out DIR

The spec (JSON, next to the model in the art folder) names the id and version, the source rig in the
template's `sourceRigs`, the height to scale to, the textures and any recolouring:

  {"id": "human", "version": "v001", "sourceRig": "biped",
   "scaleTo": {"point": "eye", "heightM": 1.5},          # mean of eye.L/eye.R, or a centre point
   "textureDir": "../Textures", "textureSize": 1024,      # relative to the model file
   "materials": {"<source material>": {"color": "<file>", "roughness": 0.8, "alphaClip": false}},
   "recolor": [{"material": "...", "seedLab": [L, a, b], "target": "#rrggbb", ...}]}

What it does, in order:
- imports the file in its rest pose and keeps the skinned meshes; every transform is applied, the mesh is
  scaled about the origin so the chosen point sits at `heightM`, and the source armature is deleted. The
  vertex groups (the source skin weights) stay on the mesh under their source names.
- reads the template's points from the source bones (bone heads, or the extreme vertex of a weight group)
  and writes `<id>_<version>.landmarks.json` with the parts and the template's group map (`sourceGroups`,
  with {S} expanded to L and R), which the `source_groups` weight rule reads.
- rebuilds each material as a plain Principled BSDF with the colour texture (optionally recoloured,
  resized and saved as JPEG, or PNG when it has alpha) so the glTF export keeps formats and alpha clip.
- saves `<id>_<version>.blend` (images packed) and `<id>_<version>.import-report.json`.

Recolouring (`recolor`) changes one garment without repainting: pixels close to `seedLab` in chroma
(within `chroma` [full, none] and `lightness` [min, max]) vote for the faces whose UVs cover them; faces
with a mean vote of at least `faceVote` are filled in UV space (dilated `dilatePx`) and their pixels are
shifted in Lab so the seed colour becomes `target`, keeping `keepDetail` of the chroma variation and all of
the lightness texture.
"""
import argparse
import json
import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from riglib.common import SIDES, load_json, load_template, log, script_args  # noqa: E402


# ---- colour ----------------------------------------------------------------------------------------

_M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
_WHITE = np.array([0.95047, 1.0, 1.08883])


def srgb_to_lab(c):
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    xyz = lin @ _M.T / _WHITE
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab_to_srgb(lab):
    fy = (lab[..., 0] + 16) / 116
    f = np.stack([fy + lab[..., 1] / 500, fy, fy - lab[..., 2] / 200], -1)
    xyz = np.where(f > 0.206893, f ** 3, (f - 16 / 116) / 7.787) * _WHITE
    lin = np.clip(xyz @ np.linalg.inv(_M).T, 0, 1)
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)


def hex_lab(h):
    h = h.lstrip("#")
    return srgb_to_lab(np.array([[int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]]))[0]


def image_array(img):
    """(H, W, 4) floats, row 0 at the bottom (Blender's pixel order, so v maps straight to rows)."""
    a = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def _smooth01(t):
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def _raster_faces(polys, uv, shape):
    """Boolean UV-space mask of polygons (lists of loop indices) on an (H, W) image."""
    h, w = shape
    mask = np.zeros(shape, dtype=bool)
    px = np.stack([uv[:, 0] * w - 0.5, uv[:, 1] * h - 0.5], -1)
    for loops in polys:
        for k in range(1, len(loops) - 1):
            tri = px[[loops[0], loops[k], loops[k + 1]]]
            x0, y0 = np.floor(tri.min(0)).astype(int)
            x1, y1 = np.ceil(tri.max(0)).astype(int)
            x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, w - 1), min(y1, h - 1)
            if x1 < x0 or y1 < y0:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
            (ax, ay), (bx, by), (cx, cy) = tri
            d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(d) < 1e-12:
                continue
            l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d
            l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d
            inside = (l1 >= -1e-3) & (l2 >= -1e-3) & (1 - l1 - l2 >= -1e-3)
            mask[y0:y1 + 1, x0:x1 + 1] |= inside
    return mask


def _dilate(mask, n):
    out = mask.copy()
    for _ in range(n):
        grown = out.copy()
        grown[1:] |= out[:-1]
        grown[:-1] |= out[1:]
        grown[:, 1:] |= out[:, :-1]
        grown[:, :-1] |= out[:, 1:]
        out = grown
    return out


def dominant_groups(ob):
    """Name of the vertex group with the largest weight on each vertex ('' when unweighted)."""
    names = [g.name for g in ob.vertex_groups]
    out = []
    for v in ob.data.vertices:
        best = max(v.groups, key=lambda g: g.weight, default=None)
        out.append(names[best.group] if best else "")
    return out


def face_filter(ob, rule):
    """Faces allowed by `groups` / `excludeGroups` (regexes on each face's most common dominant group)."""
    keep = re.compile(rule["groups"]) if rule.get("groups") else None
    drop = re.compile(rule["excludeGroups"]) if rule.get("excludeGroups") else None
    if not keep and not drop:
        return None
    dom = dominant_groups(ob)
    allowed = set()
    for p in ob.data.polygons:
        names = [dom[i] for i in p.vertices]
        g = max(dict.fromkeys(names), key=names.count)  # ties go to the first vertex's group, not set order
        if (keep is None or keep.search(g)) and not (drop and drop.search(g)):
            allowed.add(p.index)
    return allowed


def recolor(img, ob, material_index, rule):
    """Shift one garment's colour in place (see the module notes). Returns stats for the report.
    Without `seedLab`, every pixel passing `lightness` votes, and the seed is the median of the result."""
    a = image_array(img)
    lab = srgb_to_lab(a[..., :3].astype(np.float64))
    target = hex_lab(rule["target"])
    lo, hi = rule.get("lightness", [12.0, 62.0])
    vote = _smooth01((lab[..., 0] - lo) / 6.0) * _smooth01((hi - lab[..., 0]) / 6.0)
    if "seedLab" in rule:
        seed = np.array(rule["seedLab"], dtype=np.float64)
        full, none = rule.get("chroma", [5.0, 10.0])
        d = np.hypot(lab[..., 1] - seed[1], lab[..., 2] - seed[2])
        vote = vote * (1 - _smooth01((d - full) / max(none - full, 1e-6)))
    if "maxChroma" in rule:  # e.g. leave skin (strongly coloured) out of a grey or dark garment
        c = np.hypot(lab[..., 1], lab[..., 2])
        vote = vote * (1 - _smooth01((c - rule["maxChroma"] + 4.0) / 8.0))
    allowed = face_filter(ob, rule)

    me = ob.data
    uv = np.empty(len(me.loops) * 2)
    me.uv_layers.active.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    # Move each face as a whole into the 0..1 tile, so a face that touches u or v = 1 (or lies on another
    # tile) keeps its shape; wrapping each corner on its own would fold such a face to nothing.
    for p in me.polygons:
        loops = list(p.loop_indices)
        uv[loops] -= np.floor(uv[loops].min(axis=0) + 1e-6)
    h, w = vote.shape
    cols = np.clip((uv[:, 0] * w).astype(int), 0, w - 1)
    rows = np.clip((uv[:, 1] * h).astype(int), 0, h - 1)
    loop_vote = vote[rows, cols]
    chosen, total = [], 0
    for p in me.polygons:
        if p.material_index != material_index or (allowed is not None and p.index not in allowed):
            continue
        total += 1
        loops = list(p.loop_indices)
        centre = uv[loops].mean(0)
        votes = list(loop_vote[loops]) + [vote[min(int(centre[1] * h), h - 1), min(int(centre[0] * w), w - 1)]]
        if sum(votes) / len(votes) >= rule.get("faceVote", 0.5):
            chosen.append(loops)
    mask = _dilate(_raster_faces(chosen, uv, (h, w)), rule.get("dilatePx", 2))
    if "seedLab" not in rule:
        seed = np.median(lab[mask & (vote > 0.5)], axis=0) if mask.any() else target
    keep = rule.get("keepDetail", 0.6)
    new = lab.copy()
    new[..., 0] = lab[..., 0] + (target[0] - seed[0])
    new[..., 1] = target[1] + (lab[..., 1] - seed[1]) * keep
    new[..., 2] = target[2] + (lab[..., 2] - seed[2]) * keep
    rgb = np.where(mask[..., None], lab_to_srgb(new), a[..., :3])
    a[..., :3] = rgb
    img.pixels.foreach_set(a.ravel())
    img.update()
    share = float(mask.mean())
    after = srgb_to_lab(np.clip(rgb[mask], 0, 1)) if mask.any() else np.zeros((1, 3))
    median = lab_to_srgb(np.median(after, axis=0)[None])[0]
    result = "#" + "".join(f"{int(round(c * 255)):02x}" for c in median)
    log(f"recolor {img.name}: {len(chosen)}/{total} faces, {share:.1%} of the texture, seed Lab "
        f"{np.round(seed, 1).tolist()} -> {rule['target']} (median after {result})")
    return {"image": img.name, "faces": len(chosen), "ofFaces": total, "textureShare": round(share, 4),
            "seedLab": [round(float(c), 2) for c in seed], "target": rule["target"], "medianAfter": result}


# ---- model ----------------------------------------------------------------------------------------

def sided(spec_name, table):
    """`name.*` entries -> name.L / name.R with {S} -> L / R in every string value."""
    out = {}
    for key, value in table.items():
        if key.endswith(".*"):
            for side in SIDES:
                s = side[1]
                out[key[:-2] + side] = json.loads(json.dumps(value).replace("{S}", s))
        else:
            out[key] = value
    return out


def expand_groups(groups):
    out = {}
    for key, bone in groups.items():
        if "{S}" in key or "{S}" in bone:
            for s in ("L", "R"):
                out[key.replace("{S}", s)] = bone.replace("{S}", s)
        else:
            out[key] = bone
    return out


def load_source(path):
    ext = os.path.splitext(path)[1].lower()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    else:
        raise SystemExit(f"unsupported model format: {path}")
    arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    if len(arms) != 1:
        raise SystemExit(f"expected one armature in {path}, found {len(arms)}")
    arm = arms[0]
    arm.data.pose_position = 'REST'
    for ad in [arm.animation_data] if arm.animation_data else []:
        ad.action = None
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH'
              and any(m.type == 'ARMATURE' and m.object == arm for m in o.modifiers)]
    if not meshes:
        raise SystemExit("no mesh is skinned to the armature")
    return arm, meshes


def bone_head(arm, name):
    b = arm.data.bones.get(name)
    if b is None:
        raise SystemExit(f"source bone '{name}' not found (has e.g. {[x.name for x in arm.data.bones][:8]})")
    return arm.matrix_world @ b.head_local


def group_extreme(ob, group, kind):
    g = ob.vertex_groups.get(group)
    if g is None:
        raise SystemExit(f"{ob.name}: no vertex group '{group}'")
    pts = [ob.matrix_world @ v.co for v in ob.data.vertices
           if any(x.group == g.index and x.weight >= 0.5 for x in v.groups)]
    if not pts:
        raise SystemExit(f"{ob.name}: group '{group}' has no vertex weighted 0.5 or more")
    return max(pts, key=lambda p: p.z) if kind == "top" else min(pts, key=lambda p: p.y)


def source_points(arm, mesh, table):
    pts = {}
    for name, spec in table.items():
        p = bone_head(arm, spec["bone"]).copy()
        if "extreme" in spec:
            e = group_extreme(mesh, spec["group"], spec["extreme"])
            if spec["extreme"] == "top":
                p.z = e.z
            elif spec["extreme"] == "front":
                p.y = e.y
            else:
                raise SystemExit(f"point {name}: extreme must be top or front")
        if "offset_cm" in spec:
            x, f, z = spec["offset_cm"]
            p += Vector((x * 0.01, -f * 0.01, z * 0.01))
        pts[name] = p
    return pts


def scale_factor(points, rule):
    name = rule["point"]
    picked = [points[n] for n in (name, name + ".L", name + ".R") if n in points]
    if not picked:
        raise SystemExit(f"scaleTo point '{name}' is not among the source points")
    z = sum(p.z for p in picked) / len(picked)
    return rule["heightM"] / z


def bake_mesh(ob, s, name):
    """Apply the world transform and the scale to the mesh data; drop the armature modifier."""
    me = ob.data
    me.transform(ob.matrix_world)
    me.transform(Matrix.Scale(s, 4))
    ob.parent = None
    ob.matrix_world = Matrix.Identity(4)
    for m in [m for m in ob.modifiers if m.type == 'ARMATURE']:
        ob.modifiers.remove(m)
    ob.name = name
    me.name = name
    me.update()


def build_material(mat, spec, tex_dir, out_dir, size, recolors, ob):
    path = os.path.join(tex_dir, spec["color"])
    img = bpy.data.images.load(path, check_existing=False)
    img.colorspace_settings.name = 'sRGB'
    stats = []
    index = list(ob.data.materials).index(mat)
    for rule in recolors:
        if rule["material"] == mat.name:
            stats.append(recolor(img, ob, index, rule))
    size = spec.get("size", size)
    if size and img.size[0] > size:
        img.scale(size, size * img.size[1] // img.size[0])
    alpha = bool(spec.get("alphaClip"))
    if alpha:  # hidden pixels keep noisy colour that PNG cannot compress; give them the mean visible colour
        px = image_array(img)
        seen = px[..., 3] >= 0.5
        if seen.any():
            px[~seen & (px[..., 3] < 1.0 / 255), :3] = px[seen, :3].mean(0)
            img.pixels.foreach_set(px.ravel())
            img.update()
    stem = os.path.splitext(spec["color"])[0]
    os.makedirs(os.path.join(out_dir, "textures"), exist_ok=True)
    if alpha:
        dst, fmt = os.path.join(out_dir, "textures", stem + ".png"), 'PNG'
    else:
        dst, fmt = os.path.join(out_dir, "textures", stem + ".jpg"), 'JPEG'
    # Image.save writes the pixels as they are; save_render would pass them through the view transform.
    img.filepath_raw = dst
    img.file_format = fmt
    try:
        img.save(quality=90)
    except TypeError:  # Blender before 4.0 has no quality argument
        img.save()
    bpy.data.images.remove(img)
    tex = bpy.data.images.load(dst)
    tex.name = stem
    tex.colorspace_settings.name = 'sRGB'

    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = tex
    nt.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = spec.get("roughness", 0.8)
    bsdf.inputs["Metallic"].default_value = 0.0
    if alpha:  # glTF alpha MASK with cutoff 0.5: alpha -> Round -> Alpha
        rnd = nt.nodes.new("ShaderNodeMath")
        rnd.operation = 'ROUND'
        nt.links.new(node.outputs["Alpha"], rnd.inputs[0])
        nt.links.new(rnd.outputs[0], bsdf.inputs["Alpha"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    mat.use_backface_culling = not spec.get("doubleSided", alpha)
    log(f"material {mat.name}: {os.path.basename(dst)} {tex.size[0]}x{tex.size[1]}"
        f"{' alpha clip' if alpha else ''}{' double-sided' if not mat.use_backface_culling else ''}")
    return {"material": mat.name, "texture": os.path.basename(dst), "size": list(tex.size),
            "alphaClip": alpha, "recolor": stats}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--spec", required=True)
    ap.add_argument("--template", required=True)
    ap.add_argument("--out", required=True)
    a = script_args(ap)
    spec = load_json(a.spec)
    template = load_template(a.template)
    rigs = template.get("sourceRigs", {})
    if spec["sourceRig"] not in rigs:
        raise SystemExit(f"template {template['name']} has no source rig '{spec['sourceRig']}' ({sorted(rigs)})")
    source = rigs[spec["sourceRig"]]
    model = os.path.abspath(a.model)
    out_dir = os.path.abspath(a.out)
    os.makedirs(out_dir, exist_ok=True)
    name = f"{spec['id']}_{spec['version']}"

    arm, meshes = load_source(model)
    if len(meshes) != 1:
        raise SystemExit(f"expected one skinned mesh, found {[m.name for m in meshes]}; "
                         "join them in the source first or extend this script to several parts")
    mesh = meshes[0]
    points = source_points(arm, mesh, sided("points", source["points"]))
    s = scale_factor(points, spec["scaleTo"])
    points = {k: v * s for k, v in points.items()}
    log(f"scale {s:.5f} so that {spec['scaleTo']['point']} is at {spec['scaleTo']['heightM']} m")

    body = f"{spec['id']}_body"
    bake_mesh(mesh, s, body)
    for ob in [o for o in bpy.data.objects if o != mesh]:
        bpy.data.objects.remove(ob, do_unlink=True)
    for act in list(bpy.data.actions):
        bpy.data.actions.remove(act)

    tex_dir = os.path.normpath(os.path.join(os.path.dirname(model), spec.get("textureDir", ".")))
    mats = []
    for mat in list(mesh.data.materials):
        if mat.name not in spec.get("materials", {}):
            raise SystemExit(f"material '{mat.name}' has no entry in the spec's materials")
        mats.append(build_material(mat, spec["materials"][mat.name], tex_dir, out_dir,
                                   spec.get("textureSize"), spec.get("recolor", []), mesh))
    for img in [i for i in bpy.data.images if i.users == 0]:
        bpy.data.images.remove(img)

    co = np.empty(len(mesh.data.vertices) * 3)
    mesh.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    groups = expand_groups(source["groups"])
    lm = {"id": spec["id"], "version": spec["version"], "units": "m",
          "axes": {"up": "+Z", "forward": "-Y", "left": "+X"}, "bodyPlan": template["bodyPlan"],
          "points": {k: [round(c, 5) for c in v] for k, v in sorted(points.items())},
          "parts": {"body": body}, "sourceGroups": groups,
          "source": {"file": os.path.basename(model), "rig": spec["sourceRig"], "scale": round(s, 6)}}
    with open(os.path.join(out_dir, name + ".landmarks.json"), "w") as fh:
        json.dump(lm, fh, indent=1)

    used = {g.name for g in mesh.vertex_groups}
    patterns = [(re.compile(k[3:]), v) for k, v in groups.items() if k.startswith("re:")]
    unmapped = sorted(n for n in used if n not in groups and not any(p.search(n) for p, _ in patterns))
    tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
    report = {"model": os.path.basename(model), "scale": s, "height_m": float(co[:, 2].max()),
              "lowest_m": float(co[:, 2].min()), "width_m": float(np.ptp(co[:, 0])), "depth_m": float(np.ptp(co[:, 1])),
              "verts": len(mesh.data.vertices), "tris": tris, "sourceGroups": len(used),
              "unmappedGroups": unmapped, "materials": mats}
    with open(os.path.join(out_dir, name + ".import-report.json"), "w") as fh:
        json.dump(report, fh, indent=1)
    log(f"report height {report['height_m']:.4f} m, {tris} tris, {len(used)} source groups, unmapped {unmapped or 'none'}")

    for img in bpy.data.images:
        if img.source == 'FILE' and not img.packed_file:
            img.pack()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, name + ".blend"), compress=True)
    log("IMPORT_OK", name)


if __name__ == "__main__":
    main()
