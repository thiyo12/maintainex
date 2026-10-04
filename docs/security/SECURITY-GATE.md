# MaintainEX Security Gate

This file is the running security release gate for `security/production-hardening`.

## Phase status

| Phase | Area | Status | Release blocker |
|---|---|---|---|
| 0 | Security baseline / feature freeze | CONDITIONAL | YES |
| 1 | Production test/debug bypasses | NOT STARTED | YES |
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
