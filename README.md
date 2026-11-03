# plz
English | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

AI coding agent skills for Claude Code and Codex, by codekongdev. The first skill, `plz-3d-explain`, turns any technical concept into an interactive 3D study page.

Each `plz-<task>` name reads like a request to your agent: “please do this.”

[Live demo](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.en.html) · [Install](#install) · [Usage](#usage) · [Skills](#skills)

[![License: MIT](https://img.shields.io/badge/License-MIT-0a0a0a.svg?labelColor=000000)](LICENSE) [![skills.sh](https://skills.sh/b/codekongdev/plz)](https://skills.sh/codekongdev/plz) ![works with Claude Code | Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%7C%20Codex-0a0a0a.svg?labelColor=000000)

<p align="center">
  <a href="https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html"><img src="skills/plz-3d-explain/docs/demo-desktop.png" alt="Desktop view with explanatory text on the left and a 3D container model on the right" width="610"></a>
  <img src="skills/plz-3d-explain/docs/demo-mobile.png" alt="Mobile view with an OS sandbox model above the explanatory text" width="176">
</p>
<p align="center"><em>Desktop: chapter 4 of the Korean demo, where containers isolate processes but still share the host kernel. Mobile: chapter 8, OS sandboxing. An English demo is listed in the Skills table below.</em></p>

https://github.com/user-attachments/assets/eb09c80d-4260-46b4-ae61-092b9f979167

A one-line request like this is enough to start, and the demo above covers one topic of this kind:

```text
Explain how an AI agent code sandbox works in 3D.
```

## Install

Install one skill globally:

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -g
```

<details>
<summary>Codex</summary>

For Codex, add `-a codex`. This command installs the skill into the current project's `.agents/skills/` directory:

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -a codex
```

</details>

<details>
<summary>List or install all skills</summary>

List available skills:

```sh
npx skills add codekongdev/plz -l
```

Install all skills globally:

```sh
npx skills add codekongdev/plz --skill '*' -g
```

</details>

<details>
<summary>Manual install (Claude Code)</summary>

For a manual Claude Code installation, clone the repository, then copy or symlink `skills/plz-3d-explain` to `~/.claude/skills/plz-3d-explain`. To copy it:

```sh
git clone https://github.com/codekongdev/plz.git
mkdir -p ~/.claude/skills
cp -R plz/skills/plz-3d-explain ~/.claude/skills/plz-3d-explain
```

</details>

See [plz-3d-explain on skills.sh](https://skills.sh/codekongdev/plz/plz-3d-explain).

## Usage

After installing, ask your agent in plain language:

- “Explain how container isolation works in 3D.”
- “Show how a TCP handshake works as a 3D model.”

You can also ask in Korean, Japanese, or Simplified Chinese; the page is written in the language you ask in.

## How it works

When you ask for a page, `plz-3d-explain` works in four steps:

1. **Check the material.** It checks the topic or repository, records sources and verification dates, and marks anything unverified.
2. **Plan the chapters.** It plans the chapters, each with an action that plays out cause and effect on the model.
3. **Fill the template.** It fills the template with text and scenes. The result is one HTML file with no build step.
4. **Validate in a browser.** It checks the finished page for console errors, overlapping or clipped labels, horizontal overflow, autorun, and touch gestures.

## Scope and requirements

- **Good for:** learning a technical concept, mechanism, or system structure with a 3D model.
- **Out of scope:** static architecture or sequence diagrams, data charts, Blender modeling, product landing pages, and app UI design.
- **Opening a page:** needs an internet connection, because three.js r170 and web fonts load from CDNs.
- **Creating a page:** includes validation with a local server and browser automation such as Playwright.

Details are in the [skill README](skills/plz-3d-explain/README.md).

## Skills

| Skill | What it makes | Demo |
| --- | --- | --- |
| [plz-3d-explain](skills/plz-3d-explain/README.md) | A single HTML learning page with three.js 3D models of technical concepts and system structures. | [Code sandbox (English)](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.en.html) · [Korean](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html) |
| [plz-setup-issues](skills/plz-setup-issues/README.md) | Issue labels, bug and feature forms, and triage rules for a GitHub repository. | — |

## Contributing

Contributions and translations are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
