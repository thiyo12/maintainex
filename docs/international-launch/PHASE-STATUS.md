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

Generated for commit `721837dcb7531f4f27cbb6e87120e28d9ca0bf4d`.

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
| HEAD | `721837dcb7531f4f27cbb6e87120e28d9ca0bf4d` |
| `origin/main` | `afc4905160d9768f1c1f6a1cab2d257243df8d69` |
| Ahead / behind vs feature | 0 / 0 |
| Ahead / behind vs main | 103 ahead, 0 behind |
| PR | #80 — open, **draft**, `mergeable_state=clean` |
| Migrations added on branch | 0 |
| `prisma/schema.prisma` changes | none |
| Files changed vs main | 85 (documentation, code and tests; no destructive changes) |
| Only dependency added | `@turf/boolean-point-in-polygon` |

**Local-only work preserved:** two stashes, both predating this branch, neither dropped or altered.

- `stash@{0}` `On main: sdk57-local-testing` — `2a44bf0e1216c83dbe0e9a5373a3535e305182b8`
- `stash@{1}` `On main: backup before syncing main 2026-09-20` — `68fa23e19daec97569a92a000e5eb48694cb60ef`

---

## 3. CI status (VERIFIED)

Required contexts on `main` protection: `validate`, `audit`.

| Check | Conclusion | Run |
|---|---|---|
| `audit` | success | [38552683592](https://github.com/thiyo12/maintainex/actions/runs/38552683592/job/115814184744) |
| `validate` | success | [38552683571](https://github.com/thiyo12/maintainex/actions/runs/38552683571/job/115814184628) |

Web TypeScript: 0 errors. Mobile TypeScript: 0 errors. Prisma schema: valid. — **VERIFIED**

Local suite: 2,271 passed / 68 failed / 687 skipped — **CODER-REPORTED**

### Baseline-failure evidence

CI failure set, identical across the last three branch runs (VERIFIED):

- `tests/admin/pdf-generation.test.ts`
- `tests/auth/auth-characterization.test.ts`
- `tests/auth/staff-rotation.integration.test.ts`
- `tests/integration/real-postgresql-integration.test.ts`
- `tests/structural/deployment-safety.test.ts`

Of the 35 distinct files failing locally, **34 are byte-identical to `main`**. The exception is
`tests/jobs/matching-engine.test.ts`, which was modified on this branch (fixture lines only) and
**passes in CI** (12 assertions); its local failure is `PrismaClientInitializationError` from the
absent local database.

**Honest limitation (VERIFIED):** no regression is attributable to this branch, but this rests on
unchanged-file comparison plus CI passes — **not** on a before/after execution of the suite on
`main`, which was not run. Two of the five CI areas (staff-rotation, real-postgresql FK audit) are
*skipped* locally and only fail in CI.

---

## 4. Phase status

**No phase has recorded acceptance.** Phase 00 is the last with a stored baseline artefact, and that
record is historical.

| Phase | Status | Notes |
|---|---|---|
| 00 Baseline | PARTIAL | Reproducible numbers; no durable current baseline doc (this file partially addresses) |
| 01 Catalogue | BLOCKED | Integrity green; **publication is a business decision** |
| 02 Country/location | PARTIAL | Boundary VERIFIED; geocoder BLOCKED on vendor choice |
| 03 Discovery / market isolation | PARTIAL | Named surfaces hardened; two known gaps open |
| 04 Provider selection | NOT STARTED | — |
| 05 Pricing | NOT STARTED | — |
| 06 Quotes & negotiation | NOT STARTED | — |
| 07 Bookings & projects | NOT STARTED | — |
| 08 Seasonal | NOT STARTED | — |
| 09 Languages | NOT STARTED | — |
| 10 Payments & operations | NOT STARTED | — |
| 11 Launch certification | NOT TESTED | Requires live accounts and real transactions |

### Phase 01 — catalogue (BLOCKED)

Live catalogue is **24 departments / 239 services**. A proposed expansion of **3 departments +
309 services** (totalling 27/548) is authored and validated, but every entry is marked `PROPOSED`
and imports `isActive: false` behind `PROPOSED_CATALOGUE_APPLY`. **Nothing is published.**

An exhaustive search of the repository, all branches, full history and all migrations found no
approved 27/548 artefact; the master plan itself recorded these figures as
*"27 departments / 548 **proposed** jobs"*. No Canadian price benchmarks were invented.

CI test database currently holds **3 departments / 12 services** — the CI seed does not load the
full catalogue. — **VERIFIED**

### Phase 02 — geography (PARTIAL)

Official City of Vancouver dataset (`CITY LINE`) converted from 14 line segments to one validated
counterclockwise ring (480 points, RFC 7946) with provenance recorded in-file. Enforced in job
creation, book-now, quote creation/listing, quote acceptance, payment, escrow display and the
address picker. Canadian postal-only resolution was closed as a bypass because Canadian postal
codes are metro-wide.

**Remaining:** address↔coordinate correspondence requires a geocoder. **BLOCKED** on vendor
selection — no geocoding library or service exists in the codebase.

### Phase 03 — market isolation (PARTIAL)

Closed this cycle (all VERIFIED by commit and CI): quote acceptance previously failed open through
a `GLOBAL` escape hatch in the pricing-country guard; job blast; background matching waves; quote
revisions; web quote route; provider directory; browse endpoint; company worker assignment;
instant-offer matcher; cron-reachable offer notify path; four canonical provider queries.

**Remaining acceptance criteria:**
- V1 assignment path (`app/api/mobile/jobs/[id]`, `ASSIGNED` branch inside `PUT`) has no market
  check. Mitigating: `PUT` calls `legacyMarketplaceWriteDisabled()` as its first statement, and
  `ALLOW_LEGACY_MARKETPLACE_WRITES` is unset in all environment files, so writes are blocked by
  default. The gap becomes reachable only if an operator sets that flag. **VERIFIED**
- Provider profile endpoints (`taskers/[id]`, `find-tasker/[id]`) have no market gate. Deferred
  deliberately as a product decision, not an oversight.
- No end-to-end LK/CA isolation test exercising real rows through the full journey. **NOT TESTED**

---

## 5. Payments and security posture (VERIFIED)

Cash-only. `resolvePaymentProviderForMarket` selects providers solely from `PaymentProviderConfig`
rows where `enabled: true`; no credentials exist, so **no provider can appear configured**.
PayPal and PayHere adapters exist in code but are inert. Nothing in this branch enabled either.

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
2. **Canadian pricing** — CAD benchmarks do not exist; these must not be invented.
3. **Geocoder vendor** — Google Places / Mapbox / Nominatim. Purchase and privacy decision.
4. **Live certification (Phase 11)** — requires real accounts and real cash transactions.
5. **Payment providers** — remain disabled until genuinely configured and separately verified.

---

## 7. Documentation gaps (VERIFIED)

- `docs/international-launch/` did not exist on the branch; both files were deleted in
  `e14edab5` / `a5da1479` and are now restored unmodified.
- No phase acceptance records exist anywhere in the repository.
- `docs/maintainex/MASTER_BLUEPRINT.md` (architecture blueprint with Mermaid diagrams) is **NOT
   STARTED**.

---

## 8. Merge and deployment posture

Not merged. Not deployed. PR #80 remains a draft. No production data was modified. No payment
provider was enabled. Production baseline remains `afc4905160d9768f1c1f6a1cab2d257243df8d69`.
