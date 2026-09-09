# 04B-IMPLEMENTATION-PLAN.md — Phase 4C Implementation Groups

> Generated: Phase 4B — Implementation Plan
> Updated: Phase 4B.1 — Corrected group names, FK investigation, seed policy
> Scope: Safe, ordered implementation groups for Phase 4C

---

## GROUP 4C.1 — Canonical Lifecycle + Integrity Foundation

**Priority:** HIGH
**Risk:** MEDIUM
**Dependencies:** None

### Scope

Create a domain service that encapsulates all MarketplaceJob state transitions with proper validation, idempotency, and side effects. Investigate DB-level integrity for canonical V2 relations.

### Tasks

1. Create `lib/domain/job-lifecycle.ts`:
   - `transitionJobStatus(jobId, fromStatus, toStatus, actor, metadata)`
   - Validate allowed transitions (per STATUS-MAPPING.md)
   - Atomic Prisma transaction
   - Timestamp updates
   - Domain event emission (logging only, no event store yet)

2. Create `lib/domain/quote-lifecycle.ts`:
   - `acceptQuote(jobId, quoteId, customerId)`
   - `rejectQuotes(jobId, excludeQuoteId)`
   - `withdrawQuote(quoteId)`

3. Create `lib/domain/workspace-lifecycle.ts`:
   - `transitionWorkspace(jobId, fromStatus, toStatus, actor)`

4. Create `lib/domain/escrow-lifecycle.ts`:
   - `fundEscrow(jobId, customerId)`
   - `releaseEscrow(jobId, actor)`
   - `refundEscrow(jobId, customerId)`
   - `holdEscrow(jobId, actor)`

5. Refactor existing route handlers to call domain services instead of inline Prisma operations.

6. **Investigate DB-level integrity for canonical V2 relations:**
   - Audit which scalar-only FKs in MarketplaceJob, JobQuote, JobWorkspace, JobEscrow, CommissionSettlement should gain Prisma `@relation` and real PostgreSQL foreign keys
   - Identify missing indexes on FK columns
   - Identify missing uniqueness constraints
   - Test existing production data for orphaned IDs before any FK migration
   - Produce FK migration proposal (DO NOT implement yet)

### Acceptance Criteria

- All existing tests pass
- Domain services are testable in isolation
- Transition validation prevents invalid state changes
- Idempotency guards preserved
- FK audit complete with orphan report
- No FK changes applied without explicit approval

---

## GROUP 4C.2 — Quote Acceptance Transaction

**Priority:** HIGH
**Risk:** HIGH
**Dependencies:** 4C.1

### Scope

Ensure quote acceptance is fully transactional and concurrency-safe.

### Tasks

1. Audit existing select-quote route for transactional correctness
2. Ensure atomic: accept quote + reject others + upsert workspace + create escrow
3. Add idempotency check: if already has ACCEPTED quote, return existing
4. Add optimistic locking or conditional update for race condition prevention
5. Test concurrent quote acceptance (2 customers trying to accept different quotes on same job)

### Acceptance Criteria

- Two concurrent accept-quote requests → exactly one succeeds
- No partial state (quote accepted but workspace not created)
- Idempotent: second accept request returns existing state

---

## GROUP 4C.3 — BOOK_NOW Convergence Implementation

**Priority:** MEDIUM
**Risk:** MEDIUM
**Dependencies:** 4C.1

### Scope

Implement BOOK_NOW transactions creating MarketplaceJobs instead of OfferBookings. Design is frozen in Phase 4B.

### Tasks

1. Create `lib/domain/book-now.ts`:
   - `createBookNowJob(customerId, offerTemplateId, scheduledAt, address)`
   - Creates MarketplaceJob with `mode: 'BOOK_NOW'`, `budgetType: 'FIXED'`
   - Resolves price from OfferTemplate or ServiceTemplate
   - Triggers blastJobToTaskers for immediate matching

2. Create POST /api/mobile/v2/book-now endpoint (or add mode parameter to existing POST /v2/jobs)

3. Deprecate POST /api/mobile/quick-bookings (after verification)

4. Preserve OfferTemplate as catalog config — not transaction source

### Acceptance Criteria

- BOOK_NOW creates MarketplaceJob (not OfferBooking)
- Price resolved from catalog
- Matching triggered immediately
- OfferBooking creation path deprecated

---

## GROUP 4C.4 — JobPosting V1 New-Write Retirement

