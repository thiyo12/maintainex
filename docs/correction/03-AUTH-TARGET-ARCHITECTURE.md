# 03 — Canonical Auth Target Architecture

**Date**: 2026-09-07
**Status**: STEP 4A FROZEN — ALL 9 CORRECTIONS APPLIED — READY FOR IMPLEMENTATION

---

## 1. TWO HUMAN SECURITY CONTEXTS

### Context A — Marketplace User

**Identity source**: `User` table
**Auth token**: JWT signed with `MARKETPLACE_JWT_SECRET`
**Session**: `UserSession` (DB-backed, revocable)
**Capabilities**: customer, provider, company member/owner
**Security level**: Standard (password + optional OTP)

### Context B — Platform Staff

**Identity source**: `AdminUser` table
**Auth token**: JWT signed with `STAFF_JWT_SECRET`
**Session**: `AdminSession` (DB-backed, revocable)
**Roles**: SUPER_ADMIN, MANAGER, FINANCE, USER_MANAGEMENT, SUPPORT, TECHNICAL
**Security level**: Elevated (password + mandatory TOTP 2FA)

### Architectural Boundaries

| Property | Marketplace | Staff |
|---|---|---|
| Identity table | `User` | `AdminUser` |
| Signing secret | `MARKETPLACE_JWT_SECRET` | `STAFF_JWT_SECRET` |
| Token audience | `maintainex-marketplace` | `maintainex-staff` |
| Token purpose | `marketplace_access` | `staff_access` |
| Access token lifetime | 15 min (configurable) | 30 min (configurable) |
| Refresh token lifetime | 30 days (configurable) | 7 days (configurable) |
| Session model | `UserSession` | `AdminSession` |
| Refresh format | Opaque (`sessionId.randomSecret`) | Opaque (`sessionId.randomSecret`) |
| 2FA | Optional (future) | Mandatory (TOTP) |
| RBAC | Capability-based | Role-based (6 roles) — resolved from DB |
| Password hashing | bcrypt + SHA-256 pepper | bcrypt (12 rounds) |
| Cookie name | — (mobile only) | `admin_token`, `refresh_token` |

**CRITICAL RULE**: A marketplace token MUST NEVER be accepted at a staff endpoint, and vice versa. Enforced by: `aud` claim, `purpose` claim, signing secret separation.

---

## 2. CANONICAL AUTH MODULE STRUCTURE

```
lib/auth/
├── types.ts              # Principal types, error codes, shared types
├── errors.ts             # Canonical auth error classes
├── password.ts           # Shared password hashing (currently lib/security/password.ts)
├── otp.ts                # OTP generation/verification (currently inline)
├── tokens.ts             # JWT sign/verify (marketplace + staff)
├── sessions.ts           # Session CRUD (UserSession + AdminSession)
├── marketplace-auth.ts   # authenticateMarketplace(), capability checks
├── staff-auth.ts         # authenticateStaff(), RBAC checks
└── capabilities.ts       # Capability resolution (customer, provider, company)
```

**Rationale**: The current codebase has auth scattered across 6 files (`mobile-auth.ts`, `admin-auth.ts`, `admin-jwt.ts`, `admin-rbac.ts`, `auth-utils.ts`, `security/tokens.ts`). Consolidating into `lib/auth/` while preserving the same external API surface minimizes breakage.

**Migration strategy**: New modules are created first. Existing files become thin adapters that import from `lib/auth/`. Callers are migrated incrementally. Old files removed last.

---

## 3. AUTHENTICATED PRINCIPAL MODEL

### MarketplacePrincipal

```typescript
interface MarketplacePrincipal {
  principalType: 'MARKETPLACE_USER'
  userId: string                    // User.id — trusted from token sub
  sessionId: string                 // UserSession.id — trusted from token jti
  email: string                     // from token claim (verified at login)
  capabilities: Capability[]        // resolved from DB, NOT from token
  companyMemberships?: CompanyMembership[]  // resolved from DB
}

interface Capability {
  type: 'CUSTOMER' | 'PROVIDER' | 'COMPANY_OWNER' | 'COMPANY_MEMBER'
  profileId?: string                // CustomerProfile.id, TaskerProfile.id, CompanyProfile.id
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'REJECTED'
}

interface CompanyMembership {
  companyId: string                 // CompanyProfile.id
  companyProfileId: string          // CompanyProfile.id
  role: string                      // TeamMember.role
  isOwner: boolean                  // CompanyProfile.userId === user.id
}
```

**Trust boundary**: `userId` and `sessionId` are trusted from verified token claims. `capabilities` and `companyMemberships` are ALWAYS resolved from database on every request — never cached in token.

### StaffPrincipal

```typescript
interface StaffPrincipal {
  principalType: 'STAFF'
  adminUserId: string               // AdminUser.id — trusted from token sub
  sessionId: string                 // AdminSession.id — trusted from token sid
  email: string                     // resolved from DB (AdminUser.email)
  role: AdminRole                   // resolved from DB (AdminUser.role) — NON-AUTHORITATIVE for UI hints only
  permissions: string[]             // resolved from ROLE_PERMISSIONS map at request time
  assignedCountries: string[]       // resolved from DB (AdminUser.assignedCountries)
}
```

**Trust boundary**: `adminUserId` and `sessionId` are trusted from verified token claims. `email`, `role`, `permissions`, and `assignedCountries` are ALWAYS resolved from database on every request — never trusted from token claims. Token contains only identity binding (`sub`, `sid`) and session metadata. Staff authorization MUST NOT rely on stale permission claims in a JWT.

---

## 4. MARKETPLACE CAPABILITY MODEL

### Capability Resolution Rules

