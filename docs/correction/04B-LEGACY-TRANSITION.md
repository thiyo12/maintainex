# 04B-LEGACY-TRANSITION.md — Legacy Model Preservation and Deprecation

> Generated: Phase 4B — Legacy Transition Design
> Updated: Phase 4B.1 — Conditional retention policy (no permanent retention promises)
> Scope: Booking, JobPosting, Bid, Assignment, OfferBooking, V1 Review, V1 Dispute

---

## LEGACY MODEL STATUS SUMMARY

| Model | Rows | Active Writers | Active Readers | Deprecation Risk |
|---|---|---|---|---|
| Booking | 31 | 6 | 12 | MEDIUM — CRM dependency |
| JobPosting | 5 | 6 | 9 | LOW — effectively dead |
| Bid | 0 | 1 | 3 | NONE — 0 rows |
| Assignment | 0 | 1 | 6 | NONE — 0 rows |
| OfferBooking | 0 | 0 | 9 | NONE — 0 rows |
| OfferEnrollment | 0 | 0 | 3 | NONE — 0 rows |
| OfferMatchQueue | 0 | 0 | 7 | NONE — 0 rows |
| Review (V1) | 3 | 3 | 4 | LOW — 10 rows |
| Dispute (V1) | 5 | 2 | 8 | LOW — references JobPosting |
| PayoutRequest | 0 | 0 | 0 | NONE — DEAD model |

---

## BOOKING TRANSITION PLAN

### Phase 4B: PRESERVE ALL

| Action | Status | Rationale |
|---|---|---|
| Keep Booking table | YES | 31 production rows, CRM dependency |
| Keep Booking CREATE endpoints | YES (temporarily) | Verify no active V1 mobile client |
| Keep Booking READ endpoints | YES | Admin CRM, reports, PDF export |
| Keep Booking UPDATE endpoints | YES | Status transitions for active bookings |
| Keep Booking DELETE endpoints | YES | Admin management |
| Keep auto-Invoice creation | YES | Financial flow for V1 bookings |

### Phase 4C: DEPRECATE WRITES (after client verification)

| Action | Condition | Rationale |
|---|---|---|
| Deprecate POST /api/mobile/bookings | No active V1 mobile client | V2 MarketplaceJob is canonical |
| Deprecate POST /api/mobile/quick-bookings | Converge to MarketplaceJob BOOK_NOW | Zero OfferBooking rows |
| Preserve all Booking READ endpoints | Always | Historical data access |
| Preserve admin Booking management | Always | CRM and reporting |

### Phase 5+: RETENTION REVIEW

| Action | Status | Rationale |
|---|---|---|
| Booking table retained | WHILE needed | Historical data, CRM analytics — review when CRM migrates to V2 |
| Booking ID never converted to MarketplaceJob ID | YES | Legacy links must remain resolvable while table exists |
| Admin can still view Booking details | YES | Business continuity while retained |

---

## JOBPOSTING TRANSITION PLAN

### Phase 4B: PRESERVE ALL

| Action | Status | Rationale |
|---|---|---|
| Keep JobPosting table | YES | 5 production rows, Dispute dependency |
| Keep all JobPosting endpoints | YES | Read access for historical data |

### Phase 4C: DEPRECATE WRITES

| Action | Condition | Rationale |
|---|---|---|
| Deprecate POST /api/mobile/jobs | No active V1 clients (0 bids, 0 assignments) | V2 MarketplaceJob is canonical |
| Deprecate POST /api/mobile/jobs/[id]/bid | 0 production bids | V2 JobQuote is canonical |
| Deprecate PUT /api/mobile/jobs/[id] | No active V1 clients | V2 Workspace is canonical |
| Deprecate DELETE /api/mobile/jobs/[id] | Admin can still manage via admin endpoint | Soft deprecation |
| Preserve all JobPosting READ endpoints | Always | Historical data, dispute references |

### Phase 5+: RETENTION REVIEW

