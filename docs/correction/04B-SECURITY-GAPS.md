# 04B-SECURITY-GAPS.md — Phase 4 Security Gaps (NOT Financial Core)

> Generated: Phase 4B — Security Gap Classification
> Scope: Security issues discovered in Phase 4A that must be closed in Phase 4

---

## GAP 1: FlashOffer Claim Endpoint — NO AUTH

**File:** `app/api/flash-offers/claim/route.ts`
**Line:** 13
**Operation:** UPDATE (increment currentClaims)
**Risk:** Anyone can claim any flash offer by sending any offer ID. No authentication, no ownership check, no rate limiting.
**Impact:** Artificial claim counts, potential abuse for promotional gaming.
**Business question:** Is the claim endpoint intentionally anonymous (public promotional claim) or should it require authentication?
**Recommendation:** If claim is account-bound → require marketplace auth. If intentionally anonymous → add rate limiting (per IP).
**Implementation:** Phase 4C

---

## GAP 2: Review POST Endpoint — NO AUTH

**File:** `app/api/reviews/route.ts`
**Line:** 66
**Operation:** CREATE (prisma.review.create)
**Risk:** Anyone can submit a review without authentication. Uses a fixed guest user (maintainex.lk@gmail.com). No ownership verification.
**Impact:** Fake reviews, spam, review manipulation.
**Business question:** Should reviews require authenticated user with verified booking history?
**Recommendation:** Require marketplace auth + verify user has a completed Booking or MarketplaceJob with the reviewed service/provider.
**Implementation:** Phase 4C

---

## GAP 3: Seed Endpoint — NO AUTH

**File:** `app/api/seed/test-data/route.ts`
**Line:** various
**Operation:** CREATE (multiple models)
**Risk:** Public endpoint creates test data in production. No authentication, no authorization.
**Impact:** Production data pollution, potential abuse.
**Business question:** Should this endpoint be disabled in production entirely?
**Recommendation:** Disable in production (check NODE_ENV). The seed endpoint is a machine/bootstrap operation — it should not be accessible in production environments regardless of auth. If dev/staging seeding is needed, restrict to internal deployment context only. Do not mix human staff auth (SUPER_ADMIN) with machine auth (CRON_SECRET) for this endpoint.
**Implementation:** Phase 4C

---

## GAP 4: Property Boost Endpoint — CustomerWallet without MarketplaceJob

**File:** `app/api/properties/[id]/boost/route.ts`
**Line:** 45-56
**Operation:** READ+UPDATE (CustomerWallet)
**Risk:** Debits customer wallet for property boost — a non-marketplace feature. Financial side effect outside marketplace domain.
**Impact:** Customer wallet balance affected by non-marketplace operation.
**Business question:** Is property boost a marketplace feature or a separate product?
**Recommendation:** Document as separate product feature. Ensure wallet operations are consistent.
**Implementation:** Document only — no code change needed

---

## GAP 5: Reviews Endpoint — NO AUTH on GET

**File:** `app/api/reviews/route.ts`
**Line:** 11
**Operation:** READ (prisma.review.findMany)
**Risk:** Any anonymous visitor can list all reviews. No authentication.
**Impact:** Data exposure (reviews are semi-public, but full listing may be sensitive).
**Business question:** Should review listing require authentication?
**Recommendation:** LOW priority — reviews are generally public. But full listing without pagination may be a data scraping vector.
**Implementation:** Phase 5 (low priority)

---

## SECURITY GAP SUMMARY

| # | Gap | Severity | Auth Required | Phase |
|---|---|---|---|---|
| 1 | FlashOffer claim no auth | MEDIUM | Yes (or rate limit) | 4C |
| 2 | Review POST no auth | HIGH | Yes + ownership | 4C |
| 3 | Seed endpoint no auth | HIGH | Disable or require auth | 4C |
| 4 | Property boost wallet op | LOW | Documented | Document |
| 5 | Reviews GET no auth | LOW | Optional | 5 |

---

## NOT IN SCOPE (Phase 5 Financial Core)

The following are Phase 5 issues, NOT Phase 4 security gaps:

- Float money in wallets (P0)
- Wallet cascade delete hazard
- WalletTransaction idempotency
- Provider withdrawal disabled (503)
