# MaintainEX Phase 1 — Security Fixes

## 1. Path Traversal Fix

**File:** `app/api/files/[...path]/route.ts`

**Before:** `path.join(process.cwd(), 'public', ...params.path)` — no canonical path check. `..` segments resolved silently.

**After:** Canonical path comparison using `realpathSync`. Rejects any path that escapes `public/`. Null byte guard added.

**Regression test:** `tests/phase1/path-traversal.test.ts` — 8 test cases.

## 2. CV Upload Validation

**File:** `app/api/upload/cv/route.ts`

**Before:** Checked `file.type` (client-provided, spoofable). No magic byte validation.

**After:** Server-side PDF magic byte validation (`%PDF` header). Removed spoofable `file.type` check.

**Regression test:** Behavioral test in `withdrawal-safety.test.ts`.

## 3. Conversation Message IDOR

**File:** `app/api/mobile/conversations/[id]/messages/route.ts`

**Before:** GET handler only checked authentication. No participant check.

**After:** GET handler verifies `ConversationParticipant` membership before querying messages.

**Regression test:** `tests/phase1/conversation-idor.test.ts` — 3 test cases.

## 4. Booking Ownership IDOR

**File:** `app/api/mobile/bookings/[id]/route.ts`

**Before:** Any authenticated user could read any booking by ID.

**After:** Checks `booking.userId === user.id` or `booking.tasker.userId === user.id`.

**Regression test:** `tests/phase1/booking-idor.test.ts` — 3 test cases.

## 5. Invoice Cross-Branch Authorization

**File:** `app/api/invoices/[id]/route.ts`

**Before:** PATCH and DELETE only checked `canEditServices` permission. No branch scope.

**After:** Both PATCH and DELETE now verify branch ownership (matching GET handler pattern).

**Regression test:** `tests/phase1/invoice-branch.test.ts` — 4 test cases.

## 6. Admin Session Revocation

**File:** `lib/admin-auth.ts`

**Before:** `getAdminSession()` returned JWT payload without checking `AdminSession.isRevoked`.

**After:** After JWT verification, queries database for at least one active (non-revoked) session for the user.

**Regression test:** Behavioral test in existing admin test suite.
