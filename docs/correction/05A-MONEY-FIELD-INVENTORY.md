# 5A.1 — Complete Financial Model Inventory

**Date**: Sep 7, 2026

## Summary

| Metric | Count |
|--------|-------|
| Models with financial fields | 34 |
| Total financial fields | 97 |
| Float fields | 56 |
| BigInt fields | 10 |
| Int fields | 3 |
| Decimal fields | 0 |

## Critical Architectural Issue

**56 out of 67 monetary fields use Float (IEEE 754).** Zero fields use Decimal. This introduces floating-point rounding errors across the financial system.

## Money Fields by Type

### Float (56 fields) — CRITICAL

| Model | Field | Meaning | Production Min | Production Max | Production Sum | Fractional Values |
|-------|-------|---------|---------------|---------------|----------------|-------------------|
| ProviderWallet | availableBalance | Withdrawable earnings | 5,316 | 189,909 | 2,908,414 | 0 |
| ProviderWallet | pendingBalance | Unreleased earnings | 2,432 | 49,176 | 638,853 | 0 |
| CustomerWallet | balance | Customer funds | 1,855 | 73,666 | 1,095,942 | 0 |
| WalletTransaction | amount | Transaction amount | 2,000 | 49,012 | — | 0 |
| WalletTransaction | balanceBefore | Pre-txn balance | — | — | — | 0 |
| WalletTransaction | balanceAfter | Post-txn balance | — | — | — | 0 |
| WeeklySettlement | totalEarnings | Weekly provider earnings | 30,000 | 166,413 | 874,839 | 0 |
| WeeklySettlement | commissionRate | Commission % | 10 | 10 | 100 | 0 |
| WeeklySettlement | commissionOwed | Commission owed | 3,000 | 16,641 | 87,483 | 0 |
| CommissionPayment | amountDue | Commission due | 3,000 | 5,000 | 34,000 | 0 |
| CommissionSettlement | commissionRate | Commission % | 10 | 10 | — | 0 |
| Invoice | subtotal | Pre-tax total | 0 | 3,500 | 5,000 | — |
| Invoice | tax | Tax amount | — | — | — | — |
| Invoice | total | Invoice total | 0 | 3,500 | 5,000 | — |
| Invoice | amountPaid | Amount paid | 0 | 0 | 0 | — |
| InvoiceItem | quantity | Item quantity | — | — | — | — |
| InvoiceItem | unitPrice | Price per unit | — | — | — | — |
| InvoiceItem | totalPrice | quantity × unitPrice | — | — | — | — |
| Quotation | subtotal | Pre-tax total | — | — | — | — |
| Quotation | tax | Tax amount | — | — | — | — |
| Quotation | total | Quotation total | — | — | — | — |
| QuotationItem | quantity | Item quantity | — | — | — | — |
| QuotationItem | unitPrice | Price per unit | — | — | — | — |
| QuotationItem | totalPrice | quantity × unitPrice | — | — | — | — |
| Booking | totalPrice | Booking price | 800 | 5,000 | 97,666 | 0 |
| Booking | budgetMin | Budget floor | — | — | — | — |
| Booking | budgetMax | Budget ceiling | — | — | — | — |
| Service | price | Service base price | — | — | — | — |
| JobPosting | budget | Job budget | — | — | — | — |
| Bid | amount | Bid amount | — | — | 0 rows | — |
| TemplateJob | priceMin | Template floor | — | — | — | — |
| TemplateJob | priceMax | Template ceiling | — | — | — | — |
| ServiceTemplate | priceMin | Template floor | — | — | — | — |
| ServiceTemplate | priceMax | Template ceiling | — | — | — | — |
| TaskerSkill | hourlyRate | Skill rate | — | — | — | — |
| TaskerSkill | fixedRate | Fixed skill rate | — | — | — | — |
| TaskerProfile | hourlyRate | Provider rate | — | — | — | — |
| CompanyProfile | commissionRate | Company commission % | 10 | 10 | — | 0 |
| Contract | value | Contract value | — | — | — | — |
| Milestone | amount | Milestone payment | — | — | — | — |
| CustomJobRequest | budgetMin | Budget floor | — | — | — | — |
| CustomJobRequest | budgetMax | Budget ceiling | — | — | — | — |
| SubscriptionPlan | price | Plan price | — | — | — | — |
| FlashOffer | discountValue | Discount amount | — | — | — | — |
| SeasonalOfferJob | price | Seasonal override | — | — | — | — |
| PlatformSettings | commissionRate | Global commission % | 10 | 10 | — | 0 |
| PricingModel | baseRate | ML base rate | — | — | — | — |
| PricingModel | travelCostPerKm | Travel cost | — | — | — | — |
| PricingModel | materialCostFactor | Material cost % | — | — | — | — |
| HistoricalJobPrice | finalPrice | Completed price | — | — | — | — |
| HistoricalJobPrice | estimatedPrice | Estimated price | — | — | — | — |
| HistoricalJobPrice | budgetAmount | Budget at posting | — | — | — | — |
| HistoricalJobPrice | materialCost | Material cost | — | — | — | — |
| RegionalPriceIndex | avgPrice | Market average | — | — | — | — |
| RegionalPriceIndex | minPrice | Market min | — | — | — | — |
| RegionalPriceIndex | maxPrice | Market max | — | — | — | — |
| RegionalPriceIndex | medianPrice | Market median | — | — | — | — |
| ProviderPerformance | totalEarnings | Category earnings | — | — | — | — |
| ProviderPerformance | avgEarnings | Avg per job | — | — | — | — |
| CustomerProfile | totalSpent | Lifetime spend | — | — | — | — |
| CustomerProfile | lifetimeValue | CLV | — | — | — | — |
| RealEstateListing | priceLkr | Listing price | — | — | — | — |
| PropertyBoost | amount | Boost payment | — | — | — | — |
| PlatformAnalytics | metricValue | Generic metric | — | — | — | — |