**Priority:** MEDIUM
**Risk:** LOW
**Dependencies:** None

### Scope

Deprecate V1 JobPosting write endpoints after verifying no active clients.

### Tasks

1. Verify no active V1 mobile client calls POST /api/mobile/jobs
2. Add deprecation headers to V1 write endpoints
3. Log any V1 write attempts for monitoring
4. Preserve all V1 READ endpoints

### Acceptance Criteria

- V1 JobPosting writes return 410 Gone or deprecation warning
- V1 JobPosting reads still work
- No active client broken

---

## GROUP 4C.5 — Booking Compatibility

**Priority:** MEDIUM
**Risk:** MEDIUM
**Dependencies:** 4C.3

### Scope

Ensure V1 Booking reads work alongside V2 MarketplaceJob.

### Tasks

1. Verify admin CRM still reads Booking data correctly
2. Verify reports/export still generates Booking stats
3. Verify customer profile still shows Booking history
4. Add deprecation warning to POST /api/mobile/bookings
5. Monitor V1 Booking creation volume

### Acceptance Criteria

- All Booking READ endpoints functional
- Admin CRM shows Booking history
- V1 Booking creation deprecated (not disabled)

---

## GROUP 4C.6 — Catalog Write/Read Policy

**Priority:** LOW
**Risk:** LOW
**Dependencies:** None

### Scope

Document and enforce catalog write/read policy.

### Tasks

1. Ensure V2 auto-seed (lib/v2-job-categories.ts) works correctly
2. Ensure V1 admin catalog management works correctly
3. No cross-catalog writes
4. Document: new features write V2 catalog only

### Acceptance Criteria

- V1 and V2 catalogs are independent
- Auto-seed works on fresh database
- Admin can manage V1 catalog

---

## GROUP 4C.7 — Security Gap Closure

**Priority:** HIGH
**Risk:** LOW
**Dependencies:** None

### Scope

Close the 3 security gaps identified in Phase 4A.

### Tasks

1. **FlashOffer claim:** Add auth check or rate limiting
2. **Review POST:** Add auth check + ownership verification
3. **Seed endpoint:** Disable in production. The seed endpoint is a machine/bootstrap operation — it should not be accessible in production environments regardless of auth. If dev/staging seeding is needed, restrict to internal deployment context only. Do not mix human staff auth (SUPER_ADMIN) with machine auth (CRON_SECRET) for this endpoint.

### Acceptance Criteria

- FlashOffer claim requires auth or has rate limiting
- Review POST requires auth + completed booking/job verification
- Seed endpoint returns 404 or 403 in production (NODE_ENV=production)

---

## GROUP 4C.8 — Reader/Admin/Analytics Compatibility

**Priority:** MEDIUM
**Risk:** LOW
**Dependencies:** 4C.1

### Scope

Ensure admin analytics and reporting work with both V1 and V2 data.

### Tasks

1. Verify admin unified job list (GET /api/admin/jobs) works with source field
2. Verify admin analytics counts both V1 and V2
3. Verify admin dashboard shows correct totals
4. Ensure no double-counting (one job counted once)

### Acceptance Criteria

- Admin sees unified job list with source indicator
- Analytics counts are accurate
- No duplicate counting across V1/V2

---

## GROUP 4C.9 — Full Regression + Legacy Write Verification

**Priority:** HIGH
**Risk:** MEDIUM
**Dependencies:** All previous groups

### Scope

Full regression test and verification that legacy write deprecation doesn't break anything.

### Tasks

1. Run full test suite (108+ tests)
2. Verify V2 marketplace flow end-to-end
3. Verify V1 Booking reads still work
4. Verify V1 JobPosting reads still work
5. Verify admin operations
6. Verify cron jobs
7. Test on VPS with production data counts

### Acceptance Criteria

- All tests pass
- V2 flow works end-to-end
- V1 reads work
- Admin operations work
- Cron jobs work
- No production data mutations

---

## IMPLEMENTATION ORDER

```
4C.1 (Lifecycle + Integrity) → 4C.2 (Quote Transaction) → 4C.8 (Analytics)
4C.3 (BOOK_NOW) → 4C.5 (Booking Compat)
4C.4 (JobPosting Retirement)
4C.6 (Catalog Policy)
4C.7 (Security Gaps)
4C.9 (Full Regression) — LAST
```

Groups 4C.4, 4C.6, 4C.7 can run in parallel with others.
