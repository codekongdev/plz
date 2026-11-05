# plz-setup-issues
English | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

Set up issue management for a GitHub repository with a small, reusable taxonomy, issue forms, and written triage rules. Works with Claude Code and Codex. Part of [plz](https://github.com/codekongdev/plz).

## Install

To install with `npx skills`, you need Node.js 22.20 or later (with npm and `npx`), Git, and Claude Code or Codex. Check the command-line tools first:

```sh
node --version
npm --version
git --version
```

Choose your agent below. `-g` installs the skill globally, so it is available across projects.

Claude Code:

```sh
npx skills add codekongdev/plz --skill plz-setup-issues -a claude-code -g
```

Codex:

```sh
npx skills add codekongdev/plz --skill plz-setup-issues -a codex -g
```

For this project only, run the matching command from the project directory with `-g` omitted. The installer stores the skill in `.agents/skills/` and links it for Claude Code when selected.

Check the installation for your agent; the list should include `plz-setup-issues`:

```sh
npx skills list -g -a claude-code
npx skills list -g -a codex
```

For a project installation, omit `-g` from the check and run it in the same project. If the skill is missing, check the selected agent and installation scope. If it is listed but unavailable in your agent, start a new agent session from the intended project.

## Usage

After installing, open your agent in the target repository and invoke the skill:

- Claude Code: `/plz-setup-issues Set up issue management in this repository.`
- Codex: `$plz-setup-issues Set up issue management in this repository.`

You can request local files only, or explicitly ask to apply labels to a named GitHub repository. Existing settings are inspected before changes, and conflicting conventions are preserved until resolved.

## Defaults

- Five type labels: `type:bug`, `type:feature`, `type:improvement`, `type:maintenance`, and `type:docs`.
- Two review labels: `needs-triage` and `needs-info`.
- Bug and feature issue forms, `.github/ISSUE_TRIAGE.md`, and `.github/labels.json`.
- P0–P3 priority: reuse an existing project or organization field; otherwise use `priority:P0`–`priority:P3` labels. No project board is created automatically.
- Area, impact, and customer categories are added only when useful.

The skill uses one primary type system: repository type labels or organization Issue Types. It avoids duplicating the same classification across both.

## Scope

A setup request covers the target repository. Changing organization-wide types, creating a project board, and reclassifying existing issues require their own requested scope. GitHub changes need suitable authentication and permissions; local preparation can still be completed when these are unavailable.

See [SKILL.md](SKILL.md) for the workflow, [the taxonomy guide](references/taxonomy.md) for decisions, and [the label manifest](assets/labels.json) for default labels.
