# 03E — Final Auth Inventory

## Classification Legend

| Category | Meaning |
|----------|---------|
| CANONICAL_MARKETPLACE | Active marketplace auth — uses MARKETPLACE_JWT_SECRET |
| CANONICAL_STAFF | Active staff auth — uses STAFF_JWT_SECRET |
| MACHINE_AUTH | Machine-to-machine — uses CRON_SECRET or INTERNAL_SYNC_SECRET |
| TEMPORARY_COMPATIBILITY | Bounded legacy compat — has explicit cutoff |
| DEAD | Zero callers — safe to remove |
| PUBLIC | No auth required |

## Auth Files

| File | Classification | Callers | Status |
|------|---------------|---------|--------|
| `lib/auth/marketplace-jwt.ts` | CANONICAL_MARKETPLACE | lib/mobile-auth.ts, lib/auth/marketplace-session.ts, tests | ACTIVE |
| `lib/auth/marketplace-session.ts` | CANONICAL_MARKETPLACE | app/api/mobile/auth/* | ACTIVE |
| `lib/auth/rotation.ts` | CANONICAL_MARKETPLACE | lib/auth/marketplace-session.ts, lib/auth/refresh.ts | ACTIVE |
| `lib/auth/sessions.ts` | CANONICAL_MARKETPLACE | lib/auth/marketplace-session.ts, lib/auth/refresh.ts | ACTIVE |
| `lib/auth/refresh.ts` | CANONICAL_MARKETPLACE | app/api/mobile/auth/refresh/route.ts | ACTIVE |
| `lib/auth/staff-jwt.ts` | CANONICAL_STAFF | lib/admin-auth.ts, lib/auth-utils.ts, middleware.ts, app/api/admin/auth/*, tests | ACTIVE |
| `lib/auth/staff-rotation.ts` | CANONICAL_STAFF | lib/auth/staff-sessions.ts, app/api/admin/auth/refresh/route.ts | ACTIVE |
| `lib/auth/staff-sessions.ts` | CANONICAL_STAFF | lib/admin-auth.ts, lib/auth-utils.ts, app/api/admin/auth/login|route.ts | ACTIVE |
| `lib/auth/types.ts` | CANONICAL | Multiple auth files | ACTIVE |
| `lib/auth/constants.ts` | CANONICAL | Multiple auth files | ACTIVE |
| `lib/auth/errors.ts` | CANONICAL | Multiple auth files | ACTIVE |
| `lib/mobile-auth.ts` | CANONICAL_MARKETPLACE + TEMPORARY_COMPATIBILITY | 76 mobile API routes | ACTIVE |
| `lib/admin-auth.ts` | CANONICAL_STAFF | 16 admin API routes | ACTIVE |
| `lib/auth-utils.ts` | CANONICAL_STAFF | 48+ admin web API routes | ACTIVE |
| `lib/admin-rbac.ts` | CANONICAL_STAFF | 4 admin API routes (createAuditLog, getIp) | ACTIVE |
| `lib/admin-2fa.ts` | CANONICAL_STAFF | app/api/admin/auth/2fa/* | ACTIVE |
| `middleware.ts` | CANONICAL_STAFF | Edge middleware for /admin/* routes | ACTIVE |
| `lib/admin-jwt.ts` | DEAD | 0 callers | REMOVED |
| `lib/admin-audit.ts` | CANONICAL_STAFF | admin routes via createAuditLog | ACTIVE |

## Dead Code Removed in 3E

| Symbol | File | Callers Before | Callers After | Action |
|--------|------|---------------|---------------|--------|
| `signAccessToken` | lib/admin-jwt.ts | 0 | 0 | DELETED (file removed) |
| `verifyAccessToken` | lib/admin-jwt.ts | 1 (2fa/setup) | 0 | MIGRATED to staff-jwt.ts |
| `signRefreshToken` | lib/admin-jwt.ts | 0 | 0 | DELETED |
| `verifyRefreshToken` | lib/admin-jwt.ts | 0 | 0 | DELETED |
| `generateRefreshTokenValue` | lib/admin-jwt.ts | 0 | 0 | DELETED |
| `hashRefreshToken` | lib/admin-jwt.ts | 0 | 0 | DELETED |
| `getSessionFromCookie` (sync) | lib/admin-rbac.ts | 0 | 0 | REMOVED |
| `getSessionFromCookieAsync` | lib/admin-rbac.ts | 0 | 0 | REMOVED |
| `adminAuthorize` | lib/admin-rbac.ts | 0 | 0 | REMOVED |
| `getCountryFilter` | lib/admin-rbac.ts | 0 | 0 | REMOVED |
| `parseCountries` | lib/admin-rbac.ts | 0 | 0 | REMOVED |
| `AdminRefreshToken` model | prisma/schema.prisma | 0 code refs | 0 | DROPPED |
| `verifySimpleToken` | nowhere | 0 | 0 | Never existed in code |
| `createSimpleToken` | nowhere | 0 | 0 | Never existed in code |

## Runtime Auth References

| Symbol | Import Sites | Status |
|--------|-------------|--------|
| `authenticateRequest` | 76 mobile routes | CANONICAL_MARKETPLACE |
| `getAdminSession` | 16 admin routes | CANONICAL_STAFF |
| `getSession` | 48+ web admin routes | CANONICAL_STAFF |
| `verifyStaffAccessToken` | lib/admin-auth.ts, lib/auth-utils.ts, middleware.ts | CANONICAL_STAFF |
| `verifyMarketplaceAccessToken` | lib/mobile-auth.ts | CANONICAL_MARKETPLACE |
| `createStaffSession` | app/api/admin/auth/login, 2fa/verify | CANONICAL_STAFF |
| `rotateStaffRefreshToken` | app/api/admin/auth/refresh | CANONICAL_STAFF |
| `createMarketplaceAuthSession` | app/api/mobile/auth/login, register | CANONICAL_MARKETPLACE |
| `rotateRefreshToken` | app/api/mobile/auth/refresh | CANONICAL_MARKETPLACE |

## Secret Runtime References

| Variable | Files | Status |
|----------|-------|--------|
| MARKETPLACE_JWT_SECRET | lib/auth/marketplace-jwt.ts | CANONICAL |
| STAFF_JWT_SECRET | lib/auth/staff-jwt.ts, middleware.ts, app/api/admin/auth/login, 2fa/verify | CANONICAL |
| NEXTAUTH_SECRET | lib/mobile-auth.ts | TEMPORARY_COMPATIBILITY (legacy mobile only) |
| JWT_SECRET | nowhere | DEAD — zero callers |
| JWT_REFRESH_SECRET | nowhere | DEAD — zero callers |
| CRON_SECRET | app/api/cron/* | MACHINE_AUTH |
| INTERNAL_SYNC_SECRET | middleware.ts (IP blocklist sync), app/api/internal/* | MACHINE_AUTH |
| LEGACY_MOBILE_AUTH_CUTOFF | lib/mobile-auth.ts | TEMPORARY_COMPATIBILITY |
