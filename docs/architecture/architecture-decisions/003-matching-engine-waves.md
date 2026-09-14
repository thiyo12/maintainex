# ADR-003: Wave-Based Matching with Progressive Expansion

**Status**: Accepted
**Date**: 2026-09-14

## Context

When a customer posts a job, the matching engine must notify eligible providers. A single broadcast to all eligible providers would overwhelm high-demand areas and create a race condition where the first responder wins regardless of quality. Conversely, notifying too few providers risks no acceptance.

The system must balance provider fairness (give new providers a chance), customer experience (fast response), and quality (match the best provider, not just the fastest).

Reference: `lib/matching/waves.ts`, `lib/matching/config.ts`, `lib/matching/eligibility.ts`, `lib/matching/scoring.ts`

## Decision

Implement a wave-based matching system that sends opportunities in expanding rounds:

### Wave Progression

| Wave | Size | Expiry | Purpose |
|------|------|--------|---------|
| 1 | 3 providers | 15 min | Top-scored providers get first opportunity |
| 2 | 5 providers | 15 min | Expand if wave 1 not accepted |
| 3 | 8 providers | 30 min | Maximum reach for difficult jobs |

### Matching Pipeline

1. **Eligibility gate** (`eligibility.ts`): Binary YES/NO filters (account active, not suspended, profession match, service area, jurisdiction credentials). Providers failing any gate are excluded.
2. **Scoring** (`scoring.ts`): Weighted components — capability (30), reliability (20), reputation (20), availability (15), travel (10), experience (5), fairness (0-15), preferredSkill (0-15). Weights sum to 100.
3. **Wave creation** (`waves.ts`): Top N candidates sent `ProviderOpportunity` records with expiry timestamps.
4. **Notification**: Push notifications sent to each wave candidate.
5. **Escalation**: If no acceptance before wave expiry, next wave fires automatically.

### New Provider Boost

Providers with fewer than 10 completed jobs receive a `newProviderBaseline` boost (default 50 points) to ensure they are not perpetually outranked by established providers.

### Idempotency

Wave creation checks for existing `ProviderOpportunity` records before inserting, preventing duplicate notifications on retries.

## Consequences

### Positive
- Fair distribution: top providers get first pick, but new providers receive opportunity boosts
- Time-bounded: customers receive responses within minutes, not hours
- Automatic escalation: no manual intervention needed if initial providers decline
- Configurable per-country: wave sizes and expiry tuned via `MatchingConfig`

### Negative
- Increased complexity: three-phase state machine vs. single notification
- Provider fatigue: high-volume providers may receive many opportunity notifications
- Wave timing requires calibration per market (too short = missed providers, too long = customer wait)

### Neutral
- Score weights are country-configurable, allowing market-specific tuning
- Provider opportunity records serve as audit trail for matching decisions
