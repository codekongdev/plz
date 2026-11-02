# plz
English | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

A series of AI coding agent skills by codekongdev for Claude Code and Codex. Each `plz-<task>` name reads like a request to your agent: “please do this.”

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) ![Agent Skills](https://img.shields.io/badge/Agent%20Skills-555555.svg) ![works with Claude Code | Codex](https://img.shields.io/badge/works%20with-Claude%20Code%20%7C%20Codex-555555.svg)

## Skills

| Skill | What it makes | Demo |
| --- | --- | --- |
| [plz-3d-explain](skills/plz-3d-explain/README.md) | A single HTML learning page with three.js 3D models of technical concepts and system structures. | [Code sandbox (Korean)](https://codekongdev.github.io/plz/skills/plz-3d-explain/assets/example-agent-sandbox.html) |

## Install

List available skills:

```sh
npx skills add codekongdev/plz -l
```

Install one skill globally:

```sh
npx skills add codekongdev/plz --skill plz-3d-explain -g
```

Install all skills globally:

```sh
npx skills add codekongdev/plz --skill '*' -g
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

## Contributing

The English README is the source of truth. When updating a translation, keep commands, code, and links identical to the English version. Translation contributions are welcome. Run `node scripts/check-readme-translations.mjs` from the repository root to check consistency and relative links.

## License

[MIT](LICENSE).
