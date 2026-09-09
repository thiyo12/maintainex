# MaintainEX Authentication Map

## Three Co-Existing Auth Systems

### System 1: Mobile JWT (User model)

| Property | Value |
|---|---|
| Token type | HMAC-SHA256 JWT |
| Secret | `NEXTAUTH_SECRET` |
| Expiry | 30 days |
| Signing | `jsonwebtoken` library |
| Verification | `jwt.verify()` |
| Payload | `{ id, email, role }` |
| Storage | `expo-secure-store` (key: `auth_token`) |
| Transmission | `Authorization: Bearer` header |
| DB tracking | None (stateless) |
| Revocation | Not possible (until expiry) |
| Callers | 60+ mobile API routes |

**Flow:**
```
Login → createToken({id, email, role}) → jwt.sign(data, NEXTAUTH_SECRET, {expiresIn:'30d'})
  → Client stores in SecureStore
  → Subsequent requests: Bearer header
  → Server: authenticateRequest() → verifyToken() → prisma.user.findUnique()
```

### System 2: Admin New JWT (AdminUser model)

| Property | Value |
|---|---|
| Access token type | HMAC-SHA256 JWT |
| Access secret | `JWT_SECRET` (falls back to `NEXTAUTH_SECRET`) |
| Access expiry | 24 hours |
| Refresh token type | HMAC-SHA256 JWT |
| Refresh secret | `JWT_REFRESH_SECRET` |
| Refresh expiry | 7 days (JWT) + 7 days (DB) |
| Refresh storage | `AdminSession` table (hashed) |
| Cookie | `admin_token` (httpOnly, secure, sameSite: lax) |
| Cookie | `refresh_token` (httpOnly, secure, sameSite: strict) |
| Client state | In-memory via `lib/admin-api.ts` + Zustand store |
| 2FA | TOTP via `otplib` (5-min temp token for 2FA step) |
| Callers | 16 admin API routes |

**Flow:**
```
Login → verifyPasswordWithMigration() → check TOTP
  → If no 2FA: signAccessToken() + signRefreshToken() + create AdminSession
  → If 2FA: return tempToken (5min) → verify-otp → full session
  → Client: setAccessToken() in memory + cookies set
  → Refresh: POST /refresh with refresh_token cookie → rotate tokens
```

### System 3: Admin Legacy HMAC (AdminUser model)

| Property | Value |
|---|---|
| Token format | `{base64(payload)}.{hmac-hex-signature}` |
| Secret | `NEXTAUTH_SECRET` (or `JWT_SECRET`) |
| Expiry | 30 days |
| Signing | HMAC-SHA256 via `crypto` |
| Verification | `crypto.timingSafeEqual` |
| Storage | `admin_token` cookie (httpOnly) |
| DB tracking | None (stateless) |
| Revocation | Not possible (until expiry) |
| Callers | 50 legacy web API routes |

**Flow:**
```
createSimpleToken(data) → payload = {...data, created: Date.now()}
  → encoded = base64(JSON(payload))
  → signature = HMAC-SHA256(secret, encoded).hex
  → Returns "{encoded}.{signature}"

verifySimpleToken(token) → parts = token.split('.')
  → Verify HMAC signature
  → Check Date.now() - payload.created <= 30 days
  → Return payload
```

## Shared Components

### Password Hashing
- bcrypt with 14 rounds
- SHA-256 pepper prepended: `sha256(password + PASSWORD_PEPPER)`
- Migration function: auto-upgrades un-peppered hashes on login

### Middleware (middleware.ts)
- Runs on `/api/*`, `/admin/*`, `/setup/*`
- Has its own inline JWT verifier using Web Crypto API (`crypto.subtle`)
- Independent of `jsonwebtoken` library used in lib files
- Rate limiting: in-memory Map (not distributed-safe)
- IP blocklist: in-memory Set synced from DB every 60s

### Rate Limiting
| Layer | Type | Storage | Distributed? |
|---|---|---|---|
| Middleware (default) | Per-IP | In-memory | No |
| Middleware (auth) | Per-IP | In-memory | No |
| CRM rate limiter | Per-IP/User | PostgreSQL | Yes |
| OTP limits | Per-phone/IP | PostgreSQL | Yes |

## Security Concerns

1. **NEXTAUTH_SECRET shared** across mobile JWT + admin legacy HMAC
2. **Middleware has independent JWT verifier** (Web Crypto) vs lib files (jsonwebtoken)
3. **Mobile sessions stateless** — no revocation possible
4. **Admin `verifyAccessToken` does NOT check `AdminSession.isRevoked`**
5. **In-memory rate limiting** not distributed-safe
6. **X-Forwarded-For spoofable** without proxy stripping
7. **CSP includes `unsafe-inline`** for scripts
