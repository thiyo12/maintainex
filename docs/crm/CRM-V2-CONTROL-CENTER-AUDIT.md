# MaintainEX CRM V2 Control-Center Audit

Baseline: `main@202a1f212b4cb8542b3dfb57c865807ed7e23085`  
Reference: approved MaintainEX Operations Dashboard image  
Audit date: 2026-10-02

## Completion rule

A CRM area is **complete** only when the operator UI, backend action, permission enforcement, market scope, approval behavior for high-risk actions, audit trail, and relevant integration all work together. A route or page existing by itself is not considered complete.

Status legend:

- ✅ complete at the audited boundary
- 🟡 implemented but incomplete / needs parity, integration, or validation
- ⬜ missing or not yet implemented
- 🔴 release blocker

## UI defect matrix

| Area | Current state | Required state | Status |
| --- | --- | --- | --- |
| Global shell | Dark sidebar, light workspace, search, market selector and notification primitives exist | Keep compact charcoal navigation, amber MaintainEX accent, white workspace and consistent page chrome | ✅ |
| Shared buttons | CRM V2 button primitives include contrast-safe primary/danger classes | All actions must use shared variants; no foreground/background collisions | 🟡 |
| Typography / spacing | Mostly CRM V2 primitives, but older modules still have local layout choices | One consistent hierarchy, density, card radius, border and table rhythm | 🟡 |
| Dashboard | Reference-parity pass added, but KPI anatomy differs from approved reference | Reference KPI row: Total Jobs, In Progress, Completed, Disputes, Total Revenue, Payouts Processed; trend/status/recent/activity/health below | 🟡 |
| Job 360 | Seven-tab workspace and right-side operational panels exist | Preserve Overview/Lifecycle/Quotes/Workspace/Finance/Dispute-Risk/Audit while matching reference density and complete financial timeline | 🟡 |
| Finance overview | CRM V2 page exists | Provider-aware totals, settlement/reconciliation/provider-health visibility | 🟡 |
| Payments | Operational table exists | Provider column/filter, provider refs, fees, commission/net, reconciliation, event history and PayPal state | 🟡 |
| Escrow | Operational workspace exists | Provider-funded lifecycle must remain linked to canonical escrow state and approvals | ✅ |
| Refunds | Governed queue exists | Add provider-aware refund/refund-event detail and partial-refund support only where provider/domain supports it | 🟡 |
| Payouts | Governed queue, freeze and approval controls exist | Keep current controls; provider settlement visibility can be added separately | ✅ |
| Other CRM modules | Most use CRM V2 primitives | Finish visual consistency pass without page-specific color hacks | 🟡 |
| Accessibility | Obvious accent/white collisions are structurally guarded | Run global contrast/readability regression and normalize focus/disabled states | 🟡 |

## Platform-management coverage matrix

| Capability | Current control surface / backend | Audit status |
| --- | --- | --- |
| Dashboard | Dashboard V2 + scoped analytics/health | 🟡 reference parity still needs verification |
| Jobs | Jobs workspace + scoped APIs | ✅ |
| Job 360 | Detailed workspace | 🟡 financial provider timeline incomplete |
| Customers | Customer management | ✅ |
| Taskers | Tasker management | ✅ |
| Companies | Company management | ✅ |
| Company employees | Company/team domain exists | 🟡 verify dedicated CRM depth |
| Quotes | Job / quote controls | ✅ |
| Scheduling | Job schedule data present | 🟡 consolidated operations view can improve |
| Messaging / notifications | Platform controls and messaging domain exist | 🟡 operator management coverage needs final pass |
| Finance | Finance control center | 🟡 provider/reconciliation layer incomplete |
| Payments | PaymentIntent operations | 🟡 provider metadata/event layer incomplete |
| PayPal | Orders v2 adapter and checkout creation exist | 🔴 return/cancel endpoints and webhook ingestion are missing; market gate missing |
| Escrow | JobEscrow + governed actions | ✅ |
| Refunds | Approval-governed refund queue | 🟡 PayPal provider lifecycle not fully wired |
| Payouts | Governed payout queue + freeze | ✅ |
| Commission settlements | CommissionSettlement + ledger/control routes | ✅ |
| Reconciliation | PayHere refund reconciliation exists | 🟡 generic payment-provider reconciliation missing |
| Provider fees | Not first-class in payment records | ⬜ |
| Chargebacks / provider disputes | Payment status has CHARGEDBACK; marketplace disputes exist | 🟡 provider dispute event model missing |
| Payment webhooks/events | PayHere callback architecture exists | 🔴 verified PayPal webhook route/history/replay store missing |
| KYC | Identity/provider documents + Trust & Safety | ✅ |
| Trust & Safety | Dedicated control surface | ✅ |
| Fraud/security events | Risk events + security controls | ✅ |
| Staff/admin management | Staff workspace | ✅ |
| Roles / permissions | RBAC + permission overrides | ✅ |
| Staff sessions | Session controls/tests exist | ✅ |
| Audit history | CRM audit/governance events | ✅ |
| Approval workflows | CrmApprovalRequest/Decision/Event | ✅ |
| High-risk exceptions | Governance/action registry + step-up/approval | ✅ |
| Service categories | Platform/catalog controls | ✅ |
| Professions/tasker taxonomy | Taxonomy controls/tests exist | ✅ |
| Locations/countries/markets | Country + market config + selected-market authorization | ✅ |
| Pricing/configuration | MarketConfig and settings | 🟡 payment-provider config not represented |
| Promotions | Platform offers/promotions | ✅ |
| Subscriptions | Subscription control routes/tests | ✅ |
| Real Estate | Dedicated CRM workspace | ✅ |
| Website controls | App & Web platform area | 🟡 runtime ownership/wiring varies by setting |
| Mobile app controls | Platform mobile area | 🟡 final coverage pass required |
| Notification controls | Platform controls | 🟡 final coverage pass required |
| Analytics | Analytics workspace | ✅ |
| Search | Global CRM search | ✅ |
| Security Monitor | Trust/Safety + security events | 🟡 consolidate operator visibility |
| System Health | Dashboard health | 🟡 add payment-provider health detail |

