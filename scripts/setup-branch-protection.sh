#!/usr/bin/env bash
# Configure branch protection on `main` so that merging requires the single
# "CI Gate" status check, a reviewed PR and CODEOWNERS approval.
#
# Usage:
#   scripts/setup-branch-protection.sh [--dry-run] [--branch BRANCH] OWNER REPO
#
# Requires the GitHub CLI (`gh`) authenticated with admin rights on the repo.
# --dry-run prints the API call and JSON payload without contacting GitHub.
set -euo pipefail

dry_run=0
branch=main
positional=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) dry_run=1; shift ;;
    --branch) branch="${2:?--branch needs a value}"; shift 2 ;;
    -h | --help) sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "setup-branch-protection: unknown option $1" >&2; exit 2 ;;
    *) positional+=("$1"); shift ;;
  esac
done
if [[ ${#positional[@]} -ne 2 ]]; then
  echo "usage: $0 [--dry-run] [--branch BRANCH] OWNER REPO" >&2
  exit 2
fi
owner="${positional[0]}"
repo="${positional[1]}"

# The context must match the *job name* of the gate job in ci.yml.
payload="$(cat <<JSON
{
  "required_status_checks": { "strict": true, "contexts": ["CI Gate"] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true
}
JSON
)"

endpoint="repos/$owner/$repo/branches/$branch/protection"
if ((dry_run)); then
  echo "DRY RUN - would call: gh api --method PUT $endpoint --input -"
  echo "$payload"
  exit 0
fi

command -v gh >/dev/null || { echo "setup-branch-protection: gh CLI not found" >&2; exit 2; }
echo "$payload" | gh api --method PUT -H "Accept: application/vnd.github+json" "$endpoint" --input - >/dev/null
echo "Branch protection applied to $owner/$repo@$branch"