| Action | Status | Rationale |
|---|---|---|
| JobPosting table retained | WHILE needed | Dispute references, historical data — review when disputes migrate to V2 |
| Bid table retained | WHILE needed | Schema reference, historical data — review when zero active readers |
| Assignment table retained | WHILE needed | Reputation engine reads — review when reputation migrates to V2 |

---

## BID/ASSIGNMENT DEPRECATION

### Bid

| Aspect | Status |
|---|---|
| Production rows | 0 |
| Active writers | 1 (POST /api/mobile/jobs/[id]/bid) |
| Active readers | 3 (job detail include, bid idempotency check) |
| Replacement | JobQuote |
| Deprecation | Phase 4C — disable write, preserve reads |

### Assignment

| Aspect | Status |
|---|---|
| Production rows | 0 |
| Active writers | 1 (status sync with JobPosting) |
| Active readers | 6 (reputation engine, job matcher capacity) |
| Replacement | JobWorkspace |
| Deprecation | Phase 4C — preserve reads (reputation engine), disable writes |

---

## OFFER BOOKING DEPRECATION

### OfferBooking / OfferEnrollment / OfferMatchQueue

| Aspect | Status |
|---|---|
| Production rows | 0 (all three) |
| Active code | YES (offer-matcher.ts, cron/offer-timeouts) |
| Replacement | MarketplaceJob BOOK_NOW mode |
| Deprecation | Phase 4C — mark as experimental, preserve code |

**Decision:** Do NOT remove offer code. It is fully implemented but unused. If BOOK_NOW convergence requires offer-matcher logic, it can be adapted.

---

## V1 REVIEW PRESERVATION

### Review (V1 service reviews)

| Aspect | Status |
|---|---|
| Production rows | 10 |
| Active writers | 3 (create, moderate, delete) |
| Active readers | 4 (list, moderation) |
| Replacement | JobReview + ProviderReview (V2) |
| Deprecation | Phase 4C — deprecate write, preserve reads |

### Transition

- New MarketplaceJob completions use JobReview + ProviderReview
- V1 Review table preserved for historical service reviews
- No data migration between V1 and V2 review systems

---

## V1 DISPUTE PRESERVATION

### Dispute (V1)

| Aspect | Status |
|---|---|
| Production rows | 5 |
| Active writers | 2 (create, admin update) |
| Active readers | 8 (user list, admin management, fraud detection) |
| References | JobPosting (V1) |
| Replacement | MarketplaceJob DISPUTE action (V2) |
| Deprecation | Phase 4C — deprecate new creation, preserve reads |

### Transition

- V2 disputes use MarketplaceJob complete route (DISPUTE action)
- V1 Dispute table preserved for historical dispute data
- Admin can still view and manage V1 disputes
- No new V1 disputes created after Phase 4C

---

## PAYOUTREQUEST REMOVAL

### PayoutRequest

| Aspect | Status |
|---|---|
| Production rows | 0 |
| Active writers | 0 |
| Active readers | 0 |
| Replacement | Payout model |
| Action | Phase 4C — safe to remove from schema |

**Decision:** PayoutRequest is the only model with ZERO callers and ZERO rows. It can be removed in Phase 4C.

---

## LEGACY WRITE SHUTDOWN SEQUENCE

Phase 4C should follow this sequence:

1. **Verify no active V1 mobile clients** — check mobile app API calls
2. **Deprecate V1 JobPosting writes** — POST /api/mobile/jobs, bid, PUT, DELETE
3. **Deprecate V1 Booking creation** — POST /api/mobile/bookings, quick-bookings
4. **Deprecate V1 Review creation** — POST /api/reviews
5. **Deprecate V1 Dispute creation** — POST /api/mobile/disputes
6. **Remove PayoutRequest from schema** — 0 callers, 0 rows
7. **Preserve all V1 READ endpoints** — always

**Do NOT disable any V1 reads in Phase 4.**
