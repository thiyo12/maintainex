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
| 14 | Payment / escrow authorization | PARTIAL — authorization reviewed; financial error paths hardened; closure review remains | YES |
| 15 | PayHere webhook security | PARTIAL — signature/body controls + safe failure logging present; reconciliation proof remains | YES |
| 16 | PayPal production completion | PARTIAL — provider/webhook controls + safe failure logging present; sandbox/live verification remains | YES before PayPal live |
| 17 | Financial concurrency / idempotency | PARTIAL — concurrency/ledger tests present; exhaustive writer review remains | YES |
| 18 | Wallet / commission / account abuse | PARTIAL — commission/restriction controls present; abuse scenarios remain | YES |
| 19 | File / upload security | PARTIAL — traversal/content/upload controls present; full corpus review remains | YES |
| 20 | CSRF / CORS / browser security | PARTIAL — origin/browser controls present; complete mutation review remains | HIGH |
| 21 | Rate limiting / abuse protection | PARTIAL — fail-closed/rate-limit tests present; endpoint coverage review remains | HIGH |
| 22 | Database hardening | PARTIAL — schema/deploy controls present; live DB least-privilege proof remains | HIGH |
| 23 | Privacy / data minimization | PARTIAL — privacy suites present; full field-retention review remains | HIGH |
| 24 | Logging / audit safety | PARTIAL — auth/booking/finance critical sinks hardened; complete repository sink review remains | HIGH |
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

### SG-0006 — High-severity production dependency vulnerabilities blocked release validation

- ID: SG-0006
- Severity: HIGH
- Attack path: vulnerable production dependencies expose the application to known request-manipulation, XSS, denial-of-service, SMTP parsing, and CSS/source-map attack classes depending on the reachable package path.
- Affected component: web production dependency graph / release CI.
- Reproduction/evidence: `npm audit --omit=dev --audit-level=high` failed with 7 HIGH findings, including Axios, Nodemailer, PostCSS/Next and a next-sitemap dependency chain.
- Root cause: stale direct/transitive versions plus build-only `next-sitemap` being classified as a production dependency.
- Fix: resolved and locked Axios 1.20.0, DOMPurify 3.4.16, fflate 0.8.3, Nodemailer 10.0.14 and PostCSS 8.5.28; moved next-sitemap to devDependencies; retained Next 15.5.24; regenerated the lockfile through isolated CI.
- Test/verification: the isolated resolver completed `npm audit --omit=dev --audit-level=high` with `found 0 vulnerabilities`; the normal release workflow still independently re-runs the production audit.
- Commit SHA: `2d2763fb` (audited dependency resolution).
- Residual risk: normal full release validation must still prove TypeScript, regression, build and Docker compatibility with the refreshed lockfile.
- Status: FIXED — full release CI pending.


### SG-0007 — Mobile production dependency graph contained uncontrolled HIGH advisories

- ID: SG-0007
- Severity: HIGH
- Attack path: known vulnerable packages remain reachable in the mobile production dependency graph and could expose application/build paths to denial-of-service, parser, cache or related advisory classes depending on the dependency path.
- Affected component: `apps/mobile` production dependency graph and mobile release validation.
- Reproduction/evidence: the blocking controlled audit rejected uncontrolled HIGH advisories on the pre-fix graph. The dedicated resolver then regenerated the graph, reran the controlled production audit, installed the resolved graph, passed mobile TypeScript and passed native Android/iOS Expo export.
- Root cause: build/development tooling including `@expo/ngrok` was classified as a production dependency and the mobile lockfile had accumulated fixable transitive advisories.
- Fix: moved `@expo/ngrok` to devDependencies, applied non-breaking lockfile audit fixes, pinned the required `image-size` override, and preserved only exact indirect self-expiring upstream exceptions. The resolver now validates Android and iOS targets rather than failing on an unsupported `react-native-maps` web export.
- Test/verification: `scripts/mobile-production-audit.mjs`, native Expo export in `.github/workflows/security-mobile-dependency-review.yml`, and `tests/security/supply-chain-hardening.test.ts`.
- Commit SHA: dependency resolution `72cc0bd4`; resolver target/credential hardening `1b977d2a`; regression `7ba87c61`.
- Residual risk: two exact indirect HIGH advisories remain temporarily controlled in Expo build tooling (`braces` and `node-forge`) because the current upstream graph has no compatible patched release. The audit self-expires each exception when a newer upstream package becomes available. They are not accepted as a blanket allowlist.
- Status: FIXED / CONTROLLED — exact-head full release CI still required before Phase 29 can close.

### SG-0008 — Mobile upload failures bypassed structured log redaction

