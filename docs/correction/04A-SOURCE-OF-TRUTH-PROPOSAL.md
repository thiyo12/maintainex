# 04A-SOURCE-OF-TRUTH-PROPOSAL.md — Canonical Model Recommendations

> Generated: Phase 4A — Final Source-of-Truth Proposal
> Updated: Phase 4B — Design decisions frozen
> Scope: Every marketplace concept with recommended canonical model, confidence, and migration risk

---

## SOURCE-OF-TRUTH TABLE

| Concept | Current Candidates | Recommended Canonical | Confidence | Migration Risk |
|---|---|---|---|---|
| **Customer Job** | MarketplaceJob (36 rows), Booking (31 rows), JobPosting (5 rows) | MarketplaceJob | HIGH | HIGH (67 callers, financial) |
| **Service Catalog** | Category+Service (V1), JobCategory+TemplateJob+ServiceTemplate (V2) | JobCategory+TemplateJob+ServiceTemplate (V2) | HIGH | LOW (read-only catalog) |
| **Quote** | JobQuote (7 rows), Bid (0 rows) | JobQuote | HIGH | HIGH (22 callers) |
| **Engagement** | (no dedicated model) — represented by ACCEPTED Quote + Workspace + Escrow | Create Engagement concept in Phase 4B | MED | MED (new model or composition) |
| **Assignment** | Assignment (0 rows, V1), JobWorkspace (5 rows, V2) | JobWorkspace | HIGH | LOW (0 rows in Assignment) |
| **Urgent Mode** | MarketplaceJob.urgency field | MarketplaceJob.urgency (already there) | HIGH | NONE (field exists) |
| **Recurring** | NONE | New feature needed (Phase 5+) | LOW | N/A (not implemented) |
| **Review** | Review (10 rows, V1), TaskerReview (0 rows), JobReview (0 rows), ProviderReview (0 rows) | JobReview + ProviderReview (V2) | HIGH | LOW (V1 data must be preserved) |
| **Dispute** | Dispute (5 rows, V1), MarketplaceJob DISPUTE action (V2) | MarketplaceJob DISPUTE action + dedicated Dispute model | MED | MED (V1 disputes reference JobPosting) |
| **Invoice** | Invoice (4 rows, V1) | Invoice (keep V1, add V2 invoice for MarketplaceJob) | MED | LOW (4 rows) |
| **Escrow** | JobEscrow (11 rows) | JobEscrow | HIGH | HIGH (financial, 26 callers) |
| **Wallet** | ProviderWallet (27 rows), CustomerWallet (46 rows) | ProviderWallet + CustomerWallet | HIGH | HIGH (float money P0) |
| **Commission** | CommissionSettlement (10 rows), WeeklySettlement (10 rows), CommissionPayment (8 rows) | Keep all three — different purposes | HIGH | MEDIUM |
| **Provider (Individual)** | TaskerProfile (22 rows) | TaskerProfile | HIGH | HIGH (27 callers) |
| **Provider (Company)** | CompanyProfile (9 rows) | CompanyProfile | HIGH | HIGH (24 callers) |
| **Messaging** | Conversation (0 rows), Message (0 rows) | Conversation + Message | HIGH | LOW (0 rows) |
| **Matching** | JobMatchQueue (0 rows, ephemeral), OfferMatchQueue (0 rows, ephemeral) | JobMatchQueue + OfferMatchQueue (keep separate) | HIGH | LOW (ephemeral) |
| **Flash/Promotional** | FlashOffer (2 rows), SeasonalOffer (0 rows) | FlashOffer + SeasonalOffer (keep separate, not job-related) | HIGH | LOW (promotional only) |
| **Offer Program** | OfferTemplate (12 rows), OfferBooking (0 rows), OfferEnrollment (0 rows) | OfferTemplate + OfferBooking + OfferEnrollment | MED | LOW (0 transactional rows) |
| **Payout** | Payout (0 rows), PayoutRequest (0 rows) | Payout (PayoutRequest is dead) | MED | LOW (0 rows) |

---

## DETAILED RECOMMENDATIONS

### 1. Customer Job → MarketplaceJob V2 (HIGH confidence)