**CUSTOMER capability**:
```
User exists
AND User.isActive = true
AND User.isBanned = false
AND (User.isSuspended = false OR User.suspendedUntil < now())
```
No profile required. Every active User has customer capability by default.

**PROVIDER capability**:
```
User exists (same checks as CUSTOMER)
AND TaskerProfile exists (TaskerProfile.userId = User.id)
AND TaskerProfile.verificationStatus = 'VERIFIED'
AND User.identityStatus = 'VERIFIED'
```
Provider capability is SEPARATE from customer capability. A user can be customer-only, provider-only, or both.

**COMPANY_OWNER capability**:
```
User exists (same checks as CUSTOMER)
AND CompanyProfile exists (CompanyProfile.userId = User.id)
```
CompanyProfile.userId is the owner. One User can own one company.

**COMPANY_MEMBER capability**:
```
User exists (same checks as CUSTOMER)
AND TeamMember exists (TeamMember.userId = User.id)
AND TeamMember.companyId = requestedCompanyId
```
Membership is per-company. A user can be member of multiple companies.

### Capability Usage in Routes

```typescript
// Current pattern (to be replaced):
const user = await authenticateRequest(request)
if (user.role !== 'TASKER') return 403

// Target pattern:
const principal = await authenticateMarketplace(request)
assertCapability(principal, 'PROVIDER')  // checks TaskerProfile + verification
```

---

## 5. USER.ROLE FUTURE DIRECTION

### Recommendation: A — Retain as UI/Default-Persona Hint Only

**Current state**: `User.role` is a single string (`CUSTOMER`, `TASKER`, `COMPANY`) set at registration.

**Problems with using it for authorization**:
1. One User can have multiple capabilities (CustomerProfile + TaskerProfile)
2. Role is set at registration and never updated
3. No database constraint enforces role ↔ profile consistency
4. Routes already bypass role field and check profiles directly

**Recommended approach**:
- Keep `User.role` as-is for backward compatibility
- Treat it as "default persona" for UI purposes (which tab to show on login)
- Authorization uses capability resolution (Section 4), not role field
- Eventually: add `User.defaultPersona` field, deprecate `role`

**Migration path**:
1. Phase 3: Add capability resolution, stop using `role` for auth decisions
2. Phase 5: Add `User.defaultPersona` field, copy `role` values
3. Phase 8: Remove `role` from auth-critical paths (keep for UI)

**Mobile app effects**: None immediately. Mobile app already checks profiles, not role field, for capability-gated features.

---

## 6. MARKETPLACE ACCESS TOKEN DESIGN

### Specification

| Property | Value |
|---|---|
| Algorithm | HMAC-SHA256 |
| Secret | `MARKETPLACE_JWT_SECRET` |
| Issuer | `maintainex` |
| Audience | `maintainex-marketplace` |
| Subject | `User.id` |
| Type claim | `marketplace_access` |
| Session ID | `UserSession.id` (sid claim) |
| Expiry | 15 minutes (configurable via `MARKETPLACE_ACCESS_TTL`) |

### Claims

```typescript
{
  sub: string,          // User.id
  sid: string,          // UserSession.id
  aud: 'maintainex-marketplace',
  iss: 'maintainex',
  jti: string,          // unique token ID (for revocation tracking)
  type: 'marketplace_access',
  iat: number,
  exp: number
}
```

**Trust boundary**: `sub` and `sid` are trusted from verified token. `email`, `role`, `capabilities`, `balances`, `addresses`, `KYC documents`, `company info` are NEVER included in token — resolved from DB after token verification.

**NOT included in token**: email, role, capabilities, balances, addresses, KYC documents, company info. These are resolved from DB after token verification.

**Rationale for 15-minute expiry**: Balances security (short window for stolen tokens) with mobile UX (refresh happens silently in background). Current 30-day token has NO revocation — 15-minute + refresh is a major security improvement.

---

## 7. MARKETPLACE REFRESH TOKEN DESIGN

### Recommendation: A — Opaque Random Token

**Why not JWT refresh**:
1. Refresh tokens need server-side rotation tracking anyway
2. Opaque tokens have no payload to leak
3. Simpler revocation (just delete the session)
4. Current admin system already uses opaque refresh + JWT access (proven pattern)

### Specification

| Property | Value |
|---|---|
| Format | `<sessionId>.<randomSecret>` (session-bound opaque) |
| Selector | `sessionId` — identifies UserSession/AdminSession, not itself authorization |
| Secret | `crypto.randomBytes(64).toString('hex')` (128 hex chars), high entropy |
| Hash for storage | `sha256(randomSecret)` — DB stores hash of secret portion only |
| Storage | `UserSession.refreshTokenHash` / `AdminSession.refreshToken` |
| Expiry | 30 days (configurable via `MARKETPLACE_REFRESH_TTL`) |
| Rotation | On every refresh, old token invalidated |
| Replay handling | Token family revoked on reuse |

### Refresh Flow

```
Client sends refresh_token (format: sessionId.randomSecret)
      ↓
Server: parse selector (sessionId) + randomSecret
      ↓
Load UserSession by sessionId
      ↓
Session found? → check expiresAt, check revokedAt
      ↓
hash(randomSecret) → constant-time compare against stored refreshTokenHash
      ↓
User exists? → check isActive, isBanned
      ↓
Atomic rotation:
  UPDATE UserSession
  SET refreshTokenHash = sha256(newRandomSecret), lastUsedAt = now()
  WHERE id = session.id
    AND refreshTokenHash = sha256(oldRandomSecret)
    AND revokedAt IS NULL
  RETURNING id
      ↓
If RETURNING is empty → REPLAY DETECTED → revoke family
      ↓
Return: new access token + new refresh token (new sessionId.randomSecret)
```

