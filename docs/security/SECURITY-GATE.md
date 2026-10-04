# MaintainEX Security Gate

This file is the running security release gate for `security/production-hardening`.

## Phase status

| Phase | Area | Status | Release blocker |
|---|---|---|---|
| 0 | Security baseline / feature freeze | CONDITIONAL — external runtime proof required | YES |
| 1 | Production test/debug bypasses | IN PROGRESS — code closure complete; full CI running | YES |
| 2 | Secrets / credentials | PARTIAL — code controls present; rotation/runtime proof remains | YES |
| 3 | VPS / network perimeter | PARTIAL — source hardening present; live VPS proof remains | YES |
| 4 | Docker / Dokploy | PARTIAL — Docker controls present; Dokploy runtime proof remains | YES |
| 5 | GitHub / CI supply chain | PARTIAL — pinned CI/Dependabot/audits present; settings review remains | YES |
| 6 | API attack-surface inventory | PARTIAL — automated inventory present; deep closure review remains | YES |
| 7 | IDOR / broken access control | PARTIAL — multiple IDOR suites present; exhaustive matrix remains | YES |
| 8 | Company / tenant isolation | PARTIAL — tenant/persona suites present; exhaustive review remains | YES |
| 9 | CRM / staff authorization | PARTIAL — CRM/RBAC suites present; full role-action review remains | YES |
| 10 | High-risk CRM governance | PARTIAL — approval/step-up policy tests present; full action map remains | YES |
| 11 | Admin auth / sessions / MFA | PARTIAL — MFA/session lifecycle coverage present; adversarial closure remains | YES |
| 12 | Password / OTP / recovery | PARTIAL — recovery/OTP/refresh coverage present; abuse review remains | HIGH |
| 13 | Identity / KYC security | PARTIAL — identity/privacy/storage controls present; E2E review remains | HIGH |
| 14 | Payment / escrow authorization | PARTIAL — payment/escrow authorization tests present; closure review remains | YES |
| 15 | PayHere webhook security | PARTIAL — webhook/env controls present; reconciliation proof remains | YES |
| 16 | PayPal production completion | PARTIAL — provider/webhook controls present; sandbox/live verification remains | YES before PayPal live |
| 17 | Financial concurrency / idempotency | PARTIAL — concurrency/ledger tests present; exhaustive writer review remains | YES |
| 18 | Wallet / commission / account abuse | PARTIAL — commission/restriction controls present; abuse scenarios remain | YES |
| 19 | File / upload security | PARTIAL — traversal/content/upload controls present; full corpus review remains | YES |
| 20 | CSRF / CORS / browser security | PARTIAL — origin/browser controls present; complete mutation review remains | HIGH |
| 21 | Rate limiting / abuse protection | PARTIAL — fail-closed/rate-limit tests present; endpoint coverage review remains | HIGH |
| 22 | Database hardening | PARTIAL — schema/deploy controls present; live DB least-privilege proof remains | HIGH |
| 23 | Privacy / data minimization | PARTIAL — privacy suites present; full field-retention review remains | HIGH |
| 24 | Logging / audit safety | PARTIAL — redaction/security-event tests present; complete sink review remains | HIGH |
| 25 | Security monitoring / alerts | PARTIAL — risk/event logic present; live alert delivery proof remains | HARDENING |
| 26 | Cloudflare / edge hardening | PARTIAL — code assumes hardened edge; live Cloudflare config proof remains | HIGH |
| 27 | IP / proxy trust | PARTIAL — canonical proxy/IP tests present; live topology proof remains | HIGH |
| 28 | Backup / disaster recovery | PARTIAL — backup contracts present; successful restore drill remains | YES |
| 29 | Dependency / supply chain | PARTIAL — npm audits/Dependabot/pinned actions present; audit closure remains | HARDENING |
| 30 | Automated security regression | PARTIAL — blocking security suite wired; current full CI running | YES |
| 31 | External attack simulation | PARTIAL — automated negative/adversarial suites exist; external simulation remains | YES |
| 32 | Final security release gate | BLOCKED — cannot close until dependent internal/external gates are green | YES |

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

### SG-0003 — Production secret-domain reuse was not fully rejected

- ID: SG-0003
- Severity: MEDIUM
- Attack path: if an operator accidentally reused one critical production secret across authentication, password/KYC pepper, internal-sync, or cron domains, compromise of one domain could expand into another.
- Affected component: production environment validation.
- Reproduction/evidence: startup validation rejected selected secret-equality pairs but did not enforce pairwise independence across all six required production secret domains.
- Root cause: independent-secret validation was implemented as a small set of hand-written comparisons rather than a complete domain set.
- Fix: all required production secrets are now pairwise checked for independent values; legacy JWT equality checks remain separately enforced.
- Test added: production bypass regression now covers internal/cron reuse and signing-secret reuse with peppers/internal credentials.
- Commit SHA: `914c9a72` (fix), `7cdf3fd6` (regression).
- Residual risk: code can reject unsafe reuse but cannot prove the real production values were rotated; live credential-rotation evidence remains external.
- Status: FIXED — full branch CI pending.

### SG-0004 — API attack-surface inventory could miss non-function route exports

