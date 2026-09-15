# ADR-004: Template-Based Pricing with Budget Override

**Status**: Accepted
**Date**: 2026-09-14

## Context

Home services pricing varies wildly by category, region, and job complexity. A flat-rate model cannot capture that plumbing repair costs differently from electrical work, or that emergency calls command a premium. The platform needs a pricing system that provides consistent, transparent estimates while allowing customer budget signals and provider quote flexibility.

The pricing engine must integrate with the matching system (price influences provider willingness), the escrow system (deposit amounts), and the commission system (service fees are percentage-based).

Reference: `lib/pricing/engine.ts`, `lib/pricing/rules.ts`, `lib/pricing/fees.ts`

## Decision

Implement a template-based pricing system with three tiers:

### Pricing Hierarchy

1. **Service Templates** (`ServiceTemplate`): Predefined job types with base prices, unit descriptions, and estimated durations. Created by admins per job category.
2. **Category Pricing** (`JobCategory`): Fallback pricing when no template matches. Category-level min/max bounds.
3. **Budget Override**: Customers can specify a custom budget that overrides template pricing. Used for quote-mode jobs where providers bid.

### Price Calculation Flow

```
Input: categoryId, serviceTemplateId, urgency, countryCode
  -> resolvePricingConfig()     // Country-specific config
  -> template base price         // Or category fallback
  -> urgency modifier            // NORMAL=0%, URGENT=+15%, EMERGENCY=+30%
  -> platform fee                // Percentage-based commission
  -> price bounds check          // Must be within category min/max
  -> PriceBreakdown output
```

### Price Bounds

`PriceBoundsError` thrown when the calculated price falls outside the category's configured minimum or maximum. This prevents absurd quotes from entering the system.

### Quote Mode

For quote-mode jobs, the pricing engine provides an estimate range. Providers submit their own quotes within bounds. The customer selects based on price, reputation, and other factors.

## Consequences

### Positive
- Consistent pricing across similar jobs: templates enforce standards
- Transparency: customers see breakdowns before committing
- Revenue predictability: commission rates applied consistently
- Market flexibility: urgency modifiers and country configs allow local tuning

### Negative
- Template maintenance burden: admins must create and update templates per category
- Budget override complexity: providers may reject jobs with unrealistic budgets
- Edge cases: custom jobs that do not fit any template require manual handling

### Neutral
- Integrates with the escrow system: deposit amount derived from price breakdown
- Price estimates are cached and non-binding; final price determined by accepted quote
