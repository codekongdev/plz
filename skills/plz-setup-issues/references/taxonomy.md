# Baseline and adaptation

This is a starter convention, not a standard all mature repositories follow.
Keep the initial vocabulary small and grow it when it answers a real routing,
planning, or reporting question. Keep issue classification distinct from commit
message types: a maintenance issue can produce several kinds of commits.

## Work type

Choose one main purpose per issue. Split independently deliverable work when its
owners, priorities, or acceptance criteria differ.

| Label | Meaning | Example |
| --- | --- | --- |
| `type:bug` | Observed behavior differs from supported, expected behavior | A documented command fails on supported input |
| `type:feature` | Introduces a capability that does not exist | Add an export command |
| `type:improvement` | Improves an existing capability | Make an existing export resumable |
| `type:maintenance` | Internal upkeep such as refactoring, tests, dependencies, build, or CI | Replace a deprecated test runner |
| `type:docs` | The intended deliverable is documentation | Explain export configuration |

A bug fix may require tests and documentation without changing its main type.
Use acceptance criteria to settle feature/improvement ambiguity; prefer an existing
repository convention over arguing about the boundary.

GitHub's default organization Issue Types are Bug, Feature, and Task. Reusing them
merges feature/improvement and maintenance/docs respectively. This is a valid,
simpler model. Detailed type labels alongside native types are a deliberate
exception that needs a documented mapping, not an automatic default.

## Triage and progress

`needs-triage` means a maintainer has not reviewed the issue. Remove it when the
issue's validity, category, and next action have been assessed. Accepting an issue
does not promise an implementation date or require a priority immediately.

`needs-info` means a specific missing fact prevents assessment or reproduction.
Add a comment naming the required information and remove the label when supplied.
An issue can need both initial review and information; the labels are independent.
Do not use `needs-info` just because priority or an assignee is unset.

The guide should describe this small process:

1. Register the problem and expected outcome. Forms add the initial type and
   `needs-triage`; maintainers may use a blank issue for other work types.
2. Review validity, duplicates, scope, and missing information. Confirm or correct
   the type and identify the next action. A rotating maintainer or area owner can
   do this; do not invent a person or response-time commitment.
3. When planning work, choose a priority and assignee. If a board exists, Ready
   means the work is sufficiently understood and selected for an upcoming work
   cycle; Backlog can contain valid work that has not been scheduled.
4. Link implementation PRs. Close with a fix reference and relevant verification,
   or explain a duplicate, unsupported request, or other closure reason. If a fix
   must be checked after release, record the version and verification owner/method.

Do not add automatic inactivity closure by default. A quiet issue may still be a
valid defect. Establish a review cadence that fits available maintainers instead
of copying a public project's response deadline or vote threshold.

## Priority

Priority is a maintainer's scheduling decision informed by actual exposure,
frequency, workarounds, deadlines, and available capacity. Leave it unset until
assessed; do not assign a default P2 to every report or embed priority in titles.

| Value | Meaning |
| --- | --- |
| P0 | Immediate response to ongoing harm or an active critical incident |
| P1 | Prioritize in the next agreed work cycle |
| P2 | Schedule through normal planning |
| P3 | Defer until capacity allows |

## Extensions

- **Area:** add `area:*` only for useful code or product boundaries. Technology
  layers and product features are both valid models; pick boundaries that help
  route or find work. One main area is a useful default, with more when needed.
- **Impact/Severity:** add for projects where failure consequences affect decisions.
  Distinguish damage when triggered from how urgently to act. Define levels for
  the project's actual risks rather than importing another product's incidents.
- **Versions/platforms:** collect these in a bug form first; promote them to labels
  or fields if maintainers need cross-issue queries or backport coordination.
- **Customers:** add only when customer-specific support is part of the workflow.
- **Community contribution:** add `good first issue` or `help wanted` when the team
  is prepared to guide outside contributors; do not equate low priority with easy.

## Sources and limits

Reviewed 2026-11-03. These are examples supporting the design, not dependencies:

- [Kubernetes triage](https://www.kubernetes.dev/docs/guide/issue-triage/): separates
  kind, ownership, priority, and initial review.
- [CPython labels](https://devguide.python.org/triage/labels/): adds components,
  platforms, and affected versions because those dimensions matter to its work.
- [VS Code tracking](https://github.com/microsoft/vscode/wiki/Issue-Tracking):
  separates inbox routing, area ownership, planning, and verification.

Their large public communities justify conventions and automation that a new
repository may not need. The five-type baseline above is this skill's recommended
starting point, not a claim that these projects share an identical taxonomy.
