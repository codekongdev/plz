# Codex image generation prompts

## How to run

```bash
W=~/.cache/plz-model-sheet/<id>/raw      # generated originals. Outside the repository, outside /tmp (size quota)
cd "$W" && timeout 580 codex exec --skip-git-repo-check -C "$W" -s workspace-write \
  -o side-last.txt -i "$W/ref-side.jpg" -- "<prompt>" < /dev/null > side.log 2>&1
```

macOS has no `timeout` (exit code 127). In that case put `perl -e 'alarm shift; exec @ARGV' 580` in front instead of `timeout 580`.

Never drop `< /dev/null`. A `codex exec` run in the background (`&`) waits for standard input, leaves only “Reading additional input from stdin...”, and hangs until the time limit (in a cat test, all four ended after 580 seconds).

- Check: `codex features list | grep image_generation` must say `true` and `codex login status` must show a logged-in state. If not, tell the user and stop.
- `-i` accepts several files, so put `--` before the prompt.
- Write the prompt in English. One image per run, saved in the current folder under a name you specify, and the reply is only the path.
- After getting the reference view, run the remaining views at the same time with `&` and `wait` (each with `< /dev/null`). Each image takes 1–2 minutes.
- Save each prompt as `prompt-<name>.txt` and pass it as `"$(cat prompt-side.txt)"`, so it can be copied as is into the README's “how it was made” section.
- Every generated image uses the user's ChatGPT quota. Before regenerating, confirm the reason with measured values.

## Common sentence (appended to every view)

```
Photorealistic, pure white background, soft even lighting, no cast shadow, no ground line,
no text, whole subject visible and centered with margin, occupying about 80 percent of the
image's larger dimension, with at least 8 percent empty margin on every side. After saving,
reply only with the file path.
```

For a view that is not the reference view, add the following in front.

```
Same individual as the attached side-view image: identical markings, colours, fur/feather
pattern and body proportions.
```

## Reference view (side)

Attach a real photo, and say to take only the anatomy and proportions from the photo and discard the background and terrain. State the posture and the key proportions as numbers.

```
Use your image generation tool to create ONE image and save it in the current directory as
side.png. The attached photo is a real <subject>: copy its anatomy and proportions, not its
background. Image: photorealistic <subject, breed/morph>, exact orthographic side view
(camera at the subject's mid-height, no perspective tilt), facing right, standing on
invisible flat ground in a relaxed natural posture: <posture details>. Total height from feet
to top of head about <ratio> times the length from <front end> to <back end>.
Markings: <colour and pattern list>. <common sentence>
```

## Remaining views

| View | Key sentence |
| --- | --- |
| Front | `Exact orthographic front view: the subject faces the camera directly, camera at mid-height, perfectly symmetric, standing on invisible flat ground in the same relaxed posture.` + `ORTHO` + the features visible from the front |
| Back | `Exact orthographic rear view: the <tail/back> points at the camera, camera at mid-height, perfectly symmetric, standing ... same relaxed posture.` + `ORTHO` + the features visible from behind |
| Top | `Exact orthographic top-down view from directly above, the head pointing to the top of the image, same standing posture, perfectly symmetric.` + the markings visible on the back |
| Extra pose | A pose the game's motions need, such as a glide (top view with the wings spread), a walking profile, or a person's T-pose. Also attach a real photo of that motion |

Always add `ORTHO` to the front and back views. The generative model puts perspective into front and back views like a close-up photo, so for a long-bodied animal the body far from the camera gets smaller and comes out narrower than its width seen from above (cat test: front 11.0, back 10.1, top 12.1 cm).

```
ORTHO = True orthographic projection like a technical drawing or a very long telephoto lens
from far away: no foreshortening, the near and far parts of the body appear at the same scale,
and the widest part of the body (belly/ribcage) defines the silhouette width.
```

Generate the top view with the head up, and align it to the right with `rotate: -90` in the spec.

## Lessons from tests

