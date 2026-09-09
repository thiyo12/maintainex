# 03 — Identity Model Audit

**Date**: 2026-09-07
**Status**: STEP 3 COMPLETE — ALL MODELS CLASSIFIED, CREATION PATHS TRACED

---

## 1. IDENTITY MODEL INVENTORY

### All Identity-Related Prisma Models (27 total)

| Model | Lines | Purpose | Classification |
|---|---|---|---|
| `User` | 10-56 | Core marketplace identity (customer, provider, company) | **CORE_IDENTITY** |
| `Admin` | 58-74 | Legacy admin (branch-scoped, pre-JWT) | **LEGACY** |
| `AdminUser` | 1965-1989 | New admin staff (2FA, JWT, RBAC) | **PLATFORM_STAFF** |
| `AdminSession` | 2057-2072 | Admin JWT refresh token storage | **AUTH_SESSION** |
| `AdminRefreshToken` | 2005-2019 | Admin refresh token hashes (unused?) | **AUTH_SESSION** |
| `AdminLoginAttempt` | 2042-2054 | Admin login audit trail | **SECURITY** |
| `AdminNotification` | 1991-2003 | Admin notifications | **PLATFORM_STAFF** |
| `AdminAlert` | 2075-2099 | Work queue alerts | **PLATFORM_STAFF** |
| `Session` | 76-87 | User sessions (unused by mobile JWT) | **LEGACY** |
| `OTP` | 89-102 | OTP codes for login/verify | **AUTH_SESSION** |
| `LoginActivity` | 104-120 | Login audit trail | **SECURITY** |
| `CustomerProfile` | 505-567 | Customer CRM profile | **PROFILE** |
| `TaskerProfile` | 1213-1268 | Individual provider profile | **PROFILE** |
| `CompanyProfile` | 1436-1486 | Company provider profile | **PROFILE** |
| `TeamMember` | 1488-1506 | Company worker membership | **ORGANIZATION_MEMBERSHIP** |
| `TeamInvite` | 1508-1527 | Company invite tokens | **ORGANIZATION_MEMBERSHIP** |
| `IdentityDocument` | 1942-1959 | KYC documents | **VERIFICATION** |
| `Staff` | 990-1006 | Branch staff (legacy, separate from Admin) | **LEGACY** |
| `FailedLogin` | 910-935 | Mobile login brute-force tracking | **SECURITY** |
| `PasswordResetToken` | 887-897 | Password reset tokens | **AUTH_SESSION** |
| `SecurityAudit` | 770-817 | Security event log | **SECURITY** |
| `ApiKey` | 819-856 | API key authentication | **AUTH_SESSION** |
| `IpBlock` | 899-908 | IP blocklist | **SECURITY** |
| `RateLimitLog` | 858-885 | Rate limit tracking | **SECURITY** |
| `UserDevice` | 383-399 | Device registration (push tokens) | **AUTH_SESSION** |
| `AdminFlag` | 367-381 | User fraud flags | **SECURITY** |
| `EmailVerificationToken` | 2630-2640 | Email verification tokens | **AUTH_SESSION** |

---

## 2. HUMAN IDENTITY SOURCE

### Customer
**Database record**: `User` (role = `CUSTOMER`)
- Authenticated via: `authenticateRequest()` → `prisma.user.findUnique({ id })`
- Profile: `CustomerProfile` (optional, 1:1 via `userId`)
- KYC: `IdentityDocument` (user-owned)
- Wallet: `CustomerWallet` (user-owned)

### Individual Provider (Tasker)
**Database record**: `User` (role = `TASKER`)
- Authenticated via: same `User` record as customer
- Profile: `TaskerProfile` (optional, 1:1 via `userId`)
- KYC: `IdentityDocument` (user-owned)
- Wallet: `ProviderWallet` (user-owned)

### Company Provider
**Database record**: `User` (role = `COMPANY`)
- Authenticated via: same `User` record
- Profile: `CompanyProfile` (optional, 1:1 via `userId`)
- Team: `TeamMember[]` (company-owned)
- KYC: Company-level verification via `CompanyProfile.verificationStatus`

### Admin / Staff
**Database record**: `AdminUser` (completely separate from `User`)
- Authenticated via: `getAdminSession()` → `verifyAccessToken()` → `prisma.adminUser.findUnique({ id })`
- No connection to `User` table
- 2FA: `totpSecret`, `totpEnabled`
- RBAC: `role` field (SUPER_ADMIN, MANAGER, FINANCE, USER_MANAGEMENT, SUPPORT, TECHNICAL)
- Session: `AdminSession` (DB-backed, revocable)

