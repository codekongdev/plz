# Output README and sources.json template

A finished sheet ships a `README.md` and a `sources.json` next to `sheet.webp` in `<art>/<id>/` (default `docs/art/<id>/`). This file says what they must contain. Everything in angle brackets is a placeholder to fill with the real, researched value for the subject; do not copy numbers, sources, or licenses from this template and never invent them. If a value could not be found or checked, say so in the README's limits section instead.

## README.md sections

Write the README in the user's language. Keep this order.

### 1. Title and introduction

`# <Subject> modeling reference sheet v001`, then a short paragraph: what the subject is (species/breed/morph, or the character/prop), what the sheet is for (so that the prototype and the final production build the same proportions, markings, and reference points), and, if relevant, which later decision this sheet comes before (for example the project's choice of final graphics pipeline). Then the sheet picture:

```markdown
![<Subject> modeling reference sheet](sheet.webp)
```

### 2. File table

A two-column table (file, content) listing every file shipped in the folder:

| File | Content |
| --- | --- |
| `sheet.svg` · `sheet.webp` | The views at real size, `1cm = <S>px`. The SVG loads `views/` so the grid and guide lines can be edited |
| `views/*.webp` | Per-view original-size images with the background removed, for use as 3D tool background references |
| `spec.json` | View, scale, check, and colour-key settings. The sheet is rebuilt from this file and `views/` |
| `measurements.json` | The sheet's dimensions, check results, colour key, and per-view px/cm |
| `sources.json` | Reference photo authors and licenses, measurement sources, generation tool and date |

If model or rig files were later made from the sheet (with `plz-sheet-to-model` and `plz-rig-model`), add their rows and a section describing them here.

Then one or two sentences on how to rebuild the sheet: run `scripts/compose_sheet.py <art>/<id>/spec.json <art>/<id>` from the `plz-model-sheet` skill.

### 3. Base conventions

A table (item, value) with at least:

- Unit and axes (for example metres in 3D, centimetres on the sheet, Y up).
- Pivot (for example the centre between the feet, matching the game's position and collider reference).
- Front direction (for example +Z in glTF and Unity; in Blender the model faces the camera side of the front view and is exported to glTF).
- Default pose (for example relaxed standing on level ground, with the main body-axis angle if it matters).
- File naming (for example a versioned glTF binary such as `<subject>_v001.glb`).

Then the Blender background-reference placement, if the sheet will be used there: the front view in the front orthographic view, the back view in the back view, the side view (head on the right) in the left view, and the top view (head on the right, so rotated 90° clockwise to put the head toward the bottom of the screen in the top view). Point to `measurements.json` for each image's px/cm.

### 4. Dimensions (real size)

State which value is the anchor and where it came from, and that the shared dimensions (height across side/front/back, length across side/top) were converted from it, while the remaining dimensions (body width, wingspan, and so on) are results that were not forced to match. Then a table:

| Item | Sheet | Reference value |
| --- | --- | --- |
| `<anchor dimension>` | `<value>` (anchor) | `<public range>` |
| `<checked dimension>` | `<value from measurements.json>` | `<public range, with source>` |
| `<dimension across views>` | `<value per view>` | the views agree within `<tolerance>` |

Include every `checks` and `groups` result from `measurements.json` with its PASS/WARN status, and the reason for every WARN or out-of-range value. Values that cannot be measured on the sheet (tail length, for example) go here too, with how they were measured by hand.

### 5. Markings and colours

Describe the distinguishing markings of the individual in prose, and note that other individuals (other morphs, coats, or variants) are separate variants. Then the colour-key table (part, hex), taken from `measurements.json`, and the caveat that the colour key is sampled from generated images inside the `colours` boxes of `spec.json`, so it includes the lighting; the base colours of a texture should be chosen by comparing with real photos. Mention any part whose appearance changes with the viewing angle (a gloss, a sheen) and that it needs an angle-dependent material rather than a flat colour.

### 6. Use in the game (only if there is a game collider or scale)

- The game scale (`gameScale`) and the sizes it gives (length, height, and width at game scale).
- What the blue dotted collider on the sheet represents (the game collider divided by the game scale).
- A bullet for each mismatch the team must decide on, with numbers: where the collider is higher or wider than the subject, how far a part sticks out of the collider circle in the top view, how the game eye height differs from the sheet's eye height, and any scale ratio between characters that differs from reality. State these as facts and numbers; do not fix them.
- The motions the game needs, if known (idle, walk, and so on), because they decide which extra poses and which parts the later model must support.

Omit this section if the project has no game settings.

### 7. How it was made and limits

A numbered list of what was actually done:

1. The measured data and the reference photos that were researched (names and sources in `sources.json`).
2. How the reference side view was generated, including any discarded attempt and the measured ratio before and after, and which real photo was attached.
3. How the other views were generated (the side view attached as “the same individual”, which extra photos were attached to which view).
4. What `prepare_views.py` and `compose_sheet.py` did (background removal connected to the border only, silhouette measurement, landmark and foot-centre detection, shared scale).

Then the limits paragraph, which must say at least:

- The view images are generated images, not photographs of a real individual.
- The exact count and arrangement of fine details (feathers, fur, stripes) can differ slightly from view to view, and the generated front and back views are left-right mirror-symmetric. Fine details should be checked against the real photos in `sources.json`.
- Every `WARN` that remains, with its cause, and every estimated scale (`share.cm`, `approx`).
- The generation conditions used (pure white background, no shadow or text, orthographic view, subject about 80% of the image width).

### 8. Credits

One line per reference photo: author, license, and a link to the source page, followed by a pointer to `sources.json` for the measurement sources.

```markdown
Reference photos: [<author>, <license>](<source page URL>) · [<author>, <license>](<source page URL>). Measurement sources are in `sources.json`.
```

## sources.json structure

`commons_refs.py fetch` writes a `sources.json` into its own download folder (outside the repository) as a JSON array with one record per downloaded photo, using the keys `title`, `page`, `license`, `licenseUrl`, `author`, `size`, `description`, `thumb`, and `file`. The `sources.json` shipped with the sheet collects the records that were actually used, together with the generation details and the measurement sources, in this shape:

```json
{
 "generated": {
  "tool": "<image generation tool>",
  "date": "<YYYY-MM-DD>",
  "images": 0,
  "note": "<for example which views were regenerated and why>"
 },
 "referencePhotos": [
  {
   "title": "File:<name on Wikimedia Commons>",
   "page": "<URL of the file's description page>",
   "license": "<license short name>",
   "licenseUrl": "<URL of the license text>",
   "artist": "<author as shown on the page>",
   "use": "<what it was used for>"
  }
 ],
 "measurementSources": [
  {
   "what": "<quantity and value, for example body length>",
   "url": "<source URL>"
  }
 ],
 "game": {
  "what": "<optional: which game setting the sheet was checked against>",
  "file": "<optional: path of that setting file in the project>"
 }
}
```

- `generated` records the tool, the date, how many images were generated (`images`), and a short `note`.
- When copying a record from the script's `sources.json` into `referencePhotos`, rename `author` to `artist`, add `use` (what the photo was used for, such as anatomy, coat colour, or a specific extra pose), and drop `size`, `description`, `thumb`, and `file`. `title`, `page`, `license`, and `licenseUrl` are copied unchanged.
- `measurementSources` has one entry per published dimension that was used: `what` names the quantity and its value, and `url` is the source.
- `game` is optional. Include it only when the project has game settings that the sheet was checked against: `what` says which setting, and `file` is the path of that setting file in the project.
- Only reference photos that are actually credited on the sheet and in the README belong in `referencePhotos`.

## License and credit rules

- Use only openly licensed reference photos: CC0, public domain, CC BY, and CC BY-SA. `commons_refs.py` skips every other license when it downloads.
- Credit every photo that was used, with its author, license, and a link to the source page, in the README, in `sources.json`, and in the `credits` lines of `spec.json` (which appear on the sheet).
- Keep measurement sources as URLs. Use the published dimension as it is and do not convert it by hand.
- Do not commit downloaded reference photos or the raw generated images (`raw/`, `refs-*/`, `preview-*/`); only `views/*.webp`, the sheet files, `spec.json`, `measurements.json`, `sources.json`, and the README belong in the repository.
- Say in the README that the views are generated images, which is a limit of the sheet and not a license claim about the subject.