**Never scan all session hashes to discover a refresh token.** Always parse the selector first, then hash the secret portion.

---

## 8. USER SESSION MODEL DESIGN

### Proposed Schema

```prisma
model UserSession {
  id                String    @id @default(cuid())
  userId            String
  refreshTokenHash  String    @unique
  tokenFamilyId     String    // Links rotated tokens to same login event
  ipAddress         String?
  userAgent         String?
  deviceName        String?   // "iPhone 15", "Chrome on macOS"
  createdAt         DateTime  @default(now())
  lastUsedAt        DateTime?
  expiresAt         DateTime
  revokedAt         DateTime?
  revokeReason      String?   // "logout", "logout_all", "password_reset", "security"
  updatedAt         DateTime  @updatedAt

  @@index([userId])
  @@index([refreshTokenHash])
  @@index([tokenFamilyId])
  @@index([expiresAt])
}
```

**Fields explained**:
- `tokenFamilyId`: UUID generated at login. All refresh rotations from same login share this ID. If a rotated token is reused, revoke entire family.
- `deviceName`: Optional human-readable device name for "active sessions" UI.
- `revokeReason`: Distinguishes logout from security revocation for audit.

**NOT included**:
- `isValid` boolean — use `revokedAt` null check instead (clearer semantics)
- `tokenHash` — use `refreshTokenHash` (clearer purpose)

### Session Lifecycle Events

| Event | Action |
|---|---|
| Login | Create UserSession, issue access + refresh |
| Refresh | Rotate refresh token, update `lastUsedAt` |
| Logout | Set `revokedAt = now()`, `revokeReason = 'logout'` |
| Logout all | `UPDATE UserSession SET revokedAt = now() WHERE userId = ? AND revokedAt IS NULL` |
| Password reset | `UPDATE UserSession SET revokedAt = now(), revokeReason = 'password_reset' WHERE userId = ?` |
| Account disabled | Same as password reset |
| Token replay | Revoke entire `tokenFamilyId` |

---

## 9. STAFF TOKEN ARCHITECTURE

### Preserve Current Properties

The existing Admin JWT implementation is well-designed. Preserve:
- DB-backed `AdminSession` with revocation
- TOTP 2FA
- Login attempt tracking + lockout
- Audit logging via `AuditLog`
- Separate access + refresh token flow

### Staff Token Specification

| Property | Value |
|---|---|
| Access algorithm | HMAC-SHA256 |
| Access secret | `STAFF_JWT_SECRET` |
| Access expiry | 30 minutes (configurable via `STAFF_ACCESS_TTL`) |
| Refresh format | Opaque random, session-bound (`sessionId.randomSecret`) |
| Refresh expiry | 7 days (configurable via `STAFF_REFRESH_TTL`) |
| Audience | `maintainex-staff` |
| Type | `staff_access` |

### Staff Claims (Minimal)

```typescript
{
  sub: string,              // AdminUser.id
  sid: string,              // AdminSession.id
  aud: 'maintainex-staff',
  iss: 'maintainex',
  jti: string,              // unique token ID (for revocation tracking)
  type: 'staff_access',
  iat: number,
  exp: number
}
```

**NOT included in staff token**: `role`, `firstName`, `lastName`, `assignedCountries`, `permissions`. These are mutable/PII values that MUST be resolved from authoritative server-side state (AdminUser table) during staff authorization. A token must not preserve revoked permissions until token expiry.

**Non-authoritative role hint**: If `role` is retained as a UI hint for default dashboard routing, it is explicitly NON-AUTHORITATIVE and must never be used for authorization decisions.

---

## 10. CROSS-TOKEN ISOLATION

### Isolation Mechanisms

| Check | Marketplace Token | Staff Token | Cron | Internal |
|---|---|---|---|---|
| `aud` claim | `maintainex-marketplace` | `maintainex-staff` | N/A | N/A |
| `type` claim | `marketplace_access` | `staff_access` | N/A | N/A |
| Signing secret | `MARKETPLACE_JWT_SECRET` | `STAFF_JWT_SECRET` | N/A | N/A |
| DB session check | `UserSession` | `AdminSession` | N/A | N/A |

### Verification Rules

```typescript
// Marketplace verification:
function verifyMarketplaceToken(token: string): MarketplacePrincipal | null {
  const payload = jwt.verify(token, MARKETPLACE_JWT_SECRET)
  if (payload.aud !== 'maintainex-marketplace') return null  // REJECT staff token
  if (payload.type !== 'marketplace_access') return null      // REJECT refresh token
  // ... DB lookup
}

// Staff verification:
function verifyStaffToken(token: string): StaffPrincipal | null {
  const payload = jwt.verify(token, STAFF_JWT_SECRET)
  if (payload.aud !== 'maintainex-staff') return null         // REJECT marketplace token
  if (payload.type !== 'staff_access') return null            // REJECT refresh token
  // ... DB lookup
}
```

### Attack Prevention

| Attack | Prevention |
|---|---|
| Marketplace token → staff endpoint | `aud` mismatch + signing secret mismatch |
| Staff token → marketplace endpoint | `aud` mismatch + signing secret mismatch |
| Refresh token → access endpoint | `type` claim check |
| Cron secret → human endpoint | No JWT structure, direct string comparison |
| Legacy HMAC → canonical endpoint | `type` claim missing, signature format mismatch |

---

## 11. SESSION VALIDATION STRATEGY

### Marketplace Access Token Validation (per request)