---

## 3. CUSTOMER ↔ PROVIDER RELATIONSHIP

### Finding: ONE USER CAN BE BOTH CUSTOMER AND PROVIDER

**Evidence:**
1. `User.role` is a string field with default `CUSTOMER` — not an enum
2. Registration route (`mobile/auth/register:32-33`):
   ```typescript
   const validRoles = ['CUSTOMER', 'TASKER', 'COMPANY']
   const userRole = validRoles.includes(role) ? role : 'CUSTOMER'
   ```
3. `User` has optional relations to BOTH:
   - `customerProfile: CustomerProfile?` (line 37)
   - `taskerProfile: TaskerProfile?` (line 38)
   - `companyProfile: CompanyProfile?` (line 45)
4. A single `User` record can theoretically own all three profiles simultaneously

**Current behavior:**
- Registration assigns ONE role per user
- No route creates both CustomerProfile and TaskerProfile for the same user
- But the schema ALLOWS it — no database constraint prevents it
- The `role` field is a soft indicator, not a hard boundary

**Risk:**
- A user registered as CUSTOMER could theoretically have a TaskerProfile created via CRM or seed
- No validation prevents role conflicts at the database level

---

## 4. EMAIL / PHONE UNIQUENESS

### Constraints

| Field | Model | Constraint | Case Normalized? |
|---|---|---|---|
| `email` | User | `@unique` | NO (raw string) |
| `phone` | User | None (nullable) | NO (raw string) |
| `email` | AdminUser | `@unique` | NO (raw string) |
| `email` | Admin | `@unique` | NO (raw string) |
| `email` | WaitlistEntry | `@unique` | NO |
| `phone` | WaitlistEntry | `@unique` | NO |
| `email,ipAddress` | FailedLogin | `@@unique` | NO |

### Cross-Model Email Collision Risk

**User.email** and **AdminUser.email** are in SEPARATE tables with SEPARATE unique constraints.

The same email can exist in BOTH:
- `User.email = 'admin@maintainex.lk'`
- `AdminUser.email = 'admin@maintainex.lk'`

This is **by design** — admins are separate security principals. But it creates confusion:
- `verifySimpleToken()` extracts `email` from JWT payload
- `getSession()` returns `email` from token
- Route handlers may assume email uniqueness across the platform

### Phone Normalization

Phone numbers stored as raw strings. Registration uses:
```typescript
const digits = phone.replace(/\D/g, '').slice(-9)
// Checks: prisma.user.findFirst({ where: { phone: { endsWith: digits } } })
```

This means:
- `+94771234567` and `0771234567` could BOTH match the same user
- But `+14161234567` and `+94771234567` would NOT conflict (different last 9 digits)
- No global phone normalization at the database level

---

## 5. IDENTITY DUPLICATION ANALYSIS

### Creation Routes (19 total)

| Route | Model Created | Uniqueness Check | Duplicate Risk |
|---|---|---|---|
| `mobile/auth/register` | User + TaskerProfile | email + phone (last 9 digits) | LOW (checks both) |
| `customers/route.ts` (CRM) | User + CustomerProfile | email OR phone lookup | MEDIUM (no cross-check) |
| `admin/admins/route.ts` | AdminUser | email only | NONE (separate table) |
| `mobile/auth/profile` | CustomerProfile | userId lookup | NONE (upsert pattern) |
| `mobile/company/team/accept` | TeamMember | companyId only | LOW |
| `mobile/v2/identity` | IdentityDocument | userId + docType | LOW |
| `seed/test-data` | User + TaskerProfile + AdminUser | None (dev only) | N/A |
| `seed-taskers` | User + TaskerProfile | None (seed only) | N/A |

### Duplicate Identity Risks

| Risk | Severity | Evidence |
|---|---|---|
| Same email in User + AdminUser | LOW | By design (separate auth systems) |
| Same phone in different Users | MEDIUM | Registration checks last 9 digits only |
| CRM creates User without email | MEDIUM | `phone_${Date.now()}@placeholder.com` pattern |
| No role consistency check | LOW | Schema allows User with role='TASKER' but no TaskerProfile |
| AdminUser without passwordHash | LOW | Admin creation uses `hash(password, 12)` — different from User's bcrypt+pepper |

---

