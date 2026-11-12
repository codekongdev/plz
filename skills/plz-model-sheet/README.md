# plz-model-sheet
English | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

Make a realistic, real-size modeling reference sheet (orthographic views and turnaround) for a game character, animal, NPC, or prop before you model it in 3D. The skill researches measured dimensions and openly licensed photos, generates side, front, back, top, and extra-pose views of the same individual with Codex image generation, and lays them out on one sheet with a centimetre grid, height guides, a colour key, and a cross-check against the measurements. Works with Claude Code and Codex. Part of [plz](../../README.md).

Part of the modeling pipeline: **sheet** ([plz-model-sheet](../plz-model-sheet/README.md)) → **model** ([plz-sheet-to-model](../plz-sheet-to-model/README.md)) → **rig** ([plz-rig-model](../plz-rig-model/README.md)).

## Install

The commands below require this skill to be published in the repository. To try a local draft, ask your agent to read `skills/plz-model-sheet/SKILL.md` directly.

Install globally:

```sh
npx skills add codekongdev/plz --skill plz-model-sheet -g
```

For Codex, add `-a codex`. This installs into the current project's `.agents/skills/` directory:

```sh
npx skills add codekongdev/plz --skill plz-model-sheet -a codex
```

## Usage

Name the subject, and say what the sheet is for. Mention your game's collider or character scale if you have one.

Claude Code:

```text
/plz-model-sheet Make a modeling reference sheet for a domestic cat.
```

Codex:

```text
$plz-model-sheet Make a modeling reference sheet for a domestic cat.
```

Example requests:

- “Make a turnaround and orthographic reference for a cat that I will model in Blender.”
- “I need a realistic reference sheet for an NPC before we decide proportions.”
- “Fix the front view on the existing sheet in docs/art/cat and regenerate it.”
- “Add a crouched pose to this model sheet.”

## Requirements

The skill itself needs no API key. It uses these tools on your machine:

- **Python 3** with `venv` and `pip`. The first run creates `~/.cache/plz-model-sheet/venv` and installs `pillow` and `numpy` into it.
- **Codex CLI** with image generation enabled and a logged-in account (`codex features list | grep image_generation` must say `true`, and `codex login status` must show a login). Every generated image uses your ChatGPT usage. If generation is off or you are not logged in, the agent tells you and stops.
- **Headless Chromium** (for example the one installed by Playwright) to render `sheet.webp` from `sheet.svg`. It is found automatically; otherwise set `MODEL_SHEET_CHROME` to its path. Without it you still get `sheet.svg`.
- **Network access** to Wikimedia Commons and Wikipedia (`scripts/commons_refs.py`) for reference photos, and a web search tool in your agent for measured dimensions.

## How it works

1. Decide the subject, the default pose, and the views. If your project has a game collider, eye height, or character scale, read them so they can be drawn on the sheet.
2. Research measured dimensions from public sources. One trustworthy value becomes the anchor of the scale, and the rest become checks.
3. Find openly licensed reference photos (Wikimedia Commons) and pick a clean side photo in the target pose.
4. Generate the reference side view with Codex, with the real photo attached, and measure its proportions right away. Regenerate until the ratio and pose match the target.
5. Generate the other views with the side view attached as “the same individual”. Front and back views use an orthographic prompt to remove perspective.
6. Write `spec.json`, then run `prepare_views.py` (background removal and cropping) and `compose_sheet.py` (one real-size scale, guides, collider overlay, checks, colour key).
7. Look at the sheet, fix any `WARN`, and write the README and `sources.json`.

The workflow is in [SKILL.md](SKILL.md). The settings format is in the [spec.json format](references/spec-format.md), the image prompts are in the [Codex prompts](references/codex-prompts.md), and what the finished README and `sources.json` must contain is in the [output template](references/output-readme-template.md).

## Outputs

The skill writes to `docs/art/<id>/` by default, or to the art folder your project already uses.

| File | Content |
| --- | --- |
| `spec.json` | View, scale, check, and colour-key settings |
| `views/*.webp` | Per-view images with the background removed, for 3D tool background references |
| `sheet.svg`, `sheet.webp` | The sheet. The SVG loads `views/` and is editable |
| `measurements.json` | Dimensions, check results, colour key |
| `sources.json` | Reference photo authors and licenses, measurement sources, generation tool and date |
| `README.md` | Conventions, dimensions, markings and colours, game use, how it was made and its limits, sources |

Generated originals and downloaded photos stay in `~/.cache/plz-model-sheet/<id>/`, outside your repository.

## Sources and limits

- Only openly licensed photos (CC0, CC BY, CC BY-SA, public domain) are used, and their authors and licenses are recorded in `sources.json` and on the sheet. Measured dimensions are recorded with their source URLs.
- The views are generated images, not photographs of a real individual. Exact feather or fur arrangement can vary between views, and generated front and back views are left-right symmetric. The sheet's README states these limits and any remaining `WARN`.
- A large mismatch between the generated proportions and the measured ones is regenerated or reported, never hidden. Differences from your game's collider, eye height, or scale are written down as numbers for your team to decide, not silently fixed.
- The skill does not commit or push unless you ask.

See [SKILL.md](SKILL.md) for the workflow.
