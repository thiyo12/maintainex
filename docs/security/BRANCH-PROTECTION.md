# Branch protection contract — `main`

Applied via GitHub Branch Protection API. Verified live with
`GET /repos/thiyo12/maintainex/branches/main/protection`.

Do NOT relax any setting below without a security review. The regression test
`tests/security/supply-chain-hardening.test.ts` ("locks the main branch
protection contract") asserts this document matches the required values.

## Required live settings

| Setting | Required value |
|---|---|
| `required_status_checks.strict` | `true` |
| `required_status_checks.checks` | exactly `validate`, `audit` (both GitHub Actions, app_id 15368) |
| `enforce_admins.enabled` | `true` |
| `required_pull_request_reviews.dismiss_stale_reviews` | `true` |
| `required_pull_request_reviews.required_approving_review_count` | `0` (solo-owner repo; PR flow still mandatory) |
| `require_code_owner_reviews` | `false` (no CODEOWNERS file in use) |
| `allow_force_pushes.enabled` | `false` |
| `allow_deletions.enabled` | `false` |
| `required_conversation_resolution.enabled` | `true` |
| `required_linear_history.enabled` | `false` (merge commits allowed) |
| `lock_branch.enabled` | `false` |
| `required_signatures.enabled` | `false` (not enforced; acceptable for solo owner) |

## Notes

- Dependabot *alerts* and secret scanning are currently disabled at the
  repository level (see Phase 5 evidence). Dependabot *version updates* remain
  configured in `.github/dependabot.yml` and pinned-action CI checks remain
  green. Enabling alerts/scanning requires the repository admin UI and is
  tracked as a hardening follow-up, not a code change.
- Check names `validate` and `audit` were verified as the exact successful
  check-run names on the `main` HEAD before being pinned here. If CI job
  names change, this contract and the live protection must be updated together.