- ID: SG-0008
- Severity: MEDIUM
- Attack path: an authenticated caller triggers a filesystem/runtime failure during upload handling; the raw exception is written with `console.error`, potentially exposing filesystem paths, provider/runtime details or embedded sensitive values to production log sinks.
- Affected component: `app/api/mobile/upload/route.ts` / Phase 19 upload handling / Phase 24 logging safety.
- Reproduction/evidence: the upload catch path directly called `console.error('Upload error:', error)` instead of the central redacting logger.
- Root cause: an older direct logging path remained after the shared production error-redaction layer was introduced.
- Fix: routed upload failures through `logger.error(..., { err: error })`, which suppresses raw production error messages and redacts non-production details.
- Test added: `tests/security/redaction.test.ts` now locks the upload route to the safe structured logger and rejects reintroduction of the raw `console.error` sink.
- Commit SHA: fix `003da957`; regression `86b8a4bb`.
- Residual risk: repository-wide direct console/error sink review continues under Phase 24 and external log-retention/access controls still require production evidence.
- Status: FIXED — exact-head CI pending.


### SG-0009 — Financial and payment routes bypassed structured error redaction

- ID: SG-0009
- Severity: MEDIUM
- Attack path: an authenticated customer, staff operator, cron execution, or signed payment-provider request triggers an exceptional finance path whose raw Error/provider result is written directly to process logs; selected refund/webhook paths could also echo internal processing text in 5xx/409 responses.
- Affected component: mobile payment/escrow/refund/release routes, PayHere and PayPal webhooks, escrow auto-release cron, and CRM commission/escrow/ledger/payment/payout/refund/wallet routes.
- Reproduction/evidence: the Phase 14–16/24 audit found raw `console.error(..., error)` sinks across the reviewed financial routes. The customer escrow refund fallback returned `error.message` with HTTP 500, while payment webhook conflict/failure responses returned provider/service error text.
- Root cause: finance routes pre-dated the centralized redacting logger and retained direct exception logging/response patterns after the shared observability layer was hardened.
- Fix: routed reviewed finance/payment errors through `logger.error` / `logger.warn`, removed raw provider/internal error strings from customer/webhook failure responses, and preserved existing authorization, transaction, approval and idempotency behavior.
- Test added: `tests/security/redaction.test.ts` now locks customer finance, payment webhooks, auto-release cron, and CRM finance routes off raw `console.error` sinks and checks the known internal-error response regressions.
- Commit SHA: customer/payment/webhook/cron fixes `ef93c653`, `ef0ec177`, `b565c9c0`, `882e46e3`, `76a540cb`, `2ded9754`, `2ed54b72`, `73ed2465`; customer/payment regression `ac64e6b7`; CRM finance fixes `8a88e640`, `0e41f1a5`, `e96c8afc`, `08a4949d`, `c5189cc0`, `6abce527`, `c8d3c4db`, `261f515a`; CRM finance regression `72077714`.
- Residual risk: repository-wide direct log-sink review is not yet complete, and external log aggregation retention/access controls still require live production evidence.
- Status: FIXED — exact-head full release CI pending.


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

NEW FINDINGS:
- SG-0005 fixed: raw Error serialization bypassed normal production context redaction.
- SG-0008 fixed: mobile upload failures bypassed structured log redaction.
- SG-0009 fixed: critical financial/payment routes used raw error sinks and selected internal error responses.

REMAINING:
- continue repository-wide review for direct `console.*` sinks and unsafe raw exception logging
- verify external log aggregation retention/access controls in the real production environment


## Phase 29 partial report

PHASE: 29 — Dependency / supply-chain security
STATUS: PARTIAL

CODE/CI EVIDENCE:
- mobile production graph resolver has passed the controlled HIGH/CRITICAL audit and native Android/iOS validation
- write-capable mobile resolver keeps checkout credentials disabled during npm/Expo execution and scopes the token to the final push step
- pinned GitHub Actions commits
- least-privilege normal workflow permissions
- Dependabot coverage for web, mobile and Actions
- deterministic `npm ci` installs
- production dependency audit blocks HIGH/CRITICAL vulnerabilities
- production dependency graph refreshed to zero known npm-audit vulnerabilities in the isolated resolver

NEW FINDINGS:
- SG-0006 fixed: web release validation exposed 7 HIGH production dependency findings.
- SG-0007 fixed/controlled: mobile release validation exposed uncontrolled HIGH findings; fixable advisories were resolved and only exact self-expiring upstream build-tool exceptions remain.

CURRENT LOCKED SECURITY UPDATES:
- Axios 1.20.0
- DOMPurify 3.4.16
- fflate 0.8.3
- Nodemailer 10.0.14
- PostCSS 8.5.28
- next-sitemap retained only as build/dev tooling
- Next remains 15.5.24; no major-framework upgrade was required

REMAINING:
- normal release validation must pass with the refreshed graph
- continue Dependabot/npm audit review for new advisories
