---
name: plz-setup-issues
description: |
  Set up a reusable GitHub issue-management baseline for a new repository: work types,
  triage labels, priorities, bug and feature forms, and a short operating guide.
  Adapt to existing labels, organization Issue Types, and project fields without
  overwriting established conventions. Use for initial issue setup or a requested
  refresh of that setup, not for filing individual issues or bulk reclassifying a backlog.
  Triggers: "set up issue management", "initialize issue labels and templates",
  "이슈 관리 초기 세팅", "이슈 라벨이랑 템플릿 설정해줘",
  "Issue 管理を初期設定して", "初始化仓库的问题分类和模板".
---

# Set up repository issues

Create a small issue-management system that fits the target repository. This skill
works in Claude Code and Codex using ordinary file operations and available GitHub
tools; GitHub CLI (`gh`) is a fallback, not a required agent-specific integration.
Resolve paths in this document relative to this skill's directory.

## Establish the target and scope

Read the target repository's `AGENTS.md`, `CLAUDE.md`, contribution guide, existing
issue templates, and issue-management instructions. Inspect the working tree before
editing. Resolve the intended GitHub repository from the user's request and remotes;
if a fork or several remotes make the destination ambiguous, prepare local files
and ask which remote to use before changing GitHub.

- A request to draft or generate templates authorizes local artifacts.
- A request to set up issue management in an identified GitHub repository authorizes
  the necessary repository labels as well as local configuration. Explain the concrete
  additions before applying them; do not ask again for scope already authorized.
- Creating this skill, installing it, or discussing possible conventions does not
  authorize applying it to the current repository.
- Organization-wide types/fields, creating or changing shared boards, existing-issue
  relabeling, commits, pushes, and PR creation require corresponding user scope.
  Finish independent local work if remote access or scope is unavailable.

Use the repository's required GitHub account, if specified. Before authenticated
GitHub operations, verify the active login with the same credentials used for those
operations. Do not change a global account as a shortcut.

## Choose the baseline

Read [references/taxonomy.md](references/taxonomy.md) for definitions and examples.
Start from these defaults and preserve an established equivalent convention:

| Axis | Default | Where it lives |
| --- | --- | --- |
| Work type | bug, feature, improvement, maintenance, docs | Exactly one `type:*` label |
| Review needed | `needs-triage`, `needs-info` | Labels |
| Priority | P0, P1, P2, P3; unset until assessed | Existing Priority field, otherwise `priority:*` labels |
| Progress | Backlog, Ready, In progress, Done | Existing board if present |

Do not create a board just to represent progress. With no board, open/closed issues,
assignees, and linked PRs are sufficient until a board is requested. If a board is
already established, retain its status options; `In review` is optional.

### Select one source for each value

- For a new or personal repository without a suitable organization convention, use
  `type:*` labels. This works independently of organization administration.
- If the organization already uses Issue Types, reuse their exact existing names
  and definitions. Map feature/improvement to Feature and maintenance/docs to Task
  when using the standard Bug/Feature/Task set. Explain that this intentionally
  merges the finer categories. Do not also add `type:*` labels by default.
- If the user explicitly wants detailed labels alongside broader native types,
  document their mapping and keep them consistent; do not create organization types.
- Reuse an existing Priority issue field or project field. Do not create priority
  labels for the same value. Otherwise use the four bundled `priority:*` labels.
- A denied or unavailable field/type lookup is not evidence that nothing exists.
  Preserve local conventions, report the limitation, and ask only if it blocks a
  necessary choice.

Area labels, Impact/Severity, customers, platforms, versions, contributor labels,
release blockers, and automatic stale closing are extensions, not baseline defaults.
Add them only when supported by the repository's needs or requested explicitly.
Do not import domains, customer names, or operating rules from a different project.

## Generate repository files

Use the prose language already used by the repository unless the user specifies
another. Translate form names, field text, label descriptions, and the guide; keep
chosen label identifiers stable. The bundled assets are English starting points.

1. Build `.github/labels.json` from [assets/labels.json](assets/labels.json), including
   only the selected labels. Exclude `type:*` for native-type-only setups and
   `priority:*` when a Priority field is used. Match existing names when equivalent.
   This file is a desired-label manifest, not an automatic synchronization service.
2. Adapt [assets/ISSUE_TEMPLATE/bug.yml](assets/ISSUE_TEMPLATE/bug.yml) and
   [assets/ISSUE_TEMPLATE/feature.yml](assets/ISSUE_TEMPLATE/feature.yml) into the
   target's `.github/ISSUE_TEMPLATE/`. In native-type mode remove the type label from
   `labels` and set the form's top-level `type` to the verified organization type name.
   Use `needs-triage` in both forms. Do not preassign priority, area, or people.
3. Merge [assets/ISSUE_TEMPLATE/config.yml](assets/ISSUE_TEMPLATE/config.yml) with any
   existing chooser config. Keep blank issues enabled by default so maintainers can
   file maintenance/docs work without a mismatched form. Preserve contact links and
   security-reporting instructions; do not invent a contact destination.
4. Write or update `.github/ISSUE_TRIAGE.md` with the selected definitions, type and
   priority storage, what each form collects, and the review/close procedure from
   the taxonomy reference. Document actual choices, not unused alternatives.

Preserve existing files and user edits. Improve an equivalent existing form in place
instead of adding a competing form. Inspect Markdown templates as well as YAML.
Before setting native Issue Types in an existing Markdown template, verify that
GitHub supports the intended metadata there. If automatic assignment is unavailable
or unverified, retain the template and document manual type selection during triage,
or convert it in place when in scope while preserving its content. Do not invent
frontmatter keys or add a duplicate form to gain YAML-only functionality.
For overlapping changes, merge compatible content and show any substantive policy
conflict instead of overwriting it. Running the skill again should produce no
duplicate forms, labels, or guide sections. Keep unrelated repository files intact.

## Apply repository labels when in scope

Read [references/github.md](references/github.md) when reading or applying live
GitHub configuration. Discover available GitHub tools first; use `gh` if they do
not support the required operation. Verify the account and explicit owner/repo.

Read all current labels, then create only missing selected labels. Preserve existing
colors and descriptions unless their update is requested; report any conflicts.
Never delete or rename labels, force-sync the manifest, or relabel old issues as
part of an initial setup. If a write fails, inspect live state before retrying;
stop at an authentication/permission boundary rather than looping writes.

Local forms become active only after they reach the repository's default branch.
Do not claim that local files are already live, or push them without user scope.

## Verify and report

- Parse JSON and YAML with an available parser. Check unique label names, six-digit
  color strings, nonempty form bodies, unique form field IDs, and required fields.
- Check that form labels exist in the final manifest or verified live label set.
  When remote creation is deferred, report those labels as pending dependencies.
- In native-type mode, verify form `type` names against organization configuration
  when accessible. Do not claim unverified names are available.
- Inspect the final guide for one clear type source and one priority source.
  Check that `needs-info` requires a concrete request and that unknown priority is
  allowed. Review the diff for overwrites or repeated artifacts.
- If labels were applied, read them back. A local manifest is not evidence of a
  successful GitHub update. Static parsing does not verify the live issue chooser.

Report the target repository, changed files, selected model, checks actually run,
and live changes separately from pending ones. Make any missing permissions or
default-branch publication requirement explicit without labeling partial setup
complete. Do not create test issues just to validate a form unless requested.
