# MaintainEX International Launch — Canonical 12-Phase Implementation Plan

Status: IMPLEMENTATION STARTED — Phase 00; NOT APPROVED FOR PRODUCTION.
Baseline main SHA: `afc4905160d9768f1c1f6a1cab2d257243df8d69` (2026-10-09).
Working branch: `feature/international-launch-12phase`.
Markets: Sri Lanka all 25 districts (provider coverage required); Canada Vancouver municipality ONLY. Currency derived from verified booking service address: LK/LKR, Vancouver/CAD. One app, web, CRM V2 and canonical MarketplaceJob V2.

## Mandatory engineering guardrails

1. Keep main unchanged until reviewed; never deploy automatically. Work incrementally on this branch. User approval here authorized implementation, **not** production deployment.
2. Before every change locate the canonical existing owner and its callers/tests. Prefer reuse or targeted modification. No clone of V2 catalogue, pricing, matching, disputes, finance, chat, location, i18n, or job lifecycle.
3. Preserve all account, job, quote, skill, wallet, ledger, CRM and payment history; additive backward-compatible migrations only after data inventory. Do not delete legacy V1 data or dual-write catalogues.
4. Each change: baseline → failing/regression test → smallest patch → typecheck/lint/tests → diff review → push. Record actual results, not assumptions.
5. The app's confirmed validated service address determines market; GPS (permissioned), saved address, IP and phone only suggest. Vancouver city boundary enforced server side, not CA-wide or Toronto. Check market at suggestions, provider eligibility, quotes, acceptance, job creation, payment/refund and CRM.
6. Prices must be sourced locally and labelled: fixed price / evidence-backed range / inspection fee / quote required. A benchmark is not a guaranteed provider quote. Reuse `lib/pricing/*`, `JobQuote`, `QuoteLineItem`, `JobChangeOrder`, and shared LKR/CAD minor units. No currency derived solely from request body. Never convert LK prices into CA prices using FX.
7. Quote bargaining must have customer counteroffer, provider accept/decline/counter, new quote revision, final customer confirmation, expiry, immutable original scope, notifications, short preset replies and nonresponse fallback. Reuse V2 quote revision + existing messaging/notifications, no parallel engine.
8. Safety Centre accessible by customer, individual provider and assigned company worker from booking acceptance through execution and post-job period. Include urgent local emergency dial guidance, identity mismatch, incident report, discreet exit/work interruption, trusted-contact sharing with consent/expiry, evidence, CRM triage, audit and appropriate payment holds. Do not promise emergency dispatch, continuous monitoring or 24/7 staff unless operationally available. Reuse existing trust, dispute, work queue, job lifecycle and risk events; add new safety entity only if existing records cannot faithfully represent severity/response state. Keep financial disputes and urgent safety separate.
9. Languages: EN, Tamil, Sinhala; Canadian French by launch policy. Use independently authored, native-reviewed meaning-based text for job, scope, safety, consent, pricing and bargaining; same immutable service/action IDs; mixed Tamil-English/Sinhala-English aliases. No automatic translation as legally or financially binding content.
10. Seasonal: reuse `apps/mobile/lib/seasonal.ts` and offers. Canada adjust to season and Vancouver actual conditions; LK evergreen services first with regional weather prompts. Never promote unbookable/unqualified services.
11. Do not claim a phase green from model/file existence. Confirm wired client API, state transitions, database, permissions, edge cases, regression tests and operational readiness. Production requires explicit separate go/no-go.

## Canonical source of truth (verify against current HEAD before editing)

- V2: `MarketplaceJob`, `JobCategory`, `TemplateJob`, `ServiceTemplate`, `TaskerSkill`, `JobQuote`, `JobWorkspace`; legacy `JobPosting` and `Category/Service` preserved for historical/web consumers. Docs `docs/correction/04B-CATALOG-TRANSITION.md` identify **24 categories / 239 V2 template jobs at time of that audit**, NOT live counts. Compare actual current DB + files to **27 departments / 548 proposed jobs**; classify KEEP/RENAME/MERGE/ADD/RESTRICT/REVIEW, maintain old IDs.
- Pricing: `lib/pricing/engine.ts`, `lib/pricing/benchmark.ts`, `lib/pricing/quote-revision.ts`, `lib/pricing/line-items.ts`; estimate and quotes V2 APIs.
- Matching: `lib/matching/eligibility.ts` and related canonical V2 matching; avoid older parallel engines.
- Payment: `lib/finance/payments/*`, escrow/ledger and country-specific provider configuration. Baseline historical duplication report `docs/architecture/restructure/duplication-report.md` requires verifying what remains.
- Lifecycle: `lib/domain/job-lifecycle.ts`, immutable auditable transitions, identity PIN. Existing `app/api/mobile/disputes/*` must remain.
- Search: `app/api/mobile/v2/search/route.ts`, `lib/ai-search.ts`; in current inspected route country is used for runtime checks but not directly for `aiSearch(q)` or category query. First investigate all routes and correct safely.
- Geography: `lib/regions.ts` contains Toronto-oriented CA districts in current baseline; investigate active consumers and replace launch coverage with Vancouver city only, without breaking legacy history.
- Mobile language dictionaries: `apps/mobile/lib/i18n/locales/{en,si,ta}.ts`. Mobile seasonal: `apps/mobile/lib/seasonal.ts`.

