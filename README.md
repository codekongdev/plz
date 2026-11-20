# plz
English | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

AI coding agent skills for Claude Code and Codex, by codekongdev. The featured skill, `plz-explain`, turns a technical concept into an interactive study page that plays out cause and effect step by step, in a 2D diagram or a 3D model chosen for each chapter.

Each `plz-<task>` name reads like a request to your agent: “please do this.”

[Live demo](https://codekongdev.github.io/plz/skills/plz-explain/assets/example-event-loop.en.html) · [Install](#install) · [Usage](#usage) · [Skills](#skills)

[![License: MIT](https://img.shields.io/badge/License-MIT-0a0a0a.svg?labelColor=000000)](LICENSE) [![skills.sh](https://skills.sh/b/codekongdev/plz)](https://skills.sh/codekongdev/plz) ![works with Claude Code | Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%7C%20Codex-0a0a0a.svg?labelColor=000000)

<p align="center">
  <a href="https://codekongdev.github.io/plz/skills/plz-explain/assets/example-event-loop.en.html"><img src="skills/plz-explain/docs/demo-2d-desktop.png" alt="Desktop view with explanatory text on the left and a program beside its call stack, queues and console on the right" width="610"></a>
  <img src="skills/plz-explain/docs/demo-3d-mobile.png" alt="Mobile view with an OS sandbox model above the explanatory text" width="176">
</p>
<p align="center"><em>Desktop: chapter 4 of the event loop demo, where the reader predicts the console order step by step. Mobile: the OS sandbox chapter of the code sandbox demo, drawn in 3D. More demos are listed in the Skills table below.</em></p>

A one-line request like this is enough to start, and the desktop demo above covers one topic of this kind:

```text
Explain how the JavaScript event loop orders callbacks, step by step.
```

## Install

To install with `npx skills`, you need **Node.js 22.20 or later** (with npm and `npx`), **Git**, and a working Claude Code or Codex installation. Check the tools in your terminal:

```sh
node --version
npm --version
git --version
```

Choose your agent below. These commands install `plz-explain` globally, so it is available across projects.

Claude Code:

```sh
npx skills add codekongdev/plz --skill plz-explain -a claude-code -g
```

Codex:

```sh
npx skills add codekongdev/plz --skill plz-explain -a codex -g
```

For a project-only installation, run the matching command from that project's directory and omit `-g`. Claude Code uses `.claude/skills/`; Codex uses `.agents/skills/`. Follow any confirmation prompts from the installer.

Confirm the installation for your agent:

```sh
npx skills list -g -a claude-code
npx skills list -g -a codex
```

Look for `plz-explain` in the matching list. For a project-only installation, run the list command from the same project and omit `-g` too.

<details>
<summary>List or install all skills</summary>

List available skills:

```sh
npx skills add codekongdev/plz -l
```

Install all skills globally, choosing the agent when prompted:

```sh
npx skills add codekongdev/plz --skill '*' -g
```

</details>

<details>
<summary>Manual install (Claude Code)</summary>

For a manual Claude Code installation, clone the repository, then copy or symlink `skills/plz-explain` to `~/.claude/skills/plz-explain`. To copy it:

```sh
git clone https://github.com/codekongdev/plz.git
mkdir -p ~/.claude/skills
cp -R plz/skills/plz-explain ~/.claude/skills/plz-explain
```

</details>

See [plz-explain on skills.sh](https://skills.sh/codekongdev/plz/plz-explain).

## Usage

Start a new agent session in the project where you want to create the page. To use the skill explicitly:

- **Claude Code:** `/plz-explain Explain how the JavaScript event loop orders callbacks.`
- **Codex:** `$plz-explain Explain how the JavaScript event loop orders callbacks.`

You can also ask in plain language:

- “Explain how the JavaScript event loop orders callbacks, step by step.”
- “Explain how container isolation works in 3D.”

You can also ask in Korean, Japanese, or Simplified Chinese; the page is written in the language you ask in.

If the skill is not available, check the agent and installation scope with the list commands above, then start a new session. Project-only skills must be used from the project where you installed them. If `npx` is missing or reports an unsupported Node.js version, check the prerequisites above.

## How it works

When you ask for a page, `plz-explain` works in four steps:

1. **Check the material.** It checks the topic or repository, records sources and verification dates, and marks anything unverified.
2. **Plan the chapters.** It plans the chapters and picks a form for each one (a step diagram, time lanes, code and state, a parameter playground, a 3D model, and more), with an action that plays out cause and effect.
3. **Fill the template.** It fills the template with text and scenes. The result is one HTML file with no build step.
4. **Validate in a browser.** It checks the finished page for console errors, overlapping or clipped labels, horizontal overflow, autorun, and touch gestures.

## Scope and requirements

- **Good for:** learning a technical concept, mechanism, or system structure with step-by-step 2D diagrams or 3D models.
- **Out of scope:** static architecture or sequence diagrams, data charts, Blender modeling, product landing pages, and app UI design.
- **Opening a page:** needs an internet connection, because web fonts load from a CDN, and three.js r170 too when the page has a 3D chapter.
- **Creating a page:** requires a local HTTP server (the skill uses Python 3 as an example) and a browser automation tool the agent can use, such as Playwright.

Installing the skill does not install Python or browser automation. If these tools are unavailable, ask your agent to help prepare them before validation. A generated HTML file alone does not mean browser validation passed; check the agent’s report for what it actually tested.

Details are in the [skill README](skills/plz-explain/README.md).

## Skills

| Skill | What it makes | Demo |
| --- | --- | --- |
| [plz-explain](skills/plz-explain/README.md) | A single HTML study page that plays out a technical concept step by step, in 2D diagrams or 3D models chosen per chapter. | [Event loop (English)](https://codekongdev.github.io/plz/skills/plz-explain/assets/example-event-loop.en.html) · [Korean](https://codekongdev.github.io/plz/skills/plz-explain/assets/example-event-loop.html) |
| [plz-3d-explain](skills/plz-3d-explain/README.md) | Replaced by plz-explain, which draws 3D chapters too; it will be removed in a later release. | — |
| [plz-setup-issues](skills/plz-setup-issues/README.md) | Issue labels, bug and feature forms, and triage rules for a GitHub repository. | — |
| [plz-quiz](skills/plz-quiz/README.md) | Document-based quizzes for studying, checking understanding, and reviewing mistakes. | — |
| [plz-model-sheet](skills/plz-model-sheet/README.md) | Realistic, real-size modeling reference sheets (orthographic views and turnaround) for characters, animals, NPCs, and props. | — |
| [plz-sheet-to-model](skills/plz-sheet-to-model/README.md) | A real-size, textured 3D model (`.blend` and `.glb`) built headlessly in Blender from a reference sheet. | — |
| [plz-rig-model](skills/plz-rig-model/README.md) | A game-ready rig (armature, skin weights, leg IK, base poses, bone rotation sign table) for an existing mesh model. | — |

### Modeling pipeline

Three skills form a pipeline for game-ready 3D models: [plz-model-sheet](skills/plz-model-sheet/README.md) → [plz-sheet-to-model](skills/plz-sheet-to-model/README.md) → [plz-rig-model](skills/plz-rig-model/README.md). Each one also works on its own.

- **plz-model-sheet** takes a subject (a character, animal, NPC, or prop) and makes a real-size orthographic reference sheet from measured dimensions, openly licensed photos, and Codex image generation.
- **plz-sheet-to-model** takes that sheet's views and measurements and builds a textured `.blend` and `.glb` (bird or quadruped body plan), plus a `landmarks.json` for rigging.
- **plz-rig-model** takes a mesh model (`.blend` or `.glb`, from this pipeline or from anywhere else, or an avatar that already has a rig) and a `landmarks.json`, and adds the rig, exporting a `.glb` and a `.blend` with a bone rotation sign table.

No skill needs an API key. The tools they use on your machine:

- **plz-model-sheet:** Python 3 (the first run installs `pillow` and `numpy` into a cache venv), Codex CLI with image generation enabled and a logged-in account (each image uses your ChatGPT usage), headless Chromium to render `sheet.webp` (without it you still get `sheet.svg`), and network access to Wikimedia Commons and Wikipedia.
- **plz-sheet-to-model:** Blender 4.2 or later, run in the background, and Python 3 (the first run installs `pillow` and `numpy` into a cache venv, which needs access to the Python package index).
- **plz-rig-model:** Blender 4.4 or later, run in the background. No extra Python packages and no network access.

To install the set, run the single-skill command for each name. Claude Code:

```sh
for skill in plz-model-sheet plz-sheet-to-model plz-rig-model; do
  npx skills add codekongdev/plz --skill "$skill" -a claude-code -g
done
```

Codex:

```sh
for skill in plz-model-sheet plz-sheet-to-model plz-rig-model; do
  npx skills add codekongdev/plz --skill "$skill" -a codex -g
done
```

Each skill's README has the details.

## Contributing

Contributions and translations are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
