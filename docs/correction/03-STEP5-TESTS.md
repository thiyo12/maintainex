# 03 — Step 5: Test Report

**Date**: 2026-09-07

---

## Test Execution Strategy

| Category | Environment | What it tests |
|---|---|---|
| **UNIT** | Local (no DB) | Types, constants, errors, crypto utilities, token parsing |
| **SQL DATABASE** | VPS PostgreSQL (`maintainex_test`) | Schema constraints, indexes, raw SQL lifecycle |
| **TYPESCRIPT DATABASE INTEGRATION** | VPS container (same Docker network as DB) | Production TypeScript service functions (`createSession`, `getActiveSession`, `revokeSession`, `revokeAllUserSessions`, `revokeTokenFamily`) against real PostgreSQL via Prisma |

**Key**: TypeScript integration tests use `describe.skipIf(!isVPS)` to skip locally (no PostgreSQL). They only execute inside the VPS Docker container with `DATABASE_URL` pointing to `maintainex_test`.

---

## Unit Tests

### Refresh Token Utilities (`tests/phase3/refresh.test.ts`)

| Test | Result |
|---|---|
| generates token with selector.secret format | PASS |
| generates different secrets on each call | PASS |
| generates 128 hex char secrets (64 bytes) | PASS |
| returns sha256 hash of secret | PASS |
| parses valid token | PASS |
| rejects token without dot | PASS |
| rejects token with empty selector | PASS |
| rejects token with short secret | PASS |
| rejects empty string | PASS |
| produces deterministic output | PASS |
| produces 64 char hex string | PASS |
| different inputs produce different hashes | PASS |
| returns true for matching secret and hash | PASS |
| returns false for wrong secret | PASS |
| returns false for mismatched hash length | PASS |
| generate → parse → verify succeeds | PASS |

**16/16 PASS**

### Auth Types & Errors (`tests/phase3/auth-types.test.ts`)

| Test | Result |
|---|---|
| MarketplacePrincipal compiles | PASS |
| StaffPrincipal compiles | PASS |
| token purposes are distinct | PASS |
| token audiences are distinct | PASS |
| issuer is defined | PASS |
| lifetimes are defined | PASS |
| AUTH_REQUIRED status 401 | PASS |
| INVALID_CREDENTIALS status 401 | PASS |
| FORBIDDEN status 403 | PASS |
| RATE_LIMITED status 429 | PASS |
| LOCKED status 423 | PASS |
| toJSON returns code and message | PASS |
| AuthError is instance of Error | PASS |

**13/13 PASS**

---

## SQL Database Integration Tests

### UserSession Lifecycle (`tests/phase3/usersession-integration.sql`)

Run against VPS PostgreSQL `maintainex_test` database.

| Test | Result |
|---|---|
| TEST 1: Session created with correct ID | PASS |
| TEST 1: Session belongs to correct user | PASS |
| TEST 1: RefreshTokenHash stored | PASS |
| TEST 1: RevokedAt null initially | PASS |
| TEST 1: TokenFamilyId present | PASS |
| TEST 2: RevokedAt populated after revoke | PASS |
| TEST 2: RevokeReason set | PASS |
| TEST 2: Second revoke is idempotent | PASS |
| TEST 3: Expired session detected | PASS |
| TEST 3: Active count excludes expired/revoked | PASS |
| TEST 4: Correct user finds session | PASS |
| TEST 4: Wrong user cannot find session | PASS |
| TEST 5: All user A active sessions revoked | PASS |
| TEST 5: User B session unaffected | PASS |
| TEST 6: Target family revoked | PASS |
| TEST 6: Other family unaffected | PASS |

**16/16 PASS**

---

## TypeScript Database Integration Tests

### UserSession Service Functions (`tests/phase3/usersession.integration.test.ts`)

Run inside VPS Docker container (app container on `dokploy-network`), `DATABASE_URL` = `maintainex_test`.
Imports actual production functions: `createSession`, `getActiveSession`, `revokeSession`, `revokeAllUserSessions`, `revokeTokenFamily`, `parseRefreshToken`, `hashRefreshSecret`, `verifyRefreshSecret`.

**Run 1**: 9/9 PASS (942ms)
**Run 2**: 9/9 PASS (975ms) — proves cleanup/idempotency

| Test | Result |
|---|---|
| createSession creates valid session via production service | PASS |
| getActiveSession returns valid session for correct user | PASS |
| getActiveSession denies wrong user | PASS |
| getActiveSession denies expired session | PASS |
| getActiveSession denies revoked session | PASS |
| revokeSession is idempotent | PASS |
| revokeAllUserSessions revokes A sessions, leaves B intact | PASS |
| revokeTokenFamily revokes target family, leaves other intact | PASS |
| refresh token end-to-end: generate → parse → lookup → verify | PASS |

**9/9 PASS (2x run)**

---

## Full Validation Matrix

| Check | Status |
|---|---|
| `npx prisma validate` | PASS |
| `npx prisma generate` | PASS |
| Unit tests (refresh) | PASS (16/16) |
| Unit tests (types/errors) | PASS (13/13) |
| SQL database integration tests | PASS (16/16) |
| TypeScript DB integration tests | PASS (9/9, 2x run) |
| Existing mobile auth unchanged | PASS (no files modified) |
| Existing admin auth unchanged | PASS (no files modified) |
| Legacy HMAC still operational | PASS (no changes to admin-auth.ts) |
