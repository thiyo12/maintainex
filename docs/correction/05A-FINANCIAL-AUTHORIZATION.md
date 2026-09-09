# 05A-FINANCIAL-AUTHORIZATION.md — Auth Audit for Financial Operations

**Date**: Sep 8, 2026
**Evidence**: Code analysis of all 27 financial writers

---

## AUTHORIZATION MATRIX

| Operation | Required Role | Auth Check | File:Line |
|-----------|---------------|------------|-----------|
| Fund escrow | Customer (job owner) | `assertOwnership(job.customerId)` | `escrow/route.ts:16` |
| Refund escrow | Customer (job owner) | `assertOwnership(job.customerId)` | `escrow/refund/route.ts:15` |
| Manual release | Customer (job owner) | `assertOwnership(job.customerId)` | `release-escrow/route.ts:17` |
| Complete job | Customer or Provider | `assertParticipant()` | `complete/route.ts:24` |
| Cash payment | Customer or Provider | `assertParticipant()` | `cash-payment/route.ts` |
| Admin force-release | Admin (FINANCE+) | `getAdminSession()` | `admin/escrows/route.ts` |
| Admin force-refund | Admin (FINANCE+) | `getAdminSession()` | `admin/escrows/route.ts` |
| Withdrawal request | Provider (wallet owner) | `assertOwnership(providerId)` | `withdraw/route.ts` |
| Commission settle | Admin (FINANCE+) | `getAdminSession()` | `admin/commission-settle/route.ts` |
| Wallet freeze/unfreeze | Admin (SUPER_ADMIN) | `getAdminSession()` | `admin/financial/wallets/route.ts` |

---

## AUTHORIZATION GAPS

### Gap 1: Missing Ownership Check on Escrow Fund

**File**: `app/api/mobile/v2/jobs/[id]/escrow/route.ts:16`

**Issue**: Checks job exists but does not verify `job.customerId === userId`.

**Impact**: Any authenticated user could fund escrow for any job.

**Fix**: Add `assertOwnership(job.customerId, userId)`.

### Gap 2: No Amount Validation on Force-Release

**File**: `app/api/mobile/v2/admin/escrows/route.ts:60`

**Issue**: Admin can release any amount, including amounts exceeding escrow balance.

**Impact**: Admin could credit provider with more than escrow holds.

**Fix**: Validate `payout <= escrow.amount` before crediting.

### Gap 3: No Rate Limiting on Financial Endpoints

**Issue**: No rate limit on escrow fund, release, or refund endpoints.

**Impact**: Brute-force or script attacks could drain wallets.

**Fix**: Add rate limiting (e.g., 10 requests/minute per user on financial endpoints).

### Gap 4: isFrozen Not Checked

**File**: All wallet debit/credit operations

**Issue**: `CustomerWallet.isFrozen` and `ProviderWallet.isFrozen` are never checked in financial flows.

**Impact**: Frozen wallets can still transact.

**Fix**: Add `assertNotFrozen(wallet)` before every debit/credit.

### Gap 5: No KYC Check on Withdrawal

**File**: `app/api/mobile/withdraw/route.ts`

**Issue**: No `identityStatus === 'VERIFIED'` check.

**Impact**: Unverified providers could withdraw funds.

**Fix**: Add KYC verification check before allowing withdrawal.

---

## RBAC ROLES FOR FINANCE

| Role | Can Do | Cannot Do |
|------|--------|-----------|
| SUPER_ADMIN | Everything | — |
| FINANCE | View/settle commission, view wallets, approve withdrawals | Force-release/refund escrow |
| MANAGER | View financial reports | Modify balances |
| SUPPORT | View dispute-related escrows | Modify balances |
| USER_MANAGEMENT | View provider wallets (fraud) | Modify balances |

---

## SESSION VALIDATION

### Mobile Auth

```typescript
// Every financial endpoint:
const session = await getSessionFromCookie(request);
assertNotSuspended(session.userId);
assertOwnership(resourceOwnerId, session.userId);
```

### Admin Auth

```typescript
// Every admin financial endpoint:
const admin = await getAdminSession(request);
assertRole(admin, ['SUPER_ADMIN', 'FINANCE']);
logAudit(admin.id, 'FINANCIAL_ACTION', { action, resourceId });
```

---

## AUDIT LOGGING

### Current State

| Operation | Audit Logged? | File |
|-----------|--------------|------|
| Escrow fund | ❌ NO | `escrow/route.ts` |
| Escrow refund | ❌ NO | `escrow/refund/route.ts` |
| Manual release | ❌ NO | `release-escrow/route.ts` |
| Completion release | ❌ NO | `complete/route.ts` |
| Admin force-release | ❌ NO | `admin/escrows/route.ts` |
| Admin force-refund | ❌ NO | `admin/escrows/route.ts` |
| Cash payment | ❌ NO | `cash-payment/route.ts` |
| Auto-release cron | ❌ NO | `cron/escrow-release/route.ts` |
| Commission settle | ❌ NO | `admin/commission-settle/route.ts` |
| Wallet freeze | ❌ NO | `admin/financial/wallets/route.ts` |

**0 of 10 financial operations have audit logging.**

### Required Audit Fields

```typescript
interface FinancialAuditLog {
  id: string;
  actorId: string;        // userId or adminId
  actorType: 'USER' | 'ADMIN' | 'SYSTEM';
  action: string;         // 'ESCROW_FUND' | 'ESCROW_RELEASE' | etc.
  resourceId: string;     // escrowId, walletId, etc.
  resourceType: string;   // 'JobEscrow' | 'ProviderWallet' | etc.
  amount?: bigint;
  currency: string;       // 'LKR'
  metadata?: JSON;
  createdAt: DateTime;
}
```

---

## SUMMARY

| Aspect | Status |
|--------|--------|
| Ownership checks | ⚠️ Partial (missing on escrow fund) |
| Amount validation | ❌ Missing on admin force-release |
| Rate limiting | ❌ Not implemented |
| Frozen wallet check | ❌ Not implemented |
| KYC check on withdrawal | ❌ Not implemented |
| Audit logging | ❌ 0 of 10 operations logged |
| RBAC | ✅ Admin roles defined |
| Session validation | ✅ Mobile + admin auth working |
