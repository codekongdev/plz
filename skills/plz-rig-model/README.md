# plz-rig-model
English | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

Add a game-ready rig to an existing 3D mesh model. The skill builds the armature, skin weights, leg IK, base-pose actions, and check poses with headless Blender, exports a glTF (`.glb`) and a `.blend`, verifies them with pose renders, self-intersection counts, and a re-import round trip, and outputs a bone rotation sign table (+1/-1) for your game code. Works with Claude Code and Codex. Part of [plz](../../README.md).

## Install

The commands below require this skill to be published in the repository. To try a local draft, ask your agent to read `skills/plz-rig-model/SKILL.md` directly.

Install globally:

```sh
npx skills add codekongdev/plz --skill plz-rig-model -g
```

For Codex, add `-a codex`. This installs into the current project's `.agents/skills/` directory:

```sh
npx skills add codekongdev/plz --skill plz-rig-model -a codex
```

## Usage

Point the agent at a mesh model (`.blend` or `.glb`) and ask for a rig.

Claude Code:

```text
/plz-rig-model Rig this cat model so it can walk and run in my game.
```

Codex:

```text
$plz-rig-model Rig this cat model so it can walk and run in my game.
```

Example requests:

- “Rig this bird model with a skeleton and give me a glb I can animate.”
- “Add an armature, skinning, and leg IK to this quadruped.”
- “Tell me which way each bone rotates, with +1 or -1 signs, for the game code.”
- “Re-attach the rig after I changed the mesh.”
- “Bring this downloaded character, which already has a skeleton, into our conventions and keep its skin weights.”

## Requirements

- Blender 4.4 or later (verified on 5.2, on macOS and Windows). The skill runs it in the background, with no window: `blender -b --factory-startup -P <script> -- <arguments>`. Set the `BLENDER` environment variable to the executable if it is not at the default path.
- numpy and the glTF add-on are used from Blender's own bundled Python and add-ons, so no separate Python packages are installed.
- A system `python3` is only used for two checks that do not need Blender: `rig_axes.py` on a `.glb`, and `inspect_rig.py compare`. They use only the standard library.
- No network access and no API key.

## How it works

A body-plan template (`templates/<name>.json`) describes the bones, weight methods, and poses as data. Bone positions come from feature points on the model (`landmarks.json`), so another individual with the same body plan is rigged by changing only the points.

- **Templates:** `bird` (a bird standing on the ground, switching between folded and spread wings) `quadruped` (a four-legged animal such as a cat; body, head, tail, and four legs are one shell, and the ears and eyes are separate), and `humanoid` (a person bound in an A- or T-pose whose mesh already has skin weights from its own rig; those weights are kept). For another body plan, a new template is written in the format of [references/templates.md](references/templates.md).
- **Stages:** check the template and the coordinate conventions ([references/conventions.md](references/conventions.md)); prepare `landmarks.json`; rig; render poses and count self-intersections; verify (re-import, comparison with a previous version, reproducibility, rotation sign table, angle limits); document and report.
- **Reproducible:** the same input gives the same result, down to the glb bytes in the verified cat and person examples.

## Inputs and outputs

Input: a `.blend` or `.glb` mesh model and a `landmarks.json`. The skill can draw gridded orthographic images and an empty `landmarks.todo.json` to help you fill the points in. A model that comes with its own rig (an FBX or glTF avatar) is first brought in with `import_rigged.py`, which scales it, keeps its skin weights, writes the `landmarks.json` from its bones, and can recolour a garment to match a reference sheet.

| Output | Contents |
| --- | --- |
| `<name>.glb` | Skinned mesh with deform bones only, plus base-pose animations (unit m, front +Z, up +Y) |
| `<name>.blend` | Images packed, saved in the bind pose, with IK controls and the check action `rig_test` |
| `<name>.rig-report.json` | Bones, deform bones, vertex counts per part, unweighted vertices, actions, NLA tracks |
| `renders/` | Pose renders and `<prefix>_intersections.json` with self-intersection counts per pose |
| `axes.json` | Rotation sign table (+1/-1) for each bone meaning, measured on the .blend and the glb |

An angle-limit table (`sweep_limits.py`) can be added when a motion bends a joint a lot. Files are written to the `--out` folder you choose; the working folder defaults to `~/.cache/plz-rig-model/<id>/`.

## Limits

- Each template is verified on one target: `bird` on a pigeon, `quadruped` on a cat, and `humanoid` on a downloaded rigged person (a Microsoft Rocketbox avatar). Snakes and other body plans need a new template that passes the checks on a real target.
- The `humanoid` template keeps the source rig's skin weights and merges face and finger bones into the head and hands, so fingers and expressions do not move. A person mesh without skin weights needs another weight rule.
- The bird's folded/spread wing switch has no intermediate shape; cover it with fast flapping.
- Linear skinning has no collision. Deeply bent joints can leave lines where skin touches skin, which are recorded as angle limits rather than removed.
- Do not use the Blender MCP for rigging: its safe mode cannot run saved scripts. The skill does not touch a Blender file you have open.
- The skill needs a model that follows the coordinate and naming conventions (unit m, -Y front, left +X, origin under the feet), or a copy corrected in Blender first.

## Part of the modeling pipeline

The modeling pipeline runs in this order: [plz-model-sheet](../plz-model-sheet/README.md) -> [plz-sheet-to-model](../plz-sheet-to-model/README.md) -> [plz-rig-model](../plz-rig-model/README.md). This skill is the last step, but it also accepts any existing mesh model, not only the pipeline's output: a generated, purchased, or hand-made model works if it follows the conventions. Back to [plz](../../README.md).

See [SKILL.md](SKILL.md) for the workflow and [references/lessons.md](references/lessons.md) for problems encountered and their fixes.
