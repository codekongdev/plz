# Agent instructions

This repository publishes agent skills for Claude Code and Codex. Read [CONTRIBUTING.md](CONTRIBUTING.md) before you change files. It covers the repository structure, the language policy, the checks for each kind of change, what not to commit, and the commit and pull request rules.

## Checks

Run the checks that match your change from the repository root. CI runs all three on every pull request.

| What you changed | Command |
| --- | --- |
| Any `README.md` or translation | `node scripts/check-readme-translations.mjs` |
| `ENGINE` or `UI_TEXT` in `assets/template.html` | `node scripts/check-templates.mjs` |
| Anything in `scripts/` | `node --test scripts/*.test.mjs` |

The script tests include Chromium tests. Install their dependencies first with `npm ci --ignore-scripts` and `npx playwright install chromium`.

This table lists only the automated checks. Changes to `SKILL.md`, `references/`, or `TEXT`, `SCENES`, and `ENGINE` in `assets/template.html` also need the review or browser validation described in "Checks to run" in CONTRIBUTING.md.

Browser automation tools can save screenshots in the repository root. Run `git status` before every commit, and do not commit screenshots, generated pages, or `references/preferences.md`.
