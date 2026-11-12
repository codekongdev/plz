# Templates

A template is JSON that describes the rig for one body plan as data (`templates/<name>.json`). Today there are the verified `bird` and `quadruped` (cat). Humanoids and others are made when rigging an actual target, and added after they are verified on that target.

## Fields

| Key | Meaning |
| --- | --- |
| `bones` | `{name, head, tail, parent, deform, sided}`. `head` and `tail` are landmarks point names, and `"origin"` or `{"from": point, "forward_cm": d}` (d cm forward) can also be used. If `sided: true`, two bones `.L` and `.R` are made and the same suffix is added to the point names. If the parent is a left/right bone, it attaches to the bone on the same side. Order: all center bones, then left, then right. Roll is 0, and if the head equals the parent's tail, `use_connect` |
| `ik` | `{bone, target, chain, copyRotation}`. IK is put on `bone`, and the `copyRotation` bone follows the target's rotation. The target bone is `deform: false`, so it is left out of the glb, and the result is baked into the animation on export |
| `weights` | One rule per part. If `part` is written like `eye.*`, it means both sides. `.*` inside a rule is replaced with the part's side, and for a center part (`body`) it becomes both sides. A rule can have `smooth` (smoothing of weights near joints) and `maxInfluences` (limit on bones per vertex) added |
| `hideScale` | The scale used when hiding a part (default 0.001). 0 is not used (item 11 of [lessons.md](lessons.md)) |
| `basePoses` | Base poses for the engine. `hide` (bones to hide, shrunk to `hideScale`), `move` ({bone: [x, f, z] cm}, world axes), `rotate` ({bone: [X, Y, Z] degrees}, pose-bone local Euler). Each becomes a 1-frame action and goes into the glb as a muted NLA track |
| `testPoses` | Check actions (`rig_test`). For each frame, the `base` (base pose name) is applied first and then overridden. `label` becomes an action marker and is added to the render file name. With `ik: false` (for the whole action or per frame), keys 0 on the influence of the IK and copy-rotation constraints so the legs follow the FK rotation as-is (like the engine). It stays only in the .blend and does not go into the glb |
| `rotationSigns` | The meaning of rotation directions for the engine. `{meaning: {bones, axis: "X"\|"Z", tipMoves: a glTF axis such as "+Z"}}`. `rig_axes.py --template` measures it on the actual rig and outputs +1/-1 for each meaning |
| `export` | glTF settings. Image format, NLA_TRACKS, deform bones only, apply modifiers, morph off |

## Weight strategies (`scripts/riglib/weights.py`)

| method | What it does | Used for |
| --- | --- | --- |
| `heat` | Blender bone heat. Bones outside `bones` have deformation turned off for the moment, so the torso is not dragged by the legs, wings, or root | Torso |
| `lock` (added to heat etc.) | Inside `region` (+`dilate`), 100% to one bone, and over the outer `blend_cm`, blend into the original values with a smoothstep | Torso under the folded wing |
| `rigid` | All vertices 100% to one bone | Eyes, the folded wing shell |
| `nearest_segments` | Raise the distance to the bone segments on the vertex's side (x >= 0 is .L) to the power of -`power`, take the largest `keep`, and normalize | Legs, toes |
| `span_blend` | Divide the bone chain by |x| and hand over with a smoothstep within |x| +/- `half_width_cm` of each joint | Spread wing |
| `smooth` (added to heat etc.) | A list of passes `{around: [point], radius_cm, iterations, factor}`. Shrinking so that everything within r/2 of the point is included and it reaches 0 at r, repeatedly blend all bone weights toward the average of neighboring vertices and normalize again | Armpit, groin, elbow, knee |
| `maxInfluences` (added) | Keep only the n largest weights per vertex and normalize. glTF exports only 4 by default, so setting 4 makes the .blend and glb deform identically | Quadruped torso |

A new strategy is a function with the same signature `(rig, ob, rule, lm)` registered in `STRATEGIES`. The added steps run in the order `lock` -> `smooth` -> `maxInfluences`.

## bird template

### Bones (22 deform bones in the glb)
`root` -> `body` -> `neck_1` -> `neck_2` -> `head`, `body` -> `tail`, left and right `thigh` -> `shin` -> `foot` and `toe_hind`, left and right `wing_upper` -> `wing_fore` -> `wing_hand`, left and right `wing_fold`. The .blend also has the IK targets `foot_ik.L/R` (children of root, non-deforming).