```
1. Extract token from Authorization header
2. jwt.verify(token, MARKETPLACE_JWT_SECRET)
   → valid signature?
   → not expired?
   → aud = 'maintainex-marketplace'?
   → type = 'marketplace_access'?
   → sub present? → User.id
   → sid present? → UserSession.id
3. Lookup UserSession by sid (NOT by jti)
   → session exists?
   → session not revoked?
   → session not expired?
4. Lookup User by sub
   → user exists?
   → user.isActive = true?
   → user.isBanned = false?
5. Resolve capabilities from DB:
   → CustomerProfile? (always active if User exists)
   → TaskerProfile? (verification status)
   → CompanyProfile? (ownership)
   → TeamMember? (membership per company)
6. Return MarketplacePrincipal
```

**Performance**: Steps 2-3 are the bottleneck (one DB read per request). Acceptable for now. Phase 9 can add short-lived cache (30-60s) for session validation if needed.

### Staff Access Token Validation (per request)

```
1. Extract token from Bearer header or admin_token cookie
2. jwt.verify(token, STAFF_JWT_SECRET)
   → valid signature?
   → not expired?
   → aud = 'maintainex-staff'?
   → type = 'staff_access'?
   → sub present? → AdminUser.id
   → sid present? → AdminSession.id
3. Lookup AdminSession by sid
   → session exists?
   → session not revoked?
4. Lookup AdminUser by sub
   → user exists?
   → user.isActive = true?
   → user.deletedAt = null?
5. Resolve CURRENT state from DB:
   → AdminUser.role (authoritative, NOT from token)
   → ROLE_PERMISSIONS[role] (permission map)
   → AdminUser.assignedCountries (from DB)
6. Return StaffPrincipal
```

**Trust boundary**: Token provides identity binding only. Role, permissions, and scope are resolved from authoritative server-side state at every request. Stale permission claims in a JWT are NEVER trusted for authorization.

---

## 12. MIDDLEWARE ARCHITECTURE

### Middleware Responsibilities

| Task | Handled by Middleware? | Notes |
|---|---|---|
| CORS headers | YES | Mobile routes need `Access-Control-Allow-Origin: *` |
| Rate limiting | YES | In-memory per-IP (existing) |
| IP blocklist | YES | Sync from DB every 60s (existing) |
| Security headers | YES | HSTS, CSP, etc. (existing) |
| Route protection (admin) | YES | Redirect to /admin/login if no session |
| Coarse token screening | YES | Reject obviously invalid tokens early |
| Authoritative auth | **NO** | Route handlers are authoritative |
| Session validation | **NO** | DB check happens in route handlers |
| Account status check | **NO** | Route handlers check isActive/isBanned |
| Capability/permission check | **NO** | Route handlers check capabilities |
| Resource authorization | **NO** | Route handlers check ownership |

### Middleware Token Screening (Optional Optimization)

Middleware can perform COARSE screening to reject obviously invalid tokens before they reach route handlers:

```typescript
// Middleware: cheap screening (no DB)
function screenToken(token: string): 'valid_format' | 'invalid' {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return 'invalid'
    // Just check format, don't verify signature (route handler does that)
    return 'valid_format'
  } catch {
    return 'invalid'
  }
}
```

**DO NOT** make middleware the only security boundary. Route handlers MUST perform full verification.

---

## 13. LOGIN FLOW — MARKETPLACE

### Password Login

```
POST /api/mobile/auth/login
  → { email/phone, password }
  → User lookup (email or phone)
  → isActive check
  → isBanned check
  → isSuspended check
  → verifyPasswordWithMigration(password, hash)
  → FailedLogin tracking
  → Create UserSession (tokenFamilyId = random UUID)
  → Sign access token (15min, marketplace_access, sid=UserSession.id)
  → Return { accessToken, refreshToken (sessionId.randomSecret), user }
```

### OTP Login

```
POST /api/mobile/auth/otp-login
  → { email/phone, code? }
  → User lookup
  → isActive/isBanned/isSuspended check
  → If no code: generate OTP, store hash, send email
  → If code: verify OTP (bcrypt compare)
  → Create UserSession
  → Sign access token (15min, marketplace_access, sid=UserSession.id)
  → Return { accessToken, refreshToken, user }
```

### Registration

```
POST /api/mobile/auth/register
  → { name, phone, email?, role? }
  → Uniqueness checks (email, phone last 9 digits)
  → Create User (role defaults to CUSTOMER)
  → If role=TASKER: create TaskerProfile
  → Create OTP for phone verification
  → Return { requiresVerification: true, userId }
```

**Backward compatibility**: Existing passwords remain valid. `verifyPasswordWithMigration` handles both peppered and un-peppered hashes. No forced re-registration.

---

## 14. REFRESH FLOW

### Standard Refresh

```
POST /api/mobile/auth/refresh
  → { refreshToken } (format: sessionId.randomSecret)
  → Parse: sessionId = token.split('.')[0]
  → Load UserSession by sessionId
  → Session found? → check expiresAt, revokedAt
  → hash(token.split('.')[1]) → constant-time compare against stored refreshTokenHash
  → Match? → User exists? → check isActive, isBanned
  → Atomic rotation:
    BEGIN
    UPDATE UserSession
    SET "refreshTokenHash" = sha256(newRandomSecret),
        "lastUsedAt" = now()
    WHERE id = $sessionId
      AND "refreshTokenHash" = sha256(oldRandomSecret)
      AND "revokedAt" IS NULL
    RETURNING id
    → if RETURNING is empty: REPLAY DETECTED → revoke family
    COMMIT
  → Return { accessToken, refreshToken: newSessionId.newRandomSecret }
```

### Concurrent Refresh Handling

