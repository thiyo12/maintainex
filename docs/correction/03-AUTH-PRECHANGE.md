# 03 — Auth Pre-Change Snapshot

**Date**: 2026-09-07
**Purpose**: Complete baseline of all authentication mechanisms before Phase 3 consolidation
**Status**: STEP 1 COMPLETE

---

## 1. Token Systems (3 Co-Existing)

### System A: Mobile JWT (`lib/mobile-auth.ts`)

| Property | Value |
|---|---|
| Token format | Standard HMAC-SHA256 JWT (3-part) |
| Secret | `NEXTAUTH_SECRET` |
| Expiry | 30 days (`TOKEN_MAX_AGE = '30d'`) |
| Signing | `jsonwebtoken` library |
| Verification | `jwt.verify()` → null on failure |
| Payload | `{ id, email, role, iat, exp }` |
| DB lookup | `prisma.user.findUnique({ id })` on every request |
| Revocation | NOT POSSIBLE (stateless) |
| Suspend check | `assertNotSuspended()` called by 38 route files |
| Callers | 79 files via `authenticateRequest()` |

**Function chain:**
```
authenticateRequest(request)
  → getTokenFromRequest(request)       // extract Bearer token
  → verifyToken(token)                 // jwt.verify(token, NEXTAUTH_SECRET)
  → prisma.user.findUnique({ id })     // DB lookup + isActive check
  → return { id, email, name, phone, role, isActive, identityStatus, ... }
```

### System B: Admin New JWT (`lib/admin-jwt.ts`)

| Property | Value |
|---|---|
| Access token format | Standard HMAC-SHA256 JWT (3-part) |
| Access secret | `JWT_SECRET` (fallback: `NEXTAUTH_SECRET`) |
| Access expiry | 24 hours |
| Access payload | `{ sub, email, role, firstName, lastName, assignedCountries, type:'access' }` |
| Refresh token format | HMAC-SHA256 JWT |
| Refresh secret | `JWT_REFRESH_SECRET` (required) |
| Refresh expiry | 7 days (JWT) + 7 days (DB) |
| Refresh storage | `AdminSession` table (hashed via SHA-256) |
| 2FA | TOTP via `otplib`, 5-min temp token for 2FA step |
| DB revocation | `AdminSession.isRevoked` flag |
| Callers | 4 route files (login, refresh, 2fa/verify, 2fa/setup) |

**Function chain:**
```
signAccessToken(user) → jwt.sign({sub, email, role, ...}, JWT_SECRET, {expiresIn:'24h'})
verifyAccessToken(token) → jwt.verify(token, JWT_SECRET) + type === 'access' check
signRefreshToken(adminUserId, jti) → jwt.sign({sub, jti, type:'refresh'}, JWT_REFRESH_SECRET, {expiresIn:'7d'})
verifyRefreshToken(token) → jwt.verify(token, JWT_REFRESH_SECRET) + type === 'refresh' check
generateRefreshTokenValue() → crypto.randomBytes(64).toString('hex')
hashRefreshToken(token) → sha256(token)
```

### System C: Admin Legacy HMAC (`lib/admin-auth.ts`)

| Property | Value |
|---|---|
| Token format | `{base64(payload)}.{hmac-hex}` |
| Secret | `NEXTAUTH_SECRET` (or `JWT_SECRET`) |
| Expiry | 30 days (`Date.now() - payload.created > maxAge`) |
| Signing | HMAC-SHA256 via `crypto` module |
| Verification | `crypto.timingSafeEqual` |
| Payload | `{ id, email, role, name, branchId, province, region, canEditServices, authType, created }` |
| DB tracking | None (stateless) |
| Revocation | NOT POSSIBLE (until expiry) |
| Callers | 17 files (web admin routes + `lib/auth-utils.ts` + `lib/admin-rbac.ts`) |

**Function chain:**
```
createSimpleToken(data) → payload = {...data, created: Date.now()}
  → encoded = base64(JSON(payload))
  → signature = HMAC-SHA256(secret, encoded).hex
  → Returns "{encoded}.{signature}"

verifySimpleToken(token) → parts = token.split('.')
  → parts.length === 3: JWT path (jwt.verify)
  → parts.length === 2: Legacy HMAC path (timingSafeEqual)
  → Check Date.now() - payload.created <= 30 days
  → Return payload
```

