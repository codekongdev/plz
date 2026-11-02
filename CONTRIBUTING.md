# Contributing to plz

Thanks for your interest in plz. This repository is a collection of agent skills for Claude Code and Codex, published under the MIT license. Each skill is named `plz-<task>`, so it reads like a request to your agent: "please do this."

## Welcome contributions

- **Translations.** The English README is the source of truth, and the Korean, Japanese, and Simplified Chinese versions are translations. Fixes and improvements are welcome.
- **Bug reports.** Use the bug report issue form. Layout problems on generated pages are easiest to fix when you include the `__explainer.overlaps()` and `__explainer.clipped()` output.
- **Skill improvements.** Better instructions, references, templates, and examples for an existing skill.
- **New skills.** See "Adding a new skill" below.

## Before you start

- For a new skill or any large change, open an issue first so we can agree on the direction before you spend time on it.
- For a small fix such as a typo, a broken link, or a clearer sentence, open a pull request directly.

## Repository structure

```text
README.md, README.ko.md, README.ja.md, README.zh-CN.md   repository overview
CONTRIBUTING.md
SECURITY.md                                               how to report a vulnerability
scripts/check-readme-translations.mjs                     translation consistency check
scripts/check-templates.mjs                               template ENGINE and UI_TEXT consistency check
scripts/check-templates.test.mjs                          tests for the template check
skills/<skill-name>/
  SKILL.md          instructions the agent follows (frontmatter: name, description)
  README*.md        English README plus ko, ja, and zh-CN translations
  references/       supporting documents the agent reads while following SKILL.md
  assets/           files the skill copies or ships, such as templates and examples
  docs/             images used by the README
```

- A skill's directory name is `plz-<task>`, and the `name` in the `SKILL.md` frontmatter must match it.
- `description` in the frontmatter tells the agent when to use the skill. Write it carefully, because it decides when the skill triggers.
- `scripts/check-readme-translations.mjs` finds every `README.md` in the repository and requires `README.ko.md`, `README.ja.md`, and `README.zh-CN.md` beside it. It then compares each translation with the English file: code blocks, HTTP(S) URLs, image paths, table row counts, the language switcher line, and relative links must match.

## Language policy

- `SKILL.md` and everything in `references/` are written in English.
- The English `README.md` is the source of truth. The `ko`, `ja`, and `zh-CN` READMEs are translations. In a translation, keep commands, code, and links identical to the English version.
- Pages that a skill generates are written in the user's language.
- Some non-English text is intentional. Do not translate it:
  - the `ko`, `ja`, and `zh-CN` dictionaries inside `UI_TEXT` in `assets/template.html`
  - the body of the Korean demo page `assets/example-agent-sandbox.html`
  - the multilingual trigger phrases in the `description` of the `SKILL.md` frontmatter

## Checks to run

Run the check that matches what you changed. If a change fits more than one row, run all of them.

| What you changed | What to do |
| --- | --- |
| Any `README.md` or translation | Run `node scripts/check-readme-translations.mjs` from the repository root. It needs Node.js. CI runs it on Node 22. |
| `SKILL.md` or `references/` | There is no automated check. A maintainer reviews the change in the pull request, so explain what you changed and why. |
| `TEXT` or `SCENES` in `assets/template.html` | Follow the validation procedure in the validation section of `SKILL.md`: serve the page from a local server, open it with a browser automation tool, check that `__explainer.overlaps()` and `__explainer.clipped()` return empty arrays for every chapter, check auto-play, and check the layout on a phone-sized screen. |
| `ENGINE` in `assets/template.html` | Apply the same change to `assets/example-agent-sandbox.html`. The two `ENGINE` sections of the template (the block that starts at the `ENGINE` banner comment and ends before the `SCENES` banner, and the block from the `ENGINE (continued)` banner to the end of the file) are copied into the example verbatim. Run `node scripts/check-templates.mjs` from the repository root to confirm they still match; CI runs it too. Then run the validation procedure above on both files. |
| Anything in `scripts/` | Run `node --test scripts/*.test.mjs` from the repository root, and add or update tests for the behavior you changed. CI runs the same command. |
| A new key in `UI_TEXT` | Add the key to all four languages: `en`, `ko`, `ja`, and `zh-CN`. Run `node scripts/check-templates.mjs` from the repository root; it reports keys that are missing from or extra in a language compared with `en`, and CI runs it too. |

Because the `ENGINE` sections ship inside every generated page, treat them as stable. Skill instructions tell the agent not to edit them when building a page, and changes to them should be deliberate and explained.

## Adding a new skill

1. Open an issue that describes the problem the skill solves and example requests that should trigger it. Use the skill request form.
2. Create `skills/plz-<task>/` following the structure above.
3. Write `SKILL.md` in English, with `name` and `description` in the frontmatter.
4. Write the English `README.md` for the skill.
5. Add a row for the skill to the table in the root `README.md`.

You do not need to write the Korean, Japanese, or Simplified Chinese READMEs. We accept pull requests that contain only the English README. In that case the translation check reports the missing files, and that is expected. CI runs the same check, so it fails on such a pull request until the translations are added. Please enable "Allow edits by maintainers" on your pull request. A maintainer adds the translations to your branch before merging.

## Commits and pull requests

Commit messages use this format:

```text
<type>: <description>

<optional body>
```

Allowed types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

Pull request guidelines:

- One logical change per pull request.
- In the description, say what you changed, why you changed it, and how you verified it.
- Fill in the pull request template. It lists the checks above.

## What not to commit

- `skills/*/references/preferences.md`. It holds personal settings and is listed in `.gitignore`. Edit `preferences.example.md` instead if the template needs to change.
- Pages generated by a skill, other than the intentional example in `assets/`.
- Verification screenshots. Browser automation tools may save screenshots in the working directory, which can be the repository root. Give the tool an absolute path outside the repository, or delete the files before you commit. Check `git status` before every commit.

## Security review

`SKILL.md` and `references/` are instructions that an agent follows with the user's permissions. A change to them can make an agent run commands or touch files on someone else's machine, so we review them more strictly than ordinary documentation.

If your pull request adds or changes any of the following, state the purpose and the effect in the description:

- shell commands
- network access
- file writes
- external URLs, including CDNs

Do not include secrets such as API keys or tokens anywhere in the repository.

To report a vulnerability in this repository, do not open a public issue. Follow [SECURITY.md](SECURITY.md) instead.

## License

By contributing, you agree that your contribution is provided under the [MIT License](LICENSE).