**Evidence:**
- 67 callers (vs 18 for Booking, 17 for JobPosting)
- Full financial pipeline (escrow, wallet, commission, settlement)
- Richest feature set (matching, blast, AI pricing, workspace, OTP, reviews)
- Active V2 mobile app integration
- 36 production rows with active writes

**Migration plan (Phase 4C):**
- Preserve Booking table (31 rows) for CRM analytics and historical reporting
- Preserve JobPosting table (5 rows) for dispute references and historical data
- Do NOT delete V1 models
- Add new capabilities (recurring, projects) to MarketplaceJob via additive evolution

### 2. Service Catalog → JobCategory + TemplateJob + ServiceTemplate (HIGH confidence)

**Evidence:**
- 24 JobCategory + 239 TemplateJob + 239 ServiceTemplate rows
- Auto-seeded, read-only at runtime
- V2 mobile app exclusively uses this catalog
- V1 Category+Service is used only by web admin

**Migration plan:**
- Keep V1 Category+Service for web admin
- Use V2 catalog as canonical for all new features
- Consider exposing V2 catalog to web admin in future

### 3. Quote → JobQuote (HIGH confidence)

**Evidence:**
- 22 callers, 7 production rows
- Full V2 quote lifecycle (PENDING → ACCEPTED/REJECTED/WITHDRAWN)
- Integrated with escrow, workspace, reviews
- Bid model has 0 rows — effectively dead

**Migration plan:**
- Keep Bid model for historical reference (0 rows, no impact)
- JobQuote is canonical

### 4. Engagement → New concept (MEDIUM confidence)

**Evidence:**
- No dedicated "Engagement" model exists
- Currently represented by ACCEPTED Quote + Workspace + Escrow
- This is a composition, not a single entity

**Migration plan (Phase 4B):**
- Decide: create Engagement model or keep as composition
- If creating: link Quote + Workspace + Escrow into single Engagement record
- If keeping as composition: document the canonical composition pattern

### 5. Assignment → JobWorkspace (HIGH confidence)

**Evidence:**
- Assignment model has 0 rows (V1 legacy)
- JobWorkspace has 5 rows and 12 callers (V2 active)
- JobWorkspace has richer state machine (ACCEPTED → IN_PROGRESS → WAITING_CUSTOMER → COMPLETION_REQUESTED → COMPLETED → DISPUTED)

**Migration plan:**
- Assignment stays for V1 historical data (0 rows anyway)
- JobWorkspace is canonical for V2

### 6. Urgent Mode → MarketplaceJob.urgency (HIGH confidence, NONE migration)

**Evidence:**
- `urgency` field already exists on MarketplaceJob (normal/urgent/emergency)
- `responseDeadline` field already exists
- FlashOffer is promotional, NOT urgency

**Migration plan:** NONE — already implemented.

### 7. Recurring → NEW FEATURE NEEDED (LOW confidence, not implemented)

**Evidence:**
- No recurring field or model exists anywhere
- No route supports recurring jobs
- No cron handles recurring job generation

**Migration plan (Phase 5+):**
- Design recurring job support (likely a `RecurringSchedule` model linked to MarketplaceJob)
- NOT in scope for Phase 4

### 8. Review → JobReview + ProviderReview (HIGH confidence)

**Evidence:**
- V1 Review (10 rows) is service-level, unauthenticated, legacy
- V2 JobReview + ProviderReview are dual-sided, authenticated, integrated with trust/quality engines
- V2 has 0 rows but fully implemented

**Migration plan:**
- Preserve V1 Review table for historical data
- JobReview + ProviderReview are canonical for new jobs
- Consider migrating V1 Review data to JobReview format in future

### 9. Dispute → MarketplaceJob DISPUTE action + Dispute model (MEDIUM confidence)

**Evidence:**
- V1 Dispute model (5 rows) references JobPosting
- V2 dispute is handled via MarketplaceJob complete route (DISPUTE action) which sets escrow ON_HOLD and workspace DISPUTED
- No dedicated V2 Dispute model exists

**Migration plan (Phase 4B):**
- Decide: create V2 Dispute model or keep as MarketplaceJob state
- If creating: link to MarketplaceJob instead of JobPosting
- Preserve V1 Dispute table for historical data

### 10. Invoice → Keep V1, add V2 (MEDIUM confidence)

**Evidence:**
- V1 Invoice (4 rows) is triggered by Booking COMPLETED
- V2 MarketplaceJob has no Invoice auto-creation
- V2 uses escrow release instead of invoicing

