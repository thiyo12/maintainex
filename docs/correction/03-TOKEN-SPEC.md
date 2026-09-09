# 03 — Token Specification

**Date**: 2026-09-07
**Status**: STEP 6 COMPLETE — MARKETPLACE REFRESH ROTATION IMPLEMENTED

---

## Marketplace Access Token

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "clx1abc123...",           // User.id (cuid)
    "sid": "clx2def456...",           // UserSession.id (cuid)
    "aud": "maintainex-marketplace",
    "iss": "maintainex",
    "jti": "clx9xyz789...",           // unique token ID (for revocation tracking)
    "type": "marketplace_access",
    "iat": 1725734400,
    "exp": 1725735300                 // iat + 900s (15 min)
  }
}
```

**Signing**: `jwt.sign(payload, process.env.MARKETPLACE_JWT_SECRET, { algorithm: 'HS256' })`

**Verification**: `jwt.verify(token, process.env.MARKETPLACE_JWT_SECRET, { audience: 'maintainex-marketplace', issuer: 'maintainex' })`

**Trust boundary**: `sub` and `sid` are trusted from verified token. All other user state (email, role, capabilities, balances) resolved from DB after verification.

---

## Marketplace Refresh Token

**Format**: `<sessionId>.<randomSecret>` — session-bound opaque credential

**Example**: `clx2def456...  .a1b2c3d4e5f6...` (sessionId + dot + 128 hex chars)

**Generation**:
```
sessionId = UserSession.id (from DB after login)
randomSecret = crypto.randomBytes(64).toString('hex')  // 128 hex chars
token = `${sessionId}.${randomSecret}`
```

**Storage**: `sha256(randomSecret)` stored in `UserSession.refreshTokenHash`

**Parsing**: Split on `.` → `[0]` = sessionId (selector), `[1]` = randomSecret (secret)

**NOT a JWT**. Opaque random value with session binding. No claims. No expiry in token itself (expiry tracked in DB session).

**Security**: Never scan all session hashes to discover a refresh token. Always parse the selector first, then hash the secret portion.

---

## Staff Access Token

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "clx3ghi789...",           // AdminUser.id (cuid)
    "sid": "clx4jkl012...",           // AdminSession.id (cuid)
    "aud": "maintainex-staff",
    "iss": "maintainex",
    "jti": "clx9abc321...",           // unique token ID (for revocation tracking)
    "type": "staff_access",
    "iat": 1725734400,
    "exp": 1725736200                 // iat + 1800s (30 min)
  }
}
```

**Signing**: `jwt.sign(payload, process.env.STAFF_JWT_SECRET, { algorithm: 'HS256' })`

**Verification**: `jwt.verify(token, process.env.STAFF_JWT_SECRET, { audience: 'maintainex-staff', issuer: 'maintainex' })`

**NOT included**: `role`, `firstName`, `lastName`, `assignedCountries`, `permissions`. These are mutable/PII values resolved from authoritative server-side state (AdminUser table) during staff authorization. A token must not preserve revoked permissions until token expiry.

**Non-authoritative role hint**: If `role` is retained for UI purposes (default dashboard routing), it is explicitly NON-AUTHORITATIVE and must never be used for authorization decisions.

---

## Staff Refresh Token

**Format**: `<sessionId>.<randomSecret>` — session-bound opaque credential (same format as marketplace)

**Example**: `clx4jkl012...  .b2c3d4e5f6a7...` (sessionId + dot + 128 hex chars)

**Generation**: Same as marketplace refresh token.

**Storage**: `sha256(randomSecret)` stored in `AdminSession.refreshTokenHash`

**Security**: Same rules as marketplace refresh — parse selector, hash secret, constant-time compare.

---

## Temp 2FA Token

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "clx3ghi789...",           // AdminUser.id
    "purpose": "2fa_verify",
    "email": "admin@maintainex.lk",
    "iat": 1725734400,
    "exp": 1725734700                 // iat + 300s (5 min)
  }
}
```

**Signing**: `jwt.sign(payload, process.env.STAFF_JWT_SECRET, { algorithm: 'HS256' })`

**Verification**: `jwt.verify(token, process.env.STAFF_JWT_SECRET)` + check `purpose === '2fa_verify'`

---

## OTP Token (Database)

```
OTP table:
  id: string (cuid)
  userId: string (FK → User.id)
  codeHash: string (bcrypt hash of 6-digit code)
  purpose: string ('LOGIN' | 'PHONE_VERIFICATION' | 'EMAIL_VERIFICATION' | 'PASSWORD_RESET')
  attempts: int (0-5)
  isUsed: boolean
  expiresAt: datetime (now + 5 min)
  metadata: json ({ ip, userAgent })
