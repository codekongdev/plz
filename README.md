# plz
English | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

AI coding agent skills for Claude Code and Codex, by codekongdev. The first skill, `plz-3d-explain`, turns any technical concept into an interactive 3D study page.

Each `plz-<task>` name reads like a request to your agent: “please do this.”

[![License: MIT](https://img.shields.io/badge/License-MIT-0a0a0a.svg?labelColor=000000)](LICENSE) [![skills.sh](https://skills.sh/b/codekongdev/plz)](https://skills.sh/codekongdev/plz) ![works with Claude Code | Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%7C%20Codex-0a0a0a.svg?labelColor=000000)

<p align="center">
  <a href="https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html"><img src="skills/plz-3d-explain/docs/demo-desktop.png" alt="Desktop view with explanatory text on the left and a 3D container model on the right" width="800"></a>
</p>
<p align="center"><em>Chapter 4 of the demo (in Korean): containers isolate processes but still share the host kernel.</em></p>

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
cp -R plz/skills/plz-3d-explain ~/.claude/skills/plz-3d-explain
```

</details>

See [plz-3d-explain on skills.sh](https://skills.sh/codekongdev/plz/plz-3d-explain).

## Usage

After installing, ask your agent in plain language:

- “Explain how container isolation works in 3D.”
- “Show how a TCP handshake works as a 3D model.”

## Skills

| Skill | What it makes | Demo |
| --- | --- | --- |
| [plz-3d-explain](skills/plz-3d-explain/README.md) | A single HTML learning page with three.js 3D models of technical concepts and system structures. | [Code sandbox (Korean)](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html) |

## Contributing

Contributions and translations are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
