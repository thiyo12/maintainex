# MaintainEX Matching & Pricing Map

## Three Matching Engines

### Engine 1: Wave-Based (Gen 1 — Deprecated)
**File:** `lib/job-matcher.ts`
**Used by:** Legacy JobPosting system
**Flow:** Stagger by bookingType → queue → assign in batches of 5
**Status:** Active in cron but targets deprecated model

### Engine 2: Blast + Scoring (Gen 2 — Primary)
**File:** `lib/job-blast.ts`
**Used by:** MarketplaceJob V2
**Scoring formula:** `baseScore = categoryMatch*25 + distance*25 + rating*25 + completedJobs*15 + reliability*10`
**Flow:** Query providers → score → rank → blast notifications → quotes
**Status:** Production active

### Engine 3: Smart Matching (V2 enhancement)
**File:** `lib/matching-engine.ts`
**Used by:** MarketplaceJob V2 (alternative path)
**Features:** Bayesian reputation, multi-factor scoring
**Status:** Production active

## Four Pricing Models

### Model 1: AI Pricing (Primary)
**File:** `lib/pricing/index.ts`
**Endpoint:** `POST /api/mobile/v2/pricing/estimate`
**Inputs:** Category, location, urgency, description, materials, distance
**Algorithm:** Base rate × urgency multiplier × distance + materials
**Status:** Production active

### Model 2: Template Pricing
**File:** `app/api/mobile/template-jobs/route.ts`
**Inputs:** JobCategory → TemplateJob
**Range:** priceMin to priceMax per template
**Status:** Production active (V2 job wizard)

### Model 3: Customer-Facing Pricing
**File:** `lib/pricing/customer-facing.ts`
**Endpoint:** `GET /api/mobile/v2/pricing/estimate`
**Features:** Range estimates, confidence scoring
**Status:** Production active

### Model 4: Rule Engine
**File:** `lib/pricing/rule-engine.ts`
**Features:** Configurable rules, seasonal adjustments
**Status:** Built but not wired into production flow

## Four Inconsistent Commission Formulas

| Path | Formula | Result |
|---|---|---|
| Escrow deposit | `quotePrice * 0.1` | 10% hardcoded |
| Release-escrow | `escrowAmount * (company.commissionRate / 100)` | Variable from provider |
| Auto-release cron | `escrow.amount - escrow.serviceFee` | Flat deduction |
| Cash-payment | `escrowAmount * (serviceFee / 100)` | Nonsensical (BUG) |

## Matching Flow (V2 Production)

```
Customer creates MarketplaceJob
  → JobBlast queries providers by category + location
  → Scores providers (category, distance, rating, jobs, reliability)
  → Ranks top providers
  → Blast notifications to ranked providers
  → Providers submit JobQuotes
  → Customer selects quote → JobEscrow created
  → Provider arrives → OTP verification
  → Job completion → Escrow release
```

## Pricing Flow (V2 Production)

```
Customer selects TemplateJob
  → AI pricing estimate (POST /api/mobile/v2/pricing/estimate)
  → Customer confirms price
  → Provider submits counter-quote (optional)
  → Customer accepts → Escrow deposit
```