### Wing switch rule
Both the folded wing (shell) and the spread wing are included. For each motion, the root bone of one of them is shrunk to `hideScale` (0.001) to hide it. The shrunk part is buried in the body at 0.3 mm size inside the shoulder and wing root, and is not visible.
- Ground motions: set `wing_upper.L/R` to 0.001. `wing_fore` and `wing_hand` are children, so they shrink with it. The translation and rotation of the child bones stay at their bind values.
- Flight motions: set `wing_fold.L/R` to 0.001.
- Why 0 is not used: if the parent scale is 0, the glTF export cannot compute the child's local transform and writes arbitrary values (in a bird model, a 1.3 m translation), and when the engine blends two poses, the wing flies in from far away.
- In the bind pose, both are visible. So the engine always uses it with one action playing. `pose_ground` and `pose_flight` are the base poses for this rule.
- For takeoff and landing, change the scale on the frame where the wing starts to spread. There is no intermediate shape, so cover it with fast flapping.

### Rotation directions (pose-bone local axes, confirmed by rotating directly on the bird)
- `body`, `neck_*`, `head`, `tail`: X+ is the direction that tips forward.
- `wing_upper`: X+ is the direction that lifts, and the sign is the same on both sides. Z is the axis for folding forward and back, and on the left + and on the right - fold backward.

### Main bones per motion
| Motion | Bones |
| --- | --- |
| Idle | `body` breathing (small X), `neck_1` and `head` looking around, `tail` |
| Walking (head back and forth) | stepping with `foot_ik.L/R`; rotate `neck_1` (-) and `neck_2` (+) in opposite directions to push the head forward and then hold |
| Pecking (1.2 s) | `body` +30 degrees, `neck_1` +30 degrees, `neck_2` +25 degrees, `head` +20 degrees, slightly lift the tail (`tail` -) -- frame 2 of `rig_test` |
| Takeoff | the `pose_ground` -> `pose_flight` switch frame, `foot_ik` back and up, `wing_upper` large up and down |
| Flapping | `wing_upper` +55 degrees <-> -35 degrees, the tips following with `wing_fore` and `wing_hand` -- frames 4 and 5 of `rig_test` |
| Gliding and descending | keep `pose_flight`, `wing_upper` slightly up, tilt `body` forward for the descent |
| Landing | extend `foot_ik` forward and down and raise `body` upright, switch to `pose_ground` at the moment of landing |
| Hit | a short shake of `body` and `neck_*` |
| Collapsing | raise `foot_ik` toward the body to lower `body`, drop `head` |

## quadruped template

Verified on a cat model. The points and parts are in the quadruped section of [conventions.md](conventions.md).

### Bones (26 deform bones in the glb, 30 in the .blend)
- Center: `root` (origin) -> `hips` (hip->spine_mid) -> `spine` (spine_mid->chest) -> `chest` (chest->neck_base) -> `neck` (neck_base->head_base) -> `head` (head_base->snout). `head` -> `ear.L/R` (ear_base->ear_tip). `hips` -> `tail_1` (tail_base->tail_a) -> `tail_2` -> `tail_3` -> `tail_4` (->tail_end).
- Front legs: `chest` -> `upper_arm` (shoulder->elbow) -> `forearm` (elbow->wrist) -> `front_paw` (wrist->front_toe).
- Hind legs: `hips` -> `thigh` (hip_joint->knee) -> `shin` (knee->hock) -> `hind_foot` (hock->hind_ball) -> `hind_paw` (hind_ball->hind_toe).
- Only in the .blend: the IK targets `front_ik.L/R` (wrist->front_toe, two-bone IK on `forearm`, with `front_paw` copying rotation) and `hind_ik.L/R` (hock->hind_ball, two-bone IK on `shin`, with `hind_foot` copying rotation). Children of root, non-deforming.
- Roll is 0. The leg, trunk, and tail bones are all in the front-back/up-down plane, so local X is the model's left (+X). The ears tilt outward, so local X turns about 25 degrees away from +X (the sign is the same). `root`, which points exactly forward (-Y), has its axes rotated 180 degrees about Z by Blender, so local X is -X (lessons.md item 17). If the engine ever needs to rotate `root`, note this.

### Weights
- `body`: heat (all deform bones except root and ears) -> three smoothing passes near the joints (shoulder r 9 cm 150 iterations, hip joint r 8 cm 120 iterations, elbow and knee r 3.5 cm 40 iterations, all factor 0.5) -> limit to 4 per vertex. The smoothing reduced the hollow-of-the-knee intersections of the crouch (`alert`) from 39 pairs to 0 and reduced the crease behind the shoulder when the front leg is extended forward 76 degrees.
- Eyes are 100% on `head`, and ears are 100% on `ear.*`.
- The upper arm and thigh skin is a rounded area on the side of the torso (because the elbow and knee are at the height of the belly line). The legs seen below the torso start from `forearm` and `shin`.

