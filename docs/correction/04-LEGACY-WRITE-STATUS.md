# 04-LEGACY-WRITE-STATUS.md — Legacy Write Status Report

> Generated: Phase 4C.9 — Full Regression + Legacy Write Verification
> Scope: BEFORE vs AFTER comparison of all marketplace writers

---

## MARKETPLACEJOB (V2 CANONICAL)

### BEFORE Phase 4C

| Route | Operation | Status |
|---|---|---|
| POST /api/mobile/v2/jobs | CREATE | Direct Prisma create |
| POST /api/mobile/v2/jobs/[id]/select-quote | UPDATE status | Direct Prisma update |
| POST /api/mobile/v2/jobs/[id]/escrow | UPDATE status | Direct Prisma update |
| POST /api/mobile/v2/jobs/[id]/release-escrow | UPDATE status | Direct Prisma update |
| POST /api/mobile/v2/jobs/[id]/complete | UPDATE status | Direct Prisma update |
| PATCH /api/mobile/v2/jobs/[id]/workspace | UPDATE status | Direct Prisma update |
| PATCH /api/admin/jobs | UPDATE status | Direct Prisma update |

### AFTER Phase 4C

| Route | Operation | Status |
|---|---|---|
| POST /api/mobile/v2/jobs | CREATE | Direct Prisma create (unchanged) |
| POST /api/mobile/v2/jobs/[id]/select-quote | UPDATE status | **Domain service: acceptJobQuote()** |
| POST /api/mobile/v2/jobs/[id]/escrow | UPDATE status | **Domain service: fundEscrow()** |
| POST /api/mobile/v2/jobs/[id]/release-escrow | UPDATE status | **Domain service: releaseEscrow()** |
| POST /api/mobile/v2/jobs/[id]/complete | UPDATE status | **Domain service: transitionJobWorkspace() + releaseEscrow()** |
| PATCH /api/mobile/v2/jobs/[id]/workspace | UPDATE status | **Domain service: transitionJobWorkspace()** |
| POST /api/mobile/v2/book-now | CREATE | **Domain service: createBookNowJob()** |
| PATCH /api/admin/jobs | UPDATE status | Direct Prisma update (admin, unchanged) |

---

## BOOKING (V1 LEGACY)

### BEFORE Phase 4C

| Route | Operation | Status |
|---|---|---|
| POST /api/mobile/bookings | CREATE | Active |
| POST /api/mobile/quick-bookings | CREATE | Active |
| POST /api/bookings | CREATE | Active (web admin) |

### AFTER Phase 4C

| Route | Operation | Status |
|---|---|---|
| POST /api/mobile/bookings | CREATE | **DEPRECATED (410 Gone)** |
| POST /api/mobile/quick-bookings | CREATE | **DEPRECATED (410 Gone)** |
| POST /api/bookings | CREATE | Active (web admin, preserved) |
| GET /api/mobile/bookings | READ | Active (preserved) |
| GET /api/bookings | READ | Active (admin CRM, preserved) |

---

## JOBPOSTING (V1 LEGACY)

### BEFORE Phase 4C

| Route | Operation | Status |
|---|---|---|
| POST /api/mobile/jobs | CREATE | Active |

### AFTER Phase 4C

| Route | Operation | Status |
|---|---|---|
| POST /api/mobile/jobs | CREATE | **DEPRECATED (410 Gone)** |
| GET /api/mobile/jobs | READ | Active (preserved) |

---

## BID (V1 LEGACY)

### BEFORE Phase 4C

| Route | Operation | Status |
|---|---|---|
| POST /api/mobile/jobs/[id]/bid | CREATE | Active |

### AFTER Phase 4C

| Route | Operation | Status |
|---|---|---|
| POST /api/mobile/jobs/[id]/bid | CREATE | **DEPRECATED (410 Gone)** |

---

## ASSIGNMENT (V1 LEGACY)

### BEFORE Phase 4C

| Route | Operation | Status |
|---|---|---|
| (indirect via JobPosting status sync) | CREATE | Active |

### AFTER Phase 4C

| Route | Operation | Status |
|---|---|---|
| (indirect via JobPosting status sync) | CREATE | **No new canonical writes** |

---

## OFFERBOOKING (V1 LEGACY)

### BEFORE Phase 4C

| Route | Operation | Status |
|---|---|---|
| POST /api/mobile/quick-bookings | CREATE | Active (via Booking) |

### AFTER Phase 4C

| Route | Operation | Status |
|---|---|---|
| POST /api/mobile/quick-bookings | CREATE | **DEPRECATED (410 Gone)** |
| POST /api/mobile/v2/book-now | CREATE | **Creates MarketplaceJob (not OfferBooking)** |

---

## JOBQUOTE (V2 CANONICAL)

### BEFORE Phase 4C

| Route | Operation | Status |
|---|---|---|
| POST /api/mobile/v2/quotes | CREATE | Direct Prisma create |

### AFTER Phase 4C

| Route | Operation | Status |
|---|---|---|
| POST /api/mobile/v2/quotes | CREATE | Direct Prisma create (unchanged) |
| POST /api/mobile/v2/jobs/[id]/select-quote | UPDATE | **Domain service: acceptJobQuote()** |

---

## JOBWORKSPACE (V2 CANONICAL)

### BEFORE Phase 4C

| Route | Operation | Status |
|---|---|---|
| PATCH /api/mobile/v2/jobs/[id]/workspace | UPDATE | Direct Prisma update |

### AFTER Phase 4C

| Route | Operation | Status |
|---|---|---|
| PATCH /api/mobile/v2/jobs/[id]/workspace | UPDATE | **Domain service: transitionJobWorkspace()** |
| POST /api/mobile/v2/jobs/[id]/complete | UPDATE | **Domain service: transitionJobWorkspace()** |

---

## JOBESCROW (V2 CANONICAL)

### BEFORE Phase 4C

| Route | Operation | Status |
|---|---|---|
| POST /api/mobile/v2/jobs/[id]/escrow | CREATE/UPDATE | Direct Prisma |
| POST /api/mobile/v2/jobs/[id]/release-escrow | UPDATE | Direct Prisma |
| POST /api/mobile/v2/jobs/[id]/escrow/refund | UPDATE | Direct Prisma |

### AFTER Phase 4C

| Route | Operation | Status |
|---|---|---|
| POST /api/mobile/v2/jobs/[id]/escrow | CREATE/UPDATE | **Domain service: fundEscrow()** |
| POST /api/mobile/v2/jobs/[id]/release-escrow | UPDATE | **Domain service: releaseEscrow()** |
| POST /api/mobile/v2/jobs/[id]/complete | UPDATE | **Domain service: releaseEscrow()** |

---

## SUMMARY

| Model | BEFORE | AFTER | Status |
|---|---|---|---|
| MarketplaceJob | Direct writes | Domain service | CANONICAL |
| JobQuote | Direct writes | Domain service | CANONICAL |
| JobWorkspace | Direct writes | Domain service | CANONICAL |
| JobEscrow | Direct writes | Domain service | CANONICAL |
| Booking | Active writes | Mobile deprecated, admin preserved | LEGACY |
| JobPosting | Active writes | Deprecated | LEGACY |
| Bid | Active writes | Deprecated | LEGACY |
| Assignment | Indirect writes | No new writes | LEGACY |
| OfferBooking | Active writes | Deprecated | LEGACY |
