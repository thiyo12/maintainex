# 05A-CURRENCY-POLICY.md — Currency Handling Audit

**Date**: Sep 8, 2026
**Evidence**: Schema analysis, production data, code review

---

## CURRENT STATE

### Currency in Schema

| Model | Field | Currency | Stored As |
|-------|-------|----------|-----------|
| ProviderWallet | availableBalance | LKR | Float |
| ProviderWallet | pendingBalance | LKR | Float |
| CustomerWallet | balance | LKR | Float |
| WalletTransaction | amount | LKR | Float |
| JobEscrow | amount | LKR (cents) | BigInt |
| JobEscrow | serviceFee | LKR (cents) | BigInt |
| JobEscrow | totalAmount | LKR (cents) | BigInt |
| CommissionSettlement | jobAmount | LKR (cents) | BigInt |
| CommissionSettlement | commissionAmount | LKR (cents) | BigInt |
| WeeklySettlement | totalEarnings | LKR | Float |
| WeeklySettlement | commissionOwed | LKR | Float |
| CommissionPayment | amountDue | LKR | Float |
| MarketplaceJob | budgetAmount | LKR (cents) | BigInt |
| JobQuote | price | LKR (cents) | BigInt |
| Booking | totalPrice | LKR | Float |
| Invoice | subtotal, tax, total | LKR | Float |

### Currency Field in Schema

| Model | Field | Value | Notes |
|-------|-------|-------|-------|
| PlatformSettings | currency | "LKR" | Hardcoded |
| CustomerWallet | currency | "LKR" | Default |
| ProviderWallet | currency | "LKR" | Default |

### Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| No currency column on most tables | P1 | Currency is implicit (always LKR) |
| Mixed units (Float LKR vs BigInt cents) | P0 | Same currency, different representations |
| No currency validation | P2 | Nothing prevents non-LKR values |
| No multi-currency prep | P3 | System hardcoded to LKR only |

---

## CURRENCY POLICY

### Decision: LKR-Only, Integer Cents

1. **Single currency**: LKR (Sri Lankan Rupee)
2. **No sub-unit**: LKR has no official sub-unit in daily use (no cents in circulation)
3. **Storage unit**: Integer cents (BigInt) for precision
4. **Display unit**: Whole LKR (divide by 100 for display)
5. **API format**: String serialization of integer cents

### Why Cents if LKR Has No Cents?

- Escrow layer already uses BigInt cents
- Prevents floating-point drift
- Industry standard (all payment systems use smallest unit)
- Future-proofs for potential sub-unit support
- Consistent with existing BigInt fields

### Currency Display Rules

```
Storage:  2908414 (BigInt cents)
Display:  LKR 29,084.14
API:      "2908414" (string)
Mobile:   29084.14 (Number, formatted with locale)
```

### Currency Validation

```typescript
const LKR_MIN = 0n;           // Zero
const LKR_MAX = 100_000_000n; // LKR 1,000,000.00 (100M cents)

function validateAmount(amount: bigint): void {
  if (amount < LKR_MIN) throw new Error('Amount cannot be negative');
  if (amount > LKR_MAX) throw new Error('Amount exceeds maximum');
}
```

---

## MULTI-CURRENCY READINESS

### Not Required Now, But:

| Aspect | Current | Future-Proof Design |
|--------|---------|---------------------|
| Currency field | Implicit LKR | Add `currency` column to all financial tables |
| Exchange rate | N/A | Add `ExchangeRate` model |
| Rounding | N/A (integer) | Use `Decimal` if multi-currency added |
| Display formatting | LKR prefix | Use Intl.NumberFormat with locale |

### Migration: Add Currency Column

```sql
-- Future migration (NOT Phase 5)
ALTER TABLE "ProviderWallet" ADD COLUMN "currency" TEXT DEFAULT 'LKR';
ALTER TABLE "CustomerWallet" ADD COLUMN "currency" TEXT DEFAULT 'LKR';
ALTER TABLE "WalletTransaction" ADD COLUMN "currency" TEXT DEFAULT 'LKR';
ALTER TABLE "JobEscrow" ADD COLUMN "currency" TEXT DEFAULT 'LKR';
```

---

## SUMMARY

| Question | Answer |
|----------|--------|
| What currency? | LKR only |
| What unit? | Integer cents (BigInt) |
| Multi-currency? | Not now, future-proof design |
| Sub-unit? | No (cents not in circulation) |
| Display format? | LKR XX,XXX.XX |
| API format? | String of integer cents |