```

**Code generation**: `randomInt(0, 1000000).toString().padStart(6, '0')` or `'000000'` in test mode

**Code hashing**: `bcrypt.hash(code, 10)`

**Verification**: `bcrypt.compare(code, otpRecord.codeHash)`

---

## Password Reset Token (Database)

```
PasswordResetToken table:
  id: string (cuid)
  userId: string (FK → User.id)
  tokenHash: string (sha256 of random token, unique)
  expiresAt: datetime (now + 1 hour)
  usedAt: datetime? (null until used)
```

**Token generation**: `crypto.randomBytes(48).toString('base64url')`

**Token hashing**: `sha256(token)`

**Verification**: `sha256(input) === storedHash` + check `usedAt === null` + check `expiresAt > now()`

---

## Token Comparison Matrix

| Property | Marketplace Access | Marketplace Refresh | Staff Access | Staff Refresh | Temp 2FA | OTP | Password Reset |
|---|---|---|---|---|---|---|---|
| Format | JWT | Opaque (session-bound) | JWT | Opaque (session-bound) | JWT | Code | Opaque |
| Signing | HMAC-SHA256 | None | HMAC-SHA256 | None | HMAC-SHA256 | N/A | None |
| Secret | MARKETPLACE_JWT_SECRET | None | STAFF_JWT_SECRET | None | STAFF_JWT_SECRET | N/A | None |
| Lifetime | 15 min | 30 days | 30 min | 7 days | 5 min | 5 min | 1 hour |
| DB tracked | Yes (UserSession) | Yes (UserSession) | Yes (AdminSession) | Yes (AdminSession) | No | Yes (OTP) | Yes (PasswordResetToken) |
| Revocable | Yes | Yes | Yes | Yes | No (expires) | Yes (isUsed) | Yes (usedAt) |
| Single-use | No | Yes (rotation) | No | Yes (rotation) | Yes | Yes | Yes |
| Session binding | sid claim | sessionId prefix | sid claim | sessionId prefix | N/A | N/A | N/A |
| Configurable TTL | MARKETPLACE_ACCESS_TTL | MARKETPLACE_REFRESH_TTL | STAFF_ACCESS_TTL | STAFF_REFRESH_TTL | — | — | — |

---

## Refresh Token Replay Detection

### Flow

```
Refresh request with token T (format: sessionId.randomSecret)
      ↓
Parse sessionId from T (split on '.')
Load UserSession/AdminSession by sessionId
      ↓
hash(T.randomSecret) === stored refreshTokenHash?
      ↓
YES → legitimate, proceed with atomic rotation
      ↓
NO → token was already rotated (replay or race condition)
      ↓
Check: is session still active? (not revoked, not expired)
      ↓
YES → REPLAY DETECTED
      → Revoke entire tokenFamilyId
      → Log TOKEN_REPLAY security event at HIGH risk
      → Return 401
      ↓
NO → session already revoked/expired → return 401 (no additional action)
```

### Atomic PostgreSQL Rotation

```sql
UPDATE "UserSession"
SET "refreshTokenHash" = $newHash, "lastUsedAt" = now()
WHERE id = $sessionId
  AND "refreshTokenHash" = $oldHash
  AND "revokedAt" IS NULL
RETURNING id
```

If RETURNING is empty → replay detected.

### Race Condition vs Replay

| Scenario | Behavior | Cost |
|---|---|---|
| Two legitimate concurrent requests | First succeeds, second triggers family revocation | User re-logs in (acceptable) |
| Attacker with stolen token | Family revoked, attacker loses access | Security preserved |
| Stale token reuse after legitimate rotation | Family revoked, both parties must re-login | Security preserved |

**Safe default**: Treat all reuse as replay. False-positive cost (user re-logs in) << False-negative cost (attacker maintains access).

---

PHASE 3 TOKEN SPECIFICATION FROZEN — ALL 9 CORRECTIONS APPLIED
