# 05A-MONEY-TYPE-DECISION.md — Float vs BigInt vs Decimal

**Date**: Sep 8, 2026
**Evidence**: Schema inventory (34 models, 97 fields), production data audit

---

## CURRENT TYPE DISTRIBUTION

| Type | Fields | Production Status |
|------|--------|-------------------|
| Float (IEEE 754) | 56 | ALL whole numbers (no fractional values) |
| BigInt | 10 | All monetary amounts in cents |
| Int | 3 | Whole LKR amounts or basis points |
| Decimal | 0 | Not used anywhere |

---

## DECISION: USE BigInt (cents) FOR ALL MONETARY FIELDS

### Rationale

| Factor | Float | BigInt (cents) | Decimal(12,2) |
|--------|-------|----------------|---------------|
| Precision | ❌ Rounding errors on fractions | ✅ Exact integer arithmetic | ✅ Exact decimal arithmetic |
| Production evidence | All whole numbers, no drift detected | Escrow layer already uses cents | Not used, untested |
| Migration complexity | N/A (already in place) | Medium — cents conversion | High — schema + all code |
| ORM support | Native | Native (Prisma BigInt) | Native (Prisma Decimal) |
| JavaScript safety | ❌ `0.1 + 0.2 !== 0.3` | ✅ Native bigint | ⚠️ Requires decimal.js library |
| API serialization | ⚠️ JSON number (lossy) | ⚠️ JSON string needed | ⚠️ JSON string needed |
| Existing codebase | 56 fields to migrate | 10 fields already correct | 0 fields — greenfield |
| Storage size | 8 bytes | 8 bytes | Variable (up to 16 bytes) |

### Why NOT Float

1. **IEEE 754 rounding**: `0.1 + 0.2 = 0.30000000000000004`
2. **Production data shows whole numbers**: This is LUCK, not correctness
3. **Volume growth**: As transaction count increases, drift accumulates
4. **Cross-system transfers**: Float → BigInt boundary conversion loses precision
5. **Industry standard**: Stripe, Square, PayPal all use integer cents

### Why NOT Decimal(12,2)

1. **No existing Decimal usage**: Zero fields, zero test coverage
2. **decimal.js dependency**: Adds bundle size and runtime cost
3. **Prisma Decimal limitations**: Some Prisma operations less optimized
4. **Overkill for LKR**: Sri Lankan Rupee has no sub-unit in practice (no cents used)
5. **Production evidence**: ALL production amounts are whole numbers

### Why BigInt (cents)

1. **Already correct for 10 fields**: JobEscrow.amount, CommissionSettlement.commissionAmount, etc.
2. **Zero precision loss**: Integer arithmetic is exact
3. **Native JavaScript**: `bigint` type, no library needed
4. **Production-proven**: The 10 BigInt fields have zero issues
5. **Simple migration**: `Float → BigInt` = multiply by 100, `BigInt → Float` = divide by 100

---

## MIGRATION STRATEGY

### Phase 5A: Critical Financial Fields (Float → BigInt cents)

| Model | Field | Current | Target | Conversion |
|-------|-------|---------|--------|------------|
| ProviderWallet | availableBalance | Float | BigInt | × 100 |
| ProviderWallet | pendingBalance | Float | BigInt | × 100 |
| CustomerWallet | balance | Float | BigInt | × 100 |
| WalletTransaction | amount | Float | BigInt | × 100 |
| WalletTransaction | balanceBefore | Float | BigInt | × 100 |
| WalletTransaction | balanceAfter | Float | BigInt | × 100 |
| WeeklySettlement | totalEarnings | Float | BigInt | × 100 |
| WeeklySettlement | commissionOwed | Float | BigInt | × 100 |
| CommissionPayment | amountDue | Float | BigInt | × 100 |

**Total: 9 fields, all with production data**

### Phase 5B: Non-Critical Fields (Float → BigInt cents)

| Model | Field | Current | Target | Conversion |
|-------|-------|---------|--------|------------|
| CommissionSettlement | commissionRate | Float | Int | Already integer (10) |
| WeeklySettlement | commissionRate | Float | Int | Already integer (10) |
| Invoice | subtotal, tax, total, amountPaid | Float | BigInt | × 100 |
| InvoiceItem | quantity, unitPrice, totalPrice | Float | BigInt | × 100 |
| Booking | totalPrice, budgetMin, budgetMax | Float | BigInt | × 100 |
| Service | price | Float | BigInt | × 100 |
| JobPosting | budget | Float | BigInt | × 100 |

### Phase 5C: Config/Display Fields (Keep Float or Convert to Int)

| Model | Field | Decision | Rationale |
|-------|-------|----------|-----------|
| CompanyProfile | commissionRate | Int | Rate is always integer % (10) |
| PlatformSettings | commissionRate | Int | Rate is always integer % (10) |
| PlatformSettings | platformFeeBps | Int | Already Int, safe |
| TaskerProfile | hourlyRate | Float → Int | Hourly rate is whole LKR |
| TaskerSkill | hourlyRate, fixedRate | Float → Int | Rate is whole LKR |
| PricingModel | baseRate, travelCostPerKm, materialCostFactor | Float → Int | Config values |

### Conversion SQL

```sql
-- Phase 5A: Critical financial fields
UPDATE "ProviderWallet" SET "availableBalance" = ROUND("availableBalance" * 100);
UPDATE "ProviderWallet" SET "pendingBalance" = ROUND("pendingBalance" * 100);
UPDATE "CustomerWallet" SET balance = ROUND(balance * 100);
UPDATE "WalletTransaction" SET amount = ROUND(amount * 100);
UPDATE "WalletTransaction" SET "balanceBefore" = ROUND("balanceBefore" * 100);
UPDATE "WalletTransaction" SET "balanceAfter" = ROUND("balanceAfter" * 100);
UPDATE "WeeklySettlement" SET "totalEarnings" = ROUND("totalEarnings" * 100);
UPDATE "WeeklySettlement" SET "commissionOwed" = ROUND("commissionOwed" * 100);
UPDATE "CommissionPayment" SET "amountDue" = ROUND("amountDue" * 100);
```

### Prisma Schema Change

```prisma
model ProviderWallet {
  id               String @id @default(cuid())
  availableBalance BigInt @default(0)  // Was: Float
  pendingBalance   BigInt @default(0)  // Was: Float
  // ...
}

model CustomerWallet {
  id      String @id @default(cuid())
  balance BigInt @default(0)  // Was: Float
  // ...
}

model WalletTransaction {
  id            String @id @default(cuid())
  amount        BigInt  // Was: Float
  balanceBefore BigInt  // Was: Float
  balanceAfter  BigInt  // Was: Float
  // ...
}
```

### API Serialization

```typescript
// All monetary BigInts serialized as strings in JSON
// Mobile app parses as number (LKR never exceeds Number.MAX_SAFE_INTEGER)

// Server response:
{ "availableBalance": "2908414" }  // String in JSON

// Mobile client:
const balance = Number(response.availableBalance); // Safe for LKR amounts
```

---

## RISK ASSESSMENT

| Risk | Mitigation |
|------|------------|
| Production data has non-whole numbers | Audit: ALL 97 fields have 0 fractional values in production |
| Migration breaks in-flight transactions | Migration runs during maintenance window, 0 active sessions |
| Mobile app can't parse BigInt | Serialize as string, parse as number on client |
| Float drift already exists | Production sums are all whole numbers — no drift detected |
| Cross-model type mismatch | Phase 5 fixes all mismatches simultaneously |
