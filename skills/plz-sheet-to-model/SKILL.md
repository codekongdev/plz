---
name: plz-sheet-to-model
description: |
  Build a real-size, textured 3D model (.blend and .glb) from an orthographic
  reference sheet (side, top, front, and back view images plus px/cm, the output
  of the plz-model-sheet skill), running Blender headlessly. Measures the
  silhouettes to 1 mm and lofts cross sections, projects the view images onto
  the surface by direction and bakes them into a UV texture, builds eyes, legs,
  toes, and folded or spread wings as separate parts, and writes a landmarks.json
  for rigging plus a dimension report. Supported body plans: bird, and quadruped
  (mammals such as a cat: body, head, tail, and four legs merged into one closed
  shell, with the ears separate). Works in any project. Rigging (bones, weights)
  belongs to the plz-rig-model skill.
  Triggers: "model this from the reference sheet", "make a 3D model from the
  turnaround", "Blender model from reference images", "export a glb from the
  sheet", "rebuild the model as v003", "orthographic views to mesh",
  "시트 보고 모델링해줘", "3면도로 3D 모델 만들어줘", "레퍼런스 이미지로 Blender 모델",
  "기준 시트로 glb 뽑아줘", "모델 다시 만들어줘/v003",
  "基準シートから3Dモデルを作って", "三面図からBlenderモデルを作って",
  "根据参考图纸建立3D模型", "用三视图生成glb模型".
---

# Build a 3D model from a reference sheet

The input is a reference sheet made by the `plz-model-sheet` skill (view images with the background removed, plus `measurements.json`). The goal is to rebuild, by script, **a real-size model with the same proportions, markings, and pivot**. Every value chosen by hand stays in one per-subject `spec.json`, so when the sheet is fixed or the version is bumped, two commands give the same result. Example values for a complete spec are in [references/spec-format.md](references/spec-format.md).

Two body plans are validated today.

- **Bird (`bodyPlan: "bird"`)**: cross-section lofting for a body that is long along one axis (birds, fish, and rodents, anything whose torso reads as a single tube), plus bird parts: eyes, Skin-modifier legs and toes, the folded-wing shell, and spread wings. Validated with a bird model.
- **Quadruped (`bodyPlan: "quadruped"`)**: cross-section lofting for the body plus tail without legs, leg capsules whose radius varies along the joint chain and paw ellipsoids, merged by SDF into **one closed shell** (leg roots filleted on the mesh), thin ear shell parts, and forward-facing eyes (vertical pupil optional). Validated with a cat model. Because there is a single shell, faces buried inside do not poke through when the legs swing widely after rigging.

There is no strategy yet for humans or other bipeds, winged quadrupeds, or subjects whose long fur changes the silhouette. For such a subject, say it is not supported; build and validate a new strategy module before using it. Never deliver a result from an unvalidated strategy.

## Outputs

Everything is built in `<out>/` under the name `<id>_<version>`. After checking, move the files to the project's `<art>/<id>/model/` (default `docs/art/<id>/model/`). Working files live in `~/.cache/plz-sheet-to-model/<id>/` and are not committed to the repository.

| File | Contents |
| --- | --- |
| `spec.json` | Per-subject settings. Every hand-chosen value ([references/spec-format.md](references/spec-format.md)) |
| `<id>_<ver>.blend` | Part objects, final materials, projection materials for re-baking, all images packed |
| `<id>_<ver>.glb` | For games. Subdivision applied, opaque textures as JPEG, alpha textures as PNG |
| `<id>_<ver>.landmarks.json` | Feature points, part names, and regions to hand to rigging ([references/conventions.md](references/conventions.md)) |
| `<id>_<ver>.report.json` | Dimensions, eye position, triangle count per object, file sizes, differences from the sheet's dimensions |

Axes, units, pivot, and naming follow [references/conventions.md](references/conventions.md) (meters, Z up, front is -Y = glTF +Z, left is +X, origin at the center under the feet).

## Setup

```bash
SK=<skill dir>/scripts   # <skill dir> is the directory that contains this SKILL.md
V=~/.cache/plz-sheet-to-model/venv/bin/python
[ -x $V ] || { python3 -m venv ~/.cache/plz-sheet-to-model/venv && ~/.cache/plz-sheet-to-model/venv/bin/pip install -q pillow numpy; }
B=${BLENDER:-$(command -v blender || echo /Applications/Blender.app/Contents/MacOS/Blender)}
"$B" -b --factory-startup --python-expr "import bpy; print(bpy.app.version_string)"   # 4.2 or later (validated on 5.2)
W=~/.cache/plz-sheet-to-model/<id>/work; O=~/.cache/plz-sheet-to-model/<id>/out
```

Run Blender **only in the background (`-b`)**. In safe mode the Blender MCP blocks numpy, file reads, and opening other .blend files, so it cannot run these scripts. Use the MCP only to look at a result in a Blender the user has opened, and never touch a file the user has open.

## Workflow

### 1. Check the inputs
Check that `<art>/<id>/views/*.webp` and `measurements.json` exist. The orientation must match the plz-model-sheet output: side and top views with the head to the right, front and back views upright, the glide (spread) view with the head up. Read px/cm (`sourcePxPerCm`) and the distances from the pivot to the front and back ends (`pivot_cm`) from `measurements.json`.

