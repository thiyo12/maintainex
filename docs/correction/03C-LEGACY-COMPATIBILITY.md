# 03C — Legacy Compatibility

**Date**: 2026-09-07

---

## Overview

Phase 3C introduces a bounded compatibility window for legacy mobile JWTs signed by `NEXTAUTH_SECRET`.

---

## Configuration

### `LEGACY_MOBILE_AUTH_CUTOFF`

Environment variable: `LEGACY_MOBILE_AUTH_CUTOFF`

Format: UTC ISO-8601 timestamp (e.g., `2026-09-14T00:00:00.000Z`)

### Behavior

| Configuration | Legacy Token Behavior |
|---|---|
| Not set | REJECTED immediately (safe default) |
| Past timestamp | REJECTED (cutoff already passed) |
| Future timestamp | ACCEPTED until cutoff, then REJECTED |
| Invalid format | REJECTED (safe fallback) |

---

## Authentication Flow

```
Bearer token received
↓
Attempt canonical marketplace JWT (MARKETPLACE_JWT_SECRET)
↓
If canonical → validate UserSession → return user
↓
If not canonical → attempt legacy JWT (NEXTAUTH_SECRET)
↓
If legacy valid AND cutoff not reached → accept temporarily
↓
If legacy valid AND cutoff reached → reject
↓
If neither → reject
```

---

## Security During Compatibility

Legacy tokens are still subject to:
- `User.isActive` check
- `User.isBanned` check
- `User.isSuspended` check
- `User.isBanned` check

A valid legacy token does NOT bypass current account status checks.

---

## Removal Plan

1. Deploy Phase 3C with `LEGACY_MOBILE_AUTH_CUTOFF` set to 7 days from deploy
2. Monitor legacy token usage (should drop to zero as users re-login)
3. After cutoff: legacy tokens rejected automatically
4. Phase 3E: Remove `verifyLegacyToken()` and legacy code path
5. Phase 3E: Remove `createToken()` from `lib/mobile-auth.ts`

---

## What Is NOT Removed Yet

- `createToken()` function (exists but not called by login routes)
- `verifyLegacyToken()` function (used for compatibility window)
- `NEXTAUTH_SECRET` environment variable (still needed for legacy compat + admin auth)