- ID: SG-0004
- Severity: MEDIUM
- Attack path: a mutation route implemented as a const-style or named re-export could evade the automated mutation inventory and therefore evade the inventory's boundary classification check.
- Affected component: `tests/security/api-attack-surface-inventory.test.ts`.
- Reproduction/evidence: the detector originally recognized only `export async function METHOD` route handlers.
- Root cause: incomplete recognition of valid Next.js route export syntax.
- Fix: the inventory now detects async/non-async function exports, const exports, and named HTTP-method re-exports.
- Test added: detector self-tests cover function, const, and named re-export styles.
- Commit SHA: `49b82297`, `61096a6f`.
- Residual risk: dynamically generated route exports are intentionally unsupported and should not be used for security-sensitive route handlers.
- Status: FIXED — full branch CI pending.

### SG-0005 — Structured error logging could serialize raw production error details

- ID: SG-0005
- Severity: MEDIUM
- Attack path: a database/provider/runtime error containing connection details, credentials, tokens, user-controlled values, or sensitive stack context reaches the central logger and is serialized into production logs.
- Affected component: shared observability logger and CRM audit failure path.
- Reproduction/evidence: the logger redacted ordinary context but passed raw `Error` objects through Pino's error serializer; CRM audit failures also used raw `console.error`.
- Root cause: error objects followed a different serialization path from the normal redacted context.
- Fix: production logging now retains safe error name/code while replacing raw message content; non-production error strings are scrubbed for Bearer and PostgreSQL credentials; CRM audit failures now use the safe structured logger.
- Test added: redaction regression covers Bearer/database credentials and asserts raw Error objects are not handed to the production logger path.
- Commit SHA: `a616caf0`, `61fb063b`, `3bdf85be`, `cb88428c`.
- Residual risk: repository-wide raw console/error sink review is still in progress under Phase 24; this finding closes the central structured path.
- Status: FIXED — full branch CI pending.

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
- continue partial evidence work across Phases 2–31 in parallel while Phase 1 full validation runs; preserve dependency order for declaring phases PASS and for the Phase 32 final GO.


## Cross-phase partial evidence pass

STATUS: ACTIVE

The user authorized parallel partial work across all phases while preserving the dependency order for final closure. This does **not** mean later phases are PASS before earlier blockers are resolved.

Repository evidence now exists for every phase from 0 through 32 and is guarded by `tests/security/security-phase-evidence-matrix.test.ts`. That test verifies the evidence index is complete and that repository evidence is not misrepresented as a final production GO.

Current interpretation:
- **PARTIAL** means relevant code/tests/controls already exist and are being audited further.
- **CONDITIONAL / external proof required** means code can be reviewed now, but real production state must be proven from the actual system.
- **BLOCKED** means the phase cannot legitimately close until prerequisite evidence is green.

External-only or external-final-verification work remains specifically for:
- production deployed SHA/environment/migrations/topology;
- VPS reachable ports and DB exposure;
- Dokploy runtime configuration;
- production credential rotation proof;
- PayPal sandbox/live provider verification;
- Cloudflare/origin firewall configuration;
- live DB least-privilege verification;
- monitoring/alert delivery;
- successful backup restore drill;
- external attacker simulation.

No production deployment is authorized by this partial pass.


## Phase 2 partial report

PHASE: 2 — Secrets / credentials
STATUS: PARTIAL

CODE/CI EVIDENCE:
- production-required secret length checks
- pairwise independence across marketplace JWT, staff JWT, password pepper, identity pepper, internal sync secret, and cron secret
- explicit legacy JWT separation
- secret-scanning CI for current tree and Git history
- server-secret boundary tests for mobile/client code
- Docker build-context secret exclusions
- credential-rotation runbook

NEW FINDING:
- SG-0003 fixed: incomplete cross-domain secret reuse validation.

EXTERNAL REMAINDER:
- prove actual production credentials have been rotated where required
- prove known previously exposed credentials are revoked
- collect non-secret rotation receipts

Phase 2 must not be marked PASS solely from repository evidence.


## Phase 6 partial report

PHASE: 6 — Complete API attack-surface inventory
STATUS: PARTIAL

CODE/CI EVIDENCE:
- recursive inventory of `app/api/**/route.ts`
- mutation boundary classification
- explicit public mutation allowlist plus abuse-control checks
- internal/cron/webhook caller-source authentication checks
- retired mutation-route no-op checks
- operational/test/debug/setup/seed/migration route-local closure checks
- HTTP method detector now recognizes function, const, and named re-export route syntax

NEW FINDING:
- SG-0004 fixed: valid Next.js route export styles could previously escape mutation detection.

REMAINING:
- run the widened detector through the complete blocking suite
- investigate any newly surfaced unclassified mutation routes
- perform deeper ownership/tenant semantics in Phases 7 and 8 rather than treating authentication alone as authorization


## Phase 24 partial report

PHASE: 24 — Logging / audit safety
STATUS: PARTIAL

CODE/CI EVIDENCE:
- recursive structured-context redaction
- credential/token/OTP/password key redaction
- embedded Bearer and PostgreSQL credential string scrubbing
- production Error message suppression in the shared logger
- CRM audit old/new value redaction
- security/financial audit event coverage

NEW FINDING:
- SG-0005 fixed: raw Error serialization bypassed normal production context redaction.

REMAINING:
- continue repository-wide review for direct `console.*` sinks and unsafe raw exception logging
- verify external log aggregation retention/access controls in the real production environment
