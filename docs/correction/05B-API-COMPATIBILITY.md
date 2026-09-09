# Phase 5B: API Compatibility

**Status:** PHASE 5B COMPLETE  
**File:** `lib/money.ts` → `serializeMoney()`, `jsonSerializeMoney()`

## BigInt Serialization

BigInt cannot be serialized to JSON natively. All API responses use string representation.

```typescript
serializeMoney(money) // → "12345" (string)
jsonSerializeMoney(money) // → "12345" (safe for JSON.stringify)
```

## API Response Format

All financial fields in API responses use string-encoded BigInt:

```json
{
  "balance": "50000",
  "amount": "1999",
  "currency": "LKR"
}
```

## Mobile App Compatibility

### Current State (Phase 5A)

Mobile app already handles string balances from legacy code.

### Phase 5B Impact

- New BigInt shadow columns return as strings (same format)
- Old Float columns still available during transition
- Mobile app can read either format

### bigint-polyfill.json

Defines which fields are BigInt (string) vs Float (number):

```json
{
  "bigint_fields": {
    "ProviderWallet": ["availableBalanceMinor", "pendingBalanceMinor"],
    "CustomerWallet": ["balanceMinor"],
    "WalletTransaction": ["amountMinor", "balanceBeforeMinor", "balanceAfterMinor"],
    "WeeklySettlement": ["totalEarningsMinor", "commissionOwedMinor"],
    "CommissionPayment": ["amountDueMinor"]
  },
  "float_fields": {
    "ProviderWallet": ["availableBalance", "pendingBalance"],
    "CustomerWallet": ["balance"],
    "WalletTransaction": ["amount", "balanceBefore", "balanceAfter"],
    "WeeklySettlement": ["totalEarnings", "commissionOwed"],
    "CommissionPayment": ["amountDue"]
  }
}
```

## Field Mapping

| Old (Float) | New (BigInt) | API Format |
|-------------|-------------|------------|
| `balance` | `balanceMinor` | String |
| `amount` | `amountMinor` | String |
| `availableBalance` | `availableBalanceMinor` | String |
| `pendingBalance` | `pendingBalanceMinor` | String |
| `totalEarnings` | `totalEarningsMinor` | String |
| `commissionOwed` | `commissionOwedMinor` | String |
| `amountDue` | `amountDueMinor` | String |

## No Breaking Changes

- Float columns remain available
- New BigInt columns are additive
- Mobile app can transition gradually