## Existing payment architecture

Current canonical financial entities:

`MarketplaceJob -> JobEscrow -> PaymentIntent -> FinancialLedger -> CommissionSettlement -> Payout`

High-risk CRM mutations use the existing governance layer:

`CrmAction -> permission -> step-up -> CrmApprovalRequest -> approval decision -> canonical finance execution -> immutable audit/event record`

This control path must not be bypassed by provider-specific code.

### Existing PayPal implementation

Already present:

- server-side PayPal credentials through environment variables;
- Orders v2 create/retrieve/capture helpers;
- refund helpers;
- PayPal webhook signature verification helper;
- PayPal request-id idempotency headers;
- `PaymentIntent.gateway` and legacy PayHere backfill;
- checkout creation in the canonical payment service.

Critical gaps:

1. `createPaymentIntent()` directly chooses PayPal instead of resolving an enabled provider for the job market/currency.
2. Current PayPal checkout URLs point to `/api/payments/paypal/return` and `/api/payments/paypal/cancel`, but those routes do not exist.
3. The webhook verification helper is not wired to a public PayPal webhook endpoint.
4. There is no first-class immutable provider event store, so webhook replay protection/history is incomplete.
5. There is no first-class provider transaction/reconciliation record for order/auth/capture/refund/dispute references.
6. Provider fees and provider net settlement are not first-class fields in CRM payment views.
7. `.env.example` does not document the required PayPal environment boundary.
8. Payment CRM reads do not currently return `gateway`.
9. MarketConfig does not currently describe enabled payment providers or supported currencies.
10. PayPal availability cannot be inferred from country code alone; payment and payout capability must be configured per market/provider/currency and validated before activation.

## Target provider architecture

The provider layer should preserve the existing job and escrow lifecycle:

`Job -> Payment Intent -> Provider Transaction -> Capture/Settlement -> Ledger/Escrow -> Commission -> Provider Fee -> Provider Net -> Refund/Payout/Reconciliation`

Provider-specific APIs must be behind a server-side adapter/registry. The canonical job/escrow/ledger transition remains provider-neutral.

Configuration must be operational metadata only. **Credentials never belong in CRM/database payloads.**

Suggested market model:

`Market -> currency -> provider -> enabled -> mode -> capability flags -> refund/capture rules -> operational status`

Provider enablement is fail-closed: no configured market/currency/provider capability means checkout is unavailable.

## PayPal release blockers

- 🔴 Missing return/cancel routes referenced by live PayPal order creation.
- 🔴 Missing verified webhook endpoint and replay/event persistence.
- 🔴 No market/currency provider enablement gate; new checkout currently hard-selects PayPal.
- 🔴 No end-to-end PayPal capture -> canonical escrow/ledger finalization regression test.
- 🟡 No generic provider transaction/reconciliation model.
- 🟡 Payment CRM does not expose provider refs/fees/events/reconciliation.
- 🟡 Job 360 does not yet expose the complete provider financial timeline.
- 🟡 PayPal environment variables are undocumented in `.env.example`.

## Implementation order

1. Add provider/market configuration and generic provider/event transaction records without moving secrets into the database.
2. Introduce a provider registry/resolver; keep PayHere legacy compatibility and manual/bank flows explicit.
3. Refactor captured-payment finalization into one provider-neutral canonical service.
4. Add PayPal return/cancel and verified webhook endpoints with replay protection.
5. Add provider-aware reconciliation and refund paths.
6. Upgrade Finance/Payments CRM and Job 360 financial timeline.
7. Finish global UI parity/accessibility pass.
8. Add provider/payment security + regression tests to the release workflow.
9. Require green PR CI before merge/deployment.
