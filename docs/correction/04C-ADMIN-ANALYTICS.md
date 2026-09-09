# 04C-ADMIN-ANALYTICS.md — Admin/Analytics Compatibility

> Generated: Phase 4C.8 — Admin/Analytics Compatibility
> Scope: Admin unified view, analytics double-count prevention, IDOR protection

---

## ADMIN UNIFIED VIEW

**Implementation:** `app/api/admin/jobs/route.ts`

**Source discrimination:**
```typescript
source: 'V1' | 'V2'
```

V1 = JobPosting (legacy)
V2 = MarketplaceJob (canonical)

---

## ID COLLISION PREVENTION

- Never assume `Booking.id == MarketplaceJob.id`
- Admin links/details identify source type
- Separate queries for V1 and V2, merged in memory

---

## ANALYTICS DOUBLE COUNT

**Current state:** Admin queries both V1 and V2 in parallel.

**Policy:**
- New marketplace work: count as MarketplaceJob only
- Historical reports: may aggregate legacy separately
- Avoid counting same transaction twice

**Implementation:** Source field prevents double-counting.

---

## READER COMPATIBILITY

**Admin job list:** Unified V1+V2 with source indicator
**Customer job list:** V2 only (MarketplaceJob)
**Provider job list:** V2 only (MarketplaceJob)
**Public discovery:** V2 only, limited fields

---

## PRIVACY / IDOR PROTECTION

**Provider discovery projection:**
Before provider engagement, do NOT expose:
- Exact home address
- Phone
- Email
- Private customer notes
- Payment information

Expose only what provider needs for discovery.

**Customer job access:**
- Customer can read own private job details
- Unrelated customer: DENY
- Provider: only discovery projection until authorized engagement
- Staff: canonical RBAC

---

## ESCROW REGRESSION

Phase 1 protections re-verified:
- Double release prevented
- 2-way release concurrency PASS
- Multi-concurrency PASS
- Rollback PASS

No financial accounting altered.

---

## WITHDRAWAL STATUS

Provider withdrawal remains:
- 503 / DISABLED

No changes in Phase 4.

---

## FLOAT MONEY

Global P0 remains:
- `Float money in wallets → OPEN → Phase 5`

No Float→Decimal migration performed.
