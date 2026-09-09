# 03 — Legacy Auth Removal Status

## Removed Components

| Component | Old Callers | Current Callers | Data Dependency | Status |
|-----------|-------------|-----------------|-----------------|--------|
| `lib/admin-jwt.ts` (entire file) | 1 (2fa/setup) | 0 | None | REMOVED |
| `signAccessToken()` | 0 | 0 | None | REMOVED (in deleted file) |
| `verifyAccessToken()` | 1 (2fa/setup) | 0 | None | REMOVED (migrated to staff-jwt.ts) |
| `signRefreshToken()` | 0 | 0 | None | REMOVED |
| `verifyRefreshToken()` | 0 | 0 | None | REMOVED |
| `generateRefreshTokenValue()` | 0 | 0 | None | REMOVED |
| `hashRefreshToken()` | 0 | 0 | None | REMOVED |
| `createToken()` | 0 | 0 | None | REMOVED |
| `getSessionFromCookie()` (sync) | 0 | 0 | None | REMOVED |
| `getSessionFromCookieAsync()` | 0 | 0 | None | REMOVED |
| `adminAuthorize()` | 0 | 0 | None | REMOVED |
| `getCountryFilter()` | 0 | 0 | None | REMOVED |
| `parseCountries()` (dead helper) | 0 | 0 | None | REMOVED |
| `AdminRefreshToken` model | 0 code refs | 0 | 0 rows (verified) | DROPPED |
| `verifySimpleToken` | 0 | 0 | None | Never existed |
| `createSimpleToken` | 0 | 0 | None | Never existed |
| `JWT_SECRET` env var | 0 | 0 | None | Zero callers |
| `JWT_REFRESH_SECRET` env var | 0 | 0 | None | Zero callers |

## Retained Legacy Components

| Component | Current Callers | Purpose | Removal Condition |
|-----------|----------------|---------|-------------------|
| `verifyLegacyToken()` | 1 (tryLegacyAuth) | Verify pre-migration stateless JWTs | After LEGACY_MOBILE_AUTH_CUTOFF expires |
| `getLegacyJwtSecret()` | 1 (verifyLegacyToken) | Load NEXTAUTH_SECRET for legacy verification | After LEGACY_MOBILE_AUTH_CUTOFF expires |
| `NEXTAUTH_SECRET` env var | 1 (mobile-auth.ts) | Secret for legacy verification | After LEGACY_MOBILE_AUTH_CUTOFF expires |
| `LEGACY_MOBILE_AUTH_CUTOFF` env var | 1 (mobile-auth.ts) | Cutoff date for legacy compat | Permanent config until removal |

## Canonical Auth Callers

| Symbol | Callers | Status |
|--------|---------|--------|
| `authenticateRequest` | 76 mobile routes | CANONICAL |
| `getAdminSession` | 16 admin routes | CANONICAL |
| `getSession` | 48+ web admin routes | CANONICAL |
| `signMarketplaceAccessToken` | 1 (marketplace-jwt.ts) | CANONICAL |
| `verifyMarketplaceAccessToken` | 2 (mobile-auth.ts, logout route) | CANONICAL |
| `signStaffAccessToken` | 2 (staff-jwt.ts, login route) | CANONICAL |
| `verifyStaffAccessToken` | 3 (admin-auth.ts, auth-utils.ts, middleware.ts) | CANONICAL |
| `createMarketplaceAuthSession` | 4 (mobile login/register routes) | CANONICAL |
| `createStaffSession` | 2 (admin login, 2fa/verify) | CANONICAL |
| `rotateRefreshToken` | 1 (mobile refresh route) | CANONICAL |
| `rotateStaffRefreshToken` | 1 (admin refresh route) | CANONICAL |
