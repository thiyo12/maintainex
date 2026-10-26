# Phase 3 Scoped Security Assessment

Date: 2026-10-26  
Baseline inspected: `feature/payment-restructuring` at `ca6bda34680054397ecc4b51dd260f0de6ab8663`; scoped remediation is in the follow-up commit on the same branch.  
Scope: authentication, authorization, cross-account access, financial integrity, sensitive-data exposure, the named dependency advisories, and public claims. Synthetic data only; no external email, financial transfer, production or VPS access.

## Verified application finding

| ID / severity | Reproduction and evidence | Impact / status |
| --- | --- | --- |
| S3-01 — Medium: customer trust profile IDOR | The original defect was reproduced with an authenticated synthetic Customer A requesting `GET /api/mobile/v2/trust?customerId=<Customer-B-id>`; a temporary mocked route test returned 200 and confirmed the target ID reached `calculateCustomerTrust`. | **Fixed in this branch:** only authenticated `CUSTOMER` users are accepted; a supplied ID must equal the authenticated User ID; the service is always called with that canonical ID. Cross-customer/non-customer denials return before service execution. Added unit and PostgreSQL regression tests verifying self access, rejection before service invocation, and unchanged persisted target score. The self trust-profile API client no longer accepts a target ID. Unit tests pass locally; PostgreSQL integration is included in exact-head CI because no isolated PostgreSQL server can be started in this local sandbox. |

No other defect was confirmed in the scoped authentication/country/financial checks below. This is not a full penetration test or launch clearance.

## Dependency findings

| ID / severity | Locked version and exposure | Assessment / remediation option |
| --- | --- | --- |
| D3-01 — Moderate advisory; conditional runtime exposure: Nodemailer | Root lock pins runtime `nodemailer@10.0.14`; `lib/email.ts` sends OTPs to stored `user.email` via Gmail. Call sites are mobile OTP/login/reset. Mobile registration's simple email regex rejects the three current advisory proof-of-concept address strings; the endpoints do not pass arbitrary request text directly to `sendMail`. No exploit or misdelivery was demonstrated. | Current GitHub advisories affect `<10.1.4`; the parser confusion can redirect content to an attacker-chosen recipient when a vulnerable address reaches Nodemailer. Upgrade to at least 10.1.4 after compatibility review and OTP regression tests. Also replace the regex with a robust email parser/normalizer and keep delivery targets bound to verified account addresses. Current Dependabot alert status is unavailable. Sources: [nested comment](https://github.com/advisories/GHSA-8c8m-p3m8-cjg8), [group semicolon](https://github.com/advisories/GHSA-m943-m63m-w62w), [quoted `>`](https://github.com/advisories/GHSA-85x2-q946-cp5h). |
| D3-02 — Moderate advisory; low production reachability: `postcss-selector-parser` | Root lock pins `6.1.2`, dev-only, through Tailwind CSS 3.4.19 and postcss-nested. | GHSA-rj75-hqrm-r3gf affects `<7.1.6` and fixes quadratic parsing of long flat selectors. Advisory says ordinary build-time parsing of trusted source is not affected; no request-time parser of attacker-controlled selectors was found in the reviewed app paths. Do not force a v7 override against v6 parent ranges. Review compatible parent updates or bound any future untrusted selector input. [Advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf). |
| D3-03 — High upstream advisory; locally mitigated, not upstream-resolved: `node-forge` | Mobile lock pins `1.4.0`, reached through Expo CLI and `@expo/code-signing-certificates`; no direct app-source import was found. Existing postinstall patch adds nested DigestAlgorithm child-count validation. | GHSA-86w9-cpqp-85rv/CVE-2026-85393 affects `<=1.4.0`, with no upstream patched version listed. The current installed package contains the patch marker and `tests/mobile/node-forge-signature-hardening.test.ts` passed: valid RSA signature accepted and malformed nested-DigestInfo signature rejected. This covers the recorded proof case, not all cryptographic behavior. Keep the lock advisory open until upstream ships a supported fix and clean Expo 56 installation plus signature tests verify it. [Advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv). |

`npm audit` could not reach `registry.npmjs.org` because DNS/network resolution failed; this is **not** a clean audit result. GitHub's Dependabot alerts endpoint was not available through the connected GitHub tool, so the exact current alert records and default-branch per-package exposure remain unverified. The GitHub push response at assessment time reported 37 default-branch alerts (1 critical, 9 high, 23 moderate, 4 low); this count is a repository notice, not a verified package-by-package report.

## Test evidence

- Trust-profile authorization: **5 unit tests passed** locally. PostgreSQL integration contains 2 cases (self calculation and cross-customer no-write); **2 skipped locally** because no isolated PostgreSQL server is available in this sandbox. Exact-head CI must execute these cases with its isolated PostgreSQL service.
- Existing diagnostics-auth and node-forge mitigation tests: **3 files, 4 tests passed** at the assessment baseline, before the trust-profile change.
- Focused market authorization, Admin-country RBAC, country-finance invariants, bank evidence trust and bank reversal tests: **6 files, 96 tests passed** at the assessment head.
- Repository-wide Vitest was attempted but could not complete safely: database-dependent suites attempted `localhost:5432`, which was unavailable; database setup failures were observed, then the run was stopped. No aggregate suite result is claimed. Full regression needs an isolated PostgreSQL environment.
- No test ran against production or an existing database. These tests do not establish full Phase 3 acceptance.

## Native acceptance blocker

`apps/mobile/package-lock.json` resolves Expo `56.0.23`; the existing installed `apps/mobile/node_modules` resolves Expo `57.0.27`. No SDK or lockfile upgrade was made. `xcrun simctl list devices available` failed because CoreSimulatorService was unavailable, and no controllable physical/native UI session is attached. See the reproducible clean-install, mocked-service, iOS/Android launch and evidence steps in [Phase 2 UI acceptance](../international-launch/PHASE-2-UI-ACCEPTANCE.md). Customer, Tasker, Company manager, and Company worker native journeys remain blocked, not passed.

## Public claim review (recommendations only)

The pre-launch status and absence of real customer jobs make these source claims unsupported without separate evidence: “Trusted by 500+ users,” “join 500+ others,” “500+ waitlist signups,” “Trusted by Thousands,” “Over 1,000 jobs completed with a 4.9-star average,” “vetted/verified professionals,” “same-day service,” and “100% satisfaction guaranteed.” The about page also claims “pay securely” while online checkout is disabled. Career copy says “leading cleaning service provider” and lists health insurance/benefits; verify that these apply to specific employee roles, because the Terms describe Taskers and Companies as independent contractors.

Proposed factual alternatives for owner review: “MaintainEX is preparing a home-services marketplace for Sri Lanka and Canada. Join the waitlist for launch updates”; “Browse provider profiles and request a quote; availability depends on provider schedules”; and “Online payments are not available during development.” Keep satisfaction guarantees, insurance, verification policy, pricing and service promises unchanged until business evidence and policy approval. No public copy was changed.

## Assessment decision

The trust-profile IDOR remediation is implemented with unit and database regression coverage; final PostgreSQL evidence is pending exact-head CI. Touched-file ESLint and `npx tsc --noEmit` passed after the change; project lint completed with 0 errors and 40 warnings. Full regression and exact-head CI results must be added before acceptance. Dependency exposure is documented above; the current npm audit and per-alert Dependabot evidence are blocked by network/repository permissions. Native device journeys remain blocked by local simulator infrastructure. This is not launch approval.
