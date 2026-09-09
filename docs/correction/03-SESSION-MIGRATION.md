# 03 — Session Migration Plan

**Date**: 2026-09-07
**Status**: STEP 4A FROZEN — ALL 9 CORRECTIONS APPLIED

---

## Current State

| System | Session Model | Revocable? | DB-backed? |
|---|---|---|---|
| Mobile JWT | None (stateless) | NO | NO |
| Admin New JWT | AdminSession | YES | YES |
| Admin Legacy HMAC | None (stateless) | NO | NO |

## Target State

| System | Session Model | Revocable? | DB-backed? |
|---|---|---|---|
| Marketplace | UserSession | YES | YES |
| Staff | AdminSession (existing) | YES | YES |
| Legacy Admin | Deprecated | N/A | N/A |

---

## Migration Steps

### Phase 3 Step B: Create UserSession Schema

```prisma
model UserSession {
  id               String    @id @default(cuid())
  userId           String
  refreshTokenHash String    @unique
  tokenFamilyId    String
  ipAddress        String?
  userAgent        String?
  deviceName       String?
  createdAt        DateTime  @default(now())
  lastUsedAt       DateTime?
  expiresAt        DateTime
  revokedAt        DateTime?
  revokeReason     String?
  updatedAt        DateTime  @updatedAt

  @@index([userId])
  @@index([refreshTokenHash])
  @@index([tokenFamilyId])
  @@index([expiresAt])
}
```

### Phase 3 Step I: Migrate Mobile Login Routes

**Before** (current):
```typescript
// mobile/auth/login/route.ts
const token = createToken({ id: user.id, email: user.email, role: user.role })
return { token, user }
```

**After** (target):
```typescript
// mobile/auth/login/route.ts
const session = await createUserSession({
  userId: user.id,
  ipAddress: ip,
  userAgent,
})
const accessToken = signMarketplaceAccessToken({ sub: user.id, sid: session.id })
const refreshToken = session.refreshTokenValue  // returned once, never stored server-side in plain text
return { accessToken, refreshToken, user }
```

### Phase 3 Step J: Add Refresh Endpoint

```
POST /api/mobile/auth/refresh
  → Parse refreshToken (format: sessionId.randomSecret)
  → Load UserSession by sessionId (selector)
  → hash(randomSecret) === stored refreshTokenHash?
  → Check session not revoked, not expired
  → Check user still active, not banned
  → Atomic rotation (PostgreSQL UPDATE WHERE hash matches)
  → Return new access + refresh tokens
```

### Phase 3 Step K: Update authenticateRequest()

**Before**:
```typescript
export async function authenticateRequest(request) {
  const token = getTokenFromRequest(request)
  const payload = verifyToken(token)  // stateless
  const user = await prisma.user.findUnique({ where: { id: payload.id } })
  return user
}
```

**After**:
```typescript
export async function authenticateMarketplace(request) {
  const token = getTokenFromRequest(request)
  const payload = verifyMarketplaceToken(token)  // verifies aud, type, signature, extracts sid
  const session = await prisma.userSession.findUnique({ where: { id: payload.sid } })
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null
  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user || !user.isActive || user.isBanned) return null
  const capabilities = await resolveCapabilities(user.id)
  return buildMarketplacePrincipal(user, session, capabilities)
}
```

### Phase 3 Steps L-M: Migrate Admin Auth

Admin auth already uses AdminSession. Changes:
1. Separate signing secrets (STAFF_JWT_SECRET instead of JWT_SECRET/NEXTAUTH_SECRET)
2. Add `aud: 'maintainex-staff'` to staff tokens
3. Add `type: 'staff_access'` to staff tokens
4. Add `sid` claim (AdminSession.id)
5. Remove mutable/PII claims from token (role, firstName, lastName, assignedCountries)
6. Resolve current role/permissions from DB at request time

### Phase 3 Steps N-R: Migrate getSession() Consumers

80 files currently import from `lib/auth-utils.ts`. Each must be updated to import from `lib/auth/staff-auth.ts`.

**Strategy**: Create adapter in `lib/auth-utils.ts` that delegates to new module:
```typescript
// lib/auth-utils.ts (adapter, temporary)
import { authenticateStaff } from './auth/staff-auth'
export async function getSession(request) {
  return authenticateStaff(request)
}
```

This allows incremental migration without breaking all 80 files at once.

### Phase 3 Steps O-T: Cleanup

1. Remove old `lib/auth-utils.ts` after all callers migrated
2. Remove `lib/admin-auth.ts` after legacy HMAC retired
3. Remove `lib/admin-rbac.ts` after functions migrated
4. Remove dead code (`createSimpleToken`, `adminAuthorize`, `getSessionFromCookie`)
5. Clean up deprecated env vars

---

## Backward Compatibility Window

### Marketplace (Mobile)

**Duration**: 7 days (deployment date + 7 days)

**Behavior during window**:
- Old 30-day stateless tokens: Accepted by `authenticateMarketplace()` compatibility verifier (signature-only check, no session lookup)
- New logins: Issue 15-minute access + 30-day opaque refresh tokens
- Legacy token issuance: MUST STOP on deploy day

**Cutoff mechanism**: Hardcoded `MIGRATION_DEADLINE = deployDate + 7 days` in code. After cutoff:
- `verifyLegacyToken()` returns `null` immediately regardless of token validity
- Users holding legacy tokens must log in again
- Do NOT silently extend based on token expiry

