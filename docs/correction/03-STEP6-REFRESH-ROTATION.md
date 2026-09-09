# 03 — Step 6: Refresh Rotation

**Date**: 2026-09-07
**Status**: COMPLETE

---

## What Was Built

### Marketplace Access Token Service (`lib/auth/marketplace-jwt.ts`)

- `signMarketplaceAccessToken(userId, sessionId)` — signs JWT with `MARKETPLACE_JWT_SECRET`
- `verifyMarketplaceAccessToken(token)` — verifies JWT, validates audience/issuer/type

**Claims**: `sub`, `sid`, `aud`, `iss`, `jti`, `type`, `iat`, `exp`

**Excluded**: email, role, permissions, balances, provider status, KYC, company access

**TTL**: `MARKETPLACE_ACCESS_TTL` (default `15m`)

**Validation**: audience=`maintainex-marketplace`, issuer=`maintainex`, type=`marketplace_access`, `sub` and `sid` required.

### Refresh Rotation Service (`lib/auth/rotation.ts`)

- `rotateMarketplaceRefreshToken(rawRefreshToken, context?)` — atomic rotation

**Flow**:
1. Parse raw refresh token (`sessionId.secret`)
2. Load `UserSession` from DB
3. Validate session: not revoked, not expired
4. Verify refresh secret against stored hash
5. Load `User` — check isActive, isBanned, isSuspended
6. Generate new refresh secret
7. **Atomic swap**: `UPDATE UserSession SET refreshTokenHash = $newHash WHERE id = $sessionId AND refreshTokenHash = $oldHash AND revokedAt IS NULL AND expiresAt > NOW()`
8. If swap returns 0 rows → replay detected → revoke family
9. Sign marketplace access JWT
10. Return `{ accessToken, refreshToken, accessTokenExpiresAt, sessionExpiresAt }`

### Refresh Endpoint (`app/api/mobile/auth/refresh/route.ts`)

- `POST /api/mobile/auth/refresh` — accepts `{ refreshToken }` in body
- Returns `{ accessToken, refreshToken, expiresIn: 900, sessionExpiresAt }`
- All errors return safe public messages

### Security Logging

- Replay events logged to `SecurityAudit` via `recordSecurityEvent('TOKEN_REPLAY', 'AUTH', ...)`
- Severity: HIGH, includes userId, sessionId, ipAddress, userAgent
- No raw tokens, secrets, or JWTs logged

---

## Atomic Rotation

```sql
UPDATE "UserSession"
SET
  "refreshTokenHash" = $newHash,
  "lastUsedAt" = NOW(),
  "updatedAt" = NOW()
WHERE
  "id" = $sessionId
  AND "refreshTokenHash" = $oldHash
  AND "revokedAt" IS NULL
  AND "expiresAt" > NOW()
```

If 0 rows affected → replay detected → revoke token family.

---

## Replay Policy

1. Parse token → load session
2. If session revoked → log `TOKEN_REPLAY` → throw `TOKEN_REPLAY`
3. If secret mismatch → revoke entire `tokenFamilyId` → log `TOKEN_REPLAY` → throw `TOKEN_REPLAY`
4. If atomic swap fails (concurrent) → revoke entire `tokenFamilyId` → log `TOKEN_REPLAY` → throw `TOKEN_REPLAY`

Client receives 401 with safe message. No distinction between "session revoked" and "wrong secret".

---

## Concurrency Results

### 2-Way (same token, simultaneous)

- `Promise.allSettled([rotate(token), rotate(token)])`
- Result: **at most 1 succeeds**, 1 fails with `TOKEN_REPLAY`
- DB state: single session, single hash, family revoked

### 5-Way (same token, simultaneous)

- `Promise.allSettled([rotate(x5)])`
- Result: **at most 1 succeeds**, 4 fail with `TOKEN_REPLAY`
- DB state: single session, single hash, family revoked

---

## Token Family Semantics

- One device login → one `UserSession` → one `tokenFamilyId`
- Repeated rotations update the SAME session row (same `id`, same `tokenFamilyId`)
- No new `UserSession` row created on refresh
- `revokeTokenFamily()` revokes ALL sessions sharing a family ID

---

## Files Created/Modified

| File | Action |
|---|---|
| `lib/auth/marketplace-jwt.ts` | Created |
| `lib/auth/rotation.ts` | Created |
| `app/api/mobile/auth/refresh/route.ts` | Created |
| `tests/phase3/marketplace-jwt.test.ts` | Created |
| `tests/phase3/rotation.integration.test.ts` | Created |
| `docs/correction/03-STEP6-PRECHANGE.md` | Created |
| `docs/correction/03-STEP6-REFRESH-ROTATION.md` | Created (this file) |
| `docs/correction/03-STEP6-REPLAY.md` | Created |
| `docs/correction/03-STEP6-TESTS.md` | Created |
| `docs/correction/03-TOKEN-SPEC.md` | Updated |
| `docs/correction/03-SESSION-MIGRATION.md` | Updated |
| `docs/correction/00-RISK-REGISTER.md` | Updated |

---

## Database Changes

None. No new migrations. `UserSession` table already existed.

---

## What Step 6 Does NOT Touch

- `lib/mobile-auth.ts` — unchanged (75 routes still use legacy JWT)
- `lib/auth-utils.ts` — unchanged
- `lib/admin-auth.ts` — unchanged
- `lib/admin-jwt.ts` — unchanged
- `middleware.ts` — unchanged
- All 75 mobile protected routes — unchanged
- `LEGACY_MOBILE_AUTH_CUTOFF` — not enabled
- No new database tables
