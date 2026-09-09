# 03D — Test Results

## VPS Database Integration Tests (108/108 PASS)

### Staff JWT — Sign & Verify (9 tests)
- ✓ signs and verifies a valid token
- ✓ rejects token with wrong audience
- ✓ rejects token with wrong issuer
- ✓ rejects token with wrong type
- ✓ rejects token with missing sid
- ✓ rejects expired token
- ✓ rejects token signed with wrong secret
- ✓ rejects marketplace token signed with staff secret (cross-token isolation)
- ✓ does not include role, email, or permissions in claims

### Staff Refresh Token — Format Tests (8 tests)
- ✓ generates 128 hex char secret (64 bytes)
- ✓ generates different secrets on each call
- ✓ returns sha256 hash of secret
- ✓ parseRefreshToken rejects token without dot
- ✓ parseRefreshToken rejects empty string
- ✓ parseRefreshToken rejects token with short secret
- ✓ parseRefreshToken accepts valid format
- ✓ verifyRefreshSecret returns true for matching
- ✓ verifyRefreshSecret returns false for wrong secret

### Staff Session — createStaffSession (3 tests)
- ✓ creates session with valid tokens
- ✓ rejects disabled AdminUser
- ✓ rejects deleted AdminUser

### Staff Session — revokeStaffSession (2 tests)
- ✓ revokes session
- ✓ revokeAllStaffSessions revokes all

### Staff Refresh Rotation — DB Integration (9 tests)
- ✓ valid rotation: old hash replaced, new hash stored, access JWT valid
- ✓ old token reuse: replay detected, session/family revoked
- ✓ 2-way concurrency: at most 1 successful rotation
- ✓ 5-way concurrency: at most 1 successful rotation
- ✓ expired session: DENY, no mutation
- ✓ revoked session: DENY, no mutation
- ✓ disabled AdminUser: DENY
- ✓ deleted AdminUser: DENY
- ✓ wrong secret on valid session: replay policy enforced

### Marketplace Auth — DB Integration (28 tests)
- ✓ rotation: 11/11
- ✓ usersession: 9/9
- ✓ password-reset: 8/8

### Marketplace Auth — Unit (48 tests)
- ✓ marketplace-jwt: 19/19
- ✓ refresh: 16/16
- ✓ auth-types: 13/13

### Local Unit Tests (48/48 PASS)
- All marketplace unit tests pass locally (DB integration tests skipped without VPS)