Two simultaneous refresh requests with the same token:
1. First request succeeds, rotates token (atomic UPDATE succeeds)
2. Second request: old hash no longer matches → atomic UPDATE returns empty → replay detected
3. Entire token family revoked → both requests fail, user must re-login

**PostgreSQL atomic update** ensures at most ONE rotation succeeds:
```sql
UPDATE "UserSession"
SET "refreshTokenHash" = $newHash, "lastUsedAt" = now()
WHERE id = $sessionId
  AND "refreshTokenHash" = $oldHash
  AND "revokedAt" IS NULL
RETURNING id
```
If RETURNING is empty → replay detected.

### Distinguishing Race Conditions from Replay

**Race condition** (two legitimate requests at same time):
- First UPDATE succeeds, second UPDATE returns empty
- Result: family revoked, both fail — user re-logs in
- Acceptable cost: rare, and revocation is the safe default

**Replay** (attacker has stolen token):
- Same behavior as race: family revoked, attacker loses access
- Result: legitimate user must re-login — but attacker also loses access

**Safe default**: Treat all reuse as replay. The cost of a false-positive (legitimate user re-logs in) is much lower than the cost of a false-negative (attacker maintains access). Atomic PostgreSQL conditional rotation is mandatory.

---

## 15. REFRESH TOKEN REUSE POLICY

### Policy: Revoke Token Family on Replay

When an already-rotated refresh token is reused (atomic UPDATE returns empty):

1. **Revoke entire token family**: `UPDATE UserSession SET revokedAt = now(), revokeReason = 'replay_detected' WHERE tokenFamilyId = ? AND revokedAt IS NULL`
2. **Log security event**: `SecurityAudit.create({ action: 'TOKEN_REPLAY', riskLevel: 'HIGH', userId, sessionId, tokenFamilyId, ipAddress, userAgent })`
3. **Return 401**: Force re-login

**Rationale**: Token reuse indicates either:
- Legitimate concurrent request (rare, acceptable to force re-login)
- Stolen token (must revoke immediately)

**Balance**: Revoking the family (not just the session) prevents an attacker from maintaining access through multiple rotated tokens. The user must re-authenticate from scratch.

**Race condition handling**: If two legitimate requests arrive simultaneously, the atomic UPDATE ensures exactly one succeeds. The other triggers family revocation. This is acceptable — the cost of a false-positive (user re-logs in) is much lower than the cost of a false-negative (attacker maintains access).

### Replay Detection Flow

```
Refresh request arrives with token T
      ↓
Parse sessionId from T
Load UserSession by sessionId
      ↓
hash(T.randomSecret) === stored refreshTokenHash?
      ↓
YES → legitimate, proceed with atomic rotation
      ↓
NO → token was already rotated
      ↓
Check: is session still active? (not revoked, not expired)
      ↓
YES → REPLAY DETECTED (session exists but hash doesn't match = rotated token reuse)
      ↓
Revoke entire tokenFamilyId
Log TOKEN_REPLAY security event at HIGH risk
Return 401
      ↓
NO → session already revoked/expired → return 401 (no additional action needed)
```

---

## 16. LOGOUT DESIGN

### Single Device Logout

```
POST /api/mobile/auth/logout
  → authenticateMarketplace(request) → get sessionId
  → UPDATE UserSession SET revokedAt = now(), revokeReason = 'logout' WHERE id = sessionId
  → Return { success: true }
```

### After Logout

- Access token: Still valid until expiry (15 min max) BUT session validation fails → rejected at route handler
- Refresh token: Invalid (session revoked) → refresh fails
- Client: Remove tokens from SecureStore

---

## 17. LOGOUT ALL DEVICES

### Trigger Points

1. Explicit "logout all devices" button in app
2. Password change
3. Password reset
4. Account compromise detected

### Behavior

```
UPDATE UserSession
SET revokedAt = now(), revokeReason = 'logout_all'
WHERE userId = ? AND revokedAt IS NULL
```

**Default**: ALL sessions revoked including current. User must re-login on all devices.

**Optional**: After password change, allow "keep this device" by not revoking the session used for the password change request.

---

## 18. PASSWORD RESET SESSION POLICY

### Policy: Revoke All Sessions

```
PASSWORD RESET
  → Update password hash
  → Revoke ALL UserSessions for this userId
  → RevokeReason = 'password_reset'
  → Return { success: true, message: 'Password updated. Please login again.' }
```

**Rationale**: If attacker has active session, password reset must invalidate it. Current behavior issues a new token after reset — this is insecure. After reset, user must re-login with new password.

---

## 19. ACCOUNT STATUS POLICY

### Login Blockers (prevent authentication entirely)

| Status | Blocks Login? |
|---|---|
| `User.isActive = false` | YES |
| `User.isBanned = true` | YES |
| `User.isSuspended = true` (with no expiry or future expiry) | YES |

### Capability Blockers (prevent specific actions, NOT login)

| Status | Blocks Provider Work? | Blocks Company Actions? | Blocks Customer Actions? |
|---|---|---|---|
| `TaskerProfile.verificationStatus = 'PENDING'` | YES | NO | NO |
| `TaskerProfile.verificationStatus = 'REJECTED'` | YES | NO | NO |
| `User.identityStatus ≠ 'VERIFIED'` | YES (quotes) | NO | NO |
| `CompanyProfile.subscriptionStatus = 'CANCELLED'` | NO | YES | NO |
| `CompanyProfile.verificationStatus ≠ 'VERIFIED'` | NO | YES | NO |

**Key principle**: Provider suspension does NOT prevent customer login. Company suspension does NOT prevent personal customer actions. Each capability is independently gated.

---

