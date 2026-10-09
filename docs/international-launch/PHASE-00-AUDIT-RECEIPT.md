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
