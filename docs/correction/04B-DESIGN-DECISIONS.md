# 04B-DESIGN-DECISIONS.md — All Phase 4B Architecture Decisions

> Generated: Phase 4B — Design Decision Record
> Updated: Phase 4B.1 — Corrections: conditional retention, FK risk MEDIUM, phase ownership, seed policy
> Scope: Every architectural decision made in Phase 4B with rationale

---

## DECISION 1: Canonical Job Entity

**Decision:** MarketplaceJob V2 is the canonical transactional job entity.

**Rationale:**
- 67 callers (vs 18 for Booking, 17 for JobPosting)
- Full financial pipeline (escrow, wallet, commission, settlement)
- Richest feature set (matching, blast, AI pricing, workspace, OTP, reviews)
- Active V2 mobile app integration
- 36 production rows with active writes

**Alternatives considered:**
- Booking: Too simple, no escrow/settlement/matching
- JobPosting: Effectively dead (5 rows, 0 bids, 0 assignments)
- New model: Unnecessary — MarketplaceJob already has everything

**Trade-offs:**
- Scalar-only FKs (no Prisma relations) — MEDIUM DATA INTEGRITY risk. 4C.1 must investigate which canonical relationships require Prisma `@relation`, PostgreSQL foreign keys, indexes, or uniqueness constraints. Any FK migration must test production data for orphaned IDs first. Never add an FK blindly to live data.
- Complex state machine — managed by domain service (4C.1)

---

## DECISION 2: Engagement = Existing Composition (No New Model)

**Decision:** Keep the existing 4-model composition as the canonical Engagement pattern. Do NOT add a JobEngagement model.

**Rationale:**
- 5 of 6 invariants preserved (one winning provider, accepted terms, immutable quote, company identity, dispute/escrow)
- One gap (provider replacement/history) is rare and can be addressed additively later
- Adding a model requires migration + updating 60+ callers
- Premature schema growth adds risk

**Alternatives considered:**
- JobEngagement model: Solves provider replacement, but over-engineered for current needs

**Trade-offs:**
- Provider replacement not formally tracked — if required for canonical engagement integrity, Phase 4; otherwise future marketplace enhancement
- Company worker assignment not formalized — Phase 6 Provider/Company/Trust unless Phase 4 requires a minimal assignment integrity layer

---

## DECISION 3: Assignment = JobWorkspace (Not Assignment Model)

**Decision:** JobWorkspace is the canonical execution/assignment layer. Legacy Assignment model is deprecated.

**Rationale:**
- Assignment has 0 production rows
- JobWorkspace has 5 rows and 12 callers
- JobWorkspace has richer state machine (6 states vs 5)

**Trade-offs:**
- Assignment table preserved for historical reference (reputation engine reads it)

---

## DECISION 4: Two-Dimensional Job Model (Mode × Urgency)

**Decision:** Job mode (BOOK_NOW/QUOTE/PROJECT/RECURRING) and urgency (NORMAL/URGENT/EMERGENCY) are orthogonal dimensions.

**Rationale:**
- Cleaner separation of concerns
- URGENT is a characteristic, not a commercial mode
- A PROJECT job can be URGENT
- Current schema already has urgency as a separate field

**Alternatives considered:**
- mode = URGENT: Conflates priority with commercial type

**Trade-offs:**
- Requires adding `mode` field to MarketplaceJob (additive, Phase 4C)

---

## DECISION 5: BOOK_NOW Converges to MarketplaceJob

**Decision:** BOOK_NOW transactions create MarketplaceJobs (not OfferBookings). OfferTemplate remains catalog config.

**Rationale:**
- OfferBooking has 0 production rows
- MarketplaceJob already has full lifecycle, escrow, matching
- Avoids competing transaction systems
- OfferTemplate is useful as fixed-price catalog layer

**Alternatives considered:**
- Keep OfferBooking as BOOK_NOW transaction: Creates two competing job systems

**Trade-offs:**
- OfferBooking code preserved but unused
- OfferMatcher logic may be adapted for BOOK_NOW matching

---

## DECISION 6: PROJECT = MarketplaceJob + Company Providers

**Decision:** PROJECT jobs are MarketplaceJobs with company provider bidding. Contract model remains for B2B legal agreements.

**Rationale:**
- Contract has 0 production rows — not used as customer job system
- Company providers already submit JobQuotes (providerType=COMPANY)
- PROJECT is a mode annotation, not a separate model

**Alternatives considered:**
- Use Contract as PROJECT model: Contract is B2B legal, not marketplace transaction

