# GitHub inspection and label application

Use an available GitHub integration when it supports the required operation and
account. Otherwise use `gh`. Verify current capabilities and official documentation
if an API, Issue Type, or field feature differs from the examples below.

## Read before writing

For CLI use, inspect remote destinations without returning raw URLs to the agent
or logs: URLs can contain credentials. This local example captures Git output,
returns only the host and repository path, and omits unrecognized destinations.
It makes no network requests. Do not enable shell tracing or print the captured
output while adapting it.

```sh
python3 - <<'PY'
import json
import re
import subprocess
from urllib.parse import urlsplit

result = subprocess.run(["git", "remote", "-v"], capture_output=True,
                        text=True, errors="replace")
if result.returncode:
    raise SystemExit("Cannot inspect remotes; raw Git output suppressed.")
for line in result.stdout.splitlines():
    fields = line.split()
    if len(fields) != 3:
        print("[unrecognized remote omitted]")
        continue
    raw = fields[1]
    scp = re.fullmatch(r"(?:[^/@:\s]+@)?(\[[0-9a-fA-F:]+\]|[^/@:\s]+):([^:\s]+)", raw)
    if "://" not in raw and scp:
        raw = "ssh://" + scp[1] + "/" + scp[2]
    try:
        url = urlsplit(raw)
        if url.scheme not in {"http", "https", "ssh", "git"} or not url.hostname:
            raise ValueError
        print(json.dumps({"host": url.hostname, "path": url.path}))
    except ValueError:
        print("[unrecognized remote omitted]")
PY
```

Verify the current process identity with the credentials intended for subsequent
GitHub operations:

```sh
gh api user --jq .login
```

Use credentials already authorized for the target and any repository account rule.
An owner in a URL does not establish the logged-in identity. Avoid global account
switching. Use an explicit repository on every repository-specific call. These
examples use a placeholder that must be replaced with the resolved target:

```sh
gh repo view OWNER/REPO --json nameWithOwner,defaultBranchRef,hasIssuesEnabled
gh label list --repo OWNER/REPO --limit 1000 --json name,color,description
```

If there are more labels than the chosen limit, paginate the API instead of treating
the truncated list as complete. Inspect organization Issue Types or project fields
only if needed for a real choice. A personal repository does not have organization
Issue Types. Do not create a board or modify organization settings to satisfy a
baseline that can work with repository labels.

## Add missing labels

Compare `.github/labels.json` with the complete live label list. Create only names
that are missing, using each manifest entry's actual color and description:

```sh
gh label create 'needs-triage' --repo OWNER/REPO --color 'FBCA04' --description 'Awaiting initial maintainer review'
```

Use structured tool arguments or an argument array such as Python's
`subprocess.run([...], check=True)` for dynamic values, especially translated label
descriptions. Do not interpolate user-provided text into shell code. Do not use
`--force` to reconcile an existing label automatically. An existing label's name,
description, and color may be relied on by other workflows and historical issues.

Read back the labels after creation. On failure, identify which additions succeeded
before deciding whether a retry is appropriate. Do not switch accounts or request
broader scopes automatically to work around a denied operation.

## Templates and publication

Form `labels` only apply labels that actually exist; a local manifest does not
create them. Top-level form `type` must match an available organization Issue Type.
Omit it in label-only mode. Keep YAML field IDs unique and preserve any existing
contact links. Files become active when present on the default branch; local edits
alone do not change the GitHub chooser.

Never report the live chooser as tested from JSON/YAML parsing alone. If browser
preview or publication is outside scope, say exactly what was verified locally.

## Official references

Checked 2026-11-03; consult these for changing GitHub capabilities:

- [Issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
- [Default community health files and inherited templates](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file)
- [Organization Issue Types](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-types-in-an-organization)
- [Organization issue fields](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-fields-in-your-organization)
- [Create labels with gh](https://cli.github.com/manual/gh_label_create)
