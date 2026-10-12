# Phase 00 — Active V2 ownership map (verified source paths)

This map inventories canonical implementations; it does **not** assert that complete user journeys pass E2E.

| Journey | Active API entry | Domain/integration ownership evidenced by imports | Persistence/side effects | Phase |
|---|---|---|---|---|
| Customer free-text discovery | `app/api/mobile/v2/search/route.ts` | `lib/ai-search`, `lib/search-engine`, `lib/domain/catalog-market-eligibility.ts`, `lib/runtime/platform-runtime` | Prisma `JobCategory`, `TemplateJob`; search log | 01/03 |
| Legacy consumer template search | `app/api/mobile/template-jobs/search/route.ts` | `lib/domain/catalog-market-eligibility.ts` | Prisma `TemplateJob` with category | 01/03 |
| Create marketplace job | `app/api/mobile/v2/jobs/route.ts` | `lib/pricing/engine`, `lib/phase6/provider-eligibility`, `lib/job-blast` | Prisma job; notifications, push | 02/05/07 |
| Provider quote submission | `app/api/mobile/v2/quotes/route.ts` | `lib/matching`, `lib/pricing/engine`, `lib/domain/provider-availability`, `lib/finance/commissions/provider-balance-service` | Prisma quote; notifyQuoteSubmitted | 04/05/06 |
| Customer accepts quote | `app/api/mobile/v2/jobs/[id]/select-quote/route.ts` | `lib/domain/job-lifecycle` (`acceptJobQuote`) | Prisma lifecycle; notifyQuoteAccepted | 06/07 |
| Mark completion / approve / dispute / cancel | `app/api/mobile/v2/jobs/[id]/complete/route.ts` | `lib/domain/job-lifecycle`, `lib/finance/escrow/escrow-service`, `lib/domain/job-actors`, `lib/work-queue` | Prisma job, escrow/dispute; notifications/admin queue | 07/10 |
| Quote revision | `app/api/mobile/v2/quotes/[id]/revision/route.ts` | Existing V2 quote revision route; state details require validation | Prisma quote and revisions | 06 |
| Worker identity | `app/api/mobile/v2/jobs/[id]/worker-identity/route.ts` | Existing job worker identity route; trace response to mobile | Prisma company assignment/identity | 04/07 |
| Escrow refund | `app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts` | Existing finance escrow refund route; idempotency to audit | Prisma escrow, ledger | 10 |

## Open ownership evidence
- Complete *mobile screen → API client* cross-reference for all customer/provider/company views.
- Read exact route bodies, transition guards, DB writes and CRM queue consumers for quote revision, worker identity, refund and safety.
- Validate country binding to authoritative service address at every writer (especially job creation, quote acceptance, provider eligibility, money).
- Compare catalogue read APIs for category + job-country filters; tests must prove behavior, not just source text.
- Record production read-only count snapshot separately when authorized; this map does not require production writes.
