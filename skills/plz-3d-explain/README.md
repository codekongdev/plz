# plz-3d-explain
English | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

A skill for Claude Code and Codex that creates a single HTML learning page with three.js 3D models of technical concepts and system structures.

Desktop: chapter 4, containers.

![Desktop view with explanatory text on the left and a 3D container model on the right](docs/demo-desktop.png)

Mobile: chapter 8, OS sandboxing.

<img src="docs/demo-mobile.png" alt="Mobile view with an OS sandbox model above the explanatory text" width="360">

Open the [AI agent code sandbox demo (Korean)](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html): ten chapters on isolation with containers, microVMs, WASM, and OS sandboxes. The [example HTML](assets/example-agent-sandbox.html) is also in the repository. This skill is part of [plz](../../README.md), by codekongdev.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE) ![Agent Skills](https://img.shields.io/badge/Agent%20Skills-555555.svg) ![works with Claude Code | Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%7C%20Codex-555555.svg)

## Install

Install globally:

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -g
```

For Codex, add `-a codex`. This command installs the skill into the current project's `.agents/skills/` directory:

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -a codex
```

For a manual Claude Code installation, clone the repository, then copy or symlink `skills/plz-3d-explain` to `~/.claude/skills/plz-3d-explain`. To copy it:

```sh
git clone https://github.com/codekongdev/plz.git
cp -R plz/skills/plz-3d-explain ~/.claude/skills/plz-3d-explain
```

See [plz-3d-explain on skills.sh](https://skills.sh/codekongdev/plz/plz-3d-explain).

## Usage

Ask your agent about a topic you want to learn or a repository you want to explore. These requests use the triggers described in [SKILL.md](SKILL.md):

- “Explain the difference between containers and virtual machines in 3D.”
- “Show me a 3D model of how an HTTP request goes through a server to an external API.”
- “Explain in 3D how resources in this repository are created and destroyed.”

The skill checks the material, plans the chapters, fills the [template](assets/template.html) with text and scenes, and validates the finished page in a browser.

## What the page includes

- **Scenes that follow the text.** On desktop, scrolling the text on the left changes the fixed 3D stage on the right to the current chapter's scene.
- **Cause and effect at the press of a button.** Each chapter has an action, such as a request moving along a path or an attempt being stopped at a boundary. A sentence explains the result.
- **Optional autorun.** A switch repeats the current chapter's action, shows the result, and resets the scene. It is off by default, and the browser remembers the setting.
- **An architectural model style.** An orthographic camera, white models, ink outlines, and soft shadows show the structure. Red represents the actor; blue, boundaries, rules, and mediators; brass, data, resources, and materials. Drag to rotate the model and use the reset-view control to return to the starting view.
- **A mobile layout.** In portrait, the stage stays at the top while text scrolls below. In landscape, text and stage sit side by side. The stage title and legend have their own rows outside the model area.
- **Terms and sources.** Technical terms are explained and collected in a glossary. Sources and verification dates are recorded, and unverified material is marked.
- **Language-aware interface text.** Buttons, guidance, and titles follow the page's `<html lang>` in English, Korean, Japanese, or Simplified Chinese. Other languages can be added through text overrides in the page; missing entries fall back to English. The page body is written in the user's language.
- **Label and screen checks.** Validation hooks check label overlaps and clipping. Screenshots of each chapter's final state are checked against its result text, along with autorun loops and mobile views.

## Requirements and limits

The output is a single HTML file with no build step. It loads three.js r170 and web fonts from CDNs, so opening the page requires an internet connection.

Creating a page includes validation with a local server and browser automation such as Playwright. Checks cover console errors, overlapping or clipped labels, horizontal overflow, autorun, and touch gestures. See [SKILL.md](SKILL.md) for the process, the [engine API](references/engine-api.md) for validation hooks, and [gotchas](references/gotchas.md) for common issues.

On mobile, models rotate horizontally only. A vertical swipe over the stage scrolls the page; a horizontal swipe rotates the model. Tilting and zooming are not supported.

The engine adjusts labels on narrow stages, but overlaps can remain beyond its adjustment limit. Keep labels short and check the rendered page.

Static architecture or sequence diagrams, data charts, Blender modeling, product landing pages, and app UI design are outside this skill's scope.

## Personal settings

From the installed skill directory, copy the [settings example](references/preferences.example.md):

```sh
cp references/preferences.example.md references/preferences.md
```

Use the copied file to record fonts, colors, validation tools, the output location for finished HTML, and feedback. These settings override the defaults in [SKILL.md](SKILL.md); unspecified settings keep their defaults. The personal settings file is ignored by Git.

## Contributing

Contributions and translations are welcome. See [CONTRIBUTING.md](../../CONTRIBUTING.md).

## License

[MIT](../../LICENSE).

The external resources loaded from CDNs—three.js (MIT) and the Pretendard, Hahmlet, and IBM Plex fonts (SIL OFL)—are not bundled in this repository.
