# Branch protection and production environment

Settings the repository needs so that the CI workflow is actually enforced. The workflow can report failure, but only
branch protection stops a merge.

## 1. Prerequisites

1. Replace `@your-org/qa-leads` in `.github/CODEOWNERS` with a real team/user that has write access.
2. Push the workflow and run it once on `main` (a status check must have run before GitHub offers it in the picker).

## 2. Branch protection on `main`

### Via script

```bash
gh auth login                      # needs admin on the repo
scripts/setup-branch-protection.sh --dry-run OWNER REPO   # review the payload
scripts/setup-branch-protection.sh OWNER REPO
```

Applies: required status check **CI Gate** (strict / branch must be up to date), PR with at least 1 approval,
dismiss stale reviews, code-owner review, enforce for admins, no force pushes, no deletions, conversation resolution.

### Via the UI

Settings > Branches > Add branch protection rule (or Rulesets), pattern `main`:

- Require a pull request before merging: 1 approval; Dismiss stale pull request approvals; Require review from Code Owners
- Require status checks to pass: Require branches to be up to date; add only **CI Gate**
- Require conversation resolution before merging
- Do not allow bypassing the above settings (include administrators)
- Leave "Allow force pushes" and "Allow deletions" off

Only `CI Gate` is required on purpose: it aggregates `quality`, `e2e` and `docker`, so adding/renaming jobs never requires
changing the protection rule. Do not mark the individual jobs as required as well.

## 3. `production` environment (deployment approval)

Settings > Environments > New environment > `production`:

- Required reviewers: the release approvers (up to 6 users/teams)
- Optionally: wait timer, "Prevent self-review"
- Deployment branches and tags: Selected branches > `main`
- Put deploy credentials here as environment secrets (or use OIDC); never in the workflow file

The `deploy` job is gated by `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, needs `ci-gate`, and
pauses on this environment until a reviewer approves.

## Limits

Branch protection on private repos requires GitHub Pro/Team/Enterprise. Environment required reviewers on private repos
require Pro/Team/Enterprise as well.