### Cat (2026-11-11)
- The only clean side photo was a walking pose (head lowered, height/length 0.438). When the photo and the target pose differ, set the target from measured proportions (shoulder height ÷ head-to-tail-base length, and so on) instead of the photo's ratio, and write it into the prompt as numbers.
- In the back view the tail hung down to the ground and did not match the side view. For parts that tend to change between views, such as the tail and ears, write their height in the side view into the prompt (“tail tip at about knee height, as in the side view”).
- A crouched hunting pose has neither the length nor the height of the side view. Handle the scale with `share.cm` and `approx` (see spec-format).
- Orange tabby v001 (2026-11-11, 8 generations): a standing-pose photo (for anatomy) and a coat-colour photo were attached separately, each with its purpose written down. The first side view had a short tail curving upward and a long neck (0.54). Attaching that image as the “previous attempt” and writing the wrong values as numbers produced 0.46.
- Unless specified, the top-view body width came out plump (25% wider than the front view), and writing only “obese” made it too narrow the other way. Giving the values of both attempts and writing “width over length 0.19” matched it to the front view. From the start, write front width ÷ side length into the prompt.
- For a stretched pose such as a gallop, set `share.cm` by comparing head size with the side view (eye–nose tip, ear tip–chin pixels).
- The ear tip is the highest point, so put `"crownLabel": "ear tip"` in the spec. The eye and shoulder heights were within about 1 cm and the guide names overlapped; `compose_sheet.py` now moves a close name below its line. The game eye height is overlaid with `collider.eyeHeightM`.
- macOS has no `timeout`. Set the time limit with `perl -e 'alarm shift; exec @ARGV' 580 codex exec ...`. If Playwright's macOS headless shell (`chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell`) is not found automatically, pass it in `MODEL_SHEET_CHROME`.

### Person (2026-11-12)
- A person whose model comes from a downloaded rigged avatar: attach a real side photo for the standing anatomy and the avatar's render for the face, hair and outfit, each with its purpose written down ("copy only her anatomy... copy her face, hair and outfit, but not her A-pose arms"). Writing head count (7.3 heads), eye/shoulder/crotch heights as fractions of the height, and height over depth (6.0) gave 5.90 on the first try, so the sheet and the 3D model show the same person.
- Use the eye height as the anchor (`anchor.landmark`): the game's eye height and the public average (stature x 0.934) agreed within 1%. Read eye and shoulder heights from a 0.01 grid over the head and shoulders; the 0.1 grid of `measure.py grid` is too coarse on a tall, narrow subject.
- The top view kept perspective (the head close to the camera) and came out 15% narrower across the shoulders and arms than the front and back views, twice, even with the measured ratio written in. Keep the WARN and the cause in the README rather than spending more generations.
- For an action pose (shooing pigeons) no real photo of an adult existed; a photo of a child doing it, attached for the idea of the motion only, worked, with the body taken from the side view.
- On a tall subject the collider label and the game eye height line sat on the same row; `compose_sheet.py` now moves the collider label under the eye line when they would meet.

### General lessons from a bird test

- A first side view made without a real photo came out as a showy pose with the chest pushed out, with a height/length ratio far above that of real photos. Attaching a real side photo and writing the posture (body-axis angle, leg length hidden by belly feathers, head size, height as a multiple of length) as numbers brought the ratio close to the photo.
- Front, back, and top views made with the side view attached matched each other in body width within 6%. For the top view with the wings spread, attaching two more real flight photos made the wing bars, white rump, and tail band match.
- Generated front and back views are mirror-symmetric left to right. That is fine for a reference, but write it in the README's limits.
- If a subject has white markings (a rump patch, a fleshy cere), removing the background by colour punches holes in it. `prepare_views.py` removes only the white connected to the border.

## Reference-view prompt template (worked structure)

A filled-in version of the reference-view prompt with the lessons above applied. Replace every `<...>` with measured or researched values; do not carry numbers over from another subject.

```
Use your image generation tool to create ONE image and save it in the current directory as
side.png. The attached photo is a real <subject, breed/morph>: copy its anatomy and
proportions, not its background or the terrain. Image: photorealistic <subject, breed/morph>,
exact orthographic side view (camera at the subject's mid-height, no perspective tilt),
facing right, standing on invisible flat ground in a relaxed natural posture: body axis tilted
about <angle> degrees above horizontal, <head size and shape>, <neck length and thickness>,
<leg length and how much of it is hidden by the body>, <tail or wing tips position relative to
the body end>. Total height from <feet or toes> to <top of head> about <ratio> times the
length from <front end> to <back end>. Markings and colours: <colour and pattern list,
stating gradients explicitly, for example "soft blend from A into B, no sharp bands">.
Whole subject visible and centered with margin, occupying about 80 percent of the image
width. Pure white background, soft even lighting, no cast shadow, no ground line, no text.
After saving, reply only with the file path.
```