**User impact**: Active users refresh naturally within 7 days. Inactive users re-login once.

### Staff (Admin)

**Duration**: Immediate (deploy day)

**Behavior**:
- Deploy day: Invalidate all existing AdminSessions. Force re-login for all admin users.
- Deploy day: Reject old HMAC tokens (no compatibility window — `verifySimpleToken()` returns `null` for HMAC format)
- Deploy day: New canonical login issues 30-minute access + 7-day opaque refresh
- TOTP/2FA: Preserved — staff re-authenticate with password + TOTP

**User impact**: All admin staff must re-login once after deployment. Security priority over UX.

**Why no compatibility window**: Legacy HMAC tokens have no revocation mechanism. Every day they remain active is a security risk. Admin UX impact is minimal (one re-login).

---

## Refresh Token Format Migration

### Current Admin Refresh Token

**Format**: `crypto.randomBytes(64).toString('hex')` (128 hex chars, no session binding)

**Storage**: `AdminSession.refreshToken = sha256(token)`

### Target Refresh Token (Both Marketplace + Staff)

**Format**: `<sessionId>.<randomSecret>` (session-bound)

**Storage**: `hash(randomSecret)` in session table

### Migration Approach

**Staff refresh tokens**: Force re-login resets all sessions → new format issued immediately. No gradual migration needed.

**Marketplace refresh tokens**: New logins issue session-bound format. Existing old-format tokens:
1. During 7-day window: old tokens still work (hash lookup by full token, not by selector)
2. After 7-day cutoff: old tokens rejected
3. No token-upgrade flow needed — old tokens expire or are rejected at cutoff

**Dual-format support during window**:
```typescript
function parseRefreshToken(token: string): { selector: string, secret: string } | null {
  if (token.includes('.')) {
    // New format: sessionId.randomSecret
    const [selector, secret] = token.split('.', 2)
    return { selector, secret }
  }
  // Legacy format: full random (no selector)
  // During compatibility window only
  return { selector: null, secret: token }
}
```

---

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Mobile users forced to re-login after 7 days | LOW | 7-day window sufficient for active users |
| Admin forced to re-login immediately | LOW | Acceptable for security — TOTP preserved |
| Refresh token rotation failure | MEDIUM | PostgreSQL atomic updates |
| Session table growth | LOW | TTL-based cleanup cron |
| Concurrent refresh race condition | MEDIUM | Token family revocation (safe default) |
| Legacy token used after cutoff | LOW | User must re-login — acceptable |

---

PHASE 3 SESSION MIGRATION FROZEN — ALL 9 CORRECTIONS APPLIED

---

## Step 5 Implementation Status

| Component | Status |
|---|---|
| UserSession Prisma model | DONE |
| Migration SQL | DONE |
| Migration applied to test DB | DONE |
| Refresh token utilities | DONE |
| Session service primitives | DONE |
| Unit tests | DONE (29/29) |
| SQL database integration tests | DONE (16/16) |
| TypeScript DB integration tests | DONE (9/9, 2x run) — Step 5B verified |
| Production login migration | NOT YET (Phase 3C) |
| Refresh endpoint | DONE — Step 6 |
| authenticateRequest migration | NOT YET (Phase 3C) |

---

## Step 6 Implementation Status

| Component | Status |
|---|---|
| Marketplace access token service | DONE (`lib/auth/marketplace-jwt.ts`) |
| Refresh rotation service | DONE (`lib/auth/rotation.ts`) |
| Refresh endpoint | DONE (`app/api/mobile/auth/refresh/route.ts`) |
| Atomic rotation (PostgreSQL) | DONE — conditional UPDATE with hash check |
| Replay detection + family revocation | DONE |
| Security event logging | DONE (SecurityAudit table) |
| Unit tests (JWT + parsing) | DONE (19/19) |
| DB integration tests (rotation) | DONE (11/11, 2x run) |
| Production login unchanged | VERIFIED |
| `authenticateRequest()` unchanged | VERIFIED |
| Staff auth unchanged | VERIFIED |

---

## Phase 3C Implementation Status

| Component | Status |
|---|---|
| `createMarketplaceAuthSession()` | DONE (`lib/auth/marketplace-session.ts`) |
| Password login migration | DONE (`app/api/mobile/auth/login/route.ts`) |
| OTP login migration | DONE (`app/api/mobile/auth/otp-login/route.ts`) |
| Verify-OTP migration | DONE (`app/api/mobile/auth/verify-otp/route.ts`) |
| Password reset — revoke ALL, NO auto-login | DONE (`app/api/mobile/auth/reset-password/route.ts`) |
| Canonical `authenticateRequest()` | DONE — JWT + UserSession + legacy compat |
| Logout endpoint | DONE (`app/api/mobile/auth/logout/route.ts`) |
| Mobile refresh token storage | DONE (`apps/mobile/lib/api.ts`) |
| Mobile single-flight refresh | DONE (`apps/mobile/lib/api.ts`) |
| Mobile logout | DONE (`apps/mobile/lib/auth.tsx`) |
| 76-route compatibility verified | DONE — zero changes needed |
| DB integration tests | DONE (20/20, 2x run) |
| Password reset integration tests | DONE (`tests/phase3/password-reset.integration.test.ts`) |
| Build passes | VERIFIED |
| Staff auth unchanged | VERIFIED |
