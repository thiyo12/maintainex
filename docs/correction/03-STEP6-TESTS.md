# 03 — Step 6: Test Report

**Date**: 2026-09-07

---

## Test Execution Strategy

| Category | Environment | What it tests |
|---|---|---|
| **UNIT** | Local (no DB) | JWT sign/verify, refresh token parsing, malformed inputs |
| **TYPESCRIPT DATABASE INTEGRATION** | VPS container | Production rotation service against real PostgreSQL |

---

## Unit Tests

### Marketplace JWT (`tests/phase3/marketplace-jwt.test.ts`)

| Test | Result |
|---|---|
| signs and verifies a valid token | PASS |
| rejects token with wrong audience | PASS |
| rejects token with wrong issuer | PASS |
| rejects token with wrong type | PASS |
| rejects token with missing sid | PASS |
| rejects token with missing sub | PASS |
| rejects expired token | PASS |
| rejects token signed with wrong secret | PASS |
| rejects malformed token string | PASS |
| rejects staff-purpose token signed with marketplace secret | PASS |
| does not include email, role, or permissions in claims | PASS |
| uses MARKETPLACE_JWT_SECRET env var | PASS |
| parseRefreshToken rejects token without dot | PASS |
| parseRefreshToken rejects empty string | PASS |
| parseRefreshToken rejects token with empty session ID | PASS |
| parseRefreshToken rejects token with short secret | PASS |
| parseRefreshToken accepts valid format | PASS |
| parseRefreshToken rejects oversized token | PASS |
| parseRefreshToken rejects garbage input | PASS |

**19/19 PASS**

---

## TypeScript Database Integration Tests

### Refresh Rotation Service (`tests/phase3/rotation.integration.test.ts`)

Run inside VPS Docker container, `DATABASE_URL` = `maintainex_test`.
Imports actual production functions: `createSession`, `rotateMarketplaceRefreshToken`, `verifyMarketplaceAccessToken`, `parseRefreshToken`, `verifyRefreshSecret`, `revokeSession`.

**Run 1**: 11/11 PASS (1.47s)
**Run 2**: 11/11 PASS (1.08s) — proves cleanup/idempotency

| Test | Result |
|---|---|
| valid rotation: old hash replaced, new hash stored, access JWT valid | PASS |
| old token reuse: replay detected, session/family revoked | PASS |
| 2-way concurrency: at most 1 successful rotation | PASS |
| 5-way concurrency: at most 1 successful rotation | PASS |
| expired session: DENY, no mutation | PASS |
| revoked session: DENY, no mutation | PASS |
| isActive=false: DENY | PASS |
| isBanned=true: DENY | PASS |
| isSuspended=true: DENY | PASS |
| wrong secret on valid session: replay policy enforced | PASS |
| sub is always User belonging to session | PASS |

**11/11 PASS (2x run)**

---

## Full Validation Matrix

| Check | Status |
|---|---|
| `npx prisma validate` | PASS |
| `npx prisma generate` | PASS |
| `npx tsc --noEmit` | PASS |
| `npx next lint` | PASS (no new errors) |
| `npm run build` | PASS |
| Unit tests (marketplace JWT + refresh parsing) | PASS (19/19) |
| Unit tests (auth types/errors) | PASS (13/13) |
| Unit tests (refresh utilities) | PASS (16/16) |
| DB integration tests (rotation) | PASS (11/11, 2x run) |
| DB integration tests (usersession) | PASS (9/9, 2x run) |
| Existing Step 5 tests unchanged | PASS |
| Production login unchanged | PASS |
| `authenticateRequest()` unchanged | PASS |
| Staff auth unchanged | PASS |
