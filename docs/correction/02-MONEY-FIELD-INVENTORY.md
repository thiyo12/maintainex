# MaintainEX Money Field Inventory

## Summary

| Category | Count | Type | Risk |
|---|---|---|---|
| Float (legacy) | ~25 | Float | MIGRATE-IN-FINANCIAL-PHASE |
| BigInt (cents) | ~8 | BigInt | SAFE (phase 1 escrow) |
| Int (non-monetary) | ~10 | Int | SAFE |

## Detailed Inventory

### HIGH PRIORITY — Active Financial Fields

| Model | Field | Type | Unit | Notes | Risk |
|---|---|---|---|---|---|
| `ProviderWallet` | `availableBalance` | Float | Unknown | Used for withdrawals | MIGRATE |
| `ProviderWallet` | `pendingBalance` | Float | Unknown | Used for pending payouts | MIGRATE |
| `CustomerWallet` | `balance` | Float | Unknown | Customer balance | MIGRATE |
| `WalletTransaction` | `amount` | Float | Unknown | Transaction amount | MIGRATE |
| `WalletTransaction` | `balanceBefore` | Float | Unknown | Audit trail | MIGRATE |
| `WalletTransaction` | `balanceAfter` | Float | Unknown | Audit trail | MIGRATE |
| `JobEscrow` | `amount` | BigInt | Cents | Escrow amount | SAFE |
| `JobEscrow` | `serviceFee` | BigInt | Cents | Platform fee | SAFE |
| `JobEscrow` | `totalAmount` | BigInt | Cents | Total | SAFE |
| `JobEscrow` | `jobAmount` | BigInt | Cents | Job amount | SAFE |
| `JobEscrow` | `commissionAmount` | BigInt | Cents | Commission | SAFE |

### MEDIUM PRIORITY — Pricing/Quotes

| Model | Field | Type | Unit | Notes | Risk |
|---|---|---|---|---|---|
| `JobQuote` | `amount` | BigInt | Cents | Quote price | SAFE |
| `MarketplaceJob` | `budgetAmount` | BigInt | Cents | Job budget | SAFE |
| `MarketplaceJob` | `price` | BigInt | Cents | Job price | SAFE |
| `ServicePricing` | `hourlyRate` | Float | Unknown | Provider rate | MIGRATE |
| `ServicePricing` | `fixedRate` | Float | Unknown | Provider rate | MIGRATE |
| `PricingModel` | `baseRate` | Float | Unknown | Training model | MIGRATE |
| `PlatformSettings` | `minJobAmountCents` | BigInt | Cents | Platform setting | SAFE |
| `PlatformSettings` | `maxJobAmountCents` | BigInt | Cents | Platform setting | SAFE |

### LOW PRIORITY — CRM/Invoice

| Model | Field | Type | Unit | Notes | Risk |
|---|---|---|---|---|---|
| `CustomerProfile` | `totalSpent` | Float | Unknown | CRM total | MIGRATE |
| `CustomerProfile` | `lifetimeValue` | Float | Unknown | CRM LTV | MIGRATE |
| `Invoice` | `subtotal` | Float | Unknown | Invoice total | MIGRATE |
| `Invoice` | `total` | Float | Unknown | Invoice total | MIGRATE |
| `InvoiceItem` | `unitPrice` | Float | Unknown | Line item | MIGRATE |
| `InvoiceItem` | `totalPrice` | Float | Unknown | Line item | MIGRATE |
| `PricingCache` | `priceLkr` | Float | LKR | Cached price | MIGRATE |
| `Service` | `price` | Float | Unknown | Service price | MIGRATE |
| `Booking` | `totalPrice` | Float | Unknown | Booking total | MIGRATE |
| `SeasonalOffer` | `discountValue` | Float | Unknown | Discount | MIGRATE |
| `FlashOffer` | `amount` | Float | Unknown | Flash offer | MIGRATE |

### NOT MONETARY — Safe as-is

| Model | Field | Type | Notes |
|---|---|---|---|
| `PlatformSettings` | `platformFeeBps` | Int | Basis points (1000 = 10%) |
| `PlatformSettings` | `escrowReleaseDays` | Int | Days |
| `CompanyProfile` | `commissionRate` | Float | Percentage |
| `PlatformSettings` | `commissionRate` | Float | Percentage |

## Migration Strategy

Do NOT mass-convert in Phase 2. The Float wallet risk remains OPEN.

Phase 3 (financial redesign) should:
1. Add `cents` suffix to new BigInt fields
2. Migrate Float → BigInt with `ROUND(value * 100)`
3. Backfill existing data
4. Remove old Float fields after verification
