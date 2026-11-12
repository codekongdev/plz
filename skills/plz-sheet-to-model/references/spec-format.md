# Model spec.json format

The model settings for one subject. Keep it at `<art>/<id>/model/spec.json`; `measure_views.py` and `build_model.py` both read it. Read the values that can be measured from the sheet (px/cm, pivot, silhouette, eye position) from the sheet, and write only the hand-chosen values here. The values below are typical example values from two validated builds: a small bird (the "Small bird" column in the tables) and a cat (the [Quadruped](#quadruped-bodyplan-quadruped) section and the "Cat" columns). They are illustrative, not defaults, and no spec file ships with this skill. If you omit a key that is not in a table, the behavior is as before.

Coordinates are (x, f, z) in cm: x lateral (+ is left), f forward (+ toward the head, from the pivot), z height above the ground. For values that come in left and right, write only the left.

## Top level

| Key | Meaning | Small bird |
| --- | --- | --- |
| `id`, `version` | File and object name `<id>_<version>` | `example_bird`, `v001` |
| `bodyPlan` | The body plan written to landmarks. Same as the rig template name. `quadruped` builds with the quadruped flow (`stm/quadruped.py`) | `bird` |
| `sheet` | The sheet folder (`views/`, `measurements.json`), relative to the spec's location | `..` |
| `views` | View name -> file relative to the sheet folder. `side`, `top`, `front`, `back` are required; a bird's wings also need `spread` | `views/side.webp` etc. |
| `pxPerCm` | (optional) Overrides `sourcePxPerCm` from `measurements.json` per view | none |
| `frontCm`, `backCm` | (optional) From the pivot to the front and back ends. The default is `pivot_cm` from `measurements.json` | 13.12, 18.88 |

## legRemoval: remove legs from the silhouette

Erases legs and toes in the band near the ground so they do not mix into the body cross section. The red parts of `debug_side_legs.png` are what was erased.

| Key | Meaning | Small bird |
| --- | --- | --- |
| `toeCm` | Everything below this height is erased (the toe band) | 1.3 |
| `cutCm` | Below this height, only the parts that run horizontally for `minRunCm` or more (the belly) are kept | 3.0 |
| `minRunCm` | The horizontal length accepted as belly | 4.0 |
| `sideRangeCm` | The f range to erase in the side view. Narrow it so low-hanging parts such as the tail tip are not erased | [-6, 5] |

## silhouette: tidy the silhouette used for measuring shape (optional)

Used only for the shape measurement (cross sections and the width table); textures use the uncut silhouette. These are cat values.

| Key | Meaning | Cat |
| --- | --- | --- |
| `openCm` | Opening with a [height, width] cm box per view. Erases whiskers and fur tips thinner than this | [0.15, 0.15] in all four views |
| `cutsPx` | A list of polygons to erase per view (px, x to the right, y down). For parts built separately, such as ears rising above the head in the side view and paws and ears sticking out of the body in the top view | 1 ear in the side view, 4 paws and 2 ears in the top view |

## loft: cross-section lofting of the body

| Key | Meaning | Small bird |
| --- | --- | --- |
| `smooth` | Moving-average window over the silhouette values at 0.25 cm spacing (removes noise at feather edges) | 5 |
| `rawTipFromCm` | In front of this f, no smoothing (so the beak or nose tip does not turn blunt) | 11.6 |
| `stations` | List of cross-section positions `[start, end (exclusive), spacing]`. Dense where the end tapers | [[-18.88, 11.0, 0.5], [11.12, 13.13, 0.25]] |
| `rings` | Number of vertices in one cross section | 32 |
| `exponent` | Superellipse exponent of the cross section (2 = ellipse, larger is more angular) | 2.3 |
| `tipExponent` | The exponent in front of `fromCm` | {"fromCm": 11.0, "n": 2.0} |
| `frontClampSoftCm` | The soft minimum width used when clipping the cross section by the front silhouette width | 0.15 |
| `frontStepCm` | Height spacing of the front width table | 0.5 |
| `capOffsetCm` | How far the back and front end cap vertices sit from the last cross section | {"back": 0.05, "front": 0.03} |
| `uvSeamIndex` | The cross-section vertex number where the UV seam goes (0 = left side, 8 = top, 24 = underside) | 24 |
| `uvPad` | UV margin at top and bottom | 0.01 |
| `subdiv` | Subdivision level used for eye raycasts and baking | 2 |
| `decimals` | Decimal places for rounding measured values (same input -> same result) | 2 |
| `frontClamp` | (optional) Whether to clip by the front width. Default true | none |
| `clampViews` | (optional) At each height, clip by the widest width among these views. The default is the front only | none |
| `upperTaper` | (optional) Within the f ranges of `table` ([[f, amount]]), narrows the upper part of the cross section by a factor of `1 - amount x smoothstep(fromT, 1, t)` (t is the height within the cross section, -1...1, with a minimum of `min`). For the nose bridge and the face in front of the eyes, which do not show in the silhouette | none |

## eyes

| Key | Meaning | Small bird |
| --- | --- | --- |
| `detect` | Measures f and z from the center of the eye-colored pixels in the side view. `colour` is calibrated only for `orange` for now, and the search is only above `minHeightCm` | {"colour": "orange", "minHeightCm": 13.0} |
| `position` | (optional) [f, z] cm instead of detection. Use this for eyes whose color is faint | none |
| `radiusCm`, `insetCm` | Eyeball radius, and how far it is pushed inward from the surface | 0.32, 0.18 |
| `pupilDeg`, `segments` | Pupil angle (from the pole), UV sphere divisions | 22, [32, 24] |
| `iris`, `pupil`, `*Roughness` | Colors (sRGB hex) and roughness | `#be6223` 0.15, `#0b0b0c` 0.1 |
| `gazeDeg`, `lateralCm` | (optional) For forward-facing eyes. Shoots a ray along the gaze direction (yaw degrees outward from the front) toward (lateralCm, f, z) and places the eye on the surface; the pupil also looks along the gaze | none |
| `pupilShape` | (optional) If `"slit"`, reads `pupilDeg` as [horizontal half-angle, vertical half-angle] and makes a vertical slit pupil | none |
| `rim` | (optional) Paints the faces farther than `fromDeg` from the gaze in `colour` (the eyelid line) | none |

## legs: Skin legs (bird)

| Key | Meaning | Small bird |
| --- | --- | --- |
| `chain` | Point names from `skeleton` and radii (cm). The first point is the Skin root | [["hip_joint", 0.55], ["heel", 0.34], ["ankle", 0.2]] |
| `toes` | Three points per toe [middle, claw start, claw end] (left foot) | mid, inner, outer, hind |
| `toeRadii` | Radii of the three points | [0.14, 0.095, 0.025] |
| `subdiv` | Subdivision of the Skin result | 1 |
| `colour`, `roughness` | Leg color | `#ad5f6f`, 0.55 |
| `claw` | Claw material and extent: among the faces past `startT` (a ratio) from the claw start, those within `radiusCm` of the axis | `#2a2a2d`, 0.3, 0.05, 0.22 |

## texture

| Key | Meaning | Small bird |
| --- | --- | --- |
| `size` | Baked texture size | 2048 |
| `blendPower` | View blending weight = normal component ^ power. Larger makes the boundaries sharper | 3 |
| `samples`, `marginPx` | Cycles bake samples, margin outside the islands | 4, 16 |
| `padIters` | Iterations (px) for filling outside the view image's silhouette | 80 |
| `roughness`, `specular` | Feather and fur material | 0.78, 0.3 |
| `keepLegs` | (optional) Keep the legs in the texture (for quadrupeds, whose legs are modeled) | none |
| `bodyFillPx` | (optional) Per view, circles [cx, cy, r] and polygons (px) to fill in on the body texture. For a painted eye that the eyeball replaces, or an ear drawn in front of the head. Written separately as `tex_<view>_body.png`, and parts such as ears are baked from the original picture | none |
| `fillIters`, `fillScale` | Iterations of the `bodyFillPx` diffusion fill, and the shrink factor | 400, 4 (default) |

## wings: bird wings (`type: "bird"`)

| Key | Meaning | Small bird |
| --- | --- | --- |
| `foldOutlinePx` | The folded-wing outline in the side image (px, x to the right, y down). Extend the top to the top edge of the image so it covers the back. Read it with `grid.py` | 15 points |
| `foldDilateCm` | Margin outside the outline when picking faces for the shell. After cutting, it fits the outline exactly | 0.4 |
| `foldOffsetCm` | Distance to lift the shell along the body normal | 0.2 |
| `flank` | How to fill the flank that the wing hid: `excludePx` (boxes [x0, y0, x1, y1) to leave out of the fill source, such as the tail under the wing feathers), `keyColour`, `keyScale`, `keyMix` (blend with the sheet's body color), `iters`, `scale` (diffusion) | `#bdc5d1` x 0.9 at 60%, [[0, 561, 620, 100000]], 400, 4 |
| `spread.spanCm` | The maximum lateral distance to measure in the glide view | 32.0 |
| `spread.tailClearCm` | Inside this, the lower run is the tail, so only the first run counts as wing | 9.0 |
| `spread.rootFromCm`, `smooth` | Values measured from this x are used (inside it is the body), and the moving-average window | 5.0, 7 |
| `spread.stations`, `tip` | List of wing cross-section x positions, and the end cross section (x, half chord) | 22 stations, {"xCm": 32.4, "halfChordCm": 0.6} |
| `spread.leadPadCm`, `trailPadCm` | Margin for cutting the feather outline by alpha. The leading edge goes outward, the trailing edge backward | 0.35, 0.5 |
| `spread.frame` | Glide-view coordinates -> standing-body coordinates: f shift, shoulder f and z, pitch aligned to the body axis, dihedral, wing-root x | -1.1, 3.0, 11.5, 15 degrees, 5 degrees, 2.5 |
| `spread.chordSamples` | Number of vertices along the chord (cosine spacing) | 9 |
| `spread.thickness` | Wing thickness (cm) per x, linear in between | [[2.5, 1.0], [6, 0.55], [14.5, 0.3], [20, 0.14], [32.4, 0.05]] |
| `spread.camber` | Camber = chord x (`root` - `tipDrop` x x/tip) | 0.05, 0.025 |
| `spread.joints` | Joints for rigging (wing coordinates: x, glide-view f, up zz) | shoulder [2.5, 3.6, 0.2], elbow [8.0, 3.95, 0.2], wrist [14.5, 4.97, 0.15], tip [31.9, 1.3, 0.0] |
| `spread.underside` | Underside color: brightness below `darkBelow` is multiplied by `darkGain`, the rest is mixed with `pale` by `paleMix`, size factor `scale` | [0.86, 0.88, 0.90], 0.35, 1.4, 0.65, 0.5 |
| `spread.alphaPadPx`, `padIters`, `padScale` | Color margin outside the alpha (px), color-fill iterations and shrink factor | 6, 60, 2 |

## skeleton: anatomical feature points

Write the points the rig template requires as (x, f, z) cm. For left and right points, write only `.L`. Small bird:

| Point | Value | Point | Value |
| --- | --- | --- | --- |
| `hip` | (0, -0.5, 5.5) | `hip_joint.L` | (1.35, -0.2, 3.8) |
| `neck_base` | (0, 3.0, 11.0) | `heel.L` | (1.65, -0.55, 2.25) |
| `neck_mid` | (0, 5.8, 13.9) | `ankle.L` | (1.78, -0.25, 0.42) |
| `head_base` | (0, 8.2, 15.9) | `foot_end.L` | (1.9, 2.6, 0.15) |
| `beak_base` | (0, 11.6, 15.7) | `hind_toe_end.L` | (1.7, -2.3, 0.12) |
| `tail_base` | (0, -7.5, 6.2) | `wing_fold_root.L` | (2.8, 3.0, 11.0) |
| `tail_end` | (0, -18.5, 2.7) | `wing_fold_end.L` | (3.5, -12.0, 8.5) |

Put the center points inside the body cross section (between the top and bottom of the silhouette at that f). `hip_joint`, `heel`, and `ankle` are also used as the Skin skeleton of the leg mesh.

## Quadruped (`bodyPlan: "quadruped"`)

The body, head, neck, and tail are built by cross-section lofting. The four legs are built from capsules whose radius varies along the joint chain, plus paw ellipsoids, and everything is merged by SDF into one closed mesh (`<id>_body`). The ears are thin shell parts (`<id>_ear_L/R`). These are values from a cat build.

### limbs: leg chains

| Key | Meaning | Cat |
| --- | --- | --- |
| `chains` | For each chain, a `name` and `points`: [skeleton point name, radius]. The radius is one value in cm or two values [lateral (X), within the chain plane]. One capsule per segment | front: shoulder [1.9, 2.6] -> elbow [1.6, 2.3] -> wrist [1.3, 1.5] -> front_toe [1.1, 0.7]; hind: hip_joint [2.0, 3.0] -> knee [1.8, 2.6] -> hock [1.2, 1.8] -> hind_ball [1.25, 1.5] -> hind_toe [1.1, 0.7] |
| `paws` | Paw ellipsoid: `chain`, `centre` (x, f, z), `radiiCm` (x, f, z) | front (2.75, 12.15, 1.0) [1.42, 2.15, 1.0]; hind (3.2, -11.2, 1.0) [1.45, 2.3, 1.0] |
| `ringVerts`, `capRings`, `alongRings`, `pawSegments` | Vertices around a capsule, number of end hemisphere rings, number of rings along a segment, paw sphere divisions | 16, 4, 4, [24, 12] |

Put the first joint (shoulder, hip joint) inside the body cross section. Decide joint positions and radii by measuring the runs per height in the side view (front-back width), the front view (front-leg lateral width), and the back view (hind-leg lateral width), and check with the `overlay_views.py` overlay.

### union: merge into one shell

| Key | Meaning | Cat |
| --- | --- | --- |
| `voxelCm` | SDF voxel size. It sets the mesh density (about 30,000 body triangles at 0.45 cm, uniform quads) | 0.45 |
| `filletCm`, `filletIterations`, `filletFactor` | Leg-root fillet: gives weights only to vertices within `filletCm` of both the body loft and the leg surface, then Smooth | 1.0, 15, 0.5 (default) |
| `smoothIterations`, `smoothFactor` | Overall Smooth (removes voxel stair steps) | 3, 0.5 (default) |
| `bandVoxels` | Width of the SDF narrow band | 3 (default) |
| `maxTris` | (optional) Collapse (decimate) if exceeded. It makes the triangles uneven, so it is better to adjust with the voxel size | none |

### ears: ear shell

| Key | Meaning | Cat |
| --- | --- | --- |
| `medialBase`, `lateralBase`, `tip` | The base of the ear's inner edge, the base of the outer edge, and the tip, as (x, f, z) cm, for the left ear. Read x and z from the front view and f and z from the side view | (1.5, 21.6, 26.4), (3.9, 21.8, 24.9), (3.7, 21.9, 28.85) |
| `cupCm`, `cupDir`, `cupPower` | The depth and direction in which the middle of the base bulges backward, and the exponent by which it shrinks toward the tip ((1 - v)^p; below 1 the back line is convex) | 3.4, (0.15, -1, 0), 0.35 |
| `thicknessCm`, `sinkCm` | Shell thickness (thinner toward the tip), and how deep the base is sunk into the head | 0.3, 1.0 |
| `segments`, `tipJointT`, `textureSize` | [horizontal, vertical] divisions, the height ratio at which to put the `ear_tip` joint, ear texture size | [10, 10], 0.85 (default), 512 |

### tail, uv

| Key | Meaning | Cat |
| --- | --- | --- |
| `tail.startCm` | The f where the tail-only band begins in the side view. Divided evenly by arc length along the side center line from this f, starting at `skeleton.tail_base` | -15.0 |
| `tail.endInsetCm` | How far inside from the tail tip to put `tail_end` | 1.0 |
| `tail.points` | Names of the points to divide into | `tail_a, tail_b, tail_c, tail_end` (default) |
| `uv.angleDeg`, `uv.islandMargin` | Angle limit of Smart UV Project, island spacing | 66, 0.003 |

### Cat skeleton (x, f, z cm)

| Point | Value | Point | Value |
| --- | --- | --- | --- |
| `hip` | (0, -10.5, 17.5) | `shoulder.L` | (2.9, 12.3, 15.8) |
| `spine_mid` | (0, 0, 19.5) | `elbow.L` | (2.8, 10.8, 10.8) |
| `chest` | (0, 10.0, 18.0) | `wrist.L` | (2.75, 10.9, 3.0) |
| `neck_base` | (0, 14.0, 19.5) | `front_toe.L` | (2.75, 13.3, 0.8) |
| `head_base` | (0, 18.0, 22.0) | `hip_joint.L` | (3.0, -11.0, 16.0) |
| `snout` | (0, 24.2, 21.5) | `knee.L` | (3.1, -9.6, 10.8) |
| `tail_base` | (0, -13.5, 18.8) | `hock.L` | (3.1, -12.8, 6.5) |
| | | `hind_ball.L` | (3.15, -12.3, 1.3) |
| | | `hind_toe.L` | (3.2, -9.9, 0.8) |

The tail points, ear points, eyes, and `nose_tip` and `crown` are computed by the build. The rest of the cat values: `legRemoval` {cutCm 12, toeCm 1.5, minRunCm 7, sideRangeCm [-14.5, 15.5]}, `loft` {stations [[-37.45, 24.5, 0.5], [24.5, 25.33, 0.25]], tipExponent {fromCm 16.5, n 3}, clampViews [front, back], upperTaper table [[21, 0], [22, 0.35], [23, 1.0], [24, 1.2], [25.4, 1.2]], subdiv 1}, `eyes` {position [22.6, 23.2], gazeDeg 30, lateralCm 1.54, radiusCm 0.65, insetCm 0.35, slit [5, 34], rim 47 degrees `#2b1d14`, iris `#a57d37`}, `export.subdiv` 0 (the quadruped flow does not use subdivision).

## materials, export

| Key | Meaning | Small bird |
| --- | --- | --- |
| `materials.body` | Body material name `<id>_<value>` | `feather` |
| `export.subdiv` | Subdivision at export (and when peeling off the shell) | 1 |
| `export.jpegQuality` | JPEG quality for opaque textures | 90 |
