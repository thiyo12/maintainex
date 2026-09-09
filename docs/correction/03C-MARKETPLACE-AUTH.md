# 03C — Marketplace Authentication Migration

**Date**: 2026-09-07
**Status**: COMPLETE

---

## MARKETPLACE AUTH BEFORE/AFTER

### Before

```
User → stateless 30-day JWT (NEXTAUTH_SECRET) → authenticateRequest() → user
```

### After

```
User → UserSession → 15-minute Marketplace Access JWT (MARKETPLACE_JWT_SECRET) → 30-day opaque Refresh Token
→ authenticateRequest() → JWT validation → UserSession lookup → current User status → principal
```

---

## LOGIN ROUTES MIGRATED

| Route | Before | After |
|---|---|---|
| `POST /api/mobile/auth/login` | `createToken({ id, email, role })` | `createMarketplaceAuthSession()` → UserSession + Access JWT + Refresh Token |
| `POST /api/mobile/auth/otp-login` | `createToken({ id, email, role })` | `createMarketplaceAuthSession()` → UserSession + Access JWT + Refresh Token |
| `POST /api/mobile/auth/verify-otp` | `createToken({ id, email, role })` | `createMarketplaceAuthSession()` → UserSession + Access JWT + Refresh Token (PHONE_VERIFICATION only) |
| `POST /api/mobile/auth/reset-password` | `createToken({ id, email, role })` | `createMarketplaceAuthSession()` → UserSession + Access JWT + Refresh Token + revoke all sessions |

---

## SIGNUP/OTP ROUTES MIGRATED

| Route | Behavior |
|---|---|
| `POST /api/mobile/auth/register` | No change — creates user + PHONE_VERIFICATION OTP, returns `requiresVerification: true` |
| `POST /api/mobile/auth/send-otp` | No change — sends EMAIL_VERIFICATION OTP |
| `POST /api/mobile/auth/forgot-password` | No change — sends PASSWORD_RESET OTP |

---

## AUTHENTICATEREQUEST MIGRATION

### Canonical Path (NEW)

```
Bearer token → verifyMarketplaceAccessToken() → claims { sub, sid }
→ UserSession lookup (sid) → session active? → User lookup (sub) → account enabled? → principal
```

### Legacy Compatibility Path

```
Bearer token → verifyLegacyToken() (NEXTAUTH_SECRET)
→ if LEGACY_MOBILE_AUTH_CUTOFF configured AND current time < cutoff → accept temporarily
→ else reject
```

### Priority

1. Canonical JWT verified first
2. Legacy JWT fallback only if canonical fails AND cutoff not reached
3. After cutoff: legacy tokens rejected regardless of validity

---

## MOBILE ROUTE COVERAGE

| Category | Count | Status |
|---|---|---|
| Total files using `authenticateRequest()` | 75 | COMPATIBLE |
| Files using `user.id` | 63 | COMPATIBLE |
| Files using `user.role` | 17 | COMPATIBLE |
| Files using `user.name` | 6 | COMPATIBLE |
| Files using `user.email` | 4 | COMPATIBLE |
| Files using `user.identityStatus` | 3 | COMPATIBLE |
| Files using `user.phone` | 1 | COMPATIBLE |
| Files using `user.lastNameChangedAt` | 1 | COMPATIBLE |

**All 75 routes are compatible** — `authenticateRequest()` returns the same `AuthenticatedUser` shape. No route changes required.

---

## MOBILE SECURE STORAGE

| Key | Type | Purpose |
|---|---|---|
| `auth_token` | string | Access JWT (15-minute expiry) |
| `auth_refresh_token` | string | Opaque refresh token (30-day expiry) |
| `auth_user` | JSON string | Cached user object for offline bootstrap |
| `last_active_at` | epoch ms string | Heartbeat timestamp |

All stored in `expo-secure-store` (OS-backed secure storage).

---

## MOBILE SINGLE-FLIGHT REFRESH

