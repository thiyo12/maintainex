# 03C — Test Results

**Date**: 2026-09-07

---

## Unit Tests (Local)

### Marketplace JWT (`tests/phase3/marketplace-jwt.test.ts`) — 19/19 PASS
- Sign & verify: 12 tests (valid token, wrong audience, wrong issuer, wrong type, missing sid, missing sub, expired, wrong secret, malformed, cross-purpose, no sensitive claims, env var)
- Refresh token parsing: 7 tests (no dot, empty string, empty selector, short secret, valid format, oversized, garbage)

### Auth Types (`tests/phase3/auth-types.test.ts`) — 13/13 PASS

### Refresh Utilities (`tests/phase3/refresh.test.ts`) — 16/16 PASS

**Total local: 48/48 PASS**

---

## DB Integration Tests (VPS Container)

### Rotation Service (`tests/phase3/rotation.integration.test.ts`) — 11/11 PASS
- Valid rotation: old hash replaced, new hash stored, access JWT valid
- Old token reuse: replay detected, session/family revoked
- 2-way concurrency: at most 1 successful rotation
- 5-way concurrency: at most 1 successful rotation
- Expired session: DENY, no mutation
- Revoked session: DENY, no mutation
- isActive=false: DENY
- isBanned=true: DENY
- isSuspended=true: DENY
- Wrong secret: replay policy enforced
- Sub always matches session user

### UserSession Service (`tests/phase3/usersession.integration.test.ts`) — 9/9 PASS
- createSession, getActiveSession, revokeSession, revokeAllUserSessions, revokeTokenFamily, refresh token end-to-end

**Total DB integration: 20/20 PASS (2x run)**

---

## Full Validation

| Check | Status |
|---|---|
| `npx prisma validate` | PASS |
| `npx prisma generate` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| Local unit tests | PASS (48/48) |
| DB integration tests | PASS (20/20, 2x run) |
| Staff auth unchanged | PASS |
| Withdrawal disabled | PASS |
