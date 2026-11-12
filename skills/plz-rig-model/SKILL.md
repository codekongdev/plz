---
name: plz-rig-model
description: |
  Add a game-ready rig to an existing 3D mesh model (.blend or .glb), whether it came from
  plz-sheet-to-model or was generated, bought, or modeled by hand (a model that comes with its own
  rig, such as a downloaded humanoid avatar, keeps its artist weights). Uses a body-plan template
  (bird, quadruped such as a cat, or humanoid) to build the armature, skin weights, leg IK, base-pose
  actions, and check poses, exports glTF (glb) and .blend, verifies them with pose renders,
  self-intersection counts, and a re-import round trip, and outputs a bone rotation sign
  table (+1/-1) for game code. Runs Blender in the background, so the same input gives the
  same result. Use when the user wants to rig a model, add an armature or skeleton, skin or
  weight-paint it, prepare it for animation, make wings, legs, or a tail move, or learn the
  bone rotation directions or signs, and when fixing or re-attaching an existing rig.
  Triggers: "rig this model", "add armature/skeleton", "skinning", "Blender rigging for game",
  "make it animatable", "이 모델 리깅해줘", "뼈대/아마추어/스켈레톤 붙여줘",
  "스키닝·웨이트 페인팅", "애니메이션 만들 준비", "날개·다리·꼬리 움직이게",
  "본 회전 방향/부호 알려줘", "このモデルをリギングして", "ボーンを付けて",
  "给这个模型绑定骨骼", "做骨骼绑定和蒙皮".
---

# Rig a model

Attach bones, weights, and base poses to a mesh model **according to a body-plan template, and produce a glb that an engine can play immediately**. Bone positions come from the feature points on the model (`landmarks.json`); the bone set, weight methods, and poses come from the template (`templates/<name>.json`). So another individual with the same body plan is rigged by changing only the feature points.

There are three verified examples.
- **Bird**: re-rigging a model whose rig was stripped reproduces the original bone positions, weights, and actions. The glb animation differs by at most 3.2e-05 (floating-point error of the children of hidden bones), and the scripts before and after the cat work produce the same bytes.
- **Cat (quadruped)**: rigging the same input twice gives identical glb bytes.
- **Person (humanoid)**: a downloaded, already rigged avatar (Microsoft Rocketbox, 3ds Max Biped) brought in with `import_rigged.py`, its artist weights kept and summed into the template bones; rigging twice gives identical glb bytes.

Record the check poses, self-intersection counts, rotation sign table, and angle limits of your own model in the README of the model being rigged (step 6).

## Outputs

These go to the output folder (`--out`). If it is inside a repository, commit only when the user asks.

| File | Contents |
| --- | --- |
| `<name>.glb` | Skinned mesh with deform bones only, plus base-pose animations. Unit m, front +Z, up +Y |
| `<name>.blend` | Images packed, saved in the bind pose. Also contains the IK controls and the check action `rig_test` |
| `<name>.rig-report.json` | Bone list, deform bones, vertex count per part, count of unweighted vertices, actions, NLA tracks |

The check step adds `renders/` (pose images, `<prefix>_intersections.json`), `axes.json` (rotation sign table), and, if needed, an angle-limit table (`sweep_limits.py`) to the working folder.

## Setup

Paths below are relative to this skill's directory. Set `SK` to the absolute path of its `scripts/` directory.

```bash
SK=<absolute path of this skill's scripts directory>
B=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}   # Linux: blender
# Windows (Git Bash): B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"; pass paths as $(cygpath -w ...)
$B -b --factory-startup --python-expr "import bpy; print(bpy.app.version_string)"
```

- Blender 4.4 or later is required (verified on 5.2, macOS and Windows). numpy and the glTF add-on come with Blender.
- A `--view` that starts with a minus sign must be written `--view=-0.3,1,0.3`; otherwise argparse reads it as an option and the script exits before rendering.
- Keep the working folder at `~/.cache/plz-rig-model/<id>/`.
- Do not use the Blender MCP for rigging: its safe mode cannot run saved scripts. Do not touch a Blender file the user has open.

## Workflow

