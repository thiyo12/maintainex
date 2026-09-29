# Target Architecture

Three product surfaces, one canonical backend. Derived from the FINAL MASTER RESTRUCTURE
PROMPT Sections 9–13 and 43; adapted to Next.js/Expo conventions where the exact tree would
break framework rules.

## The one-platform rule

```
MOBILE APP ─────┐
                │
PUBLIC WEBSITE ─┼──── CANONICAL BACKEND (lib/modules/*)
                │
CRM / ADMIN ────┘
```

There are three interfaces and one business platform. Never create Mobile/Website/CRM
variants of job logic, finance logic, or any domain rule.

## A. Mobile App — `apps/mobile/`

Client only. Canonical business logic must not live inside screens.

```
apps/mobile/
├── app/                  # routes only: (auth)/ (customer)/ (tasker)/ (company)/
├── features/             # auth customer tasker company jobs matching quotes chat
│                         # payments disputes notifications wallet profile
├── api/                  # client.ts auth.ts jobs.ts quotes.ts companies.ts
│                         # payments.ts disputes.ts notifications.ts wallet.ts
├── components/ hooks/ providers/ state/ types/ utils/ config/ assets/
```

Migration style: screen-by-screen (Section 18); `lib/api.ts` retired in Phase H when its 57
importers are migrated to `api/`.

## B. Public Website — `app/(public)/` + `components/public/`

Responsibilities: homepage, service/category/location pages, SEO, marketing, education,
acquisition CTAs, trust & safety, app gateway, contact, legal, public forms.

```
app/(public)/
├── home/ services/ categories/ locations/ how-it-works/
├── taskers/ companies/ safety/ about/ contact/ waitlist/ legal/

components/public/
├── navigation/ hero/ services/ search/ marketplace/ trust/ marketing/ footer/
```

Website business actions call the same canonical services as mobile and CRM.
Constraint: moving existing routes under `app/(public)/` changes public URLs — must be
done with redirects/SEO verification (website test gate, Section 34). Route-group moves
are Phase G, not Phase A.

## C. CRM / Admin — `app/(admin)/admin/`

An operations client. It must not implement a second marketplace or finance engine.

```
app/(admin)/admin/
├── dashboard/ work-queue/
├── customers/ taskers/ companies/
├── jobs/ quotes/
├── payments/ escrows/ refunds/ commissions/ wallets/ payouts/ reconciliation/
├── disputes/ kyc/ trust-safety/ notifications/
├── risk/ analytics/ audit/ security/ system-health/ settings/
```

Existing admin pages are already thin (0 prisma imports) — most work is API-side
(50 admin routes → thin controllers over `lib/modules/admin/*`).

## D. Canonical backend — `lib/modules/*` + `lib/shared/*`

```
lib/modules/
├── auth/          domain/ application/ infrastructure/ contracts/
├── users/
├── companies/
├── marketplace/   jobs/ quotes/ matching/ scheduling/ workspace/ assignments/
│                  verification/ reviews/ inspections/ change-orders/
├── finance/       payments/ escrow/ ledger/ commission/ wallets/ refunds/
│                  payouts/ reconciliation/
├── trust/         kyc/ credentials/ disputes/ risk/ suspension/
├── communications/ chat/ notifications/ outbox/ sms/
└── admin/         auth/ rbac/ audit/ work-queue/

lib/shared/
├── database/ validation/ errors/ logging/ security/ idempotency/
├── observability/ money/ country/ rate-limit/
```

Rules:
- No empty folders for appearance — a module exists only when real code belongs there.
- Layering (Section 12): `domain` = pure rules; `application` = use cases
  (`acceptQuote()`, `fundEscrow()`, …); `infrastructure` = Prisma/PayHere/Expo/SMS/Redis;
  `contracts` = Zod/DTOs/API shapes.
- Thin routes (Section 13): authenticate → validate → authorize → application service → response.
- Canonical entities (Section 14): MarketplaceJob, JobQuote, JobWorkspace,
  CompanyJobAssignment, JobVerificationPin, PaymentIntent, JobEscrow, FinancialLedger,
  WalletBalance, CommissionSettlement, Payout, MarketplaceDispute, Admin, AdminSession,
  AdminAlert, AuditLog.

## E. Top-level target tree (Section 43)

```
maintainex/
├── app/
│   ├── (public)/            # WEBSITE
│   ├── (admin)/             # CRM
│   └── api/
│       ├── public/  mobile/  admin/  webhooks/  internal/
├── apps/mobile/             # MOBILE APP
├── components/
│   ├── public/  admin/  shared/
├── lib/
│   ├── modules/   (auth users companies marketplace finance trust communications admin)
│   └── shared/
├── prisma/  tests/  docs/  scripts/  public/  .github/  package.json
```

`app/api` path moves are deliberately conservative: Next.js routing is filesystem-based, so
API paths are public contracts (mobile app ships in stores). Consolidation happens by making
handlers thin first; physical `app/api` regrouping only with an explicit compatibility plan.

## F. Cross-surface consistency (Section 36)

One canonical state: a job created in the app is the same `MarketplaceJob` CRM reads; a
payment flips the same `PaymentIntent`/`JobEscrow`/ledger rows everywhere. No competing
App/Website/CRM versions of any record.
