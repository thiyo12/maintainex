# Phase 00 — Baseline / first audit receipt

Date: 2026-10-09
Base: main `afc4905160d9768f1c1f6a1cab2d257243df8d69`
Implementation branch: `feature/international-launch-12phase`
Status: **IN PROGRESS — no functional edits or tests executed yet**.

## Confirmed from current source
- V2 catalogue `JobCategory` / `TemplateJob` / `ServiceTemplate`, older independent web `Category` / `Service`; no dual writes (see docs/correction/04B-CATALOG-TRANSITION.md).
- V2 pricing estimate route uses `calculatePrice` but trusts body countryCode for selection; needs validated market binding.
- V2 search route checks market runtime, but `aiSearch(q)` and autocomplete are not given market and category ID query has no market eligibility condition; category `countries` and TemplateJob `countries` are stored as strings.
- `lib/regions.ts` current CA district list is Toronto oriented, not Vancouver-only. Determine which code consumes it before edit.
- `lib/matching/eligibility.ts`, `lib/pricing/*`, `lib/domain/job-lifecycle.ts`, `app/api/mobile/v2/quotes/*`, `app/api/mobile/disputes/*`, `apps/mobile/components/tracking/LiveTrackingScreen.native.tsx`, `apps/mobile/lib/seasonal.ts`, mobile i18n already exist.
- `lib/crm/emergency-controls.ts` currently freezes payouts; does not provide physical emergency assistance.
- Existing architecture docs describe historical parallel matching, pricing, payment and catalog systems; verify which remain active today before refactoring.

## Phase 00 remaining work
- Fetch/compare latest branch and production deployment SHA; discover protected/current build paths and code ownership.
- Obtain safe read-only production data inventory (only authorized source; no secrets), catalogue counts and benchmarks.
- Reproduce current test baseline on a real checkout: typecheck, lint, pricing, matching, quote, country isolation, lifecycle, CRM security, and mobile checks.
- Map direct consumer flows screen → API → domain service → database → notifications/CRM for all 12 phases.
- Record each gap with evidence, minimal proposed change, tests, and release risk before code edits.

## Delivery gates
- No production deploy, DB writes, replacement catalogues, parallel negotiation engine, broad frontend reconstruction, or unsafe claims until verified.
- Subsequent commits append per-phase evidence and tests.
- Final Mac sync is a manual git operation; remote GitHub writes do not change /Users/thiyoth/Documents/NEWM/maintainex.

## Implementation checkpoint — 2026-10-09

- Vancouver-only legacy region options: `f034b02`; regression test `c52f54b`.
- V2 search market filtering and canonical IDs: `e54cc5e`; optional string fix `0cf39d3`; regression `a70ed4d`.
- Popular searches and search logs scoped to country: `25cb54c`, mobile client `21b4eb8`, test `4a15fe2`.
- Pricing estimate guards: `ad3cca6` rejects unsupported countries, missing CA pricing configuration, and LKR templates for CAD prices; contract test `e8980f1`.
- **All code/tests above are pushed but executable tests were not run in this connector-only environment. None of the phase exit gates are green.**
- Further required: actual booking-address country binding, Vancouver coordinate geofence, live pricing benchmark audit, legacy consumer analysis, runtime test suite, current DB snapshot and safe feature activation.

## Continuation receipt — 2026-10-09, safety access + estimate controls

- Pricing estimate urgency allowlist implemented `20f1838`; contract test updated `a9ea8d8`.
- Initial customer job-concern reporting entry point reuses existing authenticated dispute journey from native tracking `e8fc07b` and web tracking `1a11691`.
- Safety entry-point source contract test `5b3bd52`; CI includes test after `0cb5779`.
- This is **not** the complete Safety Centre: urgent emergency dialer, identity incident categories, tasker/company-worker entry points, discreet exit, case severity, staffed escalation, evidence retention, safety-specific CRM and real-world response protocols remain open.
- Existing booking/payment processes MUST NOT be declared safe or release-ready based on button presence.
- CI currently auto-cancels earlier PR runs when another push arrives. Wait for the latest-head check before reporting pass/fail; no phase has received full 12-phase exit certification.

