# Security Policy

## Supported versions

plz has no releases. Only the latest state of the `main` branch is supported. Fixes are made on `main`, and older commits do not receive patches.

## What counts as a vulnerability

Please report a problem if it falls into one of these areas:

- **Skill instructions.** Text in a `SKILL.md` file or in `references/` that leads an agent to run a command the user did not intend, send data somewhere it should not go, or write files outside the intended location. These files are followed by an agent with the user's permissions, so they are the most sensitive part of this repository.
- **The template and the pages built from it.** Problems in `assets/template.html`, its `ENGINE` sections, or a page generated from them, such as cross-site scripting (XSS), loading third-party scripts or styles in an unsafe way, or a tampered CDN address or missing integrity setting that lets someone else's code run in the page.
- **Scripts and workflows.** Problems in `scripts/` or `.github/workflows/`, such as workflow injection or running untrusted pull request content with elevated permissions or secrets.

## Out of scope

- Vulnerabilities in three.js, the web fonts, or other third-party projects themselves. Please report those to the project concerned.
- General agent behavior that has nothing to do with a skill in this repository.

## How to report

Please do not open a public issue for a security problem. Use GitHub private vulnerability reporting instead:

1. Open the [Security tab](https://github.com/codekongdev/plz/security) of this repository.
2. Choose "Report a vulnerability", or go straight to <https://github.com/codekongdev/plz/security/advisories/new>.

Only the maintainers can see a private report.

## What to include

- The affected file and the commit you tested.
- Steps to reproduce the problem.
- The impact: what an attacker could do, and who would be affected.
- A suggested fix, if you have one.

## What to expect

This is a small project, so the answers below are honest rather than impressive:

- We will read every report and reply as best we can, but there is no fixed response time or fix date.
- There is no bounty program.
- Please keep the details private until a fix is merged, so that people using the skills are not exposed in the meantime.
- Once a fix is merged, we will credit you in the advisory if you would like that.