### 2. Write the spec
Start from the example values in [references/spec-format.md](references/spec-format.md) (a small bird for the bird plan, a cat for the quadruped plan) and adjust them to the subject. The hand-chosen values are the leg skeleton points and toes, the wing outline (`foldOutlinePx`), and the anatomical feature points (`skeleton`). Read outlines from a picture with a grid overlaid.
```bash
$V -I $SK/grid.py <art>/<id>/views/side.webp $W/grid-side.png --step 50
```
Write feature points in cm (x, f, z) by looking at the side image and the silhouette height. Joints must sit inside the body (between the top and bottom of the cross section).

For a quadruped, also decide the following.
- `silhouette.cutsPx`: polygons to exclude from the shape measurement, for ears that rise above the head in the side view and for paws and ears that stick out of the body in the top view. `openCm` erases whiskers.
- `legRemoval`: set `cutCm` a little above the underside of the belly, `minRunCm` larger than the leg thickness, and `sideRangeCm` to the front and back paw range so the tail is not erased.
- `limbs`: leg joints and radii. Decide them by measuring the silhouette runs per height (front-back and left-right widths and centers) in the side, front, and back views.
- `ears`: read the inner and outer x at the ear base and the tip from the front view, and the ear front and back f from the side view.
- Clip the body cross section with `loft.clampViews: ["front", "back"]`. If the eyes face forward, use `eyes.gazeDeg`, `lateralCm`, and `loft.upperTaper` (the nose bridge). If the views disagree on eye height, or an ear is drawn in front of the head, erase it from the body texture with `texture.bodyFillPx`.

### 3. Measure
```bash
$V -I $SK/measure_views.py <art>/<id>/model/spec.json $W
```
In `debug_side_legs.png`, check that the red parts are only legs and toes (if the belly is cut off in red, fix `legRemoval`). Compare the eye height in the output with `landmarks_cm` in `measurements.json`.

### 4. Build
```bash
"$B" -b --factory-startup -P "$SK/blender/build_model.py" -- <art>/<id>/model/spec.json $W $O
```
This takes about 5 seconds for a bird-sized subject and about 4 seconds for a cat-sized subject. A bird goes in this order: body cross-section lofting, eyes (raycast onto the head surface), legs (Skin), baking the projection materials (the folded look, and for a bird also the look without wings), the folded-wing shell, the spread wings, then glb, blend, landmarks, and report. A quadruped goes in this order: body and tail cross-section lofting and leg capsules, SDF union, leg-root fillet and smoothing, eyes, ears, Smart UV, projection baking for body and ears, landmarks (checking that the joints are inside the body), then output.

### 5. Check
```bash
"$B" -b $O/<id>_<ver>.blend -P "$SK/blender/inspect_model.py" -- $O/inspect
```
Look at `render_left/front/top/back/three_quarter.png` yourself and compare with the sheet. For hand-placed parts such as legs and ears, overlay the model silhouette on the view pictures pixel by pixel (red = model only, blue = sheet only, IoU in `overlay.json`).
```bash
"$B" -b $O/<id>_<ver>.blend -P "$SK/blender/overlay_views.py" -- <art>/<id>/model/spec.json $W $O/overlay
```
A rigged file is also read in the rest pose. If there is a previous version, compare the two dumps.
```bash
$V -I $SK/compare_models.py $O/inspect <previous dump> --map <new image>=<old image> --montage $O/montage
```
In `vsSheet` of `report.json`, check that length and height are within ±1%, that the width is near the range of the sheet's front, back, and top values, and that the wingspan matches the sheet. For a quadruped, the height includes the ears, and `landmarksOutside` and `landmarksMissing` must be empty.

### 6. Place and report
Copy the checked files to `<art>/<id>/model/` and add the file rows and limits to the README in that folder or to the sheet's README. Do not commit or push unless the user asks. The report states the dimension comparison, the triangle count and file size, the pictures checked by eye, and the limits.

## Quality criteria

- **Reproducibility**: every hand-chosen value is in the spec. Rebuilding from the same input gives byte-identical measurements, textures, meshes, and landmarks (only the order of the eye triangles in the glb changes from export to export, see [lessons](references/lessons.md)).
- **Dimension match**: length and height within ±1% of the sheet. The width falls within the difference between the generated views (the sheet's `groups` check).
- **Marking match**: the render shows the same markings as the sheet picture. The seam is only on the center line of the underside.
- **Game weight** (typical figures, not guarantees): for a bird-sized subject about 34,000 triangles and a glb of about 2.6 MB (no rig). For a cat-sized subject about 34,000 triangles and a glb of about 1.2 MB. Opaque textures are JPEG.
- **One shell (quadruped)**: the body mesh has 1 connected component, 0 boundary and non-manifold edges, and 0 self-intersections.
- **Honest limits**: without a view from below, the markings on the underside are stretched. The texture contains the sheet's lighting. Angle-dependent sheen (such as neck feathers) is a fixed color. State these points in the README.

## References

- [references/spec-format.md](references/spec-format.md): every spec key, with typical example values
- [references/conventions.md](references/conventions.md): the axes, names, and landmarks format shared with plz-rig-model
- [references/lessons.md](references/lessons.md): problems actually hit and their fixes
