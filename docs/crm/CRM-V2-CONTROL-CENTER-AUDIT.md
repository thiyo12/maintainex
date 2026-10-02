# MaintainEX CRM V2 Control-Center Audit

Baseline: production CRM V2 from `main`  
Working branch: `feature/crm-international-payments-control-center`  
Reference: approved MaintainEX Operations Dashboard image  
Audit date: 2026-10-02

## Completion rule

A CRM area is complete only when the operator UI, underlying action, permission enforcement, market scope, approval behavior for high-risk actions, audit trail, and relevant backend integration work together. A page existing by itself is not completion.

Status legend:

- ✅ complete at the audited boundary
- 🟡 intentionally limited / activation or future domain work remains
- ⬜ missing
- 🔴 release blocker

## UI defect matrix

| Area | Result | Status |
| --- | --- | --- |
| Global shell | Dark navigation rail, compact light workspace, amber MaintainEX accent, search/market controls and responsive desktop layout use the CRM V2 shell | ✅ |
| Shared buttons | Primary, secondary and danger actions use centralized contrast-safe primitives; structural tests block known invisible foreground/background combinations | ✅ |
| Typography / spacing | Admin workspaces are required by CI to use CRM V2 primitives; User 360 was migrated from the remaining legacy implementation | ✅ |
| Dashboard | Reference-direction KPI row, operations trend, job status, recent jobs/activity and health panels are implemented in the approved light control-center style | ✅ |
| Job 360 | Seven-tab operational workspace includes lifecycle, quotes, workspace, finance, dispute/risk and audit with provider payment events in the job financial timeline | ✅ |
| Finance / Payments | Provider-aware payment operations, Provider Control Plane, Payment 360, refunds, escrow, payouts, settlements, commission, wallets and ledger surfaces are present | ✅ |
| Accessibility / readability | Global structural guard checks CRM V2 page adoption and known contrast regressions; KYC lightbox contrast defect fixed | ✅ |
| Legacy dark pages | No admin workspace is allowed to remain outside the shared CRM V2 component system | ✅ |

## Platform-management coverage matrix

| Capability | Control surface / integration | Status |
| --- | --- | --- |
| Dashboard | CRM V2 operations dashboard + scoped analytics/health | ✅ |
| Jobs | Jobs workspace + governed/scoped APIs | ✅ |
| Job 360 | Full operational workspace + finance/provider timeline | ✅ |
| Customers | Customer directory + User 360 | ✅ |
| Taskers | Tasker directory + User 360 | ✅ |
| Companies | Company directory + Company 360 | ✅ |
| Company employees | Company 360 workforce/team management | ✅ |
| Quotes | Job and Job 360 quote controls | ✅ |
| Scheduling | Job/Job 360 scheduling state and lifecycle | ✅ |
| Messaging / notifications | Platform notification controls and messaging domain visibility | ✅ |
| Finance | Finance control center | ✅ |
| Payments | Payment Operations + Payment 360 | ✅ |
| PayPal | Provider adapter, Orders v2 checkout/capture, return/cancel, verified webhook handling, refunds and provider events | ✅ architecture-ready |
| Escrow | Canonical JobEscrow lifecycle + governed release/refund paths | ✅ |
| Refunds | Provider-aware governed refund queue | ✅ |
| Payouts | Governed payout queue and settlement controls | ✅ |
| Commission settlements | CommissionSettlement + ledger/control routes | ✅ |
| Reconciliation | Provider transaction reconciliation with dedicated sensitive permission and immutable audit | ✅ |
| Provider fees | First-class provider transaction fee/net fields surfaced in Payment 360 | ✅ |
| Chargebacks / provider disputes | Provider dispute webhook handling places protected escrow on hold and records risk/lifecycle events | ✅ |
| Payment webhooks/events | Verified PayPal webhook endpoint + immutable provider event history + duplicate/replay protection | ✅ |
| KYC | Identity/provider documents + Trust & Safety | ✅ |
| Trust & Safety | Dedicated control surface | ✅ |
| Fraud/security events | Risk events + Security Monitor | ✅ |
| Staff/admin management | Staff workspace | ✅ |
| Roles / permissions | RBAC + canonical permission catalog + overrides | ✅ |
| Staff sessions | Session controls and revocation | ✅ |
| Audit history | CRM/security/governance audit surfaces | ✅ |
| Approval workflows | CrmApprovalRequest/Decision/Event | ✅ |
| High-risk exceptions | Governance registry, risk re-evaluation, step-up and maker-checker approval | ✅ |
| Service categories | Platform catalog | ✅ |
| Professions/tasker taxonomy | Professions/taxonomy control surface | ✅ |
| Locations/countries/markets | Country hierarchy + market config + selected-market authorization | ✅ |
| Pricing/configuration | Market pricing/config + payment-provider control plane | ✅ |
| Promotions | Platform offers/promotions | ✅ |
| Subscriptions | Subscription control surface | ✅ |
| Real Estate | Dedicated CRM workspace | ✅ |
| Website controls | Platform website controls | ✅ |
| Mobile app controls | Platform mobile controls | ✅ |
| Notification controls | Platform notification controls | ✅ |
| Analytics | Analytics workspace | ✅ |
| Search | Global CRM search | ✅ |
| Security Monitor | Dedicated security-monitor surface | ✅ |
| System Health | System health + market-scoped payment-provider runtime readiness | ✅ |

