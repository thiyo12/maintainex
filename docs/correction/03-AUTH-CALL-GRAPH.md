# 03 — Authentication Call Graph

**Date**: 2026-09-07
**Status**: STEP 2 COMPLETE — ALL FLOWS TRACED, DEAD CODE VERIFIED

---

## 1. SYSTEM DIAGRAM

### 1A. Mobile Auth Flow (Customer / Provider / Company)

```
┌─────────────────────────────────────────────────────────────────┐
│                     MOBILE AUTH SYSTEM                          │
│                     Token: JWT (3-part)                         │
│                     Secret: NEXTAUTH_SECRET                     │
│                     Expiry: 30 days                             │
│                     Revocation: NONE                            │
└─────────────────────────────────────────────────────────────────┘

LOGIN PATHS (all create same token):
  POST /api/mobile/auth/login         → email/phone + password → createToken()
  POST /api/mobile/auth/otp-login     → email/phone + OTP code → createToken()
  POST /api/mobile/auth/register      → creates user → OTP → verify-otp flow
  POST /api/mobile/auth/send-otp      → sends OTP email (no token)
  POST /api/mobile/auth/verify-otp    → OTP verify → createToken()
  POST /api/mobile/auth/reset-password → OTP verify → createToken()

TOKEN CREATION (lib/mobile-auth.ts:15):
  createToken({ id, email, role })
    → jwt.sign(data, NEXTAUTH_SECRET, { expiresIn: '30d' })

REQUEST AUTHENTICATION:
  Client sends: Authorization: Bearer <jwt>

  ┌─ middleware.ts (EDGE — rate limiting + CORS only)
  │   verifySimpleToken(token) using JWT_SECRET || NEXTAUTH_SECRET
  │   → Middleware does NOT distinguish mobile vs admin
  │   → Sets X-User-Id, X-User-Role headers if session valid
  │   → Returns 401 if no session (for protected API routes)
  │   → BUT: Mobile routes bypass this check (line 426-451)
  │
  └─ Route Handler (AUTHORITATIVE)
      authenticateRequest(request)
        → getTokenFromRequest(request)       // extract Bearer token
        → verifyToken(token)                 // jwt.verify(token, NEXTAUTH_SECRET)
        → prisma.user.findUnique({ id })     // DB lookup
        → returns { id, email, name, phone, role, isActive, ... }
        → assertNotSuspended(user)           // ban/suspend check
```

**CRITICAL**: Mobile routes at `/api/mobile/*` are NOT authenticated by middleware. They pass through with only rate limiting + CORS headers (middleware.ts:426-451). All authentication happens inside route handlers via `authenticateRequest()`.

### 1B. Admin New JWT Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN NEW JWT SYSTEM                        │
│                     Access Token: JWT (3-part)                  │
│                     Access Secret: JWT_SECRET                   │
│                     Access Expiry: 24 hours                     │
│                     Refresh Token: JWT (3-part)                 │
│                     Refresh Secret: JWT_REFRESH_SECRET          │
│                     Refresh Expiry: 7 days (JWT) + 7 days (DB) │
│                     DB Tracking: AdminSession table             │
│                     Revocation: YES (isRevoked flag)            │
│                     2FA: TOTP (otplib)                          │
└─────────────────────────────────────────────────────────────────┘

LOGIN PATH:
  POST /api/admin/auth/login
    → prisma.adminUser.findUnique({ email })
    → verifyPasswordWithMigration(password, hash)
    → Check 2FA:
      - If 2FA enabled: return { requires2fa: true, tempToken }
      - If no 2FA: signAccessToken() + signRefreshToken() + create AdminSession
    → Set cookies: admin_token (access), refresh_token (refresh)

2FA FLOW:
  POST /api/admin/auth/login (returns tempToken)
  POST /api/admin/auth/2fa/verify
    → jwt.verify(tempToken, JWT_SECRET) + purpose === '2fa_verify'
    → verifyTotp(totpCode, adminUser.totpSecret)
    → signAccessToken() + signRefreshToken() + create AdminSession