### BigInt (10 fields) — SAFE

| Model | Field | Unit | Production Min | Production Max | Production Sum |
|-------|-------|------|---------------|---------------|----------------|
| JobEscrow | amount | cents | 4,500 | 2,000,000 | 3,057,500 |
| JobEscrow | serviceFee | cents | 450 | 200,000 | 305,750 |
| JobEscrow | totalAmount | cents | 4,950 | 2,200,000 | 3,363,250 |
| CommissionSettlement | jobAmount | cents | 4,863 | 48,911 | 306,293 |
| CommissionSettlement | commissionAmount | cents | 486 | 4,891 | 30,628 |
| MarketplaceJob | budgetAmount | cents | 0 | 2,000,000 | 9,292,800 |
| JobQuote | price | cents | 0 | 35,000 | 62,999 |
| Payout | amount | cents | — | — | 0 rows |
| PlatformSettings | minJobAmountCents | cents | 500 | — | — |
| PlatformSettings | maxJobAmountCents | cents | 1,000,000 | — | — |

### Int (3 fields) — RISKY

| Model | Field | Unit | Notes |
|-------|-------|------|-------|
| OfferTemplate | priceLkr | LKR whole | No decimal precision |
| PayoutRequest | amount | LKR whole | Inconsistent with Payout (BigInt cents) |
| PlatformSettings | platformFeeBps | basis points | Safe (integer by nature) |

## Cross-Model Type Conflicts

| Flow | Field A (Type) | → | Field B (Type) | Issue |
|------|---------------|---|---------------|-------|
| Escrow → Settlement | JobEscrow.amount (BigInt) | → | CommissionSettlement.jobAmount (BigInt) | OK |
| Settlement → Weekly | CommissionSettlement.commissionAmount (BigInt) | → | WeeklySettlement.commissionOwed (Float) | **MISMATCH** |
| Escrow → Wallet | JobEscrow.amount (BigInt) | → | WalletTransaction.amount (Float) | **MISMATCH** |
| PayoutRequest → Payout | PayoutRequest.amount (Int) | → | Payout.amount (BigInt) | **MISMATCH** |