## Phase-by-phase build checkpoint — 2026-10-09

- Current phase method: keep 12 release gates independent; source-only checks are not a substitute for runtime tests.
- Created shared fail-closed V2 catalogue country eligibility (`lib/domain/catalog-market-eligibility.ts`) and reused it in the active V2 search API (`app/api/mobile/v2/search/route.ts`). This reduces competing market parser behavior.
- Added executable behavioral coverage for LK/CA visibility, malformed JSON, invalid country values (`tests/domain/catalog-market-eligibility.test.ts`) and added it to the existing PR validation workflow.
- Latest phase remains **NOT GREEN**: real database catalogue inventory, quote/payment country binding, Vancouver municipal boundary verification, mobile UI integration tests, and full CI result are still required.
- The latest main-to-branch changes must be tested before merge; no Mac synchronization or production change was performed.

## Phase 00 independently verified CI checkpoint — 2026-10-12

- GitHub source snapshot: `main=afc4905160d9768f1c1f6a1cab2d257243df8d69` and `feature/international-launch-12phase=f718c35836b14fd1b6167d172fd097dcb8591115` before this receipt update. Source: GitHub branch APIs.
- Security Exposure Audit on `f718c358`: **SUCCESS** (GitHub Actions).
- CRM V2 Release Validation run `38283624301` at this checkpoint: **IN PROGRESS**; web TypeScript, mobile TypeScript, Prisma schema validation, isolated PostgreSQL bootstrap, migration no-op, international launch market regression, catalogue/taxonomy, country invariants, negative security, core lifecycle and financial lifecycle steps **SUCCESS**.
- The workflow's historical full regression baseline is explicitly **non-blocking** and a successful job step does not establish that every historical test passes. Inspect diagnostic artifacts before certifying.
- Still pending in run `38283624301`: production build, Docker image build/start, container health/release SHA, non-root runtime. Recheck the *latest branch HEAD* after any further commits (earlier successful runs do not certify future HEADs).

### Unclosed mandatory Phase 00 gates — NOT GREEN

1. **Live authoritative inventory (read-only):** actual production JobCategory, TemplateJob, ServiceTemplate counts and country grants; provider/skill references and orphan detection; historical job and quote counts. Do not invent the number of live jobs from seed scripts.
2. **Production deployed SHA:** compare confirmed running image and health release SHA against main and record source/evidence; GitHub main SHA is not proof of deployment.
3. **Consumer ownership map:** complete screen→API→domain service→DB→notification/CRM route map for critical booking, search, provider and finance journeys, including legacy template-job consumers.
4. **Complete test evidence:** CI production build/Docker checks and historical regression failure classification; any manual device, provider, payment-sandbox and operational gates outside CI.
5. **Gap disposition:** reconcile outstanding defects and establish a verified migration/backout plan for each active high-impact writer.

**Phase 00 verdict: BLOCKED / PARTIALLY VERIFIED.** No production writes or deployment made for this receipt. No later phase can be certified based only on these CI checks.

## Phase 00 inventory implementation — 2026-10-12

- Added `lib/domain/catalog-inventory.ts`: **read-only** aggregate JobCategory/TemplateJob/ServiceTemplate/TaskerSkill counts; LK/CA active eligibility counts; orphan-reference detection; no identifiers or personal records in output.
- Added executable mock-backed `tests/domain/catalog-inventory.test.ts` proving per-market filtering, orphan counts and no write operations, and included it in `.github/workflows/phase0-7-validation.yml`.
- This is inventory **code**, not a live production inventory result; live DB read access and recorded counts are still needed before Phase 00 GREEN. CI at latest commit must pass before this change is verified.
