## Summary

<!-- What did you change, and why? -->

## Type of change

- [ ] Translation or README
- [ ] Bug fix
- [ ] Skill improvement (`SKILL.md`, `references/`, or `assets/`)
- [ ] New skill
- [ ] CI or tooling
- [ ] Other

## How I verified it

<!-- Commands you ran and what you checked. See CONTRIBUTING.md, "Checks to run". -->

## Checklist

- [ ] `node scripts/check-readme-translations.mjs` passes (or I only changed things it does not cover)
- [ ] If I changed `ENGINE` in `template.html`, I applied the same change to `example-agent-sandbox.html`, and `node scripts/check-templates.mjs` passes
- [ ] If I added a `UI_TEXT` key, I added it for `en`, `ko`, `ja`, and `zh-CN`, and `node scripts/check-templates.mjs` passes
- [ ] I did not commit `references/preferences.md`, generated pages, or verification screenshots
- [ ] I added no new external URLs or shell commands, or I explained them in the summary above
- [ ] If this is a new skill, I understand that maintainers may add the translations to my branch, and I enabled "Allow edits by maintainers"