## 6. COMPANY MEMBERSHIP MODEL

### Models
- `CompanyProfile` — company identity (1:1 with User)
- `TeamMember` — worker membership (N:1 with CompanyProfile)
- `TeamInvite` — pending invitations

### TeamMember Fields
| Field | Type | Purpose |
|---|---|---|
| `companyId` | String (FK) | Company reference |
| `userId` | String? (FK, nullable) | Human identity reference |
| `name` | String | Display name |
| `role` | String | Role within company |
| `skills` | String | Skill slugs |
| `isOnline` | Boolean | Online status |
| `rating` | Float | Performance rating |
| `completedJobs` | Int | Job count |

### Critical Finding: `userId` is NULLABLE

```prisma
model TeamMember {
  userId String?
  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
}
```

This means:
- A TeamMember can exist WITHOUT a `User` record
- Company workers can be "phantom" members — no authenticated identity
- The `accept` route creates TeamMember with `userId: user.id` (authenticated)
- But the schema allows company members who cannot log in

### Company Roles
The `role` field is a free string — no enum defined. Current values observed:
- `MEMBER` (default in TeamInvite)
- `ADMIN` (TeamInvite role)
- No evidence of OWNER, MANAGER, DISPATCHER, WORKER, FINANCE roles in schema

---

## 7. STAFF / ADMIN IDENTITY

### Two Separate Systems

| Property | Admin (Legacy) | AdminUser (New) |
|---|---|---|
| Model | `Admin` | `AdminUser` |
| Password field | `password` | `passwordHash` |
| Hashing | Unknown (plain?) | bcrypt 12 rounds |
| 2FA | None | TOTP (otplib) |
| Role | `ADMIN` (default) | 6-role RBAC |
| Branch scope | `branchId` (FK) | None |
| Country scope | `region` (default "LK") | `assignedCountries` (CSV) |
| Session | None | `AdminSession` (revocable) |
| Lockout | None | `lockedUntil` + `failedLoginAttempts` |
| Active/inactive | `isActive` | `isActive` + `deletedAt` |
| Connected to User? | NO | NO |

### Admin Roles (AdminUser)
```
SUPER_ADMIN | MANAGER | FINANCE | USER_MANAGEMENT | SUPPORT | TECHNICAL
```

### Legacy Admin Roles
```
ADMIN (single role, no RBAC)
```

### Staff Model
```prisma
model Staff {
  staffId   String   @unique // EMP-001, EMP-002...
  name      String
  phone     String?
  email     String?
  position  String?
  branchId  String?
  isActive  Boolean
}
```

**Staff is NOT connected to AdminUser or User.** It's a separate entity for branch-level employee tracking with no authentication capability.

---

## 8. KYC / IDENTITY VERIFICATION

### KYC Ownership: `User` (direct field + related documents)

| System | Location | Purpose |
|---|---|---|
| `User.identityStatus` | User table | Global KYC status (NOT_SUBMITTED, PENDING, VERIFIED) |
| `IdentityDocument` | User-owned | Document uploads (PASSPORT, NATIONAL_ID, DRIVERS_LICENSE) |
| `TaskerProfile.verificationStatus` | TaskerProfile | Provider-specific verification |
| `CompanyProfile.verificationStatus` | CompanyProfile | Company-specific verification |

### Verification Flow
1. User submits documents → `IdentityDocument.create()` + `User.identityStatus = 'PENDING'`
2. Admin reviews → `IdentityDocument.status = 'APPROVED'` + `User.identityStatus = 'VERIFIED'`
3. For providers: `TaskerProfile.verificationStatus = 'VERIFIED'`
4. For companies: `CompanyProfile.verificationStatus = 'VERIFIED'`

### KYC Gate
Quotes require `identityStatus === 'VERIFIED'` (`v2/quotes/route.ts:18`)

---

## 9. ACCOUNT STATUS MODEL

### User Status Fields
| Field | Type | Meaning |
|---|---|---|
| `isActive` | Boolean | Account enabled/disabled |
| `isSuspended` | Boolean | Temporary suspension |
| `isBanned` | Boolean | Permanent ban |
| `suspendedUntil` | DateTime? | Suspension expiry |
| `suspensionReason` | String? | Why suspended |
| `banReason` | String? | Why banned |
| `identityStatus` | String | KYC status |

### Status Meanings

