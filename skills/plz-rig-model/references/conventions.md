# Shared conventions (plz-sheet-to-model <-> plz-rig-model)

This is the format of the model and `landmarks.json` that `plz-sheet-to-model` produces and `plz-rig-model` reads. Both skills carry the same content, so when you change it, change both. A model from any other source can be rigged as is if it follows these conventions.

## Coordinates

- The unit is meters. Blender has Z up.
- The subject faces -Y. Exported to glTF, the front is +Z and up is +Y.
- The subject's left is +X. So `.L` parts and bones are on the +X side.
- The origin is the ground under the center of the two feet.
- Values written by hand in spec files and documents are (x, f, z) in cm. f is forward (-Y x 100), x is lateral (+ is left), z is height. In Blender coordinates this is `(x/100, -f/100, z/100)`.

## Names

- Mesh objects are named `<id>_<part>`, with `_L`/`_R` appended when there is a left and right (`<id>_wing_fold_L`).
- Before rigging, the model keeps its parts as children of an empty object `<id>_root`. When rigged, this empty is deleted and the parts become children of the armature `<id>_rig`.
- Bones get `.L`/`.R` (`wing_upper.L`).

## landmarks.json

`build_model.py` writes it as `<id>_<version>.landmarks.json`. The values below are illustrative.

```json
{
 "id": "example_bird", "version": "v001", "units": "m",
 "axes": {"up": "+Z", "forward": "-Y", "left": "+X"},
 "bodyPlan": "bird",
 "points": {"hip": [0.0, 0.005, 0.055], "shoulder.L": [0.025, -0.0333, 0.1159], "...": []},
 "parts": {"body": "example_bird_body", "eye.L": "example_bird_eye_L", "...": ""},
 "regions": {"wing_fold_cover": {"plane": "fz", "units": "cm", "polygon": [[-18.0, 18.6], "..."], "dilate": 0.4}}
}
```

- `points`: Blender coordinates (m). The list of names is set by the rig template. For a bird, plz-sheet-to-model writes the spec's `skeleton` (give only the left side and the right is mirrored), the spread-wing joints (`wings.spread.joints` converted from wing coordinates), the eyeball centers, and `beak_tip`, `tail_tip`, and `crown` measured on the body surface. For a quadruped it writes `skeleton`, the tail points divided evenly by arc length along the side-silhouette center line (`tail_a` ... `tail_end`), `ear_base` and `ear_tip` computed from the ear shell, the eyeball centers, and `nose_tip` and `crown` on the body surface.
- `parts`: the template's part role -> object name.
- `regions`: regions used by rules such as weight pinning. `plane: "fz"` is a polygon on the (f, z) cm plane seen from the side, widened by `dilate` when used. plz-sheet-to-model writes the folded-wing outline (`wings.foldOutlinePx` converted to cm) as `wing_fold_cover`.

## What the bird template requires

- Center points: `beak_tip, tail_tip, crown` (informational), `hip, neck_base, neck_mid, head_base, beak_base, tail_base, tail_end`
- Left and right points (`.L/.R`): `eye` (informational), `hip_joint, heel, ankle, foot_end, hind_toe_end, shoulder, elbow, wrist, wing_end, wing_fold_root, wing_fold_end`
- Part roles: `body, eye.L, eye.R, legs, wing_fold.L, wing_fold.R, wing_spread.L, wing_spread.R`
- Regions: `wing_fold_cover` (the body region that the folded-wing shell covers). If it is missing, weight pinning is skipped and only a warning is printed.
- The spread wing (`wing_spread`) must be spread sideways in the bind pose, because the weights are divided by |x| (lateral distance).
- The folded wing (`wing_fold`) and the spread wing are different meshes. Hiding one scales the root bone of that mesh down to the template's `hideScale` (default 0.001, not 0), so each mesh is bound 100% to that bone and its children.

The definitions of bones, weights, and poses are in `references/templates.md` of the plz-rig-model skill.

## What the quadruped template requires

- Center points: `nose_tip, crown` (informational, on the body surface), `hip` (center of the pelvis), `spine_mid`, `chest` (inside the chest between the shoulders), `neck_base`, `head_base`, `snout` (inside the muzzle, just behind the nose), `tail_base`, `tail_a`, `tail_b`, `tail_c`, `tail_end`
- Left and right points (`.L/.R`): `eye` (informational), `ear_base, ear_tip, shoulder, elbow, wrist, front_toe, hip_joint, knee, hock, hind_ball, hind_toe`
- Part roles: `body` (one closed mesh that includes the head, neck, tail, and four legs), `eye.L, eye.R`, and `ear.L, ear.R` if the ears were made separately
- Regions: none.
- Joints sit at bone positions inside the body, not on the surface. For each joint, plz-sheet-to-model checks by ray parity that it is inside the body (inside the ear for the ear tip) and writes the depth to the surface in `landmarksInside` of report.json.
- How bones relate to points. Game code uses these bone names, so do not rename the points.
  - Torso: `hips: hip->spine_mid`, `spine: spine_mid->chest`, `chest: chest->neck_base`, `neck: neck_base->head_base`, `head: head_base->snout`
  - Ears and tail: `ear.L: ear_base.L->ear_tip.L`, `tail_1: tail_base->tail_a`, `tail_2: tail_a->tail_b`, `tail_3: tail_b->tail_c`, `tail_4: tail_c->tail_end`
  - Front legs: `upper_arm: shoulder->elbow`, `forearm: elbow->wrist`, `front_paw: wrist->front_toe`
  - Hind legs: `thigh: hip_joint->knee`, `shin: knee->hock`, `hind_foot: hock->hind_ball`, `hind_paw: hind_ball->hind_toe`
- `body` is a single-layer closed shell continuous from the leg roots. There are no other faces buried inside, so hidden faces do not poke through when the legs swing widely. The leg weights are divided within this one mesh.
- The ears and eyes are separate meshes, so each is bound 100% to one bone (the ears to `ear.*`, the eyes to `head`).
