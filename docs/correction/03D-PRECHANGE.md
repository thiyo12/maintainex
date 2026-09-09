# 03D — Pre-Change Repository Audit

## Date: Phase 3D Start

---

## Current Admin Auth Architecture

### Models

| Model | Purpose | Status |
|-------|---------|--------|
| `AdminUser` | Staff accounts | ACTIVE — canonical |
| `AdminSession` | Refresh token tracking | ACTIVE — needs `tokenFamilyId` |
| `AdminRefreshToken` | Old refresh token tracking | UNUSED — superseded by AdminSession |
| `Admin` | Legacy admin accounts | ACTIVE — separate from AdminUser |

### Auth Library Files

| File | Exports | Status |
|------|---------|--------|
| `lib/admin-auth.ts` | `getAdminSession`, `verifySimpleToken`, `createSimpleToken` | TO MIGRATE |
| `lib/admin-jwt.ts` | `signAccessToken`, `verifyAccessToken`, `signRefreshToken`, `verifyRefreshToken`, `generateRefreshTokenValue`, `hashRefreshToken` | TO REPLACE |
| `lib/admin-2fa.ts` | `generateTotpSecret`, `generateTotpUri`, `verifyTotp` | PRESERVE |
| `lib/auth-utils.ts` | `getSession` (wraps `verifySimpleToken`) | TO MIGRATE |
| `lib/admin-rbac.ts` | `getSessionFromCookie`, `adminAuthorize`, `getCountryFilter`, `createAuditLog`, `getIp` | TO UPDATE |
| `lib/admin-types.ts` | `AdminRole`, `ROLE_PERMISSIONS`, `AdminSession` type | TO UPDATE |

---

## Current Token Issues

| Issue | Current | Target |
|-------|---------|--------|
| Access token TTL | 24 hours | 30 minutes |
| Access token claims | Includes role, firstName, lastName, assignedCountries | Only sub, sid, aud, iss, jti, type, iat, exp |
| Refresh token format | JWT (`JWT_REFRESH_SECRET`) | Opaque `<sessionId>.<randomSecret>` |
| Refresh token storage | `AdminSession.refreshTokenHash` | `AdminSession.refreshTokenHash` + `tokenFamilyId` |
| Atomic rotation | No | YES — PostgreSQL conditional UPDATE |
| Replay detection | No | YES — hash mismatch + active session = replay |
| Cross-token isolation | Partial | FULL — staff JWTs rejected by marketplace, vice versa |

---

## Current Login Flow

```
POST /api/admin/auth/login
→ email/password
→ AdminUser lookup
→ lockout check
→ password verify (bcrypt + migration)
→ if TOTP enabled: return tempToken (JWT, 5min, purpose='2fa_verify')
→ if no TOTP: create AdminSession + signAccessToken + signRefreshToken
→ set cookies: admin_token (access, 7d), refresh_token (JWT, 7d)
```

## Current 2FA Flow

```
POST /api/admin/auth/2fa/setup → generate TOTP secret, store on AdminUser
POST /api/admin/auth/2fa/verify → verify tempToken + TOTP code → create session → issue tokens
```

## Current Refresh Flow

```
POST /api/admin/auth/refresh
→ read refresh_token cookie
→ verifyRefreshToken (JWT, JWT_REFRESH_SECRET)
→ AdminSession lookup by payload.jti
→ check isRevoked, expiresAt
→ AdminUser lookup, check isActive/deletedAt
→ generate new refresh token hash
→ sign new accessToken (includes role, name, countries)
→ update AdminSession
→ set cookies
```

## Current Logout Flow

```
POST /api/admin/auth/logout
→ read refresh_token cookie
→ verifyRefreshToken → get payload.jti
→ AdminSession.updateMany({ where: { id: payload.jti }, data: { isRevoked: true } })
→ clear cookies
```

---

## Current getAdminSession (lib/admin-auth.ts)

```
getAdminSession(request)
→ check Authorization: Bearer <token>
  → try verifyAccessToken (JWT, JWT_SECRET)
    → if valid: check hasActiveSession (AdminSession lookup)
    → if valid + active: return payload
  → try verifySimpleToken (HMAC/base64)
    → if valid: return payload
→ check admin_token cookie
  → try verifySimpleToken
    → if valid: return payload
→ return null
```

**Issues**: Mixed JWT + HMAC verification, no session ID validation for HMAC tokens, 24h access TTL.

---

## Current getSession (lib/auth-utils.ts)

```
getSession(request)
→ check Authorization: Bearer <token>
  → verifySimpleToken → return SessionUser
→ check admin_token cookie
  → verifySimpleToken → return SessionUser
→ return null
```

**Issues**: Only uses verifySimpleToken (HMAC), never checks AdminSession, no role field validation.

---

## Current getSessionFromCookie (lib/admin-rbac.ts)

```
getSessionFromCookie(request)
→ check Authorization: Bearer <token>
  → try verifyAccessToken (JWT) → return AdminSession
  → try verifySimpleToken (HMAC) → return AdminSession
→ check admin_token cookie
  → try verifySimpleToken → return AdminSession
→ return null
```

**Issues**: Similar to getAdminSession but returns different type.

---

## Current middleware.ts

Inline duplicated implementations:
- `verifyJwtSignature` — HMAC-SHA256 via Web Crypto
- `verifySimpleToken` — JWT (3-part) + HMAC (2-part) verification
- `getSession` — reads Bearer token or admin_token cookie

Protects:
- `/admin/*` pages → redirect to login if no session
- `/setup/*` → requires SUPER_ADMIN
- `/api/*` (non-mobile, non-admin, non-public) → 401 if no session

---

## Route Auth Classification

| Auth Method | Count | Routes |
|-------------|-------|--------|
| `getAdminSession` | 16 | analytics, wishlist, jobs, admins, disputes, commission, settings, kyc, cheating, staff/activity, security/*, financial/* |
| `getSession` | 2 | auth/me, users |
| `verifyAccessToken` directly | 1 | 2fa/setup |
| Public | 3 | auth/login, auth/logout, auth/refresh (reads cookie) |
| **Total admin API routes** | **22** | |

---

## Frontend Auth

| File | Purpose |
|------|---------|
| `lib/admin-api.ts` | Axios client, stores access token in module scope, auto-refreshes on 401 |
| `components/admin/AdminSessionProvider.tsx` | Calls `/api/admin/auth/me`, redirects to login on failure |
| `app/admin/login/page.tsx` | Login form |

---

## Cookie Security (Current)

| Cookie | httpOnly | secure | sameSite | path | maxAge |
|--------|----------|--------|----------|------|--------|
| admin_token | true | true | lax | / | 7 days |
| refresh_token | true | production | strict | /api/admin/auth | 7 days |

**Issue**: refresh_token is set twice with different paths.

---

## Key Findings

1. `createSimpleToken` — EXPORTED, NEVER USED — zero callers
2. `AdminRefreshToken` model — UNUSED — superseded by AdminSession
3. `getSession` — uses only HMAC verification, never checks AdminSession
4. `getAdminSession` — checks AdminSession but only for JWT path, not HMAC path
5. Access token TTL is 24h, not 30min
6. No token family tracking for replay detection
7. Refresh token is JWT, not opaque
8. Middleware has duplicated inline auth verification
9. 2FA has no disable route
10. `AdminSession` interface in admin-types.ts includes `role`, `firstName`, `lastName` — these should NOT be in the session type once we move to canonical auth
