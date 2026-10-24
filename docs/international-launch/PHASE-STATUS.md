# MaintainEX International Launch — Phase Status

> **Historical snapshot, not today's phase verdict.** This status was generated
> against commit `721837dc`; its Phase 04–11 "NOT STARTED" entries describe
> that older SHA only. For the current Phase 04 implementation/evidence and
> explicit remaining gates see
> [PHASE-04-ACCEPTANCE-RECEIPT.md](./PHASE-04-ACCEPTANCE-RECEIPT.md).
> Do not claim any phase accepted from this historical record.


**This file is a factual status record only.** It does not replace, rewrite or reinterpret
`MASTER-IMPLEMENTATION-PLAN.md` or `PHASE-00-AUDIT-RECEIPT.md`, which are restored here
byte-for-byte from their original revisions.

Updated 2026-10-15 (Asia/Colombo) against commit `0ff42ee9cd5eedff2d51923e1e3887167bc46b54`.
This approved evidence review is an uncommitted documentation-only change; no new commit SHA exists.

Labels used throughout:

- **VERIFIED** — independently confirmed from git objects, GitHub API, or CI logs in this document.
- **CODER-REPORTED** — asserted by the implementing agent; not independently re-verified here.
- **PARTIAL** — some acceptance criteria met, others outstanding.
- **BLOCKED** — cannot progress without an external decision or input.
- **NOT TESTED** — no executed evidence exists.

---

## 1. Restored documents — provenance (VERIFIED)

| Document | Source commit | Blob SHA | Bytes |
|---|---|---|---|
| `MASTER-IMPLEMENTATION-PLAN.md` | `890d1426` | `2551768d604b9b00dc7dbf488da963e5724949f0` | 9,763 |
| `PHASE-00-AUDIT-RECEIPT.md` | `3126ecc0` | `c46799c1a721400a1ade9dc6bf30656179012253` | 8,341 |

Deletion commits: `e14edab5` and `a5da1479` (2026-10-13), both titled
*"chore: remove conversation planning document from implementation branch"*.

**Pre-restoration safety check (VERIFIED):** both blobs were scanned for credentials,
API keys, tokens, private keys, emails, public IPs and env-var assignments. None present.
No evidence either deletion was a security redaction — both were pure file deletions.
Restored content was confirmed identical by `git hash-object` matching the historical blobs.

---

## 2. Git baseline (VERIFIED)

| Item | Value |
|---|---|
| Branch | `feature/international-launch-12phase` |
| HEAD / GitHub PR head | `0ff42ee9cd5eedff2d51923e1e3887167bc46b54` |
| `origin/main` | `afc4905160d9768f1c1f6a1cab2d257243df8d69` |
| Ahead / behind vs feature | 0 / 0 |
| Ahead / behind vs main | 104 ahead, 0 behind |
| PR | #80 — open, **draft**, no acceptance inferred from mergeability |
| Migrations added on branch | 0 |
| `prisma/schema.prisma` changes | none |
| Files changed vs main | 88 (committed documentation, code and tests) |
| Only dependency added | `@turf/boolean-point-in-polygon` |

**Local-only work preserved:** two stashes, both predating this branch, neither dropped or altered.

- `stash@{0}` `On main: sdk57-local-testing` — `2a44bf0e1216c83dbe0e9a5373a3535e305182b8`
- `stash@{1}` `On main: backup before syncing main 2026-09-20` — `68fa23e19daec97569a92a000e5eb48694cb60ef`

---

## 3. CI status — current HEAD (VERIFIED)

Both checks on `0ff42ee9` completed successfully:

| Check | Conclusion | Evidence |
|---|---|---|
| `audit` | success | [38638609346](https://github.com/thiyo12/maintainex/actions/runs/38638609346) |
| `validate` | success | [38638609377 / job 116108092176](https://github.com/thiyo12/maintainex/actions/runs/38638609377/job/116108092176) |

Validation finished 2026-10-15 02:56:04 Asia/Colombo. Web/mobile TypeScript, Prisma validation,
blocking security, core lifecycle and financial gates, production build, Docker build/start,
health/release check and non-root runtime all passed. These are CI results, not production certification.

The raw validation log still reports **11 failed / 2,968 passed / 60 skipped tests** in the
historical full suite: **5 failed / 303 passed / 5 skipped files**. The workflow explicitly uses
`continue-on-error: true` for that step; its successful step/job conclusion does not mean all tests passed.

| Failing file | Observed failure | Disposition |
|---|---|---|
| `tests/admin/pdf-generation.test.ts` | Six invoice route assertions receive HTTP 500 instead of 401/403/200 | Root cause and baseline comparison pending |
| `tests/auth/auth-characterization.test.ts` | Missing expected admin identity; session shape includes `authType` | Contract/fixture versus application behavior needs isolated comparison |
| `tests/auth/staff-rotation.integration.test.ts` | Wrong-secret replay-policy assertion returns false instead of true | Security-policy/fixture investigation pending |
| `tests/integration/real-postgresql-integration.test.ts` | One JobWorkspace orphan in CI instead of zero | Test isolation/fixture or integrity cause unresolved; not evidence of a production orphan |
| `tests/structural/deployment-safety.test.ts` | Expects literal `prisma migrate deploy` inside Dockerfile | Source shows Dockerfile invokes `scripts/start-production.sh`, which runs migrations at line 28; assertion appears stale, but needs isolated confirmation |

All five test files are unchanged from main. The same failure set/count occurred at `721837dc`.
**This does not establish that the failures predate the branch:** application changes can affect
unchanged tests. No equivalent main-versus-branch execution was performed in this review.
The earlier local result (2,271 passed / 68 failed / 687 skipped) remains CODER-REPORTED, not rerun here.
No local tests/builds, dependency installs, database setup or CI reruns were performed for this documentation task.

---

## 4. Phase status

**No phase has recorded acceptance.** Phase 00 is the last with a stored baseline artefact, and that
record is historical.

| Phase | Status | Notes |
|---|---|---|
| 00 Baseline | PARTIAL / BLOCKED | Current CI and public release evidence captured; production inventory, complete consumer map and failure attribution remain open |
| 01 Catalogue | PARTIAL / BLOCKED | Proposed expansion and inventory helpers exist; publication, live links, aliases and workflow acceptance outstanding |
| 02 Country/location | PARTIAL | Polygon implemented; address-coordinate verification and legacy policy remain open |
| 03 Discovery / market isolation | PARTIAL | Many surfaces hardened; stored-country precedence and full journey evidence remain open |
| 04 Provider onboarding | NOT ACCEPTED | Existing onboarding retained; related worker-market guard exists, full credentials/capacity/identity gates unverified |
| 05 Pricing | PARTIAL / BLOCKED | Estimate/currency guards exist; verified Canadian benchmarks and complete pricing acceptance missing |
| 06 Quotes & communication | PARTIAL | Revision and acceptance guards exist; complete negotiation, expiry and recovery acceptance unverified |
| 07 Booking, Safety & projects | PARTIAL | Booking guards and issue reporting exist; full both-sided Safety Centre and operational scenarios incomplete |
| 08 Seasonal | LIMITED PARTIAL | Existing engine retained; request-country helper reused, weather/coverage/CRM acceptance unverified |
| 09 Native-language meaning | NOT VERIFIED | Existing dictionaries are not evidence of native-reviewed launch semantics or complete aliases |
| 10 Finance, CRM, legal & operations | PARTIAL / BLOCKED | Financial gates exist; payment writer consistency, provider sandbox and operational/policy evidence outstanding |
| 11 Certification | NOT TESTED / NOT ACCEPTED | Full release scenarios and separate signed LK/Vancouver decisions missing |

### Phase 01 — catalogue (PARTIAL / BLOCKED)

Historical reported catalogue is **24 departments / 239 services**; current production counts were not queried or verified in this review. A proposed expansion of **3 departments +
309 services** (totalling 27/548) is authored and validated, but every entry is marked `PROPOSED`
and imports `isActive: false` behind `PROPOSED_CATALOGUE_APPLY`. **The importer does not activate these entries; current production publication state was not queried.**

An exhaustive search of the repository, all branches, full history and all migrations found no
approved 27/548 artefact; the master plan itself recorded these figures as
*"27 departments / 548 **proposed** jobs"*. No Canadian price benchmarks were invented.

CI test database currently holds **3 departments / 12 services** — the CI seed does not load the
full catalogue. — **VERIFIED**

### Phase 02 — geography (PARTIAL)

Official City of Vancouver dataset (`CITY LINE`) converted from 14 line segments to one validated
counterclockwise ring (480 points, RFC 7946) with provenance recorded in-file. Guards are wired into job
creation, book-now, quote creation/listing, quote acceptance, payment/escrow display and location
selection. This does not establish consistent enforcement in payment/refund mutations; see section 9. Canadian postal-only resolution was closed as a bypass because Canadian postal
codes are metro-wide.

**Remaining:** address↔coordinate correspondence requires a geocoder. **BLOCKED** on vendor
selection — the reviewed resolver does not verify that address text corresponds to supplied coordinates.

### Phase 03 — market isolation (PARTIAL)

Existing implementation (source and CI evidence; not full end-to-end acceptance): quote acceptance previously failed open through
a `GLOBAL` escape hatch in the pricing-country guard; job blast; background matching waves; quote
revisions; web quote route; provider directory; browse endpoint; company worker assignment;
instant-offer matcher; cron-reachable offer notify path; four canonical provider queries.

**Remaining acceptance criteria:**
- V1 assignment path (`app/api/mobile/jobs/[id]`, `ASSIGNED` branch inside `PUT`) has no market
  check. Mitigating: `PUT` calls `legacyMarketplaceWriteDisabled()` as its first statement, so writes are blocked by
  default unless `ALLOW_LEGACY_MARKETPLACE_WRITES` enables them. Current production flag values
  were not inspected. **Source verified; runtime configuration unverified.**
- Provider profile endpoints (`taskers/[id]`, `find-tasker/[id]`) have no market gate. Deferred
  deliberately as a product decision, not an oversight.
- No end-to-end LK/CA isolation test exercising real rows through the full journey. **NOT TESTED**

---

## 5. Payments and security posture

`resolvePaymentProviderForMarket` queries enabled `PaymentProviderConfig` rows and applies
provider selection policy. PayPal/PayHere code already exists. Production configuration and
credentials were not inspected; the earlier cash-only/disabled-provider claim is not independently
verified here. No provider was enabled or changed by this review. See section 9 for the difference
between payment display and payment creation market checks.

Customer-facing **Safety Centre scope is NOT implemented.** Existing surfaces are CRM
trust-and-safety administration (credentials, risk events, integrity, overview) and job
issue-reporting on mobile/web. **No real emergency services or integrations exist, and none are
claimed.**

Market-isolation defects fixed this cycle were security-relevant: quote acceptance could accept a
quote priced under another market's configuration.

---

## 6. Blockers requiring an owner decision

1. **Catalogue publication** — approve or reject the 309 proposed services. Publishing is currently
   gated and correct.
2. **Canadian pricing** — verified CAD benchmark evidence remains missing; do not invent it.
3. **Geocoder vendor** — Google Places / Mapbox / Nominatim. Purchase and privacy decision.
4. **Live certification (Phase 11)** — requires real accounts and real cash transactions.
5. **Payment providers** — require authorized configuration evidence and sandbox verification before launch claims.

---

## 7. Documentation continuity

- The original plan and receipt were deleted in `e14edab5` / `a5da1479`, then restored
  unmodified in `0ff42ee9`. They already existed before this review; no restoration repeated.
- No phase acceptance records exist anywhere in the repository.
- `docs/maintainex/MASTER_BLUEPRINT.md` (architecture blueprint with Mermaid diagrams) is **NOT
   STARTED**.

---

## 8. Merge and deployment posture

PR #80 is open and draft at the reviewed HEAD. No merge, deployment, synchronization, production
record access/write or payment-provider change was performed.

One public GET to `https://maintainex.lk/api/health` returned `status: healthy`,
`release: afc4905160d9768f1c1f6a1cab2d257243df8d69`, and `testOtpMode: disabled` at
2026-10-15 03:03:02 Asia/Colombo (response timestamp `2026-10-14T21:33:02.891Z`).
This matches GitHub main and differs from the feature HEAD. It verifies the responding endpoint's
reported release, not every running replica or image digest. The health route performs `SELECT 1`;
no customer, provider, job, payment or catalogue records were requested. No SSH/admin/DB login was used.


---

## 9. Approved Phase 00 evidence review — 2026-10-15

### Scope and completed work

- Verified expected branch and clean worktree before review and again before editing; local HEAD,
  tracking ref and live PR head agree. No fetch/pull/switch was used.
- Read the existing master plan and historical Phase 00 receipt; retained them unchanged.
  Their blobs remain `2551768d604b9b00dc7dbf488da963e5724949f0` and
  `c46799c1a721400a1ade9dc6bf30656179012253`, respectively.
- Reviewed current GitHub check/job results and raw logs, source call chains and existing tests.
  Reviewed one public health response as described above; no production inventory was authorized or collected.
- Changed file: **only `docs/international-launch/PHASE-STATUS.md`**.
- Implementation commit reviewed: `0ff42ee9cd5eedff2d51923e1e3887167bc46b54`.
  Documentation change remains uncommitted for user review; no push or new commit.
- Existing inventory code is reusable: `collectCatalogInventory` and `collectProviderAssociations`
  in `lib/domain/catalog-inventory.ts`. No duplicate tooling or planning documents created.

### Source trace and remaining gaps

These are partial call-chain observations, not a complete screen-to-notification/CRM ownership map.
Paths below are repository-relative at the reviewed commit.

| Journey | Existing implementation traced | Gap / evidence limit |
|---|---|---|
| Booking | `apps/mobile/features/jobs/screens/customer/v2/create.tsx` → `apps/mobile/api/v2-jobs.ts` → `app/api/mobile/v2/jobs/route.ts` → shared address resolver; separate `book-now/route.ts` resolves coordinates before `createBookNowJob` | Coordinates are supplied by the client; correspondence with address text is not verified. General creation supports LK postal-only resolution; book-now supplies no postal code, so absent coordinates are rejected. Device/address-picker compatibility needs runtime evidence. |
| Search | `apps/mobile/api/v2-search.ts` → `app/api/mobile/v2/search/route.ts` → `aiSearch`, canonical JobCategory/TemplateJob filtering and country-scoped logs | Request country is a discovery hint (default LK), not confirmed-address authorization. Catalogue filtering does not prove available local providers for every result. Full language/address/provider journey unverified. |
| Matching | `v2Match.getProviders` → `app/api/mobile/v2/match/[jobId]/route.ts` → `requireJobMarket` → `lib/matching/index.ts::findCandidates` → eligibility and provider queries | Caller resolves coordinates, but `findCandidates` reloads the job and sets `countryCode: job.countryCode || input.countryCode`. Conflicting stored country can override the resolved market. Source-level precedence is verified; affected live records and end-to-end impact are unknown. |
| Quote acceptance | `v2Jobs.selectQuote` → select-quote route → `lib/domain/job-lifecycle.ts` with `requireJobMarket` and eligibility | Existing guard should be retained. Missing full real-row mismatch, stale revision, concurrent acceptance and legacy compatibility evidence against phase criteria. |
| Payment creation versus display | `apps/mobile/api/v2-payments.ts` → payment route. GET calls `requireJobMarket`; POST calls `createPaymentIntent` through `lib/payment/payment-service.ts` re-export → `lib/finance/payments/payment-service.ts` | POST service selects provider using `previewJob.countryCode`; its locked job query also reads stored country, not coordinates. GET validation is not proof that POST enforces the same policy. Configuration gates may prevent checkout; live provider state was not queried. |
| Refunds | `v2Jobs.refundEscrow` → escrow/refund POST → `lib/finance/escrow/escrow-service.ts::refundEscrow` → authorization, lifecycle, funding-source handling and notifications | Escrow display guard does not establish refund mutation geography coverage. Existing refund authorization and original funding/currency handling must be preserved; complete financial writer trace and policy tests remain open. Do not block legitimate refunds merely because old location data is missing. |

Additional market-isolation limits: provider profile endpoints have no explicit market gate; the
legacy V1 assignment path relies on a default-disabled write flag. Provider visibility policy and
production configuration remain unverified. No live endpoint probing was used to test these paths.

### Older jobs without coordinates — behavior preserved

`lib/geography/market-engine.ts::resolveJobMarket` checks coordinates only when both are finite
numbers. With a complete pair it uses the geography resolver and rejects out-of-area locations.
Without a complete finite pair it accepts a supported stored `LK`/`CA` country. This includes a
missing/partial pair; it does not prove Vancouver municipal eligibility for such Canadian jobs.
Unknown countries are rejected.

This fallback is **intentional existing compatibility behavior**, explicitly tested by
`tests/geography/commercial-market-authority.test.ts` ("keeps legacy coordinate-less jobs working
via the stored country") and `tests/geography/market-engine.test.ts`. It is not a new fix to repeat.
Some commercial tests inspect source strings across an entire route file; seeing a guard in GET
cannot establish POST behavior. Phase 03 tests also assert the stored-country precedence string.

In `lib/matching/eligibility.ts`, service radius is evaluated when job/provider coordinates and a
positive radius exist. Otherwise configured-area matching is used; `configuredAreaMatches` returns
true when service areas or job areaId are absent (or configured areas are empty). Same-country
checking remains, but missing location evidence can weaken local-area eligibility.

No historical records were read, counted, corrected, backfilled or rejected. The number of affected
jobs, their lifecycle states and whether the fallback is needed for ongoing bookings are unknown.
Any future change requires an approved compatibility policy and isolated behavioral tests first.

### Open Phase 00 gates / next steps

1. **Failure attribution:** run comparable isolated tests on baseline and feature snapshots, using
   disposable test data, to classify the five failing files. Do not silently waive auth or integrity failures.
2. **Market-authority tests (recommended next code task, separately approved):** reproduce stored-country
   versus coordinate disagreement through matching and payment creation using existing modules. Include
   coordinate-less LK/CA jobs and protect refunds/ongoing jobs. Start with characterization tests;
   propose the smallest correction only after current behavior and compatibility requirements are explicit.
3. **Production inventory — blocked on specific authorization and safe access:** reuse existing aggregate
   helpers or an owner-supplied sanitized snapshot for catalogue/provider links, historical job/quote counts,
   coordinate completeness and pricing evidence. No credentials or personal records belong in this document.
4. **Production identity:** public release metadata is verified; running-image/replica provenance still
   requires an authorized operator receipt if required for baseline acceptance.
5. **Ownership and backout:** complete screen → API → domain → DB → notifications/CRM mapping for
   critical writers and document migration/backout requirements. No migration is proposed by this review.
6. **Owner decisions:** catalogue publication, geocoder/address validation policy, provider profile
   visibility, Canadian pricing evidence, payment configuration and safety/support operations remain open.
7. **Documentation consistency:** PR #80's Phase 00 GREEN / Phases 03–11 not-started claims are stale.
   PR text was not edited because this task authorizes only this file.

**Verdict: approved documentation review completed; Phase 00 remains PARTIAL / BLOCKED.**
No phase is fully accepted. Preserve the existing implementation and original plan; do not restart.

---

## 2026-10-24 resumed implementation and verification

Work resumed from `81e56f88254016f6df70b3854e73b479570aacda` on
`feature/international-launch-12phase`. The pre-existing local edits in this file were retained.
The software changes below remain subject to review and CI; this is not market or launch approval.

- Added the Safety Centre trusted-contact flow: explicit consent, random 256-bit bearer token,
  SHA-256 digest at rest, one active link per job/actor, one-to-24-hour expiry, actor-scoped
  revocation, and a no-store public view limited to booking status, market and scheduled date.
  The bearer is carried in a URL fragment and exchanged in a same-origin POST body to keep it out
  of ordinary access logs and referrers. No address, account, payment or incident fields are
  selected for the public response. Added one additive PostgreSQL migration; it was applied only
  to the disposable local test database.
- Added server-side reverse geocoding to coordinate-backed job creation and Book Now. The fixed
  Google endpoint rejects redirects, has a five-second timeout, verifies LK/CA and Vancouver
  locality, and fails closed when configuration is absent. `GOOGLE_MAPS_GEOCODING_API_KEY` is not
  configured in the local environment; live provider/quota behavior was not exercised.
- Added benchmark evidence gates for supported-market currency, Vancouver/BC scope, at least five
  ordered positive observations, stable references, methodology and publishable source types.
- Added Safety Centre English/Tamil/Sinhala dictionary entries and parity checks plus Tamil/Sinhala
  service-search alias tests. Automated key/route tests pass; native-speaker and legal copy review
  remains pending. French continues to use the explicitly documented English fallback.
- Added a version- and source-guarded mobile `node-forge@1.4.0` postinstall hardening patch with
  valid-signature and malformed-DigestInfo regression coverage. The upstream package advisory has
  no fixed release; scanners may continue to flag package metadata until upstream publishes one.
- The checked Next.js version is `15.5.28`, which the [14 Oct 2026 upstream security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026)
  names as the patched Maintenance LTS version. The production build and web/mobile TypeScript
  checks passed locally.

The complete local regression run passed: **4,560 passed, 0 failed, 60 skipped** across 472 test
files (467 passed, 5 skipped), using one worker and the isolated PostgreSQL test database. The
changed safety, geography, pricing, alias and locale tests also passed targeted runs. Mobile
TypeScript and iOS/Android Expo exports passed from an isolated dependency clone. The final
production build passed; lint reported zero errors and 41 existing warnings. `npm audit` could not
reach `registry.npmjs.org` in this local environment. For exact source SHA
`a9f5a5d343040f5710f0c238a4e1e680e45594b9`, GitHub Security Exposure Audit and International Fast
Gates passed; CRM V2 Release Validation remained queued at the time of this record. The GitHub
workflow results and links are recorded in PR #80. This does not substitute for a completed npm
audit or the still-pending release workflow.
No production or payment actions were performed. Physical/device, crew and other operational tests
remain **PENDING**.
