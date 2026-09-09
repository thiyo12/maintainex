# 04B-OPEN-QUESTIONS.md — Phase 4A Remaining Unknowns Resolved

> Generated: Phase 4B — Open Questions Resolution
> Scope: Production-safe counts only, no customer data exposed

---

## Q1: MarketplaceJob Urgency Distribution

| Urgency | Count | % |
|---|---|---|
| normal | 32 | 89% |
| urgent | 3 | 8% |
| emergency | 1 | 3% |
| **Total** | **36** | |

**Finding:** 91% of jobs are normal urgency. Urgent and emergency exist but are rare. The urgency field is functional and used.

---

## Q2: MarketplaceJob BudgetType Distribution

| BudgetType | Count | % |
|---|---|---|
| FIXED | 25 | 69% |
| REQUEST_QUOTES | 8 | 22% |
| NEGOTIABLE | 2 | 6% |
| HOURLY | 1 | 3% |
| **Total** | **36** | |

**Finding:** FIXED pricing dominates (69%). REQUEST_QUOTES is the second mode (22%). NEGOTIABLE and HOURLY are rare. All 4 budget types are used in production.

---

## Q3: V1 Client Usage — Do Active Clients Still Create Booking/JobPosting?

### Booking Status Distribution

| Status | Count | % |
|---|---|---|
| PENDING | 29 | 94% |
| IN_PROGRESS | 1 | 3% |
| INVOICED | 1 | 3% |
| **Total** | **31** | |

**Finding:** 94% of Bookings are PENDING — likely created but never progressed. Only 1 IN_PROGRESS and 1 INVOICED. The V1 booking flow appears to have been active historically but is no longer the primary path. The 29 PENDING rows suggest bulk creation or abandoned bookings.

### JobPosting Status Distribution

| Status | Count | % |
|---|---|---|
| COMPLETED | 3 | 60% |
| OPEN | 1 | 20% |
| CANCELLED | 1 | 20% |
| **Total** | **5** | |

**Finding:** 3 COMPLETED, 1 OPEN, 1 CANCELLED. Very low volume. The V1 JobPosting flow is effectively dormant.

### Assessment

- **Booking:** V1 mobile app may still support creation, but 94% PENDING suggests the flow is rarely completed. The V2 MarketplaceJob flow is the active path.
- **JobPosting:** Effectively dead. 5 rows total, 0 Bids, 0 Assignments.

**Recommendation:** Both V1 flows can be deprecated for new creation, but historical data must be preserved.

---

## Q4: Contract Row Count and Active States

| Metric | Value |
|---|---|
| Total Contracts | **0** |
| Active states | N/A |

**Finding:** The Contract model has ZERO production rows. The company contract system exists in code but has no production data. This means PROJECT mode has never been used via the Contract model.

**Assessment:** The Contract model is implemented but unused. PROJECT mode needs a design decision — either integrate with Contract or create a new project job type within MarketplaceJob.

---

## Q5: MarketplaceJob ResponseState Distribution

| ResponseState | Count | % |
|---|---|---|
| awaiting | 36 | 100% |
| **Total** | **36** | |

**Finding:** All 36 jobs are in "awaiting" response state. No jobs have been escalated or responded late. This field is functional but underutilized — likely because the response escalation cron hasn't fired for these jobs yet.

---

## Q6: MarketplaceJob Status Distribution

| Status | Count | % |
|---|---|---|
| OPEN | 12 | 33% |
| IN_PROGRESS | 10 | 28% |
| CANCELLED | 8 | 22% |
| COMPLETED | 6 | 17% |
| **Total** | **36** | |

**Finding:** Healthy distribution across all 4 active states. No QUOTE_ACCEPTED jobs currently — suggests要么 jobs move quickly through that state,要么 the daily maintenance cron reverted them.

---

## Q7: Admin V1/V2 Distinction

**Source:** `app/api/admin/jobs/route.ts`

**Mechanism:** The admin API uses a `source: 'V1' | 'V2'` field in the `UnifiedJob` interface to distinguish job origins:

- V1 jobs come from `prisma.jobPosting.findMany()`
- V2 jobs come from `prisma.marketplaceJob.findMany()`
- Both are merged, sorted by `createdAt`, and paginated together
- PATCH operations use the `source` field to route to the correct model

**Finding:** The admin already has a unified view with source discrimination. This pattern should be preserved — the admin can continue to show both V1 and V2 jobs in a combined list without requiring data migration.

---

## SUMMARY

| Unknown | Resolution | Impact on Phase 4 Design |
|---|---|---|
| Urgency distribution | 89% normal, 8% urgent, 3% emergency | Urgency field is functional — keep as-is |
| BudgetType distribution | 69% FIXED, 22% REQUEST_QUOTES | Multi-mode pricing is real — keep all 4 modes |
| V1 Booking usage | 94% PENDING, effectively dormant | Safe to deprecate new creation |
| V1 JobPosting usage | 5 rows, 0 bids, effectively dead | Safe to deprecate new creation |
| Contract rows | 0 — unused | PROJECT needs new design, not Contract |
| Admin V1/V2 distinction | `source: 'V1' | 'V2'` field | Preserved — no migration needed |