**IMPORTANT**: `verifySimpleToken` also accepts standard 3-part JWTs (lines 25-41 of admin-auth.ts). It acts as a dual-format verifier.

---

## 2. Middleware JWT Verifier (`middleware.ts`)

The middleware has its **own independent JWT verifier** using Web Crypto API:

```typescript
// middleware.ts:65-80
async function verifyJwtSignature(headerB64, payloadB64, signatureB64): Promise<boolean>
  → crypto.subtle.importKey('raw', getJwtSecret(), {name:'HMAC', hash:'SHA-256'})
  → crypto.subtle.verify('HMAC', key, signature, data)

// middleware.ts:82-114
async function verifySimpleToken(token): Promise<any>
  → 3-part: Web Crypto JWT verification
  → 2-part: Legacy HMAC verification
  → Extracts: id, email, role, name, branchId, province, region, canEditServices, authType
```

**This is SEPARATE from `lib/admin-auth.ts`** — duplicated logic, different crypto backend.

---

## 3. Shared Components

### Password Hashing (`lib/security/password.ts`)
- bcrypt with 14 rounds
- SHA-256 pepper prepended: `sha256(password + PASSWORD_PEPPER)`
- Migration function: auto-upgrades un-peppered hashes on login

### Session User Types

| Type | Source | Fields |
|---|---|---|
| `SessionUser` (auth-utils) | `lib/auth-utils.ts:4` | id, email, role, branchId?, province?, region?, name?, canEditServices? |
| `AuthenticatedUser` (mobile-auth) | `lib/mobile-auth.ts:39` | id, email, name, phone, role, isActive, identityStatus, lastNameChangedAt, isSuspended, isBanned, suspendedUntil, suspensionReason, banReason |
| `AdminSession` (admin-types) | `lib/admin-types.ts:102` | id, email, role, firstName, lastName, assignedCountries, authType |
| `AccessTokenPayload` (admin-jwt) | `lib/admin-jwt.ts:15` | sub, email, role, firstName, lastName, assignedCountries, type:'access' |

### Admin Roles
`SUPER_ADMIN | MANAGER | FINANCE | USER_MANAGEMENT | SUPPORT | TECHNICAL`

---

## 4. Call Graph (File → Auth Function)

### Mobile Auth (79 files)
All files under `app/api/mobile/` use:
```
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
const user = await authenticateRequest(request)
if (!user) return NextResponse.json({error:'Unauthorized'},{status:401})
const suspendError = assertNotSuspended(user)
if (suspendError) return suspendError
```

Key callers:
- `app/api/mobile/auth/login/route.ts` — createToken()
- `app/api/mobile/auth/otp-login/route.ts` — createToken()
- `app/api/mobile/auth/verify-otp/route.ts` — createToken()
- `app/api/mobile/auth/me/route.ts` — authenticateRequest()
- `app/api/mobile/auth/profile/route.ts` — authenticateRequest()
- `app/api/mobile/v2/jobs/[id]/route.ts` — authenticateRequest() (IDOR-protected)
- `app/api/mobile/v2/wallet/route.ts` — authenticateRequest()
- 68 more mobile routes...

### Admin New JWT (7 files)
```
app/api/admin/auth/login/route.ts     → signAccessToken(), signRefreshToken(), hashRefreshToken()
app/api/admin/auth/refresh/route.ts   → signAccessToken(), signRefreshToken(), hashRefreshToken()
app/api/admin/auth/2fa/verify/route.ts → signAccessToken(), signRefreshToken()
app/api/admin/auth/2fa/setup/route.ts → verifyAccessToken()
app/api/admin/auth/logout/route.ts    → AdminSession.isRevoked = true
lib/admin-rbac.ts                     → verifyAccessToken() in getSessionFromCookie()
lib/admin-auth.ts                     → verifyAccessToken() in getAdminSession()
```

### Admin Legacy HMAC (17 files)
All web admin API routes use:
```
import { getAdminSession } from '@/lib/admin-auth'
const session = await getAdminSession(request)
if (!session) return NextResponse.json({error:'Unauthorized'},{status:401})
```

Files: `app/api/admin/analytics/`, `app/api/admin/wishlist/`, `app/api/admin/jobs/`, `app/api/admin/staff/`, `app/api/admin/admins/`, `app/api/admin/disputes/`, `app/api/admin/security/`, `app/api/admin/financial/`, `app/api/admin/cheating/`, `app/api/admin/kyc/`, `app/api/admin/commission/`, `app/api/admin/settings/`