## Payment architecture

Canonical financial flow:

`MarketplaceJob -> JobEscrow -> PaymentIntent -> PaymentProviderTransaction -> provider capture/settlement -> FinancialLedger -> CommissionSettlement -> Payout`

Refund/event layer:

`PaymentIntent -> PaymentProviderRefund -> PaymentProviderEvent -> reconciliation / risk / approval / audit`

High-risk CRM mutation path remains:

`CrmAction -> permission -> step-up -> CrmApprovalRequest -> approval decision -> current-risk revalidation -> canonical finance execution -> immutable audit/event record`

Provider-specific code does not bypass the canonical job, escrow, ledger, approval or audit boundaries.

## Provider control plane

Operational provider configuration is market-specific and contains no credentials:

`Country / Market -> supported currencies -> provider -> enabled -> environment -> methods -> capability flags -> capture mode -> commission/refund/settlement/fee configuration -> operational status`

Provider credentials remain server-only environment variables.

Provider enablement is fail-closed:

- provider must exist for the selected market;
- currency must be explicitly supported;
- checkout capability must be enabled;
- runtime credentials/environment must match the CRM configuration;
- webhook readiness is required when webhook capability is enabled;
- refund/reconciliation runtime credentials are required when those capabilities are enabled;
- unsupported manual-bank hosted checkout is rejected;
- unsupported authorize-only mode is rejected until the canonical lifecycle implements it.

Sri Lanka PayHere compatibility is bootstrapped from the actual deployment environment and never overwrites operator-managed provider configuration. PayPal is not automatically enabled for any country.

## PayPal architecture status

Implemented:

- server-only PayPal client credentials and webhook ID;
- Orders v2 order creation and retrieval;
- server-authoritative capture/finalization;
- return and cancel endpoints;
- verified webhook signature boundary;
- provider event persistence;
- provider event replay/duplicate protection;
- idempotent PayPal request IDs;
- provider transaction IDs for order/capture/authorization references;
- provider fee and provider net settlement fields;
- full-provider refund adapter and governed refund dispatcher;
- provider-side refund event recording;
- provider-dispute handling and escrow hold;
- Payment Operations provider filters;
- Payment 360 provider refs, economics, refund history, webhook/event history, reconciliation, approval and audit history;
- Job 360 provider financial/event timeline;
- provider health/status monitoring;
- market/currency/provider enablement;
- sandbox/live separation;
- mobile checkout text/provider handling is provider-aware rather than hard-coded to PayHere.

## Intentionally limited items

These are not release blockers for the provider-ready CRM architecture:

- 🟡 **PayPal market activation:** requires valid server credentials, webhook configuration and an explicitly enabled market/provider row. No country is auto-enabled.
- 🟡 **Partial refunds:** the PayPal adapter can transport an amount, but CRM partial-refund execution is intentionally not exposed until the canonical escrow/ledger model represents partial releases/refunds without accounting ambiguity.
- 🟡 **Authorize-only/manual capture:** provider capability metadata exists, but activation is blocked until the canonical payment lifecycle supports authorization state separately from captured/protected funds.
- 🟡 **Provider payouts:** payment-provider payout capability is separate from MaintainEX tasker/company payout settlement and is not assumed from PayPal checkout capability.

## Release gates

Blocking CI includes:

- Prisma generation/validation and isolated migration verification;
- web TypeScript;
- mobile TypeScript;
- schema integrity and CRM V2 visual/readability contracts;
- country isolation/invariants;
- negative security tests;
- Phase 9 security tests;
- payment/provider control-plane security tests;
- current financial lifecycle tests including provider registry and PayPal adapter;
- production build;
- Docker build/start/health;
- non-root runtime verification.

The historical full-regression baseline remains non-blocking by design and is reported separately from the current release gates.

## Release rule

Do not merge or deploy this branch until the current PR head has:

- ✅ Security Exposure Audit
- ✅ CRM V2 Release Validation

Production PayPal activation remains a separate operational step after credentials/webhook/market capability verification.
