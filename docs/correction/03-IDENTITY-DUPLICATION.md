# 03 — Identity Duplication Analysis

**Date**: 2026-09-07
**Status**: STEP 3 SUPPLEMENTARY — CREATION PATHS TRACED

---

## Identity Creation Routes

### 1. Mobile Registration
**File**: `app/api/mobile/auth/register/route.ts`
**Creates**: User + TaskerProfile (if role=TASKER)
**Uniqueness check**:
- Email: `prisma.user.findUnique({ where: { email } })` — exact match
- Phone: `prisma.user.findFirst({ where: { phone: { endsWith: digits } } })` — last 9 digits
**Duplicate risk**: LOW (checks both email and phone)

### 2. CRM Customer Creation
**File**: `app/api/customers/route.ts`
**Creates**: User + CustomerProfile
**Uniqueness check**:
- By email: `prisma.user.findUnique({ where: { email } })` — exact match
- By phone: `prisma.user.findFirst({ where: { phone: sanitizePhone(phone) } })` — raw match
**Duplicate risk**: MEDIUM
- Creates placeholder email if no email: `phone_${Date.now()}@placeholder.com`
- No cross-check between email and phone paths
- Could create duplicate if same person has different contact methods

### 3. Admin Creation
**File**: `app/api/admin/admins/route.ts`
**Creates**: AdminUser
**Uniqueness check**: `prisma.adminUser.findUnique({ where: { email } })`
**Duplicate risk**: NONE (separate table from User)

### 4. Mobile Profile Update (CustomerProfile)
**File**: `app/api/mobile/auth/profile/route.ts`
**Creates**: CustomerProfile (if not exists)
**Uniqueness check**: `prisma.customerProfile.findUnique({ where: { userId: user.id } })`
**Duplicate risk**: NONE (upsert pattern)

### 5. Company Team Accept
**File**: `app/api/mobile/company/team/accept/route.ts`
**Creates**: TeamMember
**Uniqueness check**: None (relies on invite token)
**Duplicate risk**: LOW (invite-based flow)

### 6. Identity Document Submission
**File**: `app/api/mobile/v2/identity/route.ts`
**Creates**: IdentityDocument
**Uniqueness check**: None (allows multiple documents)
**Duplicate risk**: NONE (by design — multiple docs per user)

---

## Duplicate Identity Scenarios

### Scenario 1: Same Person, Different Roles
**Risk**: MEDIUM
- Person registers as CUSTOMER with email A
- Same person registers as TASKER with email B
- Two separate User records, same human
- No detection mechanism

**Evidence**: Registration only checks email/phone uniqueness, not identity

### Scenario 2: CRM + Self-Registration
**Risk**: MEDIUM
- Admin creates customer via CRM with email X
- Same person self-registers via mobile with email X
- CRM creates User record, self-registration would fail on email unique
- But if CRM uses phone-only, self-registration with different email succeeds

**Evidence**: CRM route creates placeholder emails for phone-only customers

### Scenario 3: Admin + User Same Email
**Risk**: NONE (by design)
- AdminUser.email and User.email are in separate tables
- Same email can exist in both
- Auth systems are completely separate

### Scenario 4: Company Worker Without User
**Risk**: LOW
- TeamMember.userId is nullable
- Company can add team members without User accounts
- These members cannot authenticate

**Evidence**: Schema allows `userId: null` on TeamMember

---

## Prevention Mechanisms

| Mechanism | Status | Effectiveness |
|---|---|---|
| Email unique constraint (User) | ACTIVE | Prevents duplicate emails in User table |
| Phone endsWith check (register) | ACTIVE | Prevents duplicate phones (last 9 digits) |
| Phone raw check (CRM) | ACTIVE | Prevents exact phone match |
| Role consistency check | MISSING | No validation that role matches profile existence |
| Cross-system identity check | MISSING | No check between User and AdminUser |
| TeamMember userId constraint | MISSING | Allows orphan members |

---

PHASE 3 STEP 3 SUPPLEMENTARY — IDENTITY DUPLICATION ANALYSIS COMPLETE