## 20. COMPANY MEMBER AUTH DESIGN

### Two Member States

**UNLINKED MEMBER**:
- `TeamMember.userId = null`
- Administrative/workforce record only
- Cannot authenticate as company member
- Created via offline import or admin action

**LINKED MEMBER**:
- `TeamMember.userId = User.id` (non-null)
- Can authenticate
- Active membership checked server-side

### Authenticated Company Action

```
authenticateMarketplace(request) → principal
  ↓
assertCapability(principal, 'COMPANY_MEMBER')
  → TeamMember exists WHERE userId = principal.userId AND companyId = requestedCompanyId
  → TeamMember is part of active company
  ↓
Check company permission/role for specific action
```

### Company Owner vs Member

| Action | Owner Required? | Member Allowed? |
|---|---|---|
| View company profile | NO | YES |
| Edit company profile | YES | NO |
| Invite team members | YES | NO |
| Accept invite | N/A (uses token) | YES |
| Post jobs as company | YES | NO |
| Accept jobs as company member | NO | YES (if assigned) |

---

## 21. STAFF AUTH DESIGN

### Staff Login Flow

```
POST /api/admin/auth/login
  → { email, password }
  → AdminUser lookup
  → isActive check, deletedAt check
  → lockedUntil check (lockout)
  → verifyPasswordWithMigration(password, hash)
  → Failed attempt tracking
  → If TOTP enabled: return { requires2fa: true, tempToken }
  → If no TOTP: create AdminSession, sign tokens
  → Set cookies: admin_token (access), refresh_token (refresh)
```

### Staff Token Storage

**Browser**: httpOnly cookies (existing behavior, preserve)
- `admin_token`: access token (24h)
- `refresh_token`: refresh token (7d)

**API clients**: Bearer header (existing behavior, preserve)

**DO NOT** move admin tokens to localStorage. httpOnly cookies are more secure for browser contexts.

---

## 22. LEGACY ADMIN MIGRATION

### Retirement Sequence (No Compatibility Window)

1. **Stop new legacy token issuance**: `createSimpleToken()` is already dead code (0 callers)
2. **Deploy day — Force re-login**: Invalidate all existing AdminSessions. All admin users must re-authenticate with password + TOTP to get canonical tokens.
3. **Deploy day — Reject old HMAC**: `verifySimpleToken()` returns `null` for all HMAC-format tokens. No fallback. No compatibility.
4. **Add new staff auth module**: `lib/auth/staff-auth.ts` with canonical login, refresh, token verification
5. **Migrate all 80 `getSession()` consumers**: Update imports to use canonical `lib/auth/staff-auth.ts`
6. **Preserve TOTP/2FA**: Staff re-authenticate with password + TOTP at forced login. TOTP enrollment survives.
7. **Remove `verifySimpleToken()`**: After zero callers confirmed
8. **Remove `lib/admin-auth.ts`**: After all functions retired
9. **Remove `lib/admin-rbac.ts` dead functions**: `adminAuthorize()`, `getSessionFromCookie()` (0 callers)
10. **Remove `NEXTAUTH_SECRET` fallback**: Staff uses `STAFF_JWT_SECRET` exclusively

**Why no compatibility window**: Legacy HMAC tokens have no revocation mechanism. Every day they remain active is a security risk. Admin UX impact is minimal (one forced re-login). Security takes priority over preserving obsolete HMAC sessions.

**Timeline**: All admin users must re-login on deploy day. This is a one-time event. No gradual migration needed.

---

## 23. OTP / RESET TOKEN ARCHITECTURE

### Canonical Token Types

| Purpose | Model | TTL | Attempts | Rate Limit | Single-Use |
|---|---|---|---|---|---|
| `LOGIN_OTP` | OTP | 5 min | 5 | 3/phone/hour | YES |
| `PASSWORD_RESET` | PasswordResetToken | 1 hour | 1 | 3/email/hour | YES |
| `EMAIL_VERIFY` | OTP | 5 min | 5 | 3/email/hour | YES |
| `PHONE_VERIFY` | OTP | 5 min | 5 | 3/phone/hour | YES |
| `2FA_TEMP` | JWT (inline) | 5 min | 1 | N/A | YES |

### Token Security Rules

1. **Cryptographic generation**: `crypto.randomBytes(48).toString('base64url')` for opaque tokens
2. **Hashed at rest**: SHA-256 for opaque tokens, bcrypt for OTP codes
3. **Purpose binding**: OTP record has `purpose` field; verify route checks purpose match
4. **Recipient binding**: OTP record has `userId`; verify route checks user match
5. **Single-use**: `isUsed = true` after successful verification
6. **Attempt limit**: 5 attempts per token, then invalidated
7. **Rate limiting**: Per-identifier (phone/email) + per-IP

---

## 24. AUTH ERROR CONTRACT

### Error Categories

| Code | HTTP Status | Message | Never Leaks |
|---|---|---|---|
| `AUTH_REQUIRED` | 401 | Authentication required | — |
| `INVALID_CREDENTIALS` | 401 | Invalid email or password | Account existence |
| `SESSION_EXPIRED` | 401 | Session expired | — |
| `SESSION_REVOKED` | 401 | Session revoked | — |
| `TOKEN_REPLAY` | 401 | Token reuse detected | — |
| `ACCOUNT_DISABLED` | 401 | Account disabled | — |
| `ACCOUNT_SUSPENDED` | 403 | Account suspended | Suspension details |
| `ACCOUNT_BANNED` | 403 | Account banned | Ban reason (optional) |
| `FORBIDDEN` | 403 | Insufficient permissions | Required permissions |
| `INVALID_TOKEN_PURPOSE` | 401 | Invalid token type | — |
| `MEMBERSHIP_REQUIRED` | 403 | Company membership required | — |
| `CAPABILITY_REQUIRED` | 403 | [Capability] required | — |
| `RATE_LIMITED` | 429 | Too many requests | Retry-after |
| `LOCKED` | 423 | Account temporarily locked | Lock duration |

