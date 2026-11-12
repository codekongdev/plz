# spec.json format

The settings for one sheet. Keep it at `<art>/<id>/spec.json` (default `docs/art/<id>/spec.json`); `prepare_views.py` and `compose_sheet.py` both read it. All numbers in the examples below are illustrative placeholders, not measurements of any real subject. The sections a finished sheet's README must contain are in [output-readme-template.md](output-readme-template.md).

```json
{
 "id": "cat",
 "title": "Cat modeling reference sheet v001",
 "subtitle": "Domestic cat Felis catus · mackerel tabby",
 "views": [ ... ],
 "landmarks": [ ... ],
 "groups": [ ... ],
 "checks": [ ... ],
 "collider": { ... },
 "crownLabel": "ear tip",
 "colours": [ ... ],
 "method": ["a short line for the sheet's info panel", "..."],
 "credits": ["one line of reference photo author and license", "..."],
 "pxPerCm": 30
}
```

`crownLabel` is optional. It is the name of the topmost guide line and defaults to `top of head`. For an animal whose ears are the highest part (a cat), set `"ear tip"`.

If `pxPerCm` is omitted it is automatic: it is chosen so that the tallest standing height (including the collider) is about 900px and the side length is within 1300px.

The strings that `compose_sheet.py` writes into the sheet by itself (panel headings, guide labels, check text) default to English. Text taken from the spec is written as given, so it can be in any language: `title`, `subtitle`, `crownLabel`, each view's `label`, `anchor.label`, `dimension.label`, the landmark and colour labels, `collider.label`, `method`, and `credits`.

## views

| Key | Meaning |
| --- | --- |
| `name` | The file name (`views/<name>.webp`) and the name other entries use to refer to this view |
| `file` | The name of the source generated image file that `prepare_views.py` reads |
| `role` | `standing` (a view on the ground, placed side by side in the first row), `top` (a view from above, aligned by length below the reference view), `extra` (an extra pose such as a glide or T-pose, one per row below) |
| `label` | The view name written on the sheet |
| `anchor` | On exactly one reference view. Fixes the scale with one value from the measured data. `{"axis": "x", "cm": 40, "label": "body length"}` is the whole image width, `{"axis": "y", ...}` is the whole image height, and `{"landmark": "shoulder", "cm": 24, "label": "shoulder height"}` is the height from the ground to that landmark. The landmark must exist in `landmarks` with the same view and name. When the public dimension does not match the image border (a cat's shoulder height, a person's eye height), use the landmark form |
| `pivot` | The pivot of the reference view. `feet` (the centre of the bottom 4% of pixels; animals and people) or `center` (the middle of the base; props) |
| `share` | The scale of a view that is not the reference view. `{"axis": "y", "with": "height"}` means this image's height equals the reference view's height (front, back). `{"axis": "x", "with": "length"}` means its width equals the reference view's length (a top view with the head on the right) |
| `rotate` | The angle in degrees to rotate counter-clockwise before cropping. For a top-view image with the head up, `-90` puts the head on the right |
| `share.cm` | An extra pose with folded joints (a hunting pose, a T-pose) keeps neither the length nor the height of the reference view. Give the real size directly, with a basis: `{"axis": "y", "cm": 14}`, and write the basis (for example a head-size comparison) in the README |
| `approx` | If `true`, ‘approximate scale’ is appended to the view name. Use it for an extra pose whose `share.cm` is an estimate or whose shared dimension does not match |
| `dimension` | The dimension to show for an `extra` view. `{"axis": "x", "label": "wingspan"}` |

The principle of orthographic projection: for the same subject, the height is the same in the side, front, and back views, and the length is the same in the side and top views. Generated images come in arbitrary sizes, so these shared dimensions are used to get each view's px/cm. Dimensions that are not shared (body width, wingspan) are results and are checked with `groups` and `checks`.

## landmarks

Landmarks drawn as height guide lines on standing views. If the same `label` appears in two or more views, the height difference is checked to be within 6%. The guide-line name is written above the line, and if it is close enough to touch the name above or the game eye-height line, it moves below the line.

- `{"label": "eye", "view": "side", "detect": "orange"}`: finds the centre of the orange (`orange`), yellow (`yellow`), or green (`green`) pixels in the upper half of the subject. Use it only when the eye colour is distinct.
- `{"label": "shoulder", "view": "front", "y": 0.18}`: specifies a fraction measured from the top of the subject's bounding box directly. Read it from the picture with the 0.1 grid overlaid by `measure.py grid views/front.webp grid.png`. For an eye whose colour is faint (a cat's olive eyes, for example), use this instead of colour detection.

## groups

Values that must be the same real dimension in different views. `{"label": "body width front/back/top", "values": ["front.width", "back.width", "top.height"], "tolerance": 0.08}`. A value is `<view>.width` or `<view>.height` (cm). It is PASS if the difference between the maximum and minimum is within the tolerance ratio.

A long-bodied animal tends to keep perspective in the generated front and back views and come out narrower than its width seen from above. Before widening the tolerance, regenerate with the `ORTHO` sentence in [codex-prompts.md](codex-prompts.md). If a gap remains, write it in the README's limits with its cause.

## checks

Values to compare with measured data. `{"label": "wingspan", "value": "spread.width", "range": [60, 70]}`. It is PASS if within ±5% of the range. A value is `<view>.width`, `<view>.height`, or `landmark:<name>@<view>` (cm from the ground to the landmark). Do not include the value that was chosen as the anchor. A value that cannot be measured on the sheet, such as tail length, is written in the README together with how it was measured by hand.

## collider

`{"radiusM": 0.2, "heightM": 0.4, "gameScale": 1, "label": "game collider"}`. Divide the collider in the project's game settings by the game scale and overlay it on the real-size sheet. On the reference view it draws a rectangle if there is a height, or vertical radius lines if there is none; on the `top` view it draws a circle and writes how far the subject extends in front of and behind it. A subject that appears at real size in the game (a person, a cat) has `gameScale` 1. Omit it for a subject with no collider in the game.

The optional key `eyeHeightM` (for example `0.3`) converts the game's eye height at the same scale and draws a blue horizontal dotted “game eye height” line across the whole row of standing views. Its name is written at the left end so it never overlaps the guide names on the right. If the reference view has an `eye` landmark, the info panel writes the difference between the two (specify `eyeLandmark` if it has another name). It is kept in `measurements.json` as `gameEyeHeight_cm`. Even if it differs from the measured eye height, do not fix it; write the difference as numbers in the README.

## colours

`{"label": "body base colour", "view": "side", "box": [x0, y0, x1, y1]}`. The box is a 0–1 fraction of the subject's bounding box, and the median of its non-transparent pixels is used as the colour key. Look at the image and set the box so that only that part is inside.

- `"stat": "dark"`/`"light"`: use only the darkest/brightest 20% of the pixels in the box (stripes, white spots).
- `"stat": "saturated"`: use only the top 30% by saturation (gloss, or small coloured parts such as feet). If the box generously covers surrounding fur or feathers, their colour may be picked up, so for a small part look at it with `measure.py grid` and set the box tightly.
- `"detect": "orange"`: use the same colour detection as landmarks instead of a box (irises).
