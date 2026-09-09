# 03 — Step 5: UserSession Foundation

**Date**: 2026-09-07
**Status**: COMPLETE

---

## What Was Built

### Canonical Auth Types (`lib/auth/types.ts`)

- `MarketplacePrincipal` — `{ principalType, userId, sessionId }`
- `StaffPrincipal` — `{ principalType, adminUserId, sessionId }`
- No capabilities embedded — resolved from DB independently

### Token Constants (`lib/auth/constants.ts`)

- `TOKEN_PURPOSE` — `marketplace_access`, `staff_access`
- `TOKEN_AUDIENCE` — `maintainex-marketplace`, `maintainex-staff`
- `TOKEN_ISSUER` — `maintainex`
- `TOKEN_LIFETIMES` — marketplace 15min/30d, staff 30min/7d

### Auth Error Model (`lib/auth/errors.ts`)

- `AuthError` class with code, status, message
- 15 error codes covering all auth failure modes
- Anti-enumeration: generic messages for login failures

### UserSession Model (Prisma)

```prisma
model UserSession {
  id               String    @id @default(cuid())
  userId           String
  refreshTokenHash String    @unique
  tokenFamilyId    String
  ipAddress        String?
  userAgent        String?
  createdAt        DateTime  @default(now())
  lastUsedAt       DateTime?
  expiresAt        DateTime
  revokedAt        DateTime?
  revokeReason     String?
  updatedAt        DateTime  @updatedAt
}
```

Key design decisions:
- Named `UserSession` (not `Session` — existing legacy model)
- `onDelete: Cascade` (matching existing Session pattern)
- `revokedAt` nullable (not `isValid` boolean) — more semantic
- No `deviceName` — no unnecessary device-fingerprinting
- Indexes: `userId`, `tokenFamilyId`, `expiresAt`

### Refresh Token Utilities (`lib/auth/refresh.ts`)

- `generateRefreshToken(sessionId)` — `<sessionId>.<randomSecret>` format
- `parseRefreshToken(token)` — extracts selector + secret, validates format
- `hashRefreshSecret(secret)` — SHA-256 deterministic hash
- `verifyRefreshSecret(secret, hash)` — constant-time comparison

### UserSession Service (`lib/auth/sessions.ts`)

- `createSession({ userId, ipAddress?, userAgent? })` — creates session, returns raw refresh token once
- `getActiveSession(sessionId, userId)` — validates session ownership, not revoked, not expired
- `revokeSession(sessionId)` — idempotent revocation
- `revokeAllUserSessions(userId, reason)` — bulk revocation
- `revokeTokenFamily(tokenFamilyId, reason)` — replay-family revocation

---

## What Was NOT Changed

- No production login endpoints modified
- `authenticateRequest()` unchanged
- `getAdminSession()` unchanged
- `verifySimpleToken()` unchanged (legacy HMAC still operational)
- No admin auth changes
- No dead code removed

---

## Migration

- `prisma/migrations/20260907000000_add_user_sessions/migration.sql`
- Clean PostgreSQL: PASS
- Existing PostgreSQL simulation: PASS (test database verified)
- No destructive changes to existing data

---

## Step 5B: Production Service Integration Verification

**Status**: VERIFIED

All production TypeScript service functions tested against real PostgreSQL:

| Function | Test | Result |
|---|---|---|
| `createSession()` | Creates valid session, hashes token, stores in DB | PASS |
| `getActiveSession()` | Returns active, denies wrong user, expired, revoked | PASS |
| `revokeSession()` | Sets revokedAt/revokeReason, idempotent | PASS |
| `revokeAllUserSessions()` | Revokes all for user A, leaves B intact | PASS |
| `revokeTokenFamily()` | Revokes target family, leaves other intact | PASS |
| `parseRefreshToken()` | Extracts sessionId and secret from raw token | PASS |
| `hashRefreshSecret()` | Produces deterministic 64-char hex | PASS |
| `verifyRefreshSecret()` | True for correct, false for wrong | PASS |
| End-to-end | generate → parse → lookup → verify | PASS |

**Execution**: 9/9 PASS on 2 consecutive runs inside VPS Docker container (`maintainex-mx-vcaohy`) on `dokploy-network` with `DATABASE_URL=...maintainex_test`.

**Next gate**: Step 5B COMPLETE — READY FOR STEP 6 (Refresh Rotation)