### Base pose and check poses
- `pose_stand`: 1 frame, the bind pose. All deform bones have keys (IK is baked, so it differs from the bind by at most 0.04 degrees).
- `rig_test` (IK off, CONSTANT): `rest`, `look_away` (neck Z -30 degrees, head Z -40 degrees), `alert` (crouch 25 degrees, neck and head raised, ears forward, root -2.06 cm), `walk` (left front leg and right hind leg forward 25 degrees), `run_reach`, `run_gather` (the extremes of the gallop in the game constants, root -2.95 cm), `run_gather_clean` (the same pose reduced to the clean range), `tail_sway`.

### Rotation directions (glTF axes: +X left, +Y up, +Z front. Measured on the .blend and glb of a cat model)
| Meaning | Bones | Axis | Sign | Basis (share of the direction the tip moved at +10 degrees) |
| --- | --- | --- | --- | --- |
| `pitchDown` the front (nose) goes down | hips, spine, chest, neck, head | X | +1 | -Y 0.89-0.99 |
| `legForward` the foot goes forward | upper_arm, thigh | X | -1 | -Z 0.93-0.98 on +X rotation |
| `lowerBack` the lower segment goes backward | forearm, shin | X | +1 | -Z 0.75-1.00 |
| `hindFootForward` the hind foot goes forward | hind_foot | X | -1 | -Z 1.00 on +X rotation |
| `turnLeft` the nose tip goes left | neck, head | Z | -1 | -X 1.00 on +Z rotation |
| `tailSwingLeft` the tail goes left | tail_1-4 | Z | -1 | -X 1.00 on +Z rotation |
| `tailLift` the tail tip goes up | tail_1-4 | X | +1 | +Y 0.88-1.00 |
| `earBack` the ear tip goes backward | ear.L, ear.R | X | -1 | +Z (forward) 0.91 on +X rotation |

To remember it as a rule: local X+ rotates the bone's tip toward the bone's local Z, and the local Z of a bone with roll 0 is down for a bone that faces forward (trunk, head), back for a bone that faces down (legs), up for a bone that faces back (tail), and forward for a bone that faces up (ears). Local Z+ rotates the tip to the right (-X).

### Main bones per motion
| Motion | Bones |
| --- | --- |
| Idle | `chest` and `spine` breathing (small X), `tail_3` and `tail_4` side to side (Z) |
| Looking away | `neck` and `head` Z (left is -) |
| Alert | crouch on all four legs (upper_arm and thigh X-, forearm and shin X+, hind_foot X-), `neck` and `head` raised with X-, ears forward with X+ |
| Walking | upper_arm and thigh X of the diagonal leg pair, fold forearm and shin of the leg moving forward, tail raised with X+ |
| Gallop | crouch + swinging the front and hind leg pairs, spine bend and extension with X on `hips`, `spine`, and `chest`, ears back with X- |

### Angle limits (a cat model, both legs at the same angle, 10 or fewer self-intersection pairs counted as clean)
- Upper arm: forward is clean up to 80 degrees (even with the forearm folded 90 degrees). Backward, up to 40 degrees when the forearm fold is 0, 30 degrees at 30, 20 degrees at 45, 10 degrees at 60, 0 degrees at 75, and -10 degrees (forward) at 90. In a gallop with spine bend (spine +12 degrees, chest +6 degrees, hips -6 degrees), up to 18 degrees at a forearm of 50 degrees and 12 degrees at 60 degrees.
- Thigh: forward up to 40 degrees (shin 60 degrees or less). Beyond 50 degrees the thigh digs into the belly (40-330 pairs). Backward, up to 40 degrees with the shin at 30 degrees or less.
- Shin fold: clean up to 45 degrees (with the thigh between 40 degrees forward and 30 degrees back). 60 degrees is clean only when the thigh is 20-30 degrees forward (26-37 pairs near neutral, in the hollow of the knee), and 75 degrees or more is 113 pairs or more (the hollow of the knee and the back of the thigh touch).
- Neck and head left/right: 0 pairs up to neck +/-40 degrees with head +/-60 degrees.
- The gallop constants (`run_reach` 85 pairs, `run_gather` 450 pairs) exceed these ranges. The part beyond is a line where skin touches skin, and no broken-through faces or tearing were seen in the images.