| Status | Cannot Login? | Cannot Accept Work? | Membership Suspended? |
|---|---|---|---|
| `isActive = false` | YES | YES | N/A |
| `isSuspended = true` | YES (if no expiry or future expiry) | YES | N/A |
| `isBanned = true` | YES (permanent) | YES | N/A |
| `identityStatus ≠ VERIFIED` | NO | Cannot submit quotes | N/A |
| `TaskerProfile.verificationStatus = REJECTED` | NO | Cannot accept jobs | N/A |
| `CompanyProfile.subscriptionStatus = CANCELLED` | NO | Cannot post jobs | YES |

### Conflict: Three Overlapping Status Systems
1. `User.isActive/isSuspended/isBanned` — login-level
2. `TaskerProfile.verificationStatus` — provider capability
3. `CompanyProfile.subscriptionStatus` — company capability

These are NOT unified. A user can be `isActive=true` but `isSuspended=true` — the login check and the work capability check use different fields.

---

## 10. ROLE FIELD AUDIT

### Role Fields Found

| Field | Model | Values | Used By |
|---|---|---|---|
| `role` | User | CUSTOMER, TASKER, COMPANY | Mobile auth, middleware |
| `role` | AdminUser | SUPER_ADMIN, MANAGER, FINANCE, USER_MANAGEMENT, SUPPORT, TECHNICAL | Admin auth, RBAC |
| `role` | Admin | ADMIN (legacy) | Legacy auth |
| `role` | TeamMember | Free string (MEMBER, ADMIN) | Company team |
| `role` | TeamInvite | MEMBER, ADMIN | Company invites |

### Role as String — No Enum
All role fields are `String` with no Prisma enum. Roles are validated in code:
```typescript
const validRoles = ['CUSTOMER', 'TASKER', 'COMPANY']  // register
const validWebRoles = ['SUPER_ADMIN', 'MANAGER', ...]  // middleware
```

### Conflict: User.role vs Actual Profile
A User with `role = 'TASKER'` might not have a `TaskerProfile`. The role field is a soft indicator, not a verified state.

---

## 11. AUTH FOREIGN-KEY MAP

### User Identity Graph
```
User (CORE_IDENTITY)
├── customerProfile: CustomerProfile? (1:1, userId)
│   ├── tags: CustomerTag[]
│   ├── addresses: CustomerAddress[]
│   ├── activities: CustomerActivity[]
│   ├── notes: CustomerNote[]
│   ├── communications: CustomerCommunication[]
│   └── segments: CustomerSegmentCustomer[]
├── taskerProfile: TaskerProfile? (1:1, userId)
│   ├── bids: Bid[]
│   ├── assignments: Assignment[]
│   ├── reviews: TaskerReview[]
│   ├── taskerSkills: TaskerSkill[]
│   ├── bookings: Booking[]
│   ├── matchQueue: JobMatchQueue[]
│   ├── offerMatchQueue: OfferMatchQueue[]
│   └── enrollments: OfferEnrollment[]
├── companyProfile: CompanyProfile? (1:1, userId)
│   ├── teamMembers: TeamMember[]
│   ├── contracts: Contract[]
│   ├── specialties: CompanySpecialty[]
│   ├── invites: TeamInvite[]
│   └── subscriptions: CompanySubscription[]
├── sessions: Session[] (legacy, unused by mobile JWT)
├── otps: OTP[]
├── loginActivities: LoginActivity[]
├── identityDocs: IdentityDocument[]
├── userDevices: UserDevice[]
├── fraudEvents: FraudEvent[]
├── adminFlags: AdminFlag[]
└── notifications: Notification[]
```

### Admin Identity Graph
```
AdminUser (PLATFORM_STAFF)
├── sessions: AdminSession[] (revocable)
├── refreshTokens: AdminRefreshToken[] (unused?)
├── loginAttempts: AdminLoginAttempt[]
├── notifications: AdminNotification[]
└── auditLogs: AuditLog[] (via adminUserId)
```

### Weak/Missing Foreign Keys
| Relationship | Status | Risk |
|---|---|---|
| User → CustomerProfile | Strong (cascade delete) | None |
| User → TaskerProfile | Strong (cascade delete) | None |
| User → CompanyProfile | Strong (cascade delete) | None |
| TeamMember → User | **WEAK (nullable, setNull)** | Orphan members possible |
| TeamMember → CompanyProfile | Strong (cascade delete) | None |
| AdminUser → AdminSession | **Missing FK relation** | Prisma doesn't enforce |
| Staff → Branch | Strong (optional FK) | None |
| IdentityDocument → User | Strong (no cascade) | Orphan docs possible |

