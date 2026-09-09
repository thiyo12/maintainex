# 03D — Admin Route Migration

## Complete Route Audit

| Auth Method | Count | Routes |
|-------------|-------|--------|
| `getAdminSession` (canonical) | 16 | analytics, wishlist, jobs, admins, disputes, commission, commission/payments, settings, kyc, cheating, staff/activity, security/failed-logins, security/monitor, security/blocked-ips, financial/wallets, financial/commission |
| `getSession` (canonical) | 2 | auth/me, users |
| `verifyAccessToken` directly | 1 | 2fa/setup (preserved — verifies canonical staff JWT) |
| Public | 3 | auth/login, auth/logout, auth/refresh |
| **Total admin API routes** | **22** | |

## Migration Status

| Route | Before | After | Status |
|-------|--------|-------|--------|
| `auth/login` | signAccessToken + signRefreshToken (JWT_REFRESH_SECRET) | createStaffSession + opaque refresh | MIGRATED |
| `auth/refresh` | verifyRefreshToken (JWT) → signAccessToken | rotateStaffRefreshToken (atomic) | MIGRATED |
| `auth/logout` | verifyRefreshToken → revoke AdminSession | parseStaffRefreshToken → verify → revoke | MIGRATED |
| `auth/me` | getSession (HMAC only) | getSession (canonical staff JWT) | MIGRATED |
| `auth/2fa/setup` | verifyAccessToken (JWT) | verifyAccessToken (canonical) | PRESERVED |
| `auth/2fa/verify` | signAccessToken + signRefreshToken (JWT_REFRESH_SECRET) | createStaffSession + opaque refresh | MIGRATED |
| `users` | getSession (HMAC only) | getSession (canonical staff JWT) | MIGRATED |
| 16 protected routes | getAdminSession (mixed JWT+HMAC) | getAdminSession (canonical staff JWT) | MIGRATED |
| Middleware | Inline HMAC verification | Inline canonical JWT verification | MIGRATED |

## Frontend Client

| File | Change |
|------|--------|
| `lib/admin-api.ts` | No changes needed — auto-refresh interceptor handles 401 → refresh → retry |
| `components/admin/AdminSessionProvider.tsx` | No changes needed — calls /api/admin/auth/me |

## Cookie Changes

| Cookie | Before | After |
|--------|--------|-------|
| admin_token maxAge | 7 days | 30 minutes |
| refresh_token maxAge | 7 days | 7 days |
| refresh_token format | JWT | Opaque string |

**Note**: The admin_token cookie now expires in 30 minutes (matching access token TTL). The frontend auto-refresh interceptor handles this transparently.