**Migration plan:**
- Preserve V1 Invoice for Booking historical data
- V2 uses escrow release as the financial mechanism (not invoicing)
- If invoicing is needed for V2, create V2 Invoice linked to MarketplaceJob

### 11. Escrow → JobEscrow (HIGH confidence)

**Evidence:**
- 26 callers, 11 production rows
- Full lifecycle (PENDING_PAYMENT → PROTECTED → RELEASED/REFUNDED/ON_HOLD)
- Integrated with wallet, commission, settlement, notifications

**Migration plan:** JobEscrow is canonical. No changes needed.

### 12. Wallet → ProviderWallet + CustomerWallet (HIGH confidence)

**Evidence:**
- ProviderWallet (27 rows, 15 callers)
- CustomerWallet (46 rows, 14 callers)
- Full financial pipeline

**Migration plan:** Both are canonical. **Float money P0 must be resolved in Phase 5** (convert Float to Decimal/BigInt).

### 13. Commission → Keep 3 models (HIGH confidence)

**Evidence:**
- CommissionSettlement (10 rows) — per-job commission record
- WeeklySettlement (10 rows) — weekly aggregation per provider
- CommissionPayment (8 rows) — payment reference for settlement
- All three serve different purposes in the commission lifecycle

**Migration plan:** Keep all three. They are complementary, not duplicated.

### 14. Provider → TaskerProfile + CompanyProfile (HIGH confidence)

**Evidence:**
- TaskerProfile (22 rows, 27 callers) — individual providers
- CompanyProfile (9 rows, 24 callers) — company providers
- Both have rich feature sets (verification, ratings, skills, locations)

**Migration plan:** Both are canonical. No changes needed.

### 15. Flash/Promotional → FlashOffer + SeasonalOffer (HIGH confidence)

**Evidence:**
- FlashOffer (2 rows) — promotional discounts, NOT urgency
- SeasonalOffer (0 rows) — seasonal promotions
- Neither is related to job lifecycle

**Migration plan:** Keep separate. They are marketing tools, not marketplace entities.

### 16. Offer Program → OfferTemplate + OfferBooking + OfferEnrollment (MEDIUM confidence)

**Evidence:**
- OfferTemplate (12 rows), OfferBooking (0 rows), OfferEnrollment (0 rows)
- Fully implemented but no production transactional data
- May be dead experimental system or early-stage feature

**Migration plan:**
- Keep for now — code is active, just no data
- If production data remains at 0 after 30 days, classify as experimental and document

---

## DEAD/UNUSED MODELS IDENTIFIED

| Model | Rows | Status | Recommendation |
|---|---|---|---|
| PayoutRequest | 0 | ZERO callers | DEAD — safe to remove from schema |
| CompanySpecialty | 0 | ZERO callers | DEAD — safe to remove from schema |
| Quotation | 0 | Not in schema | DOES NOT EXIST |
| QuotationItem | 0 | Not in schema | DOES NOT EXIST |
| Bid | 0 | 3 callers (V1) | LEGACY — keep for historical reference |
| Assignment | 0 | 6 callers (V1) | LEGACY — keep for historical reference |
| SeasonalOffer | 0 | Active code | UNCERTAIN — active code, no data |
| SeasonalOfferJob | 0 | Active code | UNCERTAIN — active code, no data |
| OfferBooking | 0 | Active code | UNCERTAIN — active code, no data |
| OfferEnrollment | 0 | Active code | UNCERTAIN — active code, no data |
| OfferMatchQueue | 0 | Active code | UNCERTAIN — active code, no data |
| JobMatchQueue | 0 | Active code | EPHEMERAL — cleared on each match cycle |
| TaskerSkill | 0 | Active code | UNCERTAIN — active code, no data |
| TeamMember | 0 | Active code | UNCERTAIN — active code, no data |
| Conversation | 0 | Active code | UNCERTAIN — active code, no data |
| Message | 0 | Active code | UNCERTAIN — active code, no data |
| TaskerReview | 0 | Active code | UNCERTAIN — active code, no data |
| JobReview | 0 | Active code | UNCERTAIN — active code, no data |
| ProviderReview | 0 | Active code | UNCERTAIN — active code, no data |
