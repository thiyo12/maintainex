# MaintainEX Authorization / IDOR / BOLA Audit

## Summary

| Severity | Count | Description |
|---|---|---|
| P0 | 0 | All V2 financial routes properly secured |
| P1 | 3 | Conversation IDOR, Invoice IDOR, Bookings IDOR |
| P2 | 1 | Bookings GET PII exposure |
| P3 | 2 | OPEN job visibility, null branch edge case |

## P1 Findings

### Finding 1: Conversation Messages GET IDOR
**Route:** `GET /api/mobile/conversations/[id]/messages`
**File:** `app/api/mobile/conversations/[id]/messages/route.ts` lines 107-115
**Severity:** P1

The POST handler correctly verifies participant membership (line 26: `participants: { some: { userId: user.id } }`). However, the GET handler has **no participant check**:

```typescript
const where: any = { conversationId: params.id }
// No participant filter!
const messages = await prisma.message.findMany({ where, orderBy: { createdAt: 'asc' } })
```

**Attack:** Authenticated user iterates conversation UUIDs and reads private messages.
**Fix:** Add participant check before querying messages.

### Finding 2: Invoice PATCH/DELETE No Branch Check
**Route:** `PATCH/DELETE /api/invoices/[id]`
**File:** `app/api/invoices/[id]/route.ts` lines 56 (PATCH), 101 (DELETE)
**Severity:** P1

GET handler checks `session.branchId !== invoice.branchId => 403`. PATCH and DELETE handlers skip this check entirely.

**Attack:** Staff with `canEditServices=true` modifies invoices from other branches.
**Fix:** Add branch ownership check before update/delete.

### Finding 3: Bookings GET No Ownership Check
**Route:** `GET /api/mobile/bookings/[id]`
**File:** `app/api/mobile/bookings/[id]/route.ts` lines 5-43
**Severity:** P2

Any authenticated user can read any booking by ID, exposing name, phone, email, address.

**Attack:** Customer A enumerates booking IDs and reads Customer B's PII.
**Fix:** Add `if (booking.userId !== user.id) return 403`.

## P3 Findings

### Finding 4: OPEN Jobs Visible to All
**Route:** `GET /api/mobile/v2/jobs/[id]`
**File:** `app/api/mobile/v2/jobs/[id]/route.ts`
**Severity:** P3 (likely intentional marketplace behavior)

OPEN jobs are visible to any authenticated user. Sensitive fields (phone, email) are redacted for non-owners.

### Finding 5: Null Branch Edge Case
**Route:** `PATCH /api/bookings/[id]`
**File:** `app/api/bookings/[id]/route.ts` lines 73-78
**Severity:** P3

Branch check doesn't guard against null `branchId` — if both booking and session have null branch, any branchless admin can update.

## Secured Routes (P0 — safe)

All V2 financial routes properly verify ownership:
- `select-quote`: `customerId === user.id`
- `escrow`: `customerId === user.id` + own wallet
- `release-escrow`: `customerId === user.id`
- `refund`: `customerId === user.id` + own wallet
- `cash-payment`: `customerId === user.id`
- `complete`: Per-action provider/customer/participant check
- `reviews`: Customer/provider ownership + unique constraint
- `otp`: Assigned provider only
- `workspace`: Participant check + role-based transitions
- `wallet`: Hardcoded `userId: user.id`
- `withdraw`: Hardcoded `userId: user.id`
- `properties/boost`: `postedBy === session.id`
- `properties/delete`: `postedBy === session.id` or admin
