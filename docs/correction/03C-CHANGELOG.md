# 03C — Changelog

**Date**: 2026-09-07

---

## New Files

| File | Purpose |
|---|---|
| `lib/auth/marketplace-session.ts` | `createMarketplaceAuthSession()` + `buildAuthResponse()` |
| `app/api/mobile/auth/logout/route.ts` | Server-side logout endpoint |
| `docs/correction/03C-PRECHANGE.md` | Pre-change review |
| `docs/correction/03C-MARKETPLACE-AUTH.md` | Migration overview |
| `docs/correction/03C-MOBILE-ROUTE-MIGRATION.md` | 75-route audit |
| `docs/correction/03C-LEGACY-COMPATIBILITY.md` | Legacy compat window |
| `docs/correction/03C-MOBILE-TOKEN-STORAGE.md` | SecureStore architecture |
| `docs/correction/03C-TEST-RESULTS.md` | Test report |
| `docs/correction/03C-CHANGELOG.md` | This file |

## Modified Files

| File | Change |
|---|---|
| `lib/mobile-auth.ts` | Rewritten — `authenticateRequest()` with canonical + legacy compat |
| `app/api/mobile/auth/login/route.ts` | Uses `createMarketplaceAuthSession()` |
| `app/api/mobile/auth/otp-login/route.ts` | Uses `createMarketplaceAuthSession()` |
| `app/api/mobile/auth/verify-otp/route.ts` | Uses `createMarketplaceAuthSession()` |
| `app/api/mobile/auth/reset-password/route.ts` | Uses `createMarketplaceAuthSession()` + revokes all sessions |
| `apps/mobile/lib/api.ts` | Added refresh token storage + single-flight refresh + logout API |
| `apps/mobile/lib/auth.tsx` | Updated for new token format + refresh + logout + clearAuth |

## Behavior Changes

| Before | After |
|---|---|
| Login returns `{ token, user }` | Login returns `{ accessToken, refreshToken, accessExpiresIn, sessionExpiresAt, user }` |
| Single 30-day JWT | 15-min access JWT + 30-day refresh token |
| No refresh mechanism | Single-flight refresh on 401 |
| Logout = clear local storage | Logout = revoke server session + clear local storage |
| Password reset = new token | Password reset = revoke ALL sessions + new token |
| `authenticateRequest()` = legacy JWT only | `authenticateRequest()` = canonical JWT + legacy compat |