### Auth-Utils (50 files)
```
import { getSession } from '@/lib/auth-utils'
const session = await getSession(request)
```

Files: `app/api/vacancies/`, `app/api/reviews/`, `app/api/reports/`, `app/api/dashboard/`, `app/api/security/`, `app/api/districts/`, `app/api/upload/`, `app/api/invoices/`, `app/api/services/`, `app/api/industries/`, `app/api/categories/`, `app/api/applications/`, `app/api/bookings/`, `app/api/users/`, `app/api/settings/`, `app/api/customers/`, `app/api/properties/`, `app/api/flash-offers/`, `app/api/seasonal-offers/`, `app/api/seed/`

### Security Tokens (2 files)
```
app/api/auth/reset-password/route.ts
app/api/auth/forgot-password/route.ts
```

---

## 5. Middleware Auth Flow

```
middleware.ts runs on: /api/*, /admin/*, /setup/*

1. Skip if path matches _next, static files, login pages
2. Extract token from: Authorization header OR admin_token OR refresh_token cookies
3. verifySimpleToken(token) — inline Web Crypto implementation
4. If no valid session → redirect to /login (admin) or 401 (API)
5. CORS headers added
6. Rate limiting applied (in-memory per-IP)
```

---

## 6. Dead Code Identified

| Function | Defined In | Callers |
|---|---|---|
| `createSimpleToken()` | `lib/admin-auth.ts:57` | **ZERO** — never called |
| `adminAuthorize()` | `lib/admin-rbac.ts:49` | **ZERO** — never called |
| `getSessionFromCookie()` | `lib/admin-rbac.ts:7` | **ZERO** — never called |

---

## 7. Known Issues

| # | Issue | Severity | Phase 3 Target |
|---|---|---|---|
| 1 | Mobile JWT has NO revocation (30d stateless) | HIGH | Step 6 — session revocation |
| 2 | Middleware has duplicate JWT verifier (Web Crypto vs jsonwebtoken) | MEDIUM | Step 4 — canonical verifier |
| 3 | `NEXTAUTH_SECRET` shared across mobile JWT + admin legacy HMAC | HIGH | Step 5 — separate secrets |
| 4 | `verifySimpleToken()` accepts BOTH JWT and HMAC formats silently | MEDIUM | Step 4 — separate functions |
| 5 | `createSimpleToken()` is dead code | LOW | Step 9 — remove |
| 6 | `adminAuthorize()` is dead code | LOW | Step 9 — remove |
| 7 | `getSessionFromCookie()` is dead code | LOW | Step 9 — remove |
| 8 | `adminAuthorize` uses different role type than `AdminSession.role` | LOW | Step 9 — remove |
| 9 | In-memory rate limiting not distributed-safe | MEDIUM | Post-Phase 3 |
| 10 | `auth-utils.ts` `getSession()` only returns `SessionUser` — no suspend/ban check | MEDIUM | Step 4 — unify types |

---

## 8. Prisma Auth Models

| Model | Lines | Purpose |
|---|---|---|
| `Admin` | 58 | Original admin (legacy) |
| `AdminUser` | 1965 | New admin staff |
| `AdminSession` | 2057 | JWT refresh token storage + revocation |
| `AdminRefreshToken` | 2005 | Refresh token hashes |
| `AdminLoginAttempt` | 2042 | Login audit trail |
| `PasswordResetToken` | 887 | Password reset tokens |
| `User` | — | Customer/provider/company mobile users |

---

## 9. Acceptance Criteria for Phase 3

- [ ] ONE canonical token library (no duplicate verifiers)
- [ ] Mobile JWT revocable via DB session store
- [ ] Admin JWT 2FA + lockout preserved
- [ ] Session revocation instant (DB check on every request)
- [ ] RBAC enforced on every protected endpoint
- [ ] Zero callers to `createSimpleToken()`, `adminAuthorize()`, `getSessionFromCookie()`
- [ ] `verifySimpleToken()` removed from `lib/admin-auth.ts`
- [ ] Middleware uses canonical verifier (not inline duplicate)
- [ ] Dead auth files removed: `lib/admin-auth.ts`, `lib/admin-rbac.ts` (if fully replaced)
- [ ] All existing tests still pass