### Anti-Enumeration

Login responses use generic messages:
- `INVALID_CREDENTIALS` for both "user not found" and "wrong password"
- Same response time for both cases (prevent timing attacks)

---

## 25. SECURITY EVENT MODEL

### Events to Audit

| Event | Table | Risk Level |
|---|---|---|
| Login success | SecurityAudit | LOW |
| Login failure | SecurityAudit | MEDIUM |
| OTP failure | SecurityAudit | MEDIUM |
| Token refresh | SecurityAudit | LOW |
| Token replay detected | SecurityAudit | HIGH |
| Logout | SecurityAudit | LOW |
| Logout all devices | SecurityAudit | MEDIUM |
| Password change | SecurityAudit | MEDIUM |
| Password reset | SecurityAudit | HIGH |
| Account disabled | SecurityAudit | MEDIUM |
| Staff login | AuditLog | LOW |
| Staff 2FA failure | AuditLog | HIGH |
| Session revoked | SecurityAudit | MEDIUM |

### Events to NEVER Log

- Passwords (raw or hashed)
- OTP values
- Access tokens
- Refresh tokens
- Signing secrets
- Private key material

### Temporary Table

Use existing `SecurityAudit` for marketplace events. Use existing `AuditLog` for staff events. No new tables needed for Phase 3.

---

## 26. TARGET SECRET STRUCTURE

### Required ENV Variables (Canonical)

| Variable | Purpose | Used By |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | Prisma |
| `MARKETPLACE_JWT_SECRET` | Sign/verify marketplace access tokens | lib/auth/tokens.ts |
| `STAFF_JWT_SECRET` | Sign/verify staff access tokens | lib/auth/tokens.ts |
| `PASSWORD_PEPPER` | SHA-256 pepper for password hashing | lib/auth/password.ts (if pepper migration proves safe) |
| `CRON_SECRET` | Machine auth for cron jobs | cron routes |
| `INTERNAL_SYNC_SECRET` | Machine auth for internal sync | internal routes |

### Optional Config Variables

| Variable | Default | Purpose |
|---|---|---|
| `MARKETPLACE_ACCESS_TTL` | `15m` | Marketplace access token lifetime |
| `MARKETPLACE_REFRESH_TTL` | `30d` | Marketplace refresh token lifetime |
| `STAFF_ACCESS_TTL` | `30m` | Staff access token lifetime |
| `STAFF_REFRESH_TTL` | `7d` | Staff refresh token lifetime |

### Deprecated Variables (LEGACY — remove after migration)

| Variable | Current Use | Replacement | Status |
|---|---|---|---|
| `NEXTAUTH_SECRET` | Mobile JWT + admin legacy HMAC | `MARKETPLACE_JWT_SECRET` + `STAFF_JWT_SECRET` | LEGACY — compatibility only |
| `JWT_SECRET` | Admin new JWT | `STAFF_JWT_SECRET` | LEGACY — compatibility only |
| `JWT_REFRESH_SECRET` | Admin refresh JWT | Removed (opaque refresh needs no JWT secret) | LEGACY — compatibility only |

**Note**: `STAFF_REFRESH_SECRET` is NOT canonical. Refresh tokens are opaque random credentials that do NOT require JWT signing secrets. Legacy `JWT_REFRESH_SECRET` may remain temporarily during migration but is not required by the target architecture.

**Note on `PASSWORD_PEPPER`**: Do NOT automatically introduce `PASSWORD_PEPPER` unless the password-security audit proves a pepper migration is beneficial and safe. Existing pepper behavior is preserved as-is. The canonical target includes it only if audit confirms value.

### Migration Path

1. Add `MARKETPLACE_JWT_SECRET` and `STAFF_JWT_SECRET` to `.env`
2. Set `MARKETPLACE_JWT_SECRET` = current `NEXTAUTH_SECRET` (backward compat)
3. Set `STAFF_JWT_SECRET` = current `JWT_SECRET` (backward compat)
4. Deploy new code that uses new variable names with fallback to legacy
5. After 7-day migration window, remove fallback
6. Eventually rotate to new secret values
7. Remove deprecated variables

---

## 27. TOKEN LIFETIME POLICY

| Token | Lifetime | Configurable Via | Rationale |
|---|---|---|---|
| Marketplace access | 15 minutes | `MARKETPLACE_ACCESS_TTL` | Security: short window for stolen tokens. UX: silent refresh in background |
| Marketplace refresh/session | 30 days | `MARKETPLACE_REFRESH_TTL` | Mobile UX: users shouldn't re-login frequently. Revocable via session |
| Staff access | 30 minutes | `STAFF_ACCESS_TTL` | Staff security: frequent re-authentication for admin panel. Configurable |
| Staff refresh/session | 7 days | `STAFF_REFRESH_TTL` | Staff UX: weekly refresh acceptable. Revocable via AdminSession |
| Temp 2FA token | 5 minutes | — | Security: very short window for 2FA bypass |
| OTP | 5 minutes | — | Security: short window for code interception |
| Password reset | 1 hour | — | UX: user may not check email immediately |

**Migration impact**: Current mobile tokens are 30-day stateless. New 15-minute tokens require refresh infrastructure. During 7-day compatibility window, old tokens remain valid while new logins issue canonical session-backed credentials.

---

