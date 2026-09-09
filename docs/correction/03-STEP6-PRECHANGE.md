# 03 — Step 6: Pre-Change Review

**Date**: 2026-09-07

---

## Current Auth Foundation (from Step 5)

### Files

| File | Lines | Purpose |
|---|---|---|
| `lib/auth/refresh.ts` | 37 | generateRefreshToken, parseRefreshToken, hashRefreshSecret, verifyRefreshSecret |
| `lib/auth/sessions.ts` | 99 | createSession, getActiveSession, revokeSession, revokeAllUserSessions, revokeTokenFamily |
| `lib/auth/types.ts` | 15 | MarketplacePrincipal, StaffPrincipal, AuthPrincipal |
| `lib/auth/constants.ts` | 25 | TOKEN_PURPOSE, TOKEN_AUDIENCE, TOKEN_ISSUER, TOKEN_LIFETIMES, REFRESH_TOKEN_BYTES |
| `lib/auth/errors.ts` | 51 | AuthError class, 15 error codes, ERROR_MAP |

### Current Mobile Auth (`lib/mobile-auth.ts`)

- `createToken(data)` — signs JWT with `NEXTAUTH_SECRET`, expiresIn `30d`
- `verifyToken(token)` — verifies JWT with `NEXTAUTH_SECRET`
- `authenticateRequest(request)` — extracts Bearer token, verifies JWT, loads User from DB
- Used by 75 mobile route files
- Token payload: `{ id, email, role }` — no `sid`, no `aud`, no `iss`, no `type`

### Current Admin JWT (`lib/admin-jwt.ts`)

- `signAccessToken()` — JWT with `JWT_SECRET` or `NEXTAUTH_SECRET`, includes role/firstName/lastName/assignedCountries
- `verifyAccessToken()` — verifies type=access
- `signRefreshToken()` / `verifyRefreshToken()` — JWT refresh with `JWT_REFRESH_SECRET`
- Uses HMAC legacy fallback in `lib/admin-auth.ts`

### Current Mobile Login Flow

- `POST /api/mobile/auth/login` — email/password → `createToken({ id, email, role })`
- `POST /api/mobile/auth/otp-login` — OTP verify → `createToken({ id, email, role })`
- No `UserSession` created on login (stateless JWT, 30d expiry)
- No refresh token issued

### Security Audit (`SecurityAudit` model)

- Used by `lib/security/risk-score.ts:recordSecurityEvent()`
- Used by `lib/fraud-detection.ts` and `lib/crm/audit.ts`
- Fields: action, category, userId, userEmail, entityType, entityId, description, ipAddress, userAgent, riskLevel, isSuspicious

### UserSession Schema

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

### Token Family Semantics

- `tokenFamilyId` = UUID generated per session creation
- Each `UserSession` has ONE token family
- Repeated rotations update the SAME session row (same `id`, same `tokenFamilyId`)
- `revokeTokenFamily()` revokes all sessions sharing a family ID
- Design: one device login → one UserSession → repeated rotations update same session

---

## What Step 6 Adds

### New: `lib/auth/marketplace-jwt.ts`

- `signMarketplaceAccessToken(userId, sessionId)` — signs JWT with `MARKETPLACE_JWT_SECRET`
- `verifyMarketplaceAccessToken(token)` — verifies JWT, returns claims or null
- Claims: `sub`, `sid`, `aud`, `iss`, `jti`, `type`, `iat`, `exp`
- No email, no role, no permissions, no balances

### New: `lib/auth/rotation.ts`

- `rotateMarketplaceRefreshToken(rawRefreshToken, context?)` — atomic rotation
- Parse → load session → load user → validate → generate new → atomic swap → sign access → return

### New: `app/api/mobile/auth/refresh/route.ts`

- `POST /api/mobile/auth/refresh` — accepts `{ refreshToken }` in body
- Returns `{ accessToken, refreshToken, expiresIn }`

### Modified: `lib/auth/errors.ts`

- Add `REFRESH_TOKEN_REPLAY` error code (already exists as `TOKEN_REPLAY`)

---

## What Step 6 Does NOT Touch

- `lib/mobile-auth.ts` — unchanged (75 routes still use it)
- `lib/auth-utils.ts` — unchanged
- `lib/admin-auth.ts` — unchanged
- `lib/admin-jwt.ts` — unchanged
- `middleware.ts` — unchanged
- All 75 mobile protected routes — unchanged
- `LEGACY_MOBILE_AUTH_CUTOFF` — not enabled
- No new database tables
- No new Prisma migrations

---

## Database Changes

None. UserSession table already exists with correct schema.

---

## Dependencies

- `jsonwebtoken` ^9.0.2 — already installed
- `crypto` — Node.js built-in
- `prisma` — already configured