## Phase map and exit gates

| Phase | Work on canonical code only | Must prove |
|---|---|---|
| 00 Baseline & ownership | Latest SHA, active V2 routes, real DB counts, duplication, test results, deployment baseline, permissions | Reproducible baseline; no blind rewrites |
| 01 Catalogue | Inventory all V2 IDs and provider associations; compare with 548; add missing jobs and locale aliases | No lost links, duplicates or broken existing bookings |
| 02 Location & market | One service-address resolver, saved addresses, Vancouver boundary, LK districts, server checks and correct CAD/LKR | Cross-market and boundary penetration tests |
| 03 Search & discovery | Existing V2 search, natural problem queries, matching job/provider profiles and direct requests | Results only from eligible local providers |
| 04 Provider onboarding | Keep current tasker/company skill selection UI; exact jobs, geography, credentials, capacity and actual worker identity | Existing selections intact; no unauthorized work |
| 05 Pricing | Audit actual benchmark data, instant/quote/inspection modes, scope, tax/materials/travel and currency | Evidence-backed price labelling; arithmetic tests |
| 06 Quotes & communication | Counteroffers, revisions, approvals, timeouts, preset/voice-assisted replies and chat recovery | Immutable final approval, no stale/duplicate accept |
| 07 Booking, Safety & projects | PIN, tracking, company assignments, project milestones, safety entry points, reporting/escalation and postincident finance actions | Both-side real-world safety scenarios and end-to-end lifecycle |
| 08 Seasonal | Existing season engine, weather/coverage ranking, CRM controls | No irrelevant/unbookable seasonal jobs |
| 09 Native-language meaning | Semantic translations, search aliases, validated safety/payment labels, language fallback | Human-reviewed intent parity in all release languages |
| 10 Finance, CRM, legal & operations | Payment providers, refund/payout/commission idempotency, cross-border privacy, licences, insurance, support/safety case ownership | Sandbox and policy verification by market |
| 11 Certification | E2E both markets, cross-country tampering, network loss, incident, complaint, refunds, regression, backups/rollback | Separate signed LK and Vancouver GO decisions; no critical blockers |

## Customer/provider safety journey (must be tested end to end)

Search → choose job → see local eligible providers → inspect profiles → request one/multiple quotes → prequote range (if defensible) → negotiate/confirm line-item total → accept → Safety Centre visible to both sides → payment protection → arrival tracking/identity check → start PIN → work or safely interrupt/raise incident → evidence/support/hold where authorized → completion/settlement/review/warranty or dispute. A report must never automatically call emergency services or automatically change financial states without applicable policy and authorization.

## Current confirmed evidence and open items

Current code includes price engine, quote revision, seasonal lookup, EN/TA/SI dictionaries, provider eligibility, live tracking, dispute intake, CRM trust pages and payout-freeze control. This does NOT certify end-to-end operation. Important verified inspection gaps: old CA geography contains Toronto locations; V2 search bypasses country context in aiSearch; estimate endpoint trusts request-provided country unless additional checks elsewhere. Other gaps unverified until client/server/tests and DB are examined.

## Continuity / new-chat instructions

Continue existing branch `feature/international-launch-12phase` and this file. Read source code, verify latest HEAD before every write. Do NOT restart planning or replace current architecture. Track phase status by verified file diffs, SHA, tests and blockers in a separate progress log. Push small increments; do not merge/deploy without explicit production authorization. Local Mac folder reported by user: `/Users/thiyoth/Documents/NEWM/maintainex`; GitHub connector does **not** synchronize their Mac. At finish supply safe `git status; git fetch; git switch; git pull` instructions; do not overwrite uncommitted local changes.
