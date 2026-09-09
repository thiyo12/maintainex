# 03D — Staff Auth Architecture

## BEFORE (Phase 3D Start)

```
AdminUser
  ↓
  password + lockout
  ↓
  TOTP / 2FA (tempToken: JWT signed with JWT_SECRET, 5min)
  ↓
  AdminSession (refreshTokenHash)
  ↓
  access JWT: signAccessToken() → JWT_SECRET, 24h, includes role/firstName/lastName/assignedCountries
  refresh JWT: signRefreshToken() → JWT_REFRESH_SECRET, 7d, JWT format
  ↓
  cookies: admin_token (access, 7d), refresh_token (JWT, 7d)
  ↓
  getAdminSession() → verifyAccessToken (JWT) OR verifySimpleToken (HMAC) OR cookie HMAC
  getSession() → verifySimpleToken (HMAC) only
  getSessionFromCookie() → verifyAccessToken (JWT) OR verifySimpleToken (HMAC)
```

## AFTER (Phase 3D)

```
AdminUser
  ↓
  password + lockout
  ↓
  TOTP / 2FA (tempToken: JWT signed with STAFF_JWT_SECRET, 5min)
  ↓
  AdminSession (refreshTokenHash + tokenFamilyId)
  ↓
  staff access JWT: signStaffAccessToken() → STAFF_JWT_SECRET, 30min, claims: sub/sid/aud/iss/jti/type/iat/exp
  staff refresh token: opaque <sessionId>.<randomSecret>, DB stores sha256(secret)
  ↓
  cookies: admin_token (access, 30min), refresh_token (opaque, 7d)
  ↓
  getAdminSession() → verifyStaffAccessToken → AdminSession lookup → AdminUser lookup → StaffAuthContext
  getSession() → verifyStaffAccessToken → AdminSession lookup → AdminUser lookup → SessionUser
  getSessionFromCookieAsync() → verifyStaffAccessToken → AdminSession lookup → AdminUser lookup → AdminSession
```

## Key Changes

| Component | Before | After |
|-----------|--------|-------|
| Access token TTL | 24 hours | 30 minutes |
| Access token claims | role, firstName, lastName, assignedCountries | Only sub, sid, aud, iss, jti, type |
| Refresh token format | JWT (JWT_REFRESH_SECRET) | Opaque `<sessionId>.<randomSecret>` |
| Refresh token storage | AdminSession.refreshTokenHash | AdminSession.refreshTokenHash + tokenFamilyId |
| Atomic rotation | No | YES — PostgreSQL conditional UPDATE |
| Replay detection | No | YES — hash mismatch + active = replay → revoke family |
| HMAC token issuance | Active | ZERO — all routes use canonical |
| HMAC token acceptance | Active | REMOVED — getAdminSession/getSession reject HMAC |
| Secret separation | Shared JWT_SECRET/NEXTAUTH_SECRET | Separate STAFF_JWT_SECRET |
