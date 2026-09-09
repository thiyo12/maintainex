# 04C-BOOK-NOW.md — BOOK_NOW Convergence Implementation

> Generated: Phase 4C.3 — BOOK_NOW Convergence
> Scope: BOOK_NOW transactions now create MarketplaceJobs instead of Bookings

---

## CHANGE SUMMARY

**Before:** `POST /api/mobile/quick-bookings` → creates `Booking` (V1 legacy)

**After:** `POST /api/mobile/v2/book-now` → creates `MarketplaceJob` (V2 canonical)

**Old endpoint:** Returns 410 Gone with redirect to new endpoint

---

## NEW ENDPOINT

`POST /api/mobile/v2/book-now`

### Request Body

```json
{
  "templateJobId": "string (required)",
  "providerId": "string (required)",
  "date": "ISO date string (required)",
  "timeSlot": "morning|afternoon|evening (required)",
  "address": "string (required)",
  "district": "string (required)",
  "notes": "string (optional)",
  "latitude": "number (optional)",
  "longitude": "number (optional)"
}
```

### Response (201)

```json
{
  "job": { "id": "...", "status": "OPEN", "budgetType": "FIXED", ... },
  "quote": { "id": "...", "status": "PENDING", "price": 5000, ... },
  "notifiedCount": 5,
  "message": "BOOK_NOW job created. Accept the quote to proceed."
}
```

---

## FLOW

1. Customer selects template job + provider + date/time/address
2. BOOK_NOW creates MarketplaceJob (status=OPEN, budgetType=FIXED)
3. BOOK_NOW creates JobQuote from provider (status=PENDING)
4. BOOK_NOW triggers blastJobToTaskers for matching
5. Customer accepts quote via `/v2/jobs/[id]/select-quote`
6. Standard V2 lifecycle continues (escrow → workspace → completion)

---

## OFFERBOOKING STATUS

After convergence:
- New OfferBooking writers = ZERO
- OfferBooking marked as DEPRECATED_TRANSACTION_MODEL
- Table preserved for historical data
- Reader/history assessment remains required

---

## OFFER TEMPLATE ROLE

OfferTemplate remains as:
- Service definition catalog
- Known/fixed price input
- Matching configuration
- Promotional/service metadata

OfferTemplate is NOT the transaction source. MarketplaceJob is.

---

## PRICE SAFETY

Price is copied from TemplateJob.priceMax (existing behavior).
No Float money redesign. Phase 5 handles Float → Decimal.
