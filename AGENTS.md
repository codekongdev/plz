# GitHub account for this repository

- All authenticated GitHub operations for `codekongdev/plz` must use **`codekongdev`**. This includes issues, pull requests, comments, labels, releases, and pushes.
- Never use another account, including `planit-mason` or `YASICJUNWOO`, as a fallback, even if it is the default CLI or connector account.
- Before a GitHub operation, verify the authenticated login with `gh api user --jq .login` or an equivalent identity check. Use the same credentials for the check and the operation, and proceed only when the login is exactly `codekongdev`.
- The repository owner and the username in the remote URL do not verify the authenticated account. A connector must also pass the identity check before use.
- Prefer credentials scoped to the individual command or process. Do not switch the global GitHub account for other projects, and never print credentials or save them in repository files or logs.
- If `codekongdev` authentication is unavailable or cannot be verified, stop the GitHub operation and report the authentication problem. Do not act under a different account.
