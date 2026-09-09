# Phase 5B: Money Utility Module

**Status:** PHASE 5B COMPLETE  
**File:** `lib/money.ts`

## Design

- **Type:** BigInt (cents, LKR, exponent 2)
- **Frozen from Phase 5A** — no changes to core money type
- **Serialization:** BigInt → string for JSON/API transport

## API Reference

### Construction

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `createMoney(amount, currency?)` | number/string/bigint | Money | Main constructor |
| `lkrCents(cents)` | bigint | Money | LKR in minor units |
| `lkrRupees(rupees)` | number | Money | LKR from major units |

### Conversion

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `toMinorUnitsSafe(money)` | Money | bigint | Safe extraction |
| `legacyToMinorUnits(float, exponent?)` | number | bigint | Float → BigInt |
| `hasFractionalParts(float, exponent?)` | number | boolean | Lossy conversion check |
| `minorUnitsToDisplay(minorUnits)` | bigint | string | Human-readable |
| `minorUnitsToMajorUnits(minorUnits)` | bigint | number | Back to Float (display only) |

### Arithmetic

| Function | Input | Output |
|----------|-------|--------|
| `addMoney(a, b)` | Money, Money | Money |
| `subtractMoney(a, b)` | Money, Money | Money |
| `multiplyMoney(m, factor)` | Money, number | Money |
| `divideMoney(m, divisor)` | Money, number | Money |

### Comparison

| Function | Input | Output |
|----------|-------|--------|
| `moneyEquals(a, b)` | Money, Money | boolean |
| `moneyGreaterThan(a, b)` | Money, Money | boolean |
| `moneyGreaterThanOrEqual(a, b)` | Money, Money | boolean |
| `moneyIsZero(m)` | Money | boolean |

### Validation

| Function | Input | Output |
|----------|-------|--------|
| `validatePositive(m)` | Money | boolean |
| `validateNonNegative(m)` | Money | boolean |

### Commission

| Function | Input | Output |
|----------|-------|--------|
| `computeCommission(amount, rate)` | Money, number | Money |
| `computeCommissionFromBps(amount, bps)` | Money, bigint | Money |

### Serialization

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `serializeMoney(money)` | Money | string | BigInt → string |
| `deserializeMoney(str)` | string | Money | String → BigInt |
| `jsonSerializeMoney(money)` | Money | JsonValue | Safe for JSON |
| `jsonDeserializeMoney(json)` | JsonValue | Money | Parse from JSON |

### Constants

```typescript
export const ZERO_LKR: Money = { amount: 0n, currency: 'LKR' };
```

## Conversion Safety

```typescript
// Legacy float → BigInt (lossy if Float has decimals)
legacyToMinorUnits(19.99) // → 1999n (safe for 2 decimal places)
legacyToMinorUnits(19.999) // → 1999n (LOSSY — fractional parts detected)
```

The `hasFractionalParts` function warns before data loss during backfill.
