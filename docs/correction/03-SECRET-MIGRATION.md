# 03 — Secret Migration Plan

**Date**: 2026-09-07
**Status**: STEP 4A FROZEN — ALL 9 CORRECTIONS APPLIED

---

## Current Secret Map

| Variable | Used By | Purpose |
|---|---|---|
| `NEXTAUTH_SECRET` | mobile-auth.ts, middleware.ts | Sign mobile JWT, admin legacy HMAC |
| `JWT_SECRET` | admin-jwt.ts, admin-auth.ts, middleware.ts | Sign admin access JWT, HMAC fallback |
| `JWT_REFRESH_SECRET` | admin-jwt.ts | Sign admin refresh JWT |
| `PASSWORD_PEPPER` | security/password.ts | SHA-256 pepper for password hashing |
| `CRON_SECRET` | cron routes | Machine auth for cron jobs |
| `INTERNAL_SYNC_SECRET` | middleware.ts, internal routes | Machine auth for internal sync |

## Target Secret Map (Canonical)

| Variable | Used By | Purpose |
|---|---|---|
| `MARKETPLACE_JWT_SECRET` | lib/auth/tokens.ts | Sign/verify marketplace access tokens |
| `STAFF_JWT_SECRET` | lib/auth/tokens.ts | Sign/verify staff access tokens |
| `PASSWORD_PEPPER` | lib/auth/password.ts | SHA-256 pepper for password hashing (if pepper migration proves safe) |
| `CRON_SECRET` | cron routes | Machine auth for cron jobs |
| `INTERNAL_SYNC_SECRET` | middleware.ts, internal routes | Machine auth for internal sync |

## Optional Config Variables

| Variable | Default | Purpose |
|---|---|---|
| `MARKETPLACE_ACCESS_TTL` | `15m` | Marketplace access token lifetime |
| `MARKETPLACE_REFRESH_TTL` | `30d` | Marketplace refresh token lifetime |
| `STAFF_ACCESS_TTL` | `30m` | Staff access token lifetime |
| `STAFF_REFRESH_TTL` | `7d` | Staff refresh token lifetime |

## Not Canonical

| Variable | Status | Reason |
|---|---|---|
| `STAFF_REFRESH_SECRET` | NOT REQUIRED | Refresh tokens are opaque random, not JWT — no signing secret needed |
| `JWT_REFRESH_SECRET` | LEGACY | May remain temporarily during migration, not required by target architecture |

## Deprecated Variables (LEGACY — remove after migration)

| Variable | Current Use | Replacement | Status |
|---|---|---|---|
| `NEXTAUTH_SECRET` | Mobile JWT + admin legacy HMAC | `MARKETPLACE_JWT_SECRET` + `STAFF_JWT_SECRET` | LEGACY — compatibility only |
| `JWT_SECRET` | Admin new JWT | `STAFF_JWT_SECRET` | LEGACY — compatibility only |
| `JWT_REFRESH_SECRET` | Admin refresh JWT | Removed (opaque refresh needs no JWT secret) | LEGACY — compatibility only |

---

## Migration Steps

### Step 1: Add New Variables (No Breaking Change)

Add to `.env`:
```
MARKETPLACE_JWT_SECRET=<same value as NEXTAUTH_SECRET>
STAFF_JWT_SECRET=<same value as JWT_SECRET>
```

**Effect**: New code can use new variable names. Old code still works with old names. Zero downtime.

### Step 2: Deploy Code Using New Variables

Update `lib/auth/tokens.ts` to read:
```typescript
function getMarketplaceSecret(): string {
  return process.env.MARKETPLACE_JWT_SECRET || process.env.NEXTAUTH_SECRET!
}
function getStaffSecret(): string {
  return process.env.STAFF_JWT_SECRET || process.env.JWT_SECRET!
}
```

**Effect**: New auth module uses new variables with fallback to old. Old modules unchanged.

### Step 3: Remove Fallbacks

After all routes migrated and 7-day window elapsed, remove fallback:
```typescript
function getMarketplaceSecret(): string {
  const secret = process.env.MARKETPLACE_JWT_SECRET
  if (!secret) throw new Error('MARKETPLACE_JWT_SECRET required')
  return secret
}
```

### Step 4: Rotate Secrets (Optional, Recommended)

Generate new random values for `MARKETPLACE_JWT_SECRET` and `STAFF_JWT_SECRET`. This invalidates ALL existing tokens simultaneously — force re-login for all users.

**When to rotate**: Only if compromise suspected, or as part of regular security hygiene (quarterly).

### Step 5: Remove Deprecated Variables

Remove `NEXTAUTH_SECRET`, `JWT_SECRET`, `JWT_REFRESH_SECRET` from `.env` and `.env.example`.

---

## Secret Generation Guidelines

| Secret | Minimum Length | Generation Command |
|---|---|---|
| `MARKETPLACE_JWT_SECRET` | 32 bytes | `openssl rand -base64 32` |
| `STAFF_JWT_SECRET` | 32 bytes | `openssl rand -base64 32` |
| `PASSWORD_PEPPER` | 32 bytes | `openssl rand -hex 32` |
| `CRON_SECRET` | 32 bytes | `openssl rand -base64 32` |
| `INTERNAL_SYNC_SECRET` | 32 bytes | `openssl rand -base64 32` |

**Note**: `STAFF_REFRESH_SECRET` is NOT generated. Refresh tokens are opaque random credentials that do NOT require JWT signing secrets.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Wrong secret selected | LOW | Fallback chain during migration |
| Secret rotation logs out all users | MEDIUM | Rotate only when necessary |
| Secret leak in logs | LOW | Never log secret values |
| Stale env var in deployment | LOW | Validate env vars at startup |
| PASSWORD_PEPPER introduced unsafely | MEDIUM | Only introduce if password-security audit proves beneficial |

---

PHASE 3 SECRET MIGRATION FROZEN — ALL 9 CORRECTIONS APPLIED
