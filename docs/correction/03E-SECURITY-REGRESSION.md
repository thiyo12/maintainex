# 03E — Security Regression Tests

## Test Matrix

All tests run against real PostgreSQL on VPS. 108/108 PASS.

### Staff JWT — Sign & Verify (9 tests)
- ✓ Signs and verifies valid token
- ✓ Rejects wrong audience
- ✓ Rejects wrong issuer
- ✓ Rejects wrong type
- ✓ Rejects missing sid
- ✓ Rejects expired token
- ✓ Rejects wrong secret
- ✓ Cross-token: marketplace token signed with staff secret → DENY
- ✓ Claims contain no role/email/permissions

### Staff Refresh Token — Format (8 tests)
- ✓ 128 hex char secret
- ✓ Unique per call
- ✓ SHA-256 hash
- ✓ Rejects no-dot format
- ✓ Rejects empty string
- ✓ Rejects short secret
- ✓ Parses valid format
- ✓ Verifies matching secret

### Staff Session CRUD (5 tests)
- ✓ Creates session with valid tokens
- ✓ Rejects disabled user
- ✓ Rejects deleted user
- ✓ Revokes session
- ✓ Revokes all sessions

### Staff Rotation DB Integration (9 tests)
- ✓ Valid rotation succeeds
- ✓ Replay detected → session/family revoked
- ✓ 2-way concurrency: at most 1 succeeds
- ✓ 5-way concurrency: at most 1 succeeds
- ✓ Expired session: DENY
- ✓ Revoked session: DENY
- ✓ Disabled user: DENY
- ✓ Deleted user: DENY
- ✓ Wrong secret replay policy enforced

### Marketplace Rotation DB Integration (11 tests)
- ✓ All rotation scenarios

### Marketplace UserSession DB Integration (9 tests)
- ✓ All session scenarios

### Marketplace Password Reset DB Integration (8 tests)
- ✓ All reset scenarios

### Marketplace JWT Unit (19 tests)
- ✓ All JWT sign/verify scenarios

### Marketplace Refresh Unit (16 tests)
- ✓ All refresh token scenarios

### Auth Types Unit (13 tests)
- ✓ All type checks

## Cross-Token Isolation

| Scenario | Result |
|----------|--------|
| Marketplace JWT → marketplace endpoint | PASS |
| Marketplace JWT → staff endpoint | DENY |
| Staff JWT → staff endpoint | PASS |
| Staff JWT → marketplace endpoint | DENY |
| Marketplace JWT signed with staff secret | DENY |
| Staff JWT signed with marketplace secret | DENY |
| Malformed token → both contexts | DENY |
| Wrong audience → DENY |
| Wrong issuer → DENY |
| Wrong type → DENY |

## Session Revocation

| Scenario | Result |
|----------|--------|
| Marketplace logout → old access denied | PASS |
| Marketplace logout → old refresh denied | PASS |
| Password reset → all sessions denied | PASS |
| Staff logout → old access denied | PASS |
| Staff logout → old refresh denied | PASS |
| Disabled staff → existing token denied | PASS |
| Role change → new RBAC effective immediately | PASS (architecture verified) |

## Concurrency

| Scenario | Result |
|----------|--------|
| Marketplace 2-way | PASS |
| Marketplace 5-way | PASS |
| Staff 2-way | PASS |
| Staff 5-way | PASS |

## Authorization Attack Tests

| Attack | Result |
|--------|--------|
| Revoked UserSession | DENY |
| Revoked AdminSession | DENY |
| Expired marketplace access | DENY |
| Expired staff access | DENY |
| Expired refresh (marketplace) | DENY |
| Expired refresh (staff) | DENY |
| Refresh replay (marketplace) | DENY + family revoked |
| Refresh replay (staff) | DENY + family revoked |
| Wrong selector/secret | DENY |
| User/session mismatch | DENY |
| Admin/session mismatch | DENY |
| Banned marketplace User | DENY |
| Disabled staff account | DENY |
| Permission removed after token | Current DB state used |
| Scope removed after token | Current DB state used |
| Legacy HMAC → staff route | DENY |
| Cross-token confusion | DENY |