## 28. MIGRATION COMPATIBILITY STRATEGY

### Marketplace Token Migration

**Strategy: 7-Day Compatibility Window**

1. **Phase 3 deploy**: Deploy `UserSession` model + new token service + compatibility verifier
2. **Day 0-7**: Existing valid legacy JWTs accepted via compatibility verifier (signature-only check, no session lookup)
3. **Day 0-7**: ALL new logins issue canonical 15-minute access + 30-day opaque refresh
4. **Day 7 cutoff**: Legacy JWT validation disabled. Legacy token issuance must have stopped.
5. **Day 7+**: Users still holding legacy tokens must log in again
6. **Phase 3 cleanup**: Remove compatibility verifier, remove old `authenticateRequest()` fallback

**Cutoff mechanism**: Hardcoded deployment-date constant in code. After `MIGRATION_DEADLINE = deployDate + 7 days`, `verifyLegacyToken()` returns `null` immediately regardless of token validity. Do NOT silently extend based on token expiry.

**Why 7 days, not 30**: Stateless legacy tokens with no revocation are a security liability. Each day they remain active is a risk window. 7 days is sufficient for active users to naturally refresh; infrequent users can re-login.

### Legacy Admin HMAC Migration

**Strategy: Controlled Forced Re-login**

1. **Phase 3 deploy**: Add new staff auth module alongside legacy
2. **Deploy day**: Disable HMAC issuance (`createSimpleToken()` already dead code)
3. **Deploy day**: Force re-login for all admin users — invalidate all existing HMAC sessions
4. **Deploy day**: Reject old HMAC tokens (no compatibility window — security priority)
5. **Phase 3 cleanup**: Remove `verifySimpleToken()`, `lib/admin-auth.ts`, `lib/admin-rbac.ts` dead functions
6. **Preserve**: TOTP/2FA enrollment survives re-login (re-verify 2FA at forced login)

**Why no compatibility window for admin**: Legacy HMAC tokens have no revocation mechanism. Every day they remain active is a security risk. Admin UX impact is minimal (one re-login). TOTP setup is preserved — staff re-authenticate with password + TOTP, getting fresh canonical tokens.

---

## 29. CANONICAL TARGET DIAGRAM

```
                         AUTH CORE
                            │
               ┌────────────┴────────────┐
               │                         │
        MARKETPLACE SECURITY        STAFF SECURITY
               │                         │
             User                    AdminUser
               │                         │
          UserSession              AdminSession
               │                         │
     ┌─────────┴─────────┐       ┌───────┴───────┐
     │                   │       │               │
 Access Token      Refresh Token  Access Token  Refresh Token
 (15min, JWT)    (30d, opaque)  (30min, JWT)   (7d, opaque)
 sid=UserSession.id              sid=AdminSession.id
     │                   │       │               │
     │    ┌──────────────┘       │    ┌──────────┘
     │    │                      │    │
     ▼    ▼                      ▼    ▼
 Capability                 CURRENT state
 Resolution                 from DB (authoritative)
 (from DB)                  role/permissions/scope
     │                         │
     └────────────┬────────────┘
                  │
           Authorization
                  │
          ┌───────┴───────┐
          │               │
    Route Handler    Resource Check
   (authoritative)  (ownership/scope)
```

**Machine authentication** (CRON_SECRET, INTERNAL_SYNC_SECRET) remains completely outside this hierarchy.

---

## 30. IMPLEMENTATION DEPENDENCY PLAN

### Phase 3 Implementation Order

| Step | Task | Depends On | Risk |
|---|---|---|---|
| A | Create `lib/auth/types.ts` + `lib/auth/errors.ts` | None | LOW |
| B | Create `UserSession` schema (Prisma) | None | LOW |
| C | Create `lib/auth/tokens.ts` (marketplace + staff) | A | LOW |
| D | Create `lib/auth/sessions.ts` (UserSession CRUD) | B | LOW |
| E | Create `lib/auth/marketplace-auth.ts` | C, D | MEDIUM |
| F | Create `lib/auth/staff-auth.ts` | C, D | LOW |
| G | Create `lib/auth/capabilities.ts` | E | LOW |
| H | Deploy `MARKETPLACE_JWT_SECRET` + `STAFF_JWT_SECRET` env vars | None | LOW |
| I | Migrate mobile login routes to new auth | E, H | MEDIUM |
| J | Add refresh endpoint for marketplace | D, H | MEDIUM |
| K | Migrate `authenticateRequest()` to use new module | E, I | MEDIUM |
| L | Migrate admin login routes to new staff auth | F, H | LOW |
| M | Migrate `getAdminSession()` to use new module | F, L | LOW |
| N | Migrate 80 `getSession()` consumers | M | HIGH (many files) |
| O | Update middleware to use canonical verifier | C, H | MEDIUM |
| P | Remove `lib/admin-auth.ts` (legacy HMAC) | N | LOW |
| Q | Remove `lib/auth-utils.ts` | N | LOW |
| R | Remove `lib/admin-rbac.ts` | M | LOW |
| S | Remove dead code (`createSimpleToken`, `adminAuthorize`, `getSessionFromCookie`) | N | LOW |
| T | Clean up deprecated env vars | All | LOW |

### Critical Path

```
A → C → E → I → K → N → P → Q → R → S
                ↘
B → D → J ↗
                ↘
          F → L → M ↗
```

**Estimated effort**: Steps A-H can be done in parallel (foundation). Steps I-N are the critical path (migration). Steps O-T are cleanup.

---

PHASE 3 AUTH ARCHITECTURE FROZEN — ALL 9 CORRECTIONS APPLIED — READY FOR IMPLEMENTATION
