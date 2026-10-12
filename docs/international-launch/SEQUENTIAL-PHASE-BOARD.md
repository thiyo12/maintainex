# MaintainEX — Sequential 12-Phase Build (Reset)

**Purpose:** This replaces the confusing *status/workflow*, not the source code or Git history. Preserve existing V2 app, CRM, Prisma, payments, users and previously implemented fixes. The detailed scope remains in [MASTER-IMPLEMENTATION-PLAN.md](./MASTER-IMPLEMENTATION-PLAN.md). Do not create an additional parallel architecture.

## Working agreement

- Work in `feature/international-launch-12phase`; commit each **substantial tested batch**.
- Finish development + focused tests for a phase, then advance to the next. Production-only release checks (live inventory, external legal review, real provider/payment access) are tracked separately and must pass before launch, but must not block unrelated development.
- A GitHub Actions pass is **CI green**, not automatically **phase complete**.
- Retain IDs, financial records, history and canonical V2 components. No destructive seeds or migration, no automatic production deploy, and no `main` merge.
- Fix failures in the phase that owns them. Track evidence and blockers clearly.
- Final integration, operational review, market-specific GO decisions and Mac sync come last.
- No scheduled hourly task: work is carried out in active sessions; do not imply continuous background coding.

## Build board

| Phase | Deliverable | Development state | Required development proof |
| --- | --- | --- | --- |
| 00 | Baseline, active system map, repeatable CI | IN PROGRESS | CI on current SHA; app/API/DB/CRM ownership map; safe inventory tooling |
| 01 | Canonical 27-department / target 548-job reconciliation | TODO | Historical IDs preserved, no duplicate jobs, catalogue tests |
| 02 | LK 25 districts and Vancouver city-only geographic enforcement | TODO | Address-derived country/currency; boundary and tampering tests |
| 03 | Local eligible search and provider discovery | TODO | Search-to-real-provider integration and market tests |
| 04 | Provider/company onboarding and worker identity | TODO | Permissions, skills, KYC and assignment lifecycle tests |
| 05 | Trustworthy local pricing | TODO | Evidence/mode labels, CAD/LKR and calculation tests |
| 06 | Quotes and bargaining | TODO | Revision/approval/expiry and duplicate-action tests |
| 07 | Booking lifecycle, tracking and Safety Centre | TODO | Customer/provider/worker safety and financial lifecycle tests |
| 08 | Seasonal service discovery | TODO | Canada four-season and LK monsoon eligibility tests |
| 09 | Native language UX | TODO | EN/TA/SI and EN/FR intent/fallback tests; human-review blockers |
| 10 | Finance, CRM, legal/operations integration | TODO | Authorization, webhook, payout/refund and market gates |
| 11 | Integrated release certification | TODO | Two-market E2E, build/Docker, rollback, manual GO/NO-GO |

## Phase 00 — measurable baseline

**Verified on branch HEAD `970387abbf8e693cea50609a2414e19956ce6de2`:** GitHub Security Exposure Audit and CRM V2 Release Validation both completed SUCCESS. Existing read-only catalogue inventory helper and test have been added and exercised by CI.

**Still required to close development Phase 00:**
1. Document the active customer/provider mobile screens → V2 API endpoints → domain services → Prisma models → CRM/notifications for discovery, jobs, quotes, finance and safety.
2. Reconcile real CI test scope and known nonblocking baseline failures; retain evidence and repeatable commands.
3. Confirm phase exit requires no dependency on production write access.

**Release-only checks parked (not waived):** read-only live data counts and orphan checks; deployed Docker image SHA; legal/operational and production payment confirmation. Block production GO until these are evidenced.

Status terms: TODO / IN PROGRESS / DEV GREEN / RELEASE GREEN. **Do not set DEV GREEN without source and test evidence; do not set RELEASE GREEN without external release checks.**
