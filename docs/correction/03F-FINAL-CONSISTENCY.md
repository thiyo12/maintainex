# 03F — Final Consistency Closure

## Legacy Marketplace Issuance Audit

### `createToken()` — REMOVED

- **Definition**: `lib/mobile-auth.ts:22` — signed with `NEXTAUTH_SECRET`, 30d expiry
- **Runtime callers**: ZERO (confirmed by repo-wide search)
- **Status**: DEAD CODE — removed in Phase 3F
- **Impact**: No reachable login/register/OTP/mobile flow can issue new legacy stateless JWT

### `verifyLegacyToken()` — TEMPORARY_COMPATIBILITY

- **Definition**: `lib/mobile-auth.ts:31` — verifies with `NEXTAUTH_SECRET`
- **Runtime callers**: 1 (`tryLegacyAuth()` in same file, line 135)
- **Behavior**: Bounded by `LEGACY_MOBILE_AUTH_CUTOFF`
  - Missing cutoff → reject
  - Invalid cutoff → reject
  - Current time >= cutoff → reject
  - Current time < cutoff → verify + enforce current User status
- **Status**: TEMPORARY_COMPATIBILITY — VERIFICATION ONLY
- **Removal condition**: After cutoff permanently expires

## Registration Flow Verification

All registration flows use canonical session-backed issuance:

| Flow | Issuance Function | Token Type | Status |
|------|-------------------|------------|--------|
| Phone OTP login | `createMarketplaceAuthSession()` | UserSession + access JWT + refresh | CANONICAL |
| Email/password login | `createMarketplaceAuthSession()` | UserSession + access JWT + refresh | CANONICAL |
| Phone registration | `createMarketplaceAuthSession()` | UserSession + access JWT + refresh | CANONICAL |
| Company registration | `createMarketplaceAuthSession()` | UserSession + access JWT + refresh | CANONICAL |
| Provider registration | `createMarketplaceAuthSession()` | UserSession + access JWT + refresh | CANONICAL |
| OTP verification (phone) | `createMarketplaceAuthSession()` | UserSession + access JWT + refresh | CANONICAL |
| Email verification | No auth issuance | Verification only | CANONICAL |
| Password reset | Revoke ALL sessions | No tokens returned | CANONICAL |

**Zero registration flows issue legacy stateless JWT.**

## `NEXTAUTH_SECRET` Current Purpose

- Used by `verifyLegacyToken()` in `lib/mobile-auth.ts` — TEMPORARY_COMPATIBILITY
- Used by `getLegacyJwtSecret()` — private helper for legacy verification only
- **NOT used by any canonical auth code**
- **NOT used by any token issuance code**
- Retained temporarily for bounded legacy mobile compatibility cutoff

## `JWT_SECRET` and `JWT_REFRESH_SECRET`

- **Zero runtime callers** — confirmed by repo-wide search
- Previously used by deleted `lib/admin-jwt.ts`
- Safe to remove from deployment configuration
- No code references remain

## Legacy Staff Status

| Metric | Count |
|--------|-------|
| Legacy HMAC issuance | ZERO callers |
| Legacy HMAC acceptance | ZERO callers |
| Legacy staff JWT issuance | ZERO callers |
| Legacy staff JWT acceptance | ZERO callers |
| Dead code removed | `lib/admin-jwt.ts` (entire file), `adminAuthorize`, `getSessionFromCookie`, `getSessionFromCookieAsync`, `getCountryFilter` |

## Phase 3 Auth Risk Status

| # | Risk | State |
|---|------|-------|
| 46 | Mobile JWT no revocation | RESOLVED |
| 47 | Middleware duplicate JWT verifier | RESOLVED |
| 48 | NEXTAUTH_SECRET shared | RESOLVED (temporary compat only) |
| 49 | verifySimpleToken dual-format | RESOLVED |
| 50 | Dead auth code | RESOLVED |
| 51 | Auth-utils missing fields | RESOLVED |
| 23 | 3 admin auth mechanisms | RESOLVED |

## Validation

| Check | Status |
|-------|--------|
| npx prisma validate | PASS |
| npx prisma generate | PASS |
| npx tsc --noEmit | PASS |
| npx next lint | PASS |
| npm run build | PASS |
| Local unit tests | 48/48 PASS |
| VPS DB integration tests | 108/108 PASS |
