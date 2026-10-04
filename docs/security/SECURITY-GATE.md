# MaintainEX Security Gate

This file is the running security release gate for `security/production-hardening`.

## Phase status

| Phase | Area | Status | Release blocker |
|---|---|---|---|
| 0 | Security baseline / feature freeze | CONDITIONAL | YES |
| 1 | Production test/debug bypasses | IN PROGRESS — code closure complete; CI pending | YES |
| 2 | Secrets / credentials | NOT STARTED | YES |
| 3 | VPS / network perimeter | NOT STARTED | YES |
| 4 | Docker / Dokploy | NOT STARTED | YES |
| 5 | GitHub / CI supply chain | NOT STARTED | YES |
| 6 | API attack-surface inventory | NOT STARTED | YES |
| 7 | IDOR / broken access control | NOT STARTED | YES |
| 8 | Company / tenant isolation | NOT STARTED | YES |
| 9 | CRM / staff authorization | NOT STARTED | YES |
| 10 | High-risk CRM governance | NOT STARTED | YES |
| 11 | Admin auth / sessions / MFA | NOT STARTED | YES |
| 12 | Password / OTP / recovery | NOT STARTED | HIGH |
| 13 | Identity / KYC security | NOT STARTED | HIGH |
| 14 | Payment / escrow authorization | NOT STARTED | YES |
| 15 | PayHere webhook security | NOT STARTED | YES |
| 16 | PayPal production completion | NOT STARTED | YES before PayPal live |
| 17 | Financial concurrency / idempotency | NOT STARTED | YES |
| 18 | Wallet / commission / account abuse | NOT STARTED | YES |
| 19 | File / upload security | NOT STARTED | YES |
| 20 | CSRF / CORS / browser security | NOT STARTED | HIGH |
| 21 | Rate limiting / abuse protection | NOT STARTED | HIGH |
| 22 | Database hardening | NOT STARTED | HIGH |
| 23 | Privacy / data minimization | NOT STARTED | HIGH |
| 24 | Logging / audit safety | NOT STARTED | HIGH |
| 25 | Security monitoring / alerts | NOT STARTED | HARDENING |
| 26 | Cloudflare / edge hardening | NOT STARTED | HIGH |
| 27 | IP / proxy trust | NOT STARTED | HIGH |
| 28 | Backup / disaster recovery | NOT STARTED | YES |
| 29 | Dependency / supply chain | NOT STARTED | HARDENING |
| 30 | Automated security regression | NOT STARTED | YES |
| 31 | External attack simulation | NOT STARTED | YES |
| 32 | Final security release gate | NOT STARTED | YES |

## Findings

### SG-0001 — Production release SHA is not externally traceable

- Severity: HIGH (release-control / forensic traceability)
- Status: OPEN
- Attack path: deployment drift or unauthorized/accidental production release cannot be conclusively mapped back to reviewed source using currently available public evidence.
- Affected component: production deployment / release traceability
- Remediation:
  1. expose a non-secret release identifier in an authenticated/internal readiness endpoint or deployment metadata;
  2. record the deployed git SHA in the deployment;
  3. verify the real Dokploy deployment SHA against expected `main`.
- Regression/verification: deployment preflight must compare expected and deployed release SHA.
- Commit: pending security branch commits
- Remaining risk: production may differ from GitHub `main`; do not infer equivalence.

### SG-0002 — Internal shared-secret routes used ordinary string comparison

- Severity: LOW
- Status: FIXED — CI verification pending
- Attack path: a remote caller repeatedly probes internal or cron endpoints and attempts to infer a shared secret from ordinary string-comparison timing behavior.
- Affected component: internal metrics/readiness, IP-blocklist sync, non-production security seed, and mobile photo-cleanup cron authentication.
- Reproduction/evidence: route-local audit found direct `!==` comparisons against `INTERNAL_SYNC_SECRET` / `CRON_SECRET` on the affected endpoints.
- Root cause: constant-time shared-secret helpers existed but were not applied consistently to every internal/cron route.
- Fix: migrated the affected routes to `matchesSharedSecret` / `matchesBearerSecret`.
- Test added: `tests/security/secret-boundary-contract.test.ts` now locks these routes to the constant-time helpers.
- Commit SHA: route fixes `13a10205`, `e7f800ef`, `658ab58a`, `89a30f0b`, `a494b12d`; regression `c48dffb5`.
- Residual risk: network timing attacks are noisy; the stronger boundary now removes this avoidable signal. Real origin/network isolation is still an external Phase 3/26 requirement.
- Status: FIXED — awaiting the full branch validation run.