---

## 12. FUTURE TARGET OPTIONS

### OPTION A: Common Identity Including Staff

```
HUMAN IDENTITY (User)
├── Customer capability (CustomerProfile)
├── Provider capability (TaskerProfile)
├── Company membership (TeamMember)
├── Staff capability (StaffProfile)
└── Security sessions (unified)
```

**Pros:**
- Single login for all personas
- Simplified KYC (one identity, multiple profiles)
- Easier role transitions (customer → provider)

**Cons:**
- Requires merging AdminUser into User (HIGH risk)
- Admin 2FA/TOTP must be migrated
- Admin RBAC must be preserved
- Staff model is completely separate currently
- Breaking change for all admin authentication

**Migration Risk: HIGH**

### OPTION B: Common Marketplace Identity + Isolated Staff Identity

```
MARKETPLACE IDENTITY (User)
├── Customer capability (CustomerProfile)
├── Provider capability (TaskerProfile)
└── Company membership (TeamMember)

STAFF PRINCIPAL (AdminUser)
├── Platform roles (RBAC)
├── 2FA (TOTP)
├── Scope (country/branch)
└── Separate auth system
```

**Pros:**
- Zero risk to admin authentication
- Admin 2FA/RBAC/session revocation preserved
- Marketplace identity unification is lower risk
- Clear separation of concerns

**Cons:**
- Two auth systems remain (but cleaner)
- Staff cannot act as marketplace users (by design)
- Duplicate email possible across systems (by design)

**Migration Risk: LOW**

### OPTION C: Minimal-Change Compatibility Architecture

```
CURRENT: Keep all systems, add compatibility layer
├── Unify User roles (CUSTOMER/TASKER/COMPANY → multi-capability)
├── Add UserSession table for mobile JWT revocation
├── Keep AdminUser separate
├── Keep Admin/Staff legacy models
└── Add role consistency checks
```

**Pros:**
- Lowest migration risk
- Preserves all existing behavior
- Adds revocation without breaking changes
- Can be done incrementally

**Cons:**
- Doesn't address fundamental architecture
- Multiple auth systems remain
- Technical debt continues

**Migration Risk: VERY LOW**

---

## 13. RECOMMENDED TARGET

### **OPTION B: Common Marketplace Identity + Isolated Staff Identity**

**Rationale:**
1. Admin authentication is MORE complex (2FA, RBAC, session revocation, country scope)
2. Merging AdminUser into User would require migrating ALL admin auth — HIGH risk with minimal benefit
3. Marketplace users (customer, provider, company) share the same JWT, same auth flow, same profiles
4. The current architecture already treats them as one identity with different capabilities
5. Staff identity is correctly isolated — platform operators should not be marketplace participants

**Implementation scope:**
1. Unify `User.role` from single string to multi-capability model
2. Add `UserSession` table for mobile JWT revocation
3. Enforce profile consistency (role ↔ profile existence)
4. Keep `AdminUser` + `AdminSession` as-is
5. Keep `Admin` + `Staff` legacy models (deprecate later)

---

## 14. MIGRATION RISKS

| Risk | Severity | Mitigation |
|---|---|---|
| Merging AdminUser into User | HIGH | Don't do it (Option B) |
| Breaking mobile JWT | MEDIUM | Add UserSession without changing JWT format |
| Orphan TeamMember records | LOW | Add validation, not cascade |
| Role consistency violations | LOW | Add application-level checks first |
| Email collision across systems | NONE | By design (separate tables) |
| Phone normalization inconsistency | MEDIUM | Add normalization before unique constraint |
| Legacy Admin model confusion | LOW | Document as deprecated, don't remove yet |

---

## 15. UNRESOLVED QUESTIONS

1. **Is `AdminRefreshToken` actually used?** — `AdminSession` comment says "replaces AdminRefreshToken" but both models exist
2. **Is `Staff` model used anywhere?** — Schema defines it but no API routes create/query it
3. **Company profile creation** — No `prisma.companyProfile.create()` found in routes; how are companies onboarded?
4. **User.role transition** — Can a user change from CUSTOMER to TASKER? No route does this currently
5. **Password hashing inconsistency** — User uses bcrypt+pepper, AdminUser uses plain bcrypt(12) — should these be unified?

---

PHASE 3 STEP 3 COMPLETE — IDENTITY MODEL READY FOR REVIEW
