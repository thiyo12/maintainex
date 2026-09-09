# 05A-API-MONEY-CONTRACT.md — API Serialization Policy

**Date**: Sep 8, 2026
**Evidence**: Code analysis, mobile app integration

---

## CURRENT STATE

### Money Fields in API Responses

| Field | Current Type | Serialized As | Mobile Parsing |
|-------|-------------|---------------|----------------|
| ProviderWallet.availableBalance | Float | JSON number | `Number(value)` |
| ProviderWallet.pendingBalance | Float | JSON number | `Number(value)` |
| CustomerWallet.balance | Float | JSON number | `Number(value)` |
| WalletTransaction.amount | Float | JSON number | `Number(value)` |
| JobEscrow.amount | BigInt | JSON string (Prisma default) | `BigInt(value)` or `Number(value)` |
| CommissionSettlement.commissionAmount | BigInt | JSON string | `Number(value)` |
| WeeklySettlement.totalEarnings | Float | JSON number | `Number(value)` |

### Cross-Model Type Mismatch in API

| Endpoint | Field A | Field B | Mismatch |
|----------|---------|---------|----------|
| Job detail | JobEscrow.amount (BigInt) | WalletTransaction.amount (Float) | Same money, different types |
| Settlement view | CommissionSettlement.commissionAmount (BigInt) | WeeklySettlement.commissionOwed (Float) | Same money, different types |

---

## SERIALIZATION POLICY (Post-Migration)

### Rule 1: All Monetary BigInts to JSON Strings

Prisma default: BigInt serialized as string in JSON. No custom serialization needed.

Response format:

```json
{
  "availableBalance": "2908414",
  "amount": "800000",
  "commissionAmount": "30628"
}
```

### Rule 2: Mobile App Parses as Number

```typescript
const balance = Number(response.availableBalance);
```

Safe because LKR amounts never exceed Number.MAX_SAFE_INTEGER (9,007,199,254,740,991).

### Rule 3: Display Formatting

```typescript
// Cents to LKR display
function formatLKR(cents: number): string {
  const lkr = cents / 100;
  return `LKR ${lkr.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
}

// Examples:
formatLKR(2908414) // "LKR 29,084.14"
formatLKR(800000)  // "LKR 8,000.00"
formatLKR(30628)   // "LKR 306.28"
```

### Rule 4: Input Validation

```typescript
// API accepts cents as string or number
function parseAmount(input: string | number): bigint {
  if (typeof input === 'string') {
    const parsed = BigInt(input);
    if (parsed < 0n) throw new Error('Amount cannot be negative');
    return parsed;
  }
  return BigInt(Math.round(input));
}
```

---

## API CONTRACT MATRIX

### Wallet Endpoints

| Endpoint | Method | Request Body | Response |
|----------|--------|-------------|----------|
| `/api/mobile/v2/wallet` | GET | — | `{ balance: "1095942" }` |
| `/api/mobile/withdraw` | POST | `{ amount: "500000" }` | `{ payout: { id, amount: "500000" } }` |

### Escrow Endpoints

| Endpoint | Method | Request Body | Response |
|----------|--------|-------------|----------|
| `/api/mobile/v2/jobs/[id]/escrow` | POST | `{ amount: "800000", paymentMethod: "CARD" }` | `{ escrow: { id, amount: "800000", status: "PROTECTED" } }` |
| `/api/mobile/v2/jobs/[id]/escrow/refund` | POST | — | `{ escrow: { id, status: "REFUNDED" } }` |
| `/api/mobile/v2/jobs/[id]/release-escrow` | POST | — | `{ escrow: { id, status: "RELEASED" } }` |
| `/api/mobile/v2/jobs/[id]/complete` | POST | — | `{ job: { id, status: "COMPLETED" } }` |

### Admin Endpoints

| Endpoint | Method | Request Body | Response |
|----------|--------|-------------|----------|
| `/api/mobile/v2/admin/escrows` | PATCH | `{ escrowId, action: "release" }` | `{ escrow: { id, status: "RELEASED" } }` |
| `/api/admin/commission` | GET | — | `{ settlements: [...], total: "8748300" }` |

---

## MOBILE APP COMPATIBILITY

### Current Mobile Code

```typescript
// wallet.ts
const balance = Number(wallet.balance); // Works with Float

// escrow.ts
const amount = Number(escrow.amount); // Works with BigInt string
```

### Post-Migration Mobile Code

```typescript
// Same code works — BigInt serialized as string, Number() parses it
const balance = Number(wallet.balance); // "1095942" -> 1095942
const amount = Number(escrow.amount);   // "800000" -> 800000
```

### Breaking Change Risk: NONE

All monetary amounts are whole numbers. Number() handles string-to-number conversion correctly for all production values.

---

## SERIALIZATION FORMAT

### Standard Response Envelope

```json
{
  "success": true,
  "data": {
    "wallet": {
      "id": "cw_abc123",
      "balance": "1095942",
      "currency": "LKR"
    },
    "transactions": [
      {
        "id": "wt_def456",
        "amount": "800000",
        "balanceBefore": "1895942",
        "balanceAfter": "1095942",
        "entryType": "DEBIT",
        "referenceType": "ESCROW_DEPOSIT",
        "createdAt": "2026-09-08T10:30:00Z"
      }
    ]
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient balance",
    "details": {
      "available": "500000",
      "requested": "800000"
    }
  }
}
```

---

## VALIDATION RULES

| Rule | Implementation |
|------|----------------|
| Amount must be positive | `amount > 0n` |
| Amount must be whole cents | `amount % 1n === 0n` |
| Amount must not exceed max | `amount <= MAX_AMOUNT` (LKR 1,000,000) |
| Currency must be LKR | `currency === 'LKR'` |
| Idempotency key required | Header `X-Idempotency-Key` |
