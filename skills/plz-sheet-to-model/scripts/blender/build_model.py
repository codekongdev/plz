"""Build a textured, real-scale model from a measured reference sheet (headless Blender).

  blender -b --factory-startup -P build_model.py -- <model spec.json> <work dir> <out dir>

<work dir> must already hold measure_views.py's output. Writes to <out dir>:
  <id>_<version>.blend / .glb / .landmarks.json / .report.json

bodyPlan "bird" (and other single-tube bodies) runs the flow below; "quadruped" runs stm/quadruped.py.
"""
import os
import sys

sys.dont_write_bytecode = True            # keep the skill folder free of __pycache__
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

from stm import bird_wings, eyes, legs, loft, output, quadruped, texture  # noqa: E402
from stm.common import P, load_image, load_json, sided, textured  # noqa: E402


def main(argv):
    spec_path, work, out = (os.path.abspath(a) for a in argv[:3])
    os.makedirs(out, exist_ok=True)
    spec = load_json(spec_path)
    meas = load_json(os.path.join(work, "measure.json"))
    meas_sheet = load_json(os.path.join(meas["sheet"], "measurements.json"))
    oid, ver = spec["id"], spec["version"]
    stem = os.path.join(out, f"{oid}_{ver}")
    tex_cfg = spec["texture"]
    wings_cfg = spec.get("wings") if spec.get("wings", {}).get("type") == "bird" else None
    skel = spec.get("skeleton", {})

    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    root = bpy.data.objects.new(f"{oid}_root", None)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = 0.05
    bpy.context.scene.collection.objects.link(root)
    if spec.get("bodyPlan") == "quadruped":
        quadruped.build(spec, meas, meas_sheet, work, stem, root)
        return

    # body + eyes + legs ----------------------------------------------------------------
    body = loft.build_body(f"{oid}_body", meas["profile"], meas["frontHalfWidth"], spec["loft"], root)
    eye_parts = {}
    if spec.get("eyes"):
        e = spec["eyes"].get("position") or [meas["eye"]["f"], meas["eye"]["z"]]
        eye_parts = eyes.build_eyes(oid, e, spec["eyes"], body, root)
    legs_ob = legs.build_legs(oid, spec["legs"], skel, root) if spec.get("legs") else None

    # projection bake(s) ------------------------------------------------------------------
    img = {}
    for key in ("side", "top", "front", "back") + (("wingmask", "side_flank", "spread_rgb") if wings_cfg else ()):
        img[key] = load_image(f"{oid}_proj_{key}", os.path.join(work, f"tex_{key}.png"),
                              'Non-Color' if key == "wingmask" else 'sRGB')
    bake_levels = spec["loft"]["subdiv"]
    m_fold = texture.build_projection(f"{oid}_project_folded", 'folded', meas, img, tex_cfg["blendPower"])
    alb_fold = texture.bake(body, m_fold, f"{oid}_body_albedo", tex_cfg, bake_levels,
                            os.path.join(work, f"{oid}_body_albedo.png"))
    sub = body.modifiers["Subdivision"]
    sub.levels = sub.render_levels = spec["export"]["subdiv"]
    body_albedo = alb_fold
    if wings_cfg:
        m_open = texture.build_projection(f"{oid}_project_wingless", 'wingless', meas, img, tex_cfg["blendPower"])
        body_albedo = texture.bake(body, m_open, f"{oid}_body_albedo_wingless", tex_cfg, bake_levels,
                                   os.path.join(work, f"{oid}_body_albedo_wingless.png"))
    body.data.materials.clear()
    body.data.materials.append(textured(f"{oid}_{spec.get('materials', {}).get('body', 'body')}", body_albedo,
                                        tex_cfg["roughness"], tex_cfg["specular"]))

    # landmarks gathered as we go -------------------------------------------------------------
    points = {}
    for name, (x, f, z) in skel.items():
        if name.endswith(".L"):
            points.update(sided(skel, name[:-2]))
        elif not name.endswith(".R"):
            points[name] = P(x, f, z)
    for k, (ob, c) in eye_parts.items():
        points[k] = c
    parts = {"body": body.name}
    parts.update({k: ob.name for k, (ob, c) in eye_parts.items()})
    if legs_ob:
        parts["legs"] = legs_ob.name
    regions = {}
    span_cm = None

    # bird wings ----------------------------------------------------------------------
    if wings_cfg:
        poly = bird_wings.outline_fz(wings_cfg["foldOutlinePx"], meas["views"]["side"])
        m_folded = textured(f"{oid}_wing_folded", alb_fold, tex_cfg["roughness"], tex_cfg["specular"])
        shells = bird_wings.build_fold_shells(oid, body, poly, wings_cfg["foldDilateCm"], wings_cfg["foldOffsetCm"],
                                              m_folded, root)
        top = load_image(f"{oid}_wing_top", os.path.join(work, f"{oid}_wing_top.png"), alpha_straight=True)
        under = load_image(f"{oid}_wing_under", os.path.join(work, f"{oid}_wing_under.png"), alpha_straight=True)
        mats = {"top": textured(f"{oid}_wing_top", top, tex_cfg["roughness"], tex_cfg["specular"], clip=True),
                "under": textured(f"{oid}_wing_under", under, tex_cfg["roughness"], tex_cfg["specular"], clip=True)}
        spread, joints = bird_wings.build_spread_wings(oid, meas["spreadPlan"], wings_cfg["spread"],
                                                       meas["views"]["spread"], meas["tailF"], mats, root)
        points.update(joints)
        parts.update({k: ob.name for k, ob in shells.items()})
        parts.update({k: ob.name for k, ob in spread.items()})
        regions["wing_fold_cover"] = {"plane": "fz", "units": "cm", "polygon": [[round(f, 4), round(z, 4)] for f, z in poly],
                                      "dilate": wings_cfg["foldDilateCm"]}

    points.update(output.body_extremes(body))
    objs = output.descendants(root)
    stats = output.evaluated_stats(objs)
    if wings_cfg:
        span_cm = stats[parts["wing_spread.L"]]["boundsCm"][1][0] - stats[parts["wing_spread.R"]]["boundsCm"][0][0]

    output.export_glb(root, stem + ".glb", spec["export"])
    output.write_json(stem + ".landmarks.json", output.landmarks(spec, points, parts, regions))
    output.save_blend(stem + ".blend")
    eye_c = eye_parts["eye.L"][1] if eye_parts else None
    rep = output.report(spec, meas_sheet, stats, body.name, eye_c,
                        {"glb": stem + ".glb", "blend": stem + ".blend"}, span_cm)
    output.write_json(stem + ".report.json", rep)
    print("BUILD_OK", stem, "tris", rep["trisTotal"], "body", rep["bodyCm"])


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1:])
