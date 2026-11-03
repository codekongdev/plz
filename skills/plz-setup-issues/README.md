# plz-setup-issues
English | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

Set up issue management for a GitHub repository with a small, reusable taxonomy, issue forms, and written triage rules. Works with Claude Code and Codex. Part of [plz](../../README.md).

## Install

Install globally:

```sh
npx skills add codekongdev/plz --skill plz-setup-issues -g
```

For Codex, add `-a codex`. This installs into the current project's `.agents/skills/` directory:

```sh
npx skills add codekongdev/plz --skill plz-setup-issues -a codex
```

## Usage

Claude Code:

```text
/plz-setup-issues Set up issue management in this repository.
```

Codex:

```text
$plz-setup-issues Set up issue management in this repository.
```

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