TOKEN CREATION (lib/admin-jwt.ts):
  signAccessToken(user):
    → jwt.sign({sub, email, role, firstName, lastName, assignedCountries, type:'access'}, JWT_SECRET, {expiresIn:'24h'})

  signRefreshToken(adminUserId, jti):
    → jwt.sign({sub, jti, type:'refresh'}, JWT_REFRESH_SECRET, {expiresIn:'7d'})

  generateRefreshTokenValue():
    → crypto.randomBytes(64).toString('hex')

  hashRefreshToken(token):
    → sha256(token)

REQUEST AUTHENTICATION:
  Client sends: Cookie: admin_token=<jwt>; refresh_token=<jwt>
  OR: Authorization: Bearer <jwt>

  ┌─ middleware.ts (EDGE — RBAC + route protection)
  │   getSession(request) → verifySimpleToken(token) using JWT_SECRET || NEXTAUTH_SECRET
  │   → Checks /admin/* routes require session + valid role
  │   → Sets X-Admin-Id, X-Admin-Role headers
  │   → Redirects to /admin/login if no session
  │
  └─ Route Handler (AUTHORITATIVE — session revocation check)
      getAdminSession(request)
        → Extract token from Bearer header OR admin_token cookie
        → verifyAccessToken(token)         // jwt.verify + type === 'access'
          → If JWT: check AdminSession.isRevoked via hasActiveSession()
        → verifySimpleToken(token)         // fallback to legacy HMAC
        → returns { id, email, role, firstName, lastName, assignedCountries }
```

### 1C. Admin Legacy HMAC Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN LEGACY HMAC SYSTEM                    │
│                     Token: {base64}.{hmac-hex}                  │
│                     Secret: NEXTAUTH_SECRET (or JWT_SECRET)     │
│                     Expiry: 30 days                             │
│                     DB Tracking: NONE                           │
│                     Revocation: NOT POSSIBLE                    │
└─────────────────────────────────────────────────────────────────┘

NOTE: createSimpleToken() is DEAD CODE — no callers exist.
      This system is vestigial. All tokens currently issued are JWT.
      The verifySimpleToken() function in admin-auth.ts still accepts
      this format as a fallback, but no new tokens are created in this format.

TOKEN CREATION: NONE (dead code)
  createSimpleToken(data) → base64(JSON({...data, created: Date.now()})) + HMAC signature

TOKEN VERIFICATION:
  verifySimpleToken(token) in lib/admin-auth.ts
    → parts.length === 3: JWT path (jwt.verify)
    → parts.length === 2: Legacy HMAC path (timingSafeEqual)
    → Check Date.now() - payload.created <= 30 days

CALLEES: 17 files (web admin routes) via getAdminSession()
  getAdminSession() → tries verifyAccessToken() first → falls back to verifySimpleToken()
```

### 1D. Middleware Auth Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     MIDDLEWARE (middleware.ts)                   │
│                     Matcher: /api/*, /admin/*, /setup/*          │
│                     Crypto: Web Crypto API (crypto.subtle)      │
│                     Secret: JWT_SECRET || NEXTAUTH_SECRET        │
│                     Purpose: Route protection + rate limiting    │
└─────────────────────────────────────────────────────────────────┘

INLINE VERIFIER (NOT imported from lib files):
  verifySimpleToken(token) — lines 82-114
    → 3-part: Web Crypto HMAC verification (crypto.subtle)
    → 2-part: Legacy HMAC verification
    → Extracts: id, email, role, name, branchId, province, region, canEditServices, authType

  getSession(request) — lines 116-150
    → Extract token from Bearer header OR admin_token cookie
    → Calls verifySimpleToken()
    → Returns session object

ROUTE GROUPS PROTECTED:
  /admin/* (except /admin/login, /admin/api/auth)
    → getSession() required
    → Role must be in [SUPER_ADMIN, MANAGER, FINANCE, USER_MANAGEMENT, SUPPORT, TECHNICAL]
    → Sets X-Admin-Id, X-Admin-Role headers

  /api/* (except mobile, cron, health, waitlist, bookings, vacancies, seed, etc.)
    → getSession() required
    → Sets X-User-Id, X-User-Role headers

  /api/mobile/* — NO AUTH CHECK (only rate limiting + CORS)
    → Passes through to route handlers

  /api/cron/* — NO AUTH CHECK (rate limiting only)
    → Passes through to route handlers (which check CRON_SECRET internally)

  /api/internal/* — NO AUTH CHECK (rate limiting only)
    → Passes through to route handlers (which check INTERNAL_SYNC_SECRET internally)

  /setup/* — NO AUTH CHECK (production guard only)
```

### 1E. Machine Authentication

```
┌─────────────────────────────────────────────────────────────────┐
│                     MACHINE AUTH: CRON_SECRET                   │
│                     Type: Bearer token                          │
│                     Secret: CRON_SECRET env var                 │
│                     Revocation: NONE (stateless)                │
└─────────────────────────────────────────────────────────────────┘

ROUTES:
  POST /api/cron/offer-timeouts       → Bearer CRON_SECRET
  POST /api/cron/matching-waves       → Bearer CRON_SECRET
  POST /api/cron/job-response-escalation → Bearer CRON_SECRET
  POST /api/cron/daily-maintenance    → Bearer CRON_SECRET
  POST /api/cron/pricing-train        → Bearer CRON_SECRET
  POST /api/cron/reputation           → Bearer CRON_SECRET
  POST /api/cron/learn                → Bearer CRON_SECRET
  POST /api/cron/escrow-release       → Bearer CRON_SECRET
  POST /api/cron/re-engagement        → Bearer CRON_SECRET

VERIFICATION: Direct string comparison
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return 401

┌─────────────────────────────────────────────────────────────────┐
│                     MACHINE AUTH: INTERNAL_SYNC_SECRET          │
│                     Type: Header value                          │
│                     Secret: INTERNAL_SYNC_SECRET env var        │
│                     Revocation: NONE (stateless)                │
└─────────────────────────────────────────────────────────────────┘

ROUTES:
  GET /api/internal/security/ip-blocklist → x-internal-sync header
  GET /api/internal/security/seed         → x-internal-sync header

VERIFICATION: Direct string comparison
  if (syncHeader !== getInternalSyncSecret()) return 403

CALLED BY: middleware.ts syncIPBlocklist() (line 162-186)
  → Fetches IP blocklist from /api/internal/security/ip-blocklist
  → Passes INTERNAL_SYNC_SECRET via x-internal-sync header
```

### 1F. Password Reset Flow (Token-based, not session)

```
┌─────────────────────────────────────────────────────────────────┐
│                     PASSWORD RESET TOKENS                       │
│                     Type: Random bytes (not JWT)                 │
│                     Storage: PasswordResetToken table            │
│                     Expiry: 1 hour                              │
│                     Single-use: Yes                             │
└─────────────────────────────────────────────────────────────────┘

FORGOT PASSWORD:
  POST /api/auth/forgot-password
    → createPasswordResetToken(userId)
    → Returns token (sent via email)

RESET PASSWORD:
  POST /api/auth/reset-password
    → verifyPasswordResetToken(token)
    → hashPassword(newPassword)
    → prisma.user.update({ passwordHash })
```

---

## 2. FUNCTION TABLE

| Function | File | Purpose | Token Type | Callers | Active? | Future State |
|---|---|---|---|---|---|---|
| `createToken` | lib/mobile-auth.ts:15 | Issue mobile JWT | JWT (NEXTAUTH_SECRET, 30d) | 4 callers | YES | CANONICAL (mobile) |
| `verifyToken` | lib/mobile-auth.ts:24 | Verify mobile JWT | JWT (NEXTAUTH_SECRET) | 1 caller (authenticateRequest) | YES | CANONICAL (mobile) |
| `getTokenFromRequest` | lib/mobile-auth.ts:33 | Extract Bearer token | — | 1 caller (authenticateRequest) | YES | CANONICAL (mobile) |
| `authenticateRequest` | lib/mobile-auth.ts:86 | Full mobile auth | JWT + DB lookup | 79+ route files | YES | CANONICAL (mobile) |
| `assertNotSuspended` | lib/mobile-auth.ts:55 | Ban/suspend guard | — | 38 route files | YES | CANONICAL (mobile) |
| `signAccessToken` | lib/admin-jwt.ts:31 | Issue admin access JWT | JWT (JWT_SECRET, 24h) | 3 callers | YES | CANONICAL (admin) |
| `verifyAccessToken` | lib/admin-jwt.ts:54 | Verify admin access JWT | JWT (JWT_SECRET) | 3 callers | YES | CANONICAL (admin) |
| `signRefreshToken` | lib/admin-jwt.ts:64 | Issue admin refresh JWT | JWT (JWT_REFRESH_SECRET, 7d) | 3 callers | YES | CANONICAL (admin) |
| `verifyRefreshToken` | lib/admin-jwt.ts:76 | Verify admin refresh JWT | JWT (JWT_REFRESH_SECRET) | 3 callers | YES | CANONICAL (admin) |
| `generateRefreshTokenValue` | lib/admin-jwt.ts:86 | Generate refresh token value | — | 3 callers | YES | CANONICAL (admin) |
| `hashRefreshToken` | lib/admin-jwt.ts:90 | SHA-256 hash for DB storage | — | 3 callers | YES | CANONICAL (admin) |
| `getAdminSession` | lib/admin-auth.ts:72 | Full admin auth (JWT + legacy fallback) | JWT or HMAC | 19 route files | YES | MIGRATE (merge into admin-jwt) |
| `verifySimpleToken` | lib/admin-auth.ts:21 | Verify JWT or legacy HMAC | JWT or HMAC | 4 callers | YES | RETIRE (replace with dedicated verifiers) |
| `hasActiveSession` | lib/admin-auth.ts:64 | Check AdminSession.isRevoked | — | 1 caller (getAdminSession) | YES | CANONICAL (admin) |
| `getSession` | lib/auth-utils.ts:15 | Web admin session via verifySimpleToken | JWT or HMAC | 80 route files | YES | MIGRATE (use getAdminSession) |
| `getSessionFromCookie` | lib/admin-rbac.ts:7 | Admin session from cookie/header | JWT or HMAC | **0 callers** | NO | RETIRE (dead code) |
| `adminAuthorize` | lib/admin-rbac.ts:49 | Role-based authorization | — | **0 callers** | NO | RETIRE (dead code) |
| `createSimpleToken` | lib/admin-auth.ts:57 | Create legacy HMAC token | HMAC | **0 callers** | NO | RETIRE (dead code) |
| `createAuditLog` | lib/admin-rbac.ts:67 | Log admin actions | — | 19 route files | YES | CANONICAL (admin) |
| `getIp` | lib/admin-rbac.ts:99 | Extract client IP | — | 19 route files | YES | CANONICAL (admin) |
| `verifySimpleToken` (middleware) | middleware.ts:82 | Edge verification | Web Crypto JWT or HMAC | middleware only | YES | RETIRE (use canonical verifier) |
| `getSession` (middleware) | middleware.ts:116 | Edge session extraction | Web Crypto JWT or HMAC | middleware only | YES | RETIRE (use canonical verifier) |
| `createPasswordResetToken` | lib/security/tokens.ts:15 | Password reset token | Random bytes | 1 caller | YES | CANONICAL (password reset) |
| `verifyPasswordResetToken` | lib/security/tokens.ts:30 | Verify password reset token | Random bytes | 1 caller | YES | CANONICAL (password reset) |
| `verifyTotp` | lib/admin-2fa.ts:17 | Verify TOTP 2FA code | — | 1 caller | YES | CANONICAL (admin 2FA) |
| `generateTotpSecret` | lib/admin-2fa.ts:9 | Generate TOTP secret | — | 1 caller | YES | CANONICAL (admin 2FA) |
| `generateTotpUri` | lib/admin-2fa.ts:13 | Generate TOTP URI | — | 1 caller | YES | CANONICAL (admin 2FA) |
| `verifyPasswordWithMigration` | lib/security/password.ts:21 | Verify password + auto-upgrade hash | — | 2 callers | YES | CANONICAL (shared) |
| `hashPassword` | lib/security/password.ts:11 | Hash password with pepper | — | 4 callers | YES | CANONICAL (shared) |

---

## 3. ROUTE CONSUMER MAP

### Mobile Routes (79 files) — Auth: `authenticateRequest()`

| Route Group | Files | Auth Function | Suspended Check |
|---|---|---|---|
| `/api/mobile/auth/*` | 9 files | createToken / authenticateRequest | Inline (login) |
| `/api/mobile/company/*` | 8 files | authenticateRequest | assertNotSuspended |
| `/api/mobile/taskers/*` | 8 files | authenticateRequest | assertNotSuspended |
| `/api/mobile/bookings/*` | 2 files | authenticateRequest | assertNotSuspended |
| `/api/mobile/quick-bookings/*` | 2 files | authenticateRequest | assertNotSuspended |
| `/api/mobile/conversations/*` | 3 files | authenticateRequest | assertNotSuspended |
| `/api/mobile/disputes/*` | 2 files | authenticateRequest | assertNotSuspended |
| `/api/mobile/jobs/*` | 3 files | authenticateRequest | assertNotSuspended |
| `/api/mobile/notifications/*` | 3 files | authenticateRequest | assertNotSuspended |
| `/api/mobile/earnings/*` | 1 file | authenticateRequest | None |
| `/api/mobile/find-tasker/*` | 2 files | authenticateRequest | None |
| `/api/mobile/search/*` | 1 file | authenticateRequest | None |
| `/api/mobile/upload/*` | 1 file | authenticateRequest | assertNotSuspended |
| `/api/mobile/files/*` | 1 file | authenticateRequest | None |
| `/api/mobile/v2/*` | 38 files | authenticateRequest | assertNotSuspended |

### Admin New JWT Routes (19 files) — Auth: `getAdminSession()`

| Route Group | Files | Auth Function | RBAC |
|---|---|---|---|
| `/api/admin/analytics/*` | 1 file | getAdminSession | Manual role check |
| `/api/admin/wishlist/*` | 1 file | getAdminSession | Manual role check |
| `/api/admin/jobs/*` | 1 file | getAdminSession | Manual role check |
| `/api/admin/staff/*` | 1 file | getAdminSession | Manual role check |
| `/api/admin/admins/*` | 1 file | getAdminSession | Manual role check |
| `/api/admin/disputes/*` | 1 file | getAdminSession | Manual role check |
| `/api/admin/security/*` | 4 files | getAdminSession | Manual role check |
| `/api/admin/financial/*` | 2 files | getAdminSession | Manual role check |
| `/api/admin/cheating/*` | 1 file | getAdminSession | Manual role check |
| `/api/admin/kyc/*` | 1 file | getAdminSession | Manual role check |
| `/api/admin/commission/*` | 2 files | getAdminSession | Manual role check |
| `/api/admin/settings/*` | 1 file | getAdminSession | Manual role check |

### Web Admin Routes (80 files) — Auth: `getSession()` from auth-utils

| Route Group | Files | Auth Function |
|---|---|---|
| `/api/vacancies/*` | 2 files | getSession |
| `/api/reviews/*` | 1 file | getSession |
| `/api/reports/*` | 2 files | getSession |
| `/api/dashboard/*` | 1 file | getSession |
| `/api/security/*` | 2 files | getSession |
| `/api/districts/*` | 1 file | getSession |
| `/api/upload/*` | 2 files | getSession |
| `/api/invoices/*` | 3 files | getSession |
| `/api/services/*` | 2 files | getSession |
| `/api/industries/*` | 4 files | getSession |
| `/api/categories/*` | 1 file | getSession |
| `/api/applications/*` | 2 files | getSession |
| `/api/bookings/*` | 3 files | getSession |
| `/api/users/*` | 1 file | getSession |
| `/api/settings/*` | 2 files | getSession |
| `/api/customers/*` | 5 files | getSession |
| `/api/properties/*` | 8 files | getSession |
| `/api/flash-offers/*` | 1 file | getSession |
| `/api/seasonal-offers/*` | 3 files | getSession |
| `/api/seed/*` | 2 files | getSession |
| `/api/admin/auth/me` | 1 file | getSession |

### Admin Auth Routes (5 files) — Auth: Self-authenticating

| Route | Auth Function | Notes |
|---|---|---|
| `/api/admin/auth/login` | verifyPasswordWithMigration | Issues tokens |
| `/api/admin/auth/logout` | verifyRefreshToken | Revokes session |
| `/api/admin/auth/refresh` | verifyRefreshToken + AdminSession lookup | Rotates tokens |
| `/api/admin/auth/2fa/verify` | jwt.verify (tempToken) | Issues tokens after 2FA |
| `/api/admin/auth/2fa/setup` | verifyAccessToken | Requires existing session |

### Cron Routes (9 files) — Auth: `CRON_SECRET`

| Route | Auth |
|---|---|
| `/api/cron/offer-timeouts` | Bearer CRON_SECRET |
| `/api/cron/matching-waves` | Bearer CRON_SECRET |
| `/api/cron/job-response-escalation` | Bearer CRON_SECRET |
| `/api/cron/daily-maintenance` | Bearer CRON_SECRET |
| `/api/cron/pricing-train` | Bearer CRON_SECRET |
| `/api/cron/reputation` | Bearer CRON_SECRET |
| `/api/cron/learn` | Bearer CRON_SECRET |
| `/api/cron/escrow-release` | Bearer CRON_SECRET |
| `/api/cron/re-engagement` | Bearer CRON_SECRET |

### Internal Routes (2 files) — Auth: `INTERNAL_SYNC_SECRET`

| Route | Auth |
|---|---|
| `/api/internal/security/ip-blocklist` | x-internal-sync header |
| `/api/internal/security/seed` | x-internal-sync header |

### Password Reset Routes (2 files) — Auth: None (token-based)

| Route | Auth |
|---|---|
| `/api/auth/forgot-password` | None (sends email) |
| `/api/auth/reset-password` | PasswordResetToken verification |

---

## 4. TOKEN ISSUANCE MAP

### Mobile Access Tokens
| Issuer | File | Secret | Expiry | DB Record |
|---|---|---|---|---|
| `createToken()` | lib/mobile-auth.ts:15 | NEXTAUTH_SECRET | 30d | None |
| Called by: mobile/auth/login, otp-login, verify-otp, reset-password | | | | |

### Admin Access Tokens
| Issuer | File | Secret | Expiry | DB Record |
|---|---|---|---|---|
| `signAccessToken()` | lib/admin-jwt.ts:31 | JWT_SECRET | 24h | None (stateless) |
| Called by: admin/auth/login, admin/auth/refresh, admin/auth/2fa/verify | | | | |

### Admin Refresh Tokens
| Issuer | File | Secret | Expiry | DB Record |
|---|---|---|---|---|
| `signRefreshToken()` | lib/admin-jwt.ts:64 | JWT_REFRESH_SECRET | 7d | AdminSession.refreshTokenHash |
| Called by: admin/auth/login, admin/auth/refresh, admin/auth/2fa/verify | | | | |

### Legacy Admin Tokens
| Issuer | File | Secret | Expiry | DB Record |
|---|---|---|---|---|
| `createSimpleToken()` | lib/admin-auth.ts:57 | NEXTAUTH_SECRET | 30d | None |
| **CALLERS: 0 — DEAD CODE** | | | | |

### Temp 2FA Tokens
| Issuer | File | Secret | Expiry | DB Record |
|---|---|---|---|---|
| `jwt.sign()` inline | admin/auth/login:132 | JWT_SECRET | 5m | None |
| Called by: admin/auth/login (when 2FA enabled) | | | | |

### OTP Tokens
| Issuer | File | Storage | Expiry | DB Record |
|---|---|---|---|---|
| `prisma.oTP.create()` | mobile/auth/otp-login:80, register:75, send-otp:32 | bcrypt hash | 5m | OTP table |

### Password Reset Tokens
| Issuer | File | Storage | Expiry | DB Record |
|---|---|---|---|---|
| `createPasswordResetToken()` | lib/security/tokens.ts:15 | SHA-256 hash | 1h | PasswordResetToken table |

---

## 5. TOKEN VERIFICATION MAP

### Independent Verifiers (5 total)

| Verifier | File | Method | Crypto Backend | Accepts JWT? | Accepts HMAC? | DB Check? |
|---|---|---|---|---|---|---|
| `verifyToken()` | lib/mobile-auth.ts:24 | jwt.verify | jsonwebtoken | YES | NO | Via authenticateRequest |
| `verifyAccessToken()` | lib/admin-jwt.ts:54 | jwt.verify + type check | jsonwebtoken | YES | NO | Via hasActiveSession |
| `verifyRefreshToken()` | lib/admin-jwt.ts:76 | jwt.verify + type check | jsonwebtoken | YES | NO | Via refresh route |
| `verifySimpleToken()` | lib/admin-auth.ts:21 | jwt.verify OR timingSafeEqual | jsonwebtoken + crypto | YES | YES | Via getAdminSession |
| `verifySimpleToken()` (middleware) | middleware.ts:82 | Web Crypto HMAC | crypto.subtle | YES | YES | NO (edge only) |

### Verification Chain by Request Type

**Mobile API request:**
```
middleware.ts:verifySimpleToken() → [EDGE, not authoritative]
  ↓ (mobile routes bypass middleware auth)
route handler:authenticateRequest() → verifyToken() → [AUTHORITATIVE]
  ↓
prisma.user.findUnique() → [DB LOOKUP]
  ↓
assertNotSuspended() → [SUSPEND CHECK]
```

**Admin API request (new JWT):**
```
middleware.ts:verifySimpleToken() → [EDGE, route protection]
  ↓
route handler:getAdminSession() → verifyAccessToken() → [AUTHORITATIVE]
  ↓
hasActiveSession() → prisma.adminSession.findFirst() → [DB + REVOCATION CHECK]
```

**Admin API request (legacy path):**
```
middleware.ts:verifySimpleToken() → [EDGE, route protection]
  ↓
route handler:getAdminSession() → verifyAccessToken() fails → verifySimpleToken() → [FALLBACK]
  ↓ (no DB check for legacy tokens)
```

**Web admin route (auth-utils):**
```
middleware.ts:verifySimpleToken() → [EDGE, route protection]
  ↓
route handler:getSession() → verifySimpleToken() → [AUTHORITATIVE]
  ↓ (no DB check — stateless verification only)
```

---

## 6. SESSION MAP

| System | Type | DB Backed? | Revocable? | Revocation Method |
|---|---|---|---|---|
| Mobile JWT | Stateless | NO | NO | N/A |
| Admin New JWT | DB session | YES (AdminSession) | YES | `isRevoked = true` |
| Admin Legacy HMAC | Stateless | NO | NO | N/A |
| Password Reset Token | DB token | YES (PasswordResetToken) | YES (single-use) | `usedAt` timestamp |
| OTP | DB token | YES (OTP) | YES (single-use + expiry) | `isUsed = true` |
| Temp 2FA Token | Stateless | NO | NO (5m expiry) | N/A |
| Cron Auth | Stateless | NO | NO | N/A |
| Internal Sync | Stateless | NO | NO | N/A |

---

## 7. STORAGE MAP

| System | Client Storage | Cookie Name | Header | Secure? | HttpOnly? | SameSite? |
|---|---|---|---|---|---|---|
| Mobile JWT | expo-secure-store (key: `auth_token`) | — | Authorization: Bearer | N/A (native) | N/A | N/A |
| Admin Access JWT | Memory (lib/admin-api.ts + Zustand) | `admin_token` | Authorization: Bearer | YES | YES | lax |
| Admin Refresh JWT | — | `refresh_token` | — | conditional | YES | strict |
| Web Admin Legacy | Cookie | `admin_token` | Authorization: Bearer | YES | YES | lax |
| Temp 2FA Token | Response body | — | — | N/A | N/A | N/A |
| Password Reset | Email link | — | — | N/A | N/A | N/A |
| OTP | Email | — | — | N/A | N/A | N/A |

---

## 8. MIGRATION DEPENDENCY ORDER

### Phase 3 Step 4-9: Recommended Migration Sequence

```
STEP 4: Choose canonical token architecture
  └─ Split verifySimpleToken() into dedicated JWT + HMAC verifiers
  └─ Create unified SessionUser type with all fields

STEP 5: Separate secrets
  └─ Mobile: NEXTAUTH_SECRET (keep)
  └─ Admin access: JWT_SECRET (keep)
  └─ Admin refresh: JWT_REFRESH_SECRET (keep)
  └─ Remove NEXTAUTH_SECRET fallback from admin paths

STEP 6: Add session revocation for mobile
  └─ Create MobileSession table (userId, tokenHash, expiresAt, isRevoked)
  └─ Modify createToken() to store session record
  └─ Modify authenticateRequest() to check isRevoked
  └─ Add logout route for mobile (DELETE MobileSession)

STEP 7: Migrate getSession() callers to getAdminSession()
  └─ 80 files currently use getSession() from auth-utils
  └─ These use verifySimpleToken() which has no DB revocation check
  └─ Migrate to getAdminSession() for consistency

STEP 8: Remove dead code
  └─ createSimpleToken() — 0 callers
  └─ adminAuthorize() — 0 callers
  └─ getSessionFromCookie() — 0 callers

STEP 9: Unify middleware verifier
  └─ Replace inline Web Crypto verifier with canonical library function
  └─ Ensure middleware and route handlers use same verification logic

DEPENDENCY GRAPH:
  Step 4 ← Step 5 ← Step 6 ← Step 7 ← Step 8 ← Step 9
  (Steps 4-5 are prerequisites for Step 6)
  (Steps 6-7 can be done in parallel after Step 5)
  (Steps 8-9 can be done after Step 7)
```

### Risk Assessment

| Step | Risk | Mitigation |
|---|---|---|
| Step 4 | Breaking verifySimpleToken callers | Keep same function signature, split internals |
| Step 5 | Wrong secret selected | Test all paths with each secret independently |
| Step 6 | Mobile users logged out | New sessions use new system, existing JWTs still valid until expiry |
| Step 7 | Web admin routes break | Test each route group after migration |
| Step 8 | Dead code referenced somewhere | Confirmed 0 callers via exact symbol search |
| Step 9 | Middleware auth behavior changes | Test edge cases: CORS, rate limiting, redirects |

---

## 9. DEAD FUNCTION VERIFICATION

### Exact Symbol Search Results

| Function | Defined At | Symbol Matches | Callers | Verified Dead? |
|---|---|---|---|---|
| `createSimpleToken` | lib/admin-auth.ts:57 | 1 (definition only) | 0 | **YES** |
| `adminAuthorize` | lib/admin-rbac.ts:49 | 1 (definition only) | 0 | **YES** |
| `getSessionFromCookie` | lib/admin-rbac.ts:7 | 1 (definition only) | 0 | **YES** |

### Verification Methods Used
1. ✅ Repository-wide exact symbol search (`createSimpleToken`, `adminAuthorize`, `getSessionFromCookie`)
2. ✅ Dynamic/import alias search (no dynamic imports found)
3. ✅ Re-export search (no re-exports found)
4. ✅ Route usage search (no route files import these)
5. ✅ Scripts/tests usage search (no test files reference these)
6. ✅ Cross-file type search (no `.js`, `.tsx`, `.jsx` references)

### Safe to Remove
All three functions are confirmed dead code with zero active callers.

---

## 10. VALIDATION CHECKLIST

- [x] Every auth-related file from Step 1 is represented
- [x] Every login route is represented (mobile: 5, admin: 1, password reset: 2)
- [x] Every token issuer is represented (createToken, signAccessToken, signRefreshToken, createPasswordResetToken, inline jwt.sign for temp 2FA)
- [x] Every token verifier is represented (5 independent verifiers documented)
- [x] Every session model is represented (AdminSession, OTP, PasswordResetToken)
- [x] All apparent dead functions have caller counts (3 functions, 0 callers each)
- [x] Machine auth separated from human auth (CRON_SECRET, INTERNAL_SYNC_SECRET)
- [x] Middleware behavior documented separately from route handlers
- [x] Migration dependency order specified
- [x] Risk assessment for each migration step

---

PHASE 3 STEP 2 COMPLETE — AUTH CALL GRAPH READY FOR REVIEW