```typescript
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise  // coalesce concurrent requests
  refreshPromise = doRefresh().finally(() => { refreshPromise = null })
  return refreshPromise
}
```

- First 401 → starts refresh promise
- Other 401s → wait for same promise
- Refresh succeeds → all retry with new token
- Refresh fails → all get AUTH_EXPIRED error

**Critical**: Server replay protection is NOT weakened. Mobile coordinates refresh to prevent concurrent rotation attempts.

---

## LOGOUT

`POST /api/mobile/auth/logout`

- Accepts `{ all: true }` to revoke all sessions
- Verifies current session via access token or refresh token
- Revokes server-side UserSession
- Mobile clears all local credentials via `clearAuth()`

---

## PASSWORD RESET SESSION POLICY

After successful password reset:
1. `revokeAllUserSessions(userId, 'password_reset')` — ALL marketplace sessions revoked
2. New session issued for the reset flow
3. All other devices must re-login

---

## LEGACY CUTOFF

### Configuration

`LEGACY_MOBILE_AUTH_CUTOFF` — UTC ISO-8601 timestamp

### Behavior

| Value | Behavior |
|---|---|
| Not set | Legacy tokens rejected immediately (safest) |
| Past timestamp | Legacy tokens rejected (cutoff already passed) |
| Future timestamp | Legacy tokens accepted until cutoff, then rejected |
| Invalid value | Legacy tokens rejected (safe fallback) |

### After Cutoff

- Legacy JWT signed by `NEXTAUTH_SECRET` → rejected
- New login → canonical UserSession + Access JWT + Refresh Token
- No silent extension based on old token expiry

---

## LEGACY ISSUANCE

**Target: ZERO active marketplace legacy token issuers**

After Phase 3C:
- `createToken()` still exists in `lib/mobile-auth.ts` but is NOT called by any login route
- Legacy verification exists for compatibility window only
- No new marketplace authentication flow issues old 30-day stateless JWT

---

## CANONICAL JWT SECRET

- New issuance uses `MARKETPLACE_JWT_SECRET` only
- Legacy compatibility may temporarily use `NEXTAUTH_SECRET`
- No fallback to `NEXTAUTH_SECRET` in canonical issuance
- Missing `MARKETPLACE_JWT_SECRET` in production → login fails safely

---

## FILES CHANGED

| File | Action |
|---|---|
| `lib/auth/marketplace-session.ts` | Created — `createMarketplaceAuthSession()`, `buildAuthResponse()` |
| `lib/mobile-auth.ts` | Rewritten — `authenticateRequest()` with canonical + legacy compat |
| `app/api/mobile/auth/login/route.ts` | Migrated to canonical session issuance |
| `app/api/mobile/auth/otp-login/route.ts` | Migrated to canonical session issuance |
| `app/api/mobile/auth/verify-otp/route.ts` | Migrated to canonical session issuance |
| `app/api/mobile/auth/reset-password/route.ts` | Migrated + session revocation |
| `app/api/mobile/auth/logout/route.ts` | Created — server-side session revocation |
| `apps/mobile/lib/api.ts` | Added refresh token storage + single-flight refresh |
| `apps/mobile/lib/auth.tsx` | Updated for new token format + logout + clearAuth |
| `docs/correction/03C-PRECHANGE.md` | Created |
| `docs/correction/03C-MARKETPLACE-AUTH.md` | Created (this file) |

---

## DATABASE CHANGES

None. No new migrations.

---

## VALIDATION MATRIX

| Check | Status |
|---|---|
| `npx prisma validate` | PASS |
| `npx prisma generate` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| Unit tests (local) | PASS (48/48) |
| DB integration tests (rotation) | PASS (11/11) |
| DB integration tests (usersession) | PASS (9/9) |
| Production login unchanged | N/A — login routes migrated |
| Staff auth unchanged | PASS |
| Withdrawal disabled | PASS |