**Trade-offs:**
- Milestones and multi-phase support deferred — future Project capability unless required for Phase 4 canonical PROJECT support
- Company worker assignment not formalized — Phase 6 unless Phase 4 requires minimal integrity

---

## DECISION 7: RECURRING = Future Model (Not Phase 4)

**Decision:** RECURRING requires a RecurringJobPlan model that generates individual MarketplaceJobs. Design documented but NOT implemented in Phase 4.

**Rationale:**
- No current recurring implementation exists
- Each occurrence must be a real transactional job (finite lifecycle, payment, review, dispute)
- RecurringJobPlan is a scheduler, not a job

**Alternatives considered:**
- Endless single MarketplaceJob for recurring: Violates finite lifecycle invariant

**Trade-offs:**
- Deferred to future implementation (not Phase 4, not Phase 5 financial core)

---

## DECISION 8: Four-Layer Status Architecture

**Decision:** Separate status machines for Job, Quote, Workspace, and Escrow. Do NOT merge into one giant status.

**Rationale:**
- Each layer has independent lifecycle
- Financial state (escrow) should not be inferred from job status
- Quote status is per-quote, not per-job
- Workspace tracks execution progress independently

**Alternatives considered:**
- Single unified status: Overloaded, hard to extend, conflates concerns

**Trade-offs:**
- More complex cross-layer validation
- Domain service (4C.1) manages cross-layer transitions

---

## DECISION 9: V1 Legacy Retention Policy

**Decision:** V1 models (Booking, JobPosting, Bid, Assignment, Review, Dispute) are preserved while production/history requires it, active readers exist, active writers exist, foreign-key/data dependencies exist, or retention/audit requirements require it.

**Rationale:**
- Historical data must be accessible while needed
- CRM depends on Booking data
- Disputes reference JobPosting
- Reviews are historical service feedback
- No benefit to deleting 0-row tables now

**Physical deletion may occur only after:**
1. Zero active writers
2. Zero required readers
3. Data retention review
4. Dependency review
5. Migration/archive strategy
6. Explicit approval

**Alternatives considered:**
- Migrate V1 data to V2: Risky, no benefit, breaks historical links
- Preserve forever unconditionally: Does not account for eventual schema hygiene

**Trade-offs:**
- Multiple parallel models in schema — managed by documentation
- Do NOT promise permanent retention
- Do NOT delete anything now

---

## DECISION 10: No Dual-Write Between V1 and V2 Catalogs

**Decision:** V1 Category+Service and V2 JobCategory+TemplateJob+ServiceTemplate are independent. No synchronization.

**Rationale:**
- Different taxonomies serving different surfaces
- V1 for web admin, V2 for mobile app
- No business need to keep them synchronized

**Alternatives considered:**
- Dual-write: Adds complexity, risk of inconsistency, no benefit

**Trade-offs:**
- Catalogs may diverge — expected and acceptable

---

## DECISION 11: Admin Unified View Preserved

**Decision:** Admin job list continues to show both V1 and V2 jobs with `source: 'V1' | 'V2'` discrimination.

**Rationale:**
- Already implemented and working
- No migration needed
- Admin can see both legacy and current jobs

**Alternatives considered:**
- Force admin to V2 only: Loses visibility into V1 historical data

**Trade-offs:**
- Two data sources merged in API — managed by existing code

---

## DECISION 12: Security Gaps = Phase 4, Not Phase 5

**Decision:** FlashOffer claim, Review POST, and Seed endpoint security gaps are Phase 4 closure items, not deferred to Phase 5.

**Rationale:**
- These are authentication/authorization gaps, not financial core issues
- Phase 5 is about money representation (Float → Decimal)
- Security gaps can be closed independently

**Alternatives considered:**
- Defer to Phase 5: Leaves security holes open longer

**Trade-offs:**
- Phase 4C scope increased slightly — acceptable

---

## DECISION 13: Float Money Remains P0 (Phase 5)

**Decision:** Float money in wallets is NOT addressed in Phase 4. Phase 4 design describes the financial flow but does not alter amounts/types.

**Rationale:**
- Phase 4 is marketplace domain consolidation
- Float → Decimal is a data type change affecting all financial models
- Must be done atomically with proper testing
- Withdrawal remains disabled

**Alternatives considered:**
- Fix Float in Phase 4: Mixing domain consolidation with data type migration increases risk

**Trade-offs:**
- Float money P0 remains open — documented and tracked
