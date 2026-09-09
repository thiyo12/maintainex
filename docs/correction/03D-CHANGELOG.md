# 03D — Changelog

## Files Created

| File | Purpose |
|------|---------|
| `lib/auth/staff-jwt.ts` | Canonical staff JWT sign/verify (STAFF_JWT_SECRET) |
| `lib/auth/staff-rotation.ts` | Staff refresh token generation, parsing, verification, atomic rotation |
| `lib/auth/staff-sessions.ts` | Staff session CRUD, StaffPrincipal, authenticateStaffRequest |
| `tests/phase3/staff-jwt.test.ts` | Staff JWT + refresh token + session unit tests (23 tests) |
| `tests/phase3/staff-rotation.integration.test.ts` | Staff refresh rotation DB integration tests (9 tests) |
| `prisma/migrations/20260907000001_add_token_family_id_to_admin_session/migration.sql` | AdminSession.tokenFamilyId column |
| `docs/correction/03D-PRECHANGE.md` | Pre-change audit |
| `docs/correction/03D-STAFF-AUTH.md` | Staff auth architecture |
| `docs/correction/03D-ADMIN-ROUTE-MIGRATION.md` | Admin route migration |
| `docs/correction/03D-RBAC.md` | RBAC model |
| `docs/correction/03D-TEST-RESULTS.md` | Test results |

## Files Modified

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added `tokenFamilyId` to AdminSession |
| `lib/admin-auth.ts` | Rewritten — getAdminSession now uses canonical staff JWT + AdminSession lookup |
| `lib/auth-utils.ts` | Rewritten — getSession now uses canonical staff JWT + AdminSession lookup |
| `lib/admin-rbac.ts` | Updated getSessionFromCookie → canonical staff JWT |
| `app/api/admin/auth/login/route.ts` | Uses createStaffSession, STAFF_JWT_SECRET for tempToken |
| `app/api/admin/auth/refresh/route.ts` | Uses rotateStaffRefreshToken (atomic rotation) |
| `app/api/admin/auth/logout/route.ts` | Uses opaque refresh token parsing + verification |
| `app/api/admin/auth/2fa/verify/route.ts` | Uses createStaffSession, STAFF_JWT_SECRET for tempToken |
| `middleware.ts` | Rewritten — inline canonical JWT verification (STAFF_JWT_SECRET) |

## Behavior Changes

| Change | Impact |
|--------|--------|
| Access token TTL: 24h → 30min | Frontend auto-refresh handles transparently |
| Refresh token: JWT → Opaque | Cookie format changes, server-side only |
| HMAC tokens: rejected | All existing admin tokens invalidated, forced re-login |
| AdminSession.tokenFamilyId: added | New column with empty default, backward compatible |
| admin_token cookie maxAge: 7d → 30min | Matches access token TTL |

## DATABASE CHANGES

- AdminSession: Added `tokenFamilyId TEXT NOT NULL DEFAULT ''`
- AdminSession: Added index on `tokenFamilyId`
