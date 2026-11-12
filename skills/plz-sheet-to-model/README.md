# plz-sheet-to-model
English | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

Build a real-size, textured 3D model from an orthographic reference sheet (side, top, front, and back views with px/cm, such as the output of plz-model-sheet). The skill runs Blender headlessly, measures the silhouettes, lofts cross sections, bakes the view images into a UV texture, builds eyes, legs, wings, and ears as separate parts, and writes a `.blend`, a `.glb`, a `landmarks.json` for rigging, and a dimension report. Works with Claude Code and Codex. Part of [plz](../../README.md).

## Install

The commands below require this skill to be published in the repository. To try a local draft, ask your agent to read `skills/plz-sheet-to-model/SKILL.md` directly.

Install globally:

```sh
npx skills add codekongdev/plz --skill plz-sheet-to-model -g
```

For Codex, add `-a codex`. This installs into the current project's `.agents/skills/` directory:

```sh
npx skills add codekongdev/plz --skill plz-sheet-to-model -a codex
```

## Usage

Point the agent at a reference sheet folder (view images and `measurements.json`) and ask for a model.

Claude Code:

```text
/plz-sheet-to-model Build a 3D model from the reference sheet in docs/art/cat/.
```

Codex:

```text
$plz-sheet-to-model Build a 3D model from the reference sheet in docs/art/cat/.
```

Example requests:

- “Model this from the reference sheet and export a glb.”
- “Make a Blender model from these turnaround views.”
- “Rebuild the model as v003 after I fixed the sheet.”
- “Check the model against the sheet and show me the dimension differences.”

## Requirements

- Blender 4.2 or later (verified on 5.2). The skill runs it in the background, with no window: `blender -b --factory-startup -P <script> -- <arguments>`. Set the `BLENDER` environment variable to the executable if it is not on your `PATH` or at the default macOS path.
- Python 3 with Pillow and numpy for the measurement and comparison scripts (`grid.py`, `measure_views.py`, `compare_models.py`). On first use the skill creates a virtual environment at `~/.cache/plz-sheet-to-model/venv` and installs both packages with `pip`, which needs network access to the Python package index.
- Inside Blender, the scripts use Blender's own bundled Python, numpy, Cycles (CPU baking), and glTF exporter, so nothing else is installed.
- No API key and no other network access.

## How it works

Every value chosen by hand is kept in one per-subject `spec.json` ([references/spec-format.md](references/spec-format.md)), so rebuilding after a sheet fix or a version bump takes two commands and gives the same result.

- **Stages:** check the inputs; write the spec; measure the views (`measure_views.py`); build the model (`build_model.py`); check it with renders, a pixel overlay on the sheet views, and the dimension report (`inspect_model.py`, `overlay_views.py`, `compare_models.py`); place the files and report.
- **Bird:** cross-section lofting of a one-tube body, eyes by raycast, Skin-modifier legs and toes, a folded-wing shell, and spread wings.
- **Quadruped:** cross-section lofting of the body plus tail, leg capsules and paw ellipsoids merged by SDF into one closed shell, thin ear parts, and forward-facing eyes. One shell means buried faces do not poke through when the legs swing widely after rigging.
- **Reproducible:** rebuilding from the same input gives the same measurements, textures, meshes, and landmarks. Only the order of the eye triangles in the glb changes between exports ([references/lessons.md](references/lessons.md)).

## Inputs and outputs

Input: a reference sheet folder with `views/*.webp` (background removed; side and top views with the head to the right, front and back upright, the optional spread view with the head up) and `measurements.json`, plus the `spec.json` the agent writes with you.

| Output | Contents |
| --- | --- |
| `spec.json` | Per-subject settings, every hand-chosen value |
| `<id>_<ver>.blend` | Part objects, final and projection materials, all images packed |
| `<id>_<ver>.glb` | For games: subdivision applied, opaque textures as JPEG, alpha textures as PNG |
| `<id>_<ver>.landmarks.json` | Feature points, part names, and regions for plz-rig-model ([references/conventions.md](references/conventions.md)) |
| `<id>_<ver>.report.json` | Dimensions, eye position, triangle count per object, file sizes, differences from the sheet |

The build happens in a working folder under `~/.cache/plz-sheet-to-model/<id>/`. After checking, the files are copied to the project, by default `docs/art/<id>/model/`. The model uses meters, Z up, front -Y (glTF +Z), left +X, and the origin under the feet.

## Limits

- Only the bird and quadruped body plans are verified (the bird with a bird model, the quadruped with a cat model). Humans and other bipeds, winged quadrupeds, and subjects whose long fur changes the silhouette have no strategy yet; the skill says so instead of guessing.
- Without a view from below, the markings on the underside are stretched.
- The texture contains the sheet's lighting, and angle-dependent sheen (such as neck feathers) becomes a fixed color.
- Typical size, without a rig: about 34,000 triangles for a bird-sized or cat-sized subject, and a glb of about 2.6 MB (bird-sized) or about 1.2 MB (cat-sized). These are typical figures, not guarantees.
- Do not use the Blender MCP to build: its safe mode blocks numpy, file reads, and opening other `.blend` files. The skill runs Blender in the background and does not touch a Blender file you have open.
- Rigging is not part of this skill; use plz-rig-model.

## Part of the modeling pipeline

The modeling pipeline runs in this order: [plz-model-sheet](../plz-model-sheet/README.md) -> [plz-sheet-to-model](../plz-sheet-to-model/README.md) -> [plz-rig-model](../plz-rig-model/README.md). This skill is the middle step: it turns the reference sheet into a model and hands `landmarks.json` to rigging. Back to [plz](../../README.md).

See [SKILL.md](SKILL.md) for the workflow and [references/lessons.md](references/lessons.md) for problems encountered and their fixes.