### 1. Confirm the template and the conventions
Pick the template that matches the target's body plan. Today there are `bird` (a bird standing on the ground, switching between folded and spread wings), `quadruped` (a four-legged animal; body, head, tail, and four legs are one shell, and the ears and eyes are separate) and `humanoid` (a person bound in an A- or T-pose whose mesh already carries skin weights from its source rig). For another structure (snake, and so on), write a new template in the format of [references/templates.md](references/templates.md), and add it to the skill only after it passes the step 5 checks on the actual target. Check that the model follows the coordinate and naming conventions in [references/conventions.md](references/conventions.md) (unit m, -Y front, left +X, origin under the feet). If it does not, first make a copy in Blender with the scale, rotation, and origin corrected.

**A model that already has a rig** (bought or downloaded, FBX or glTF): bring it in with `import_rigged.py` instead of fixing it by hand. It applies the transforms, scales the model so a chosen point sits at a given height (a person's eye height), keeps the source skin weights as vertex groups, writes `landmarks.json` from the source bones through the template's `sourceRigs` table, and can rebuild the materials and recolour one garment to match the reference sheet. Its settings live in a `spec.json` next to the model in the art folder (format in the script's header):
```bash
$B -b --factory-startup -P $SK/import_rigged.py -- --model <in.fbx|in.glb> --spec <art>/<id>/model/spec.json \
   --template humanoid --out ~/.cache/plz-rig-model/<id>/model
```
Check the `report` line (height, triangles, `unmapped none`) and look at the recoloured texture and a render before rigging. Keep the source files outside the repository and the source's license text next to the shipped model.

### 2. Feature points (landmarks.json)
- For a `plz-sheet-to-model` or `import_rigged.py` result, use the `landmarks.json` that came with it.
- Otherwise, make it yourself. Render gridded orthographic images and an empty skeleton:
  ```bash
  $B -b --factory-startup -P $SK/landmark_views.py -- --model <in.blend|in.glb> --out ~/.cache/plz-rig-model/<id>/views --template <bird|quadruped> --id <id>
  ```
  This produces `side.png`, `front.png`, and `top.png` (1 cm grid, with a bold line and a number every 5 cm), `views.json` (the pixel-to-cm formula), and `landmarks.todo.json`. Read the joint positions off the images in cm, convert them to m and fill them in, and write the part role -> object name mapping in `parts`. Place joints at the bone position inside the body, not on the surface (hip, neck base, and shoulder at mid-depth of the body; the ankle where the toes meet). A rule that needs a torso region (`wing_fold_cover`) is written as an (f, z) cm polygon on the side view.

### 3. Rig
```bash
$B -b --factory-startup -P $SK/rig_model.py -- --model <in.blend|in.glb> --landmarks <landmarks.json> --template <bird|quadruped> --out <out> --name <id>_vNNN
```
If a feature point or part is missing, the script reports its name and stops. If the input file already has a rig, the old rig and weights are removed and attached again. In the `report` line at the end of the output, check that it says `unweighted verts none`.

### 4. Pose renders and self-intersections
```bash
$B -b --factory-startup -P $SK/render_poses.py -- --blend <out>/<name>.blend --out <out>/renders --prefix <name> --intersections
```
This renders `rest` (bind), the base poses (in NLA track order), and each frame of `rig_test` (with the template label, as in `rig_test_3_alert`) from the same direction. Always look at the images yourself with Read. Render other directions, such as side or top, with `--view x,y,z`. For each pose, `--intersections` records the number of self-intersecting face pairs per mesh and the bones those faces mainly belong to, in `INTERSECT` lines and in `<prefix>_intersections.json`, plus `new vs rest`: the pairs the pose adds to the bind pose. Read `new` for a model with crossings built in (hair cards on the scalp, layered clothes: the Rocketbox person has 1,079 pairs at rest). `--mark` also renders `<prefix>_<pose>_cross.png` with the faces of the new pairs in red. If the number is not 0, look at where, and use the red images to tell whether it is a line where skin touches skin (thigh and belly), hair cards against a collar, or a face that has broken through. If there is a previous version to compare with, render that file with the same arguments and view them side by side.

### 5. Verify
- **Re-import**: `render_poses.py -- --glb <out>/<name>.glb --out ...` (renders all actions by default; for a bird, `pose_ground,pose_flight`, for a quadruped, `pose_stand`). In the `ROUNDTRIP` line, check that the deform bone count, skinned mesh count, and action names are right, and that the pose images are right. The glTF export writes even a 1-frame action with the same two keys; an engine only needs to read the first key.
- **Compare with the previous version** (when there is one):
  ```bash
  $B -b --factory-startup -P $SK/inspect_rig.py -- dump --blend old.blend --glb old.glb --out old.json
  $B -b --factory-startup -P $SK/inspect_rig.py -- dump --blend new.blend --glb new.glb --out new.json
  python3 $SK/inspect_rig.py compare old.json new.json
  ```
  This reports differences in bone positions, parents, weights, actions, and glb animation as PASS/FAIL. If there is a FAIL other than where you changed things on purpose, find the cause. When comparing with an old file whose hiding scale was 0 and was changed to `hideScale` (older bird rigs and similar), that difference is reported separately as `INFO … hide scale changed` and `children of zero-scaled bones … rest-local` lines (lessons.md item 11). Re-dump old dumps with this script.
- **Same input twice**: rig once more into a different folder and check that `dump`/`compare` as above gives `RESULT MATCH` (reproducibility).
- **Rotation sign table** (when the engine rotates bones on their local axes): if the template has `rotationSigns`,
  ```bash
  python3 $SK/rig_axes.py --glb <out>/<name>.glb --template <t> --out <out>/axes_glb.json
  $B -b --factory-startup -P $SK/rig_axes.py -- --blend <out>/<name>.blend --template <t> --out <out>/axes_blend.json
  ```
  For each bone, this reports where the tip goes on the glTF axes (+X left, +Y up, +Z front) when local X, Y and Z are rotated +10 degrees on top of `pose_stand` (the bind pose for a template without it, such as `bird`) (`AXES`; for Y, which turns a bone about itself, the probe is the end of local +Z), and the sign per meaning (`SIGN pitchDown 1` and so on). The two results must match. If it says `MIXED`, the axes differ by side or by segment, so find the cause (bone direction, roll, `alignZ`).
- **Angle limits** (when there are motions that bend a joint a lot):
  ```bash
  $B -b --factory-startup -P $SK/sweep_limits.py -- --blend <out>/<name>.blend --out <out>/sweep_front.json \
     --vary "upper_arm.*:X:-80:40:10" --vary "forearm.*:X:0,30,45,60,75,90" --near upper_arm,forearm,front_paw
  ```
  This counts self-intersections for each angle combination and leaves the clean range as numbers (`--hold` fixes other bones, such as spine bend; several holds on one bone apply in the order given). Add `--base pose_stand` when the base pose differs from the bind pose (a humanoid's lowered arms): the angles are then added on top of it, as the engine does, and `new` counts the pairs added to the bind pose. Sweep the joints in the positions the motions actually use (a raised arm reaches the head at a smaller elbow angle than a hanging one). Copy the ranges into the README's limits.
- If something looks wrong, start with [references/lessons.md](references/lessons.md).

### 6. Documentation and report
In the model folder's README, write the bone list, the part switch rule (the bird's wings), the rotation sign table, the main bones per motion, the angle limits, and the commands to rebuild (copy the per-template content from [templates.md](references/templates.md) and replace it with the numbers measured on this target). In the report, give the output paths, the bone count (deform/total), the triangle count, the check results (names of the bone images, self-intersection count per pose), the rotation sign table, the `ROUNDTRIP` line, the reproducibility result, what changed from the previous version, and the remaining limits.

## Quality bar

- **Completeness**: every part vertex has weights, and a part that is hidden is attached to a single bone only.
- **Deformation**: in check poses such as pecking, walking, wing up and down, turning the head, and crouching, no faces break through or tear. Judge by looking at the images, and leave the numbers with the self-intersection counts. Unavoidable contact (a deeply folded leg against the belly) is recorded as an angle limit.
- **Engine compatibility**: the glb has only deform bones and base-pose actions (with keys on every deform bone), and skin and actions are unchanged after re-import. The .blend opens in the bind pose. If the engine rotates bones directly, measure the rotation sign table on both the .blend and the glb and check that they match.
- **Reproducibility**: the same input gives the same result. Leave hand-corrected values in `landmarks.json` or the template, and never hand-edit only the output files.
- **Honest limits**: write in the README what the template cannot do, such as a wing switch with no intermediate shape, a tail with one bone, or joint angles at which skin touches.