## Phase 0 report

PHASE: 0 — Security baseline / feature freeze
STATUS: CONDITIONAL

DISCOVERED:
- Critical: 0 confirmed
- High: 1 (SG-0001 release SHA traceability)
- Medium: 0 confirmed
- Low: 0 confirmed

FIXED:
1. Created dedicated `security/production-hardening` branch from exact merged main.
2. Recorded source/toolchain/CI/auth/payment baseline.
3. Established this running security gate.

FILES CHANGED:
- `docs/security/SECURITY-BASELINE.md`
- `docs/security/SECURITY-GATE.md`

TESTS ADDED:
- none in Phase 0 documentation commit

TEST RESULTS:
- inherited exact pre-security baseline: green
- full regression: 262 pass-files / 5 skipped / 0 failed

PRODUCTION IMPACT:
- none; documentation only; no deployment

REMAINING BLOCKERS:
- exact deployed production SHA
- real production environment/payment modes
- real production database migration state
- complete production domain/service topology

EVIDENCE:
- GitHub main SHA `e280515e44d9ee15c35a3b35aa334d212f2a643d`
- security branch created from that exact SHA
- public `maintainex.lk` observed reachable
- repository workflow/build evidence recorded above

NEXT PHASE:
- Phase 1 repository/config audit for production test/debug bypasses begins immediately; Phase 0 remains CONDITIONAL until runtime deployment evidence is collected.


## Phase 1 report

PHASE: 1 — Production test/debug bypasses
STATUS: IN PROGRESS — repository closure complete; full CI pending

DISCOVERED:
- Critical: 0 confirmed
- High: 0 confirmed
- Medium: 0 confirmed
- Low: 1 (SG-0002 shared-secret comparison consistency)

EVIDENCE REVIEWED:
- complete API route tree contains 283 route handlers
- 13 operational/test-like routes matched the explicit audit classifier
- seed/setup/init/migration mutations contain route-local production denial
- internal operational endpoints contain route-local shared-secret authorization
- `/api/mobile/cleanup-photos` requires `CRON_SECRET`
- middleware remains defense in depth only; Phase 1 does not rely on middleware as the sole guard

FIXED:
1. Added exhaustive regression classification for test/debug/setup/seed/migration/internal/cleanup mutation surfaces.
2. Replaced ordinary internal/cron secret comparisons with constant-time helper calls.
3. Preserved all existing production seed/setup denial behavior.

FILES CHANGED:
- `tests/security/api-attack-surface-inventory.test.ts`
- `app/api/internal/metrics/route.ts`
- `app/api/internal/readiness/route.ts`
- `app/api/internal/security/ip-blocklist/route.ts`
- `app/api/internal/security/seed/route.ts`
- `app/api/mobile/cleanup-photos/route.ts`
- `tests/security/secret-boundary-contract.test.ts`

TESTS ADDED / STRENGTHENED:
- exhaustive operational/test-surface route-local guard check
- constant-time internal/cron shared-secret boundary regression

TEST RESULTS:
- Security Exposure Audit on pre-fix and intermediate heads: PASS
- full CRM V2 Release Validation on final Phase 1 head: PENDING

PRODUCTION IMPACT:
- no deployment performed
- no production database mutation performed

REMAINING BLOCKERS:
- full branch validation must finish green
- Phase 0 runtime evidence remains external and CONDITIONAL

NEXT PHASE:
- after the final Phase 1 branch validation is green, continue to Phase 2 secrets/credentials without reopening already validated architecture.
