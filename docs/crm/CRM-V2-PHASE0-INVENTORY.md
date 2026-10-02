# MaintainEX CRM V2 — Phase 0 Platform Inventory

Status: code inventory baseline for `feature/crm-v2-rebuild`

This document is the Phase 0 source map for the CRM V2 rebuild. It records the current operational surfaces, canonical models/services, known legacy duplicates, and the high-risk mutation paths that later phases must preserve, rewrite, or retire.

## 1. Inventory snapshot

| Surface | Count / status |
|---|---:|
| Admin CRM pages | 36 |
| Admin API routes | 66 |
| Admin / CRM UI components | 16 |
| `lib/crm` helpers | 19 |
| Mobile TypeScript / TSX files | 317 |
| Mobile API routes | 128 |
| Prisma models | 158 |
| Cron/background candidates | 14 |
| Public website / booking candidates | 37 |
| Payment webhooks | 1 PayHere webhook |

These counts are branch-local and are intended as the rebuild baseline. They may decrease as legacy code is removed.

---

## 2. Existing CRM pages — all current page routes

Every page below is REWRITE unless explicitly noted otherwise by the phase plan.

- `/admin/admins/activity`
- `/admin/admins`
- `/admin/analytics/audit`
- `/admin/analytics`
- `/admin/analytics/security-monitor`
- `/admin/analytics/security`
- `/admin/cheating`
- `/admin/commission`
- `/admin/companies/[id]`
- `/admin/dashboard`
- `/admin/financial/commission`
- `/admin/financial`
- `/admin/financial/refunds`
- `/admin/financial/settlements`
- `/admin/financial/wallets`
- `/admin/jobs/[id]`
- `/admin/jobs/disputes`
- `/admin/jobs`
- `/admin/kyc`
- `/admin/platform/catalog`
- `/admin/platform/mobile`
- `/admin/platform/notifications`
- `/admin/platform/offers`
- `/admin/platform`
- `/admin/platform/website`
- `/admin/pricing/market-config`
- `/admin/settings`
- `/admin/trust-safety/credentials`
- `/admin/trust-safety`
- `/admin/trust-safety/risk-events`
- `/admin/users/[id]`
- `/admin/users/companies`
- `/admin/users/customers`
- `/admin/users`
- `/admin/users/taskers`
- `/admin/wishlist`

### Phase ownership

- Phase 1: shell/navigation/layout
- Phase 2: dashboard, jobs, Job 360
- Phase 3: customers
- Phase 4: taskers
- Phase 5: companies/workforce
- Phase 7: finance
- Phase 8: disputes, KYC, trust/safety
- Phase 9: catalog/pricing/markets
- Phase 10–12: app/web, offers/subscriptions, real estate
- Phase 13: staff
- Phase 14: analytics/search/audit/security/health
- Phase 15: final dead-code removal

---

## 3. Existing admin APIs — full route inventory

### Staff/auth/security
- `app/api/admin/admins/[id]/permissions/route.ts`
- `app/api/admin/admins/route.ts`
- `app/api/admin/auth/2fa/confirm/route.ts`
- `app/api/admin/auth/2fa/setup/route.ts`
- `app/api/admin/auth/2fa/verify/route.ts`
- `app/api/admin/auth/login/route.ts`
- `app/api/admin/auth/logout/route.ts`
- `app/api/admin/auth/me/route.ts`
- `app/api/admin/auth/refresh/route.ts`
- `app/api/admin/auth/step-up/route.ts`
- `app/api/admin/security/blocked-ips/route.ts`
- `app/api/admin/security/break-glass/payouts/freeze/route.ts`
- `app/api/admin/security/failed-logins/route.ts`
- `app/api/admin/security/logs/route.ts`
- `app/api/admin/security/monitor/route.ts`
- `app/api/admin/staff/activity/route.ts`

### Dashboard/analytics/audit/search
- `app/api/admin/analytics/route.ts`
- `app/api/admin/audit/route.ts`
- `app/api/admin/search/route.ts`

### Jobs/quotes/disputes/users
- `app/api/admin/disputes/route.ts`
- `app/api/admin/jobs/[id]/route.ts`
- `app/api/admin/jobs/route.ts`
- `app/api/admin/quotes/[id]/route.ts`
- `app/api/admin/users/[id]/route.ts`
- `app/api/admin/users/route.ts`

### Providers/companies/KYC/trust
- `app/api/admin/companies/[id]/reactivate/route.ts`
- `app/api/admin/companies/[id]/route.ts`
- `app/api/admin/companies/[id]/suspend/route.ts`
- `app/api/admin/companies/[id]/verification/route.ts`
- `app/api/admin/providers/[id]/reactivate/route.ts`
- `app/api/admin/providers/[id]/suspend/route.ts`
- `app/api/admin/kyc/route.ts`
- `app/api/admin/credentials/[id]/review/route.ts`
- `app/api/admin/credentials/route.ts`
- `app/api/admin/risk-events/[id]/review/route.ts`
- `app/api/admin/risk-events/route.ts`
- `app/api/admin/trust-safety/overview/route.ts`
- `app/api/admin/cheating/route.ts`

### Finance
- `app/api/admin/commission/payments/route.ts`
- `app/api/admin/commission/route.ts`
- `app/api/admin/financial/commission/route.ts`
- `app/api/admin/financial/overview/route.ts`
- `app/api/admin/financial/payouts/[id]/route.ts`
- `app/api/admin/financial/payouts/route.ts`
- `app/api/admin/financial/refunds/route.ts`
- `app/api/admin/financial/wallets/route.ts`

### Catalog/pricing/market/platform
- `app/api/admin/benchmarks/[id]/approve/route.ts`
- `app/api/admin/benchmarks/[id]/publish/route.ts`
- `app/api/admin/benchmarks/[id]/route.ts`
- `app/api/admin/benchmarks/[id]/submit/route.ts`
- `app/api/admin/benchmarks/[id]/supersede/route.ts`
- `app/api/admin/benchmarks/route.ts`
- `app/api/admin/market-config/route.ts`
- `app/api/admin/platform/catalog/route.ts`
- `app/api/admin/platform/offers/route.ts`
- `app/api/admin/platform/overview/route.ts`
- `app/api/admin/pricing-config/route.ts`
- `app/api/admin/professions/[id]/route.ts`
- `app/api/admin/professions/[id]/skills/route.ts`
- `app/api/admin/professions/route.ts`
- `app/api/admin/professions/submissions/[id]/route.ts`
- `app/api/admin/professions/submissions/route.ts`
- `app/api/admin/service-requirements/route.ts`
- `app/api/admin/settings/route.ts`
- `app/api/admin/wishlist/route.ts`
- `app/api/admin/notifications/route.ts`

---

## 4. Existing admin/CRM UI helpers

### Phase 1 KEEP/REWRITE
- `components/admin/AdminLayout.tsx` — REWRITE in Phase 1.
- `components/admin/AdminSessionProvider.tsx` — KEEP contract, simplify/modernize in Phase 1.
- `components/crm/CrmGlobalSearch.tsx` — REVIEW/REWRITE against canonical search in Phase 14.
- `components/crm/CrmNotificationBell.tsx` — REVIEW/REWRITE in Phase 6/14.

### Legacy module components — retire with owning phase
- `ActivityTimeline.tsx`
- `CustomerFilters.tsx`
- `CustomerNotes.tsx`
- `CustomerProfile.tsx`
- `CustomerStats.tsx`
- `CustomerTable.tsx`
- `ImageCropper.tsx`
- `ImageUploader.tsx`
- `PriceSuggestion.tsx`
- `TagBadge.tsx`
- `WhatsAppModal.tsx`
- `components/admin/index.ts`

No old component is deleted before its replacement route is proven.

---

## 5. Canonical CRM/security helpers

KEEP and expand:
- `lib/crm/security.ts`
- `lib/crm/audit.ts`
- `lib/crm/governance/action-registry.ts`
- `lib/crm/governance/approval-engine.ts`
- `lib/crm/governance/approval-service.ts`
- `lib/crm/governance/approval-state.ts`
- `lib/crm/governance/permission-catalog.ts`
- `lib/crm/governance/permissions.ts`
- `lib/crm/governance/risk-policy.ts`
- `lib/crm/governance/step-up.ts`
- `lib/crm/governance/types.ts`
- `lib/crm/emergency-controls.ts`

TEMP/REVIEW:
- `lib/crm/account-action-permissions.ts` — legacy compatibility until account phases migrate.
- `lib/crm/section-access.ts` — temporary nav/page compatibility.
- `lib/crm/rate-limit.ts` — keep only if it remains the canonical CRM rate-limit layer.
- `lib/crm/validation.ts` — split/retire as modules get typed schemas.
- `lib/crm/whatsapp.ts` — review in messaging phase.
- `lib/crm/benchmark-utils.ts` — review in pricing/catalog phase.

DELETE completed:
- `lib/crm/access-control.ts` — removed; obsolete ADMIN/PROVINCE_ADMIN/BRANCH_ADMIN CRM authorization layer.

---

## 6. Mobile/app runtime inventory

The branch contains 317 mobile TS/TSX files and 128 `/api/mobile/**` routes.

### Functional route families
- Auth/account: login, OTP, refresh, registration, profile, password reset, role switching.
- Customer: booking, search, job creation/tracking, quote acceptance, completion/review, wallet/payment, disputes.
- Tasker/provider: profile, professions/skills, eligibility, location, status, earnings, withdrawal, availability.
- Company: context, team/invites, members, workforce, assignments, contracts, milestones, earnings, subscription.
- Jobs V2: lifecycle, workspace, PIN, inspection, evidence, change orders, customer status, completion.
- Quotes: submit/revise/select.
- Payments/escrow: payment state, cash payment, escrow hold/release/refund.
- Messaging: conversations/messages.
- Notifications: list/read/unread.
- Pricing/matching: estimates, confirmation, materials, matching, schedule, quality.
- Identity/KYC/certifications.
- Real estate.
- Admin/mobile compatibility routes.

CRM controls must only expose configuration/actions actually consumed by these runtimes.

---

## 7. Website/public booking inventory

Public website and booking surfaces currently span:
- public home/about/contact/careers/services/waitlist routes
- service pages including city/location pages
- `/api/bookings/**`
- `/api/services/**`
- `/api/categories`
- `/api/industries/**`

Phase 10 must move website booking onto the same canonical marketplace catalog/job/quote/payment rules as mobile. Public website `Category/Service/Industry` is not allowed to remain an independent marketplace source of truth after that phase.

---

## 8. Background/cron inventory

Current background candidates:
- `/api/cron/daily-maintenance`
- `/api/cron/escrow-release`
- `/api/cron/job-response-escalation`
- `/api/cron/learn`
- `/api/cron/matching-waves`
- `/api/cron/offer-timeouts`
- `/api/cron/payhere-refunds`
- `/api/cron/pricing-train`
- `/api/cron/re-engagement`
- `/api/cron/reputation`
- `lib/work-queue.ts`

Also review worker assignment/scheduling flows under mobile company/worker APIs.

Every cron that mutates money or job lifecycle must call canonical domain services, remain idempotent, and use authenticated cron/internal boundaries.

---

## 9. Third-party / infrastructure integration inventory

Known branch configuration/dependencies:
- PostgreSQL / Prisma
- PayHere payment gateway + PayHere webhook
- Redis / ioredis
- Cloudinary
- SMTP / Nodemailer
- Cloudflare DNS/proxy/Access at infrastructure layer
- Dokploy / Docker Swarm / Traefik deployment layer
- Expo/mobile runtime outside the root package

Sensitive integration values remain environment-only and must never be surfaced in CRM APIs, health payloads, logs, or Git.

---

## 10. Canonical source-of-truth map

| Domain | Canonical models/services | Legacy/duplicate status |
|---|---|---|
| Staff identity | `AdminUser`, `AdminSession`, `AdminPermissionOverride` | legacy `Admin` model is not CRM V2 identity |
| Staff permissions | canonical role templates + V2 permission catalog/evaluator | old role-only/branch/province semantics retire |
| Staff step-up | `CrmStepUpGrant` + TOTP | one-time, session/action-bound |
| Approval governance | `CrmApprovalRequest/Decision/Event` + governance services | no UI-only approval |
| Emergency controls | `CrmEmergencyControl` | safer-state-only break-glass |
| Customer identity | `User` + `CustomerProfile` | retired legacy `/api/customers/**` CRM CRUD |
| Tasker/provider | `User`, `TaskerProfile`, profession/skill models | reconcile old job-selection/static category behavior |
| Company | `CompanyProfile`, `TeamMember`, `CompanyJobAssignment`, contracts/milestones | company workforce roles are domain roles, not CRM staff roles |
| Job | `MarketplaceJob`, `JobWorkspace`, `JobLifecycleEvent` | legacy `JobPosting/Bid/Assignment` reviewed per migration |
| Job verification | `JobVerificationPin`, `JobInspection`, `JobEvidence`, `JobChangeOrder` | canonical V2 lifecycle |
| Quotes | `JobQuote`, `QuoteLineItem` | reconcile legacy bid/quote paths |
| Messaging | `Conversation`, `ConversationParticipant`, `Message` | canonical messaging |
| Payments | `PaymentIntent`, payment service, idempotency | no client-calculated money |
| Escrow | `JobEscrow` | canonical escrow state machine |
| Ledger | `FinancialLedger`, `IdempotencyRecord` | append-only accounting path |
| Wallets | `ProviderWallet`, `CustomerWallet`, `WalletBalance` | admin direct writes must move behind canonical wallet service |
| Payouts | `Payout` + `lib/finance/payouts/payout-engine.ts` | engine is canonical |
| Commission/settlement | `CommissionSettlement`, `WeeklySettlement`, `CommissionPayment` | direct admin settlement mutations require Phase 7 reconciliation |
| KYC/identity | `IdentityDocument`, `ProviderDocument`, `Certification` | private-file boundary required |
| Risk/trust | `MarketplaceRiskEvent`, `FraudEvent`, `AdminFlag` | consolidate in Trust & Safety |
| Catalog | `JobCategory`, `ServiceTemplate`, `Profession` + skills/requirements | legacy `Category/Service/Industry`, static mobile categories and `lib/v2-job-categories.ts` are duplicate authority |
| Markets | `Country/State/City/Area`, `MarketConfig` | one market/currency source required |
| Notifications | `Notification`, `AdminNotification` + notification engine | broadcast requires governed audience/action |
| Real estate | `RealEstateListing`, favorites/inquiries/boost/location models | Phase 12 explicit ownership |
| Audit | `SecurityAudit`, `AuditLog`, `CrmApprovalEvent` | append-only privileged history |

---

## 11. Duplicate catalog/category sources to retire

Current overlapping sources:
- `Category`, `Service`, `Industry`
- `JobCategory`
- `TemplateJob`
- `ServiceTemplate`
- `Profession` / `ProfessionSkill` / requirements
- `lib/v2-job-categories.ts`
- `apps/mobile/lib/categories.ts`
- `apps/mobile/lib/categoryData.ts`
- multiple V1/V2 category/template APIs

Phase 9 owns consolidation. Until then, no new independent taxonomy may be introduced.

---

## 12. Legacy role/permission systems

### Canonical CRM staff roles
- `SUPER_ADMIN`
- `MANAGER`
- `FINANCE`
- `USER_MANAGEMENT`
- `SUPPORT`
- `TECHNICAL`

### Legacy / non-CRM role vocabularies
- legacy `Admin` model with `ADMIN`, province, region and branch semantics
- historical `PROVINCE_ADMIN` / `BRANCH_ADMIN` access helper — removed from CRM V2
- company/team/workforce roles — valid domain roles, must never be interpreted as CRM staff roles
- public/mobile `User.role` — marketplace identity role, separate from CRM staff role

The canonical CRM evaluator is role template -> explicit DENY/ALLOW rules -> permission class/action policy -> live account/session/country scope.

---

## 13. High-risk mutation inventory

### Already routed through canonical/domain services
- Customer/tasker/company suspend/reactivate: `lib/domain/admin-suspension`
- Refunds: `lib/finance/payments/payment-service`
- Payout transitions: `lib/finance/payouts/payout-engine`
- Market config: `lib/domain/market-config`
- Staff permission changes: governed V2 action + one-time step-up + session revocation

### Direct-write candidates that must be rewritten/reconciled
- `app/api/admin/financial/wallets/route.ts` — direct provider/customer wallet mutation
- `app/api/admin/commission/route.ts` — direct commission-settlement mutation inside transaction
- `app/api/admin/settings/route.ts` — direct runtime-setting transaction path; must prove each setting has a real consumer
- any later discovered finance/job lifecycle route that changes state without canonical service ownership

These are not considered release-safe just because they are currently authenticated. Their owning phases must move high-impact transitions behind typed domain services, approval policy, idempotency/concurrency controls, and audit.

---

## 14. Legacy retirement assignments

| Artifact | Classification | Removal phase |
|---|---|---|
| `components/admin/AdminLayout.tsx` | REWRITE | Phase 1 |
| nested legacy nav | DELETE after replacement | Phase 1 |
| legacy dark page-specific CRM styles | DELETE as module migrates | Phase 1–14 |
| old dashboard | REWRITE/DELETE | Phase 2 |
| old jobs/Job 360 | REWRITE/DELETE | Phase 2 |
| old Customer* components | REVIEW then DELETE | Phase 3 |
| old tasker/provider controls | REWRITE/DELETE | Phase 4 |
| duplicate company paths | RECONCILE | Phase 5 |
| old finance UI/direct mutation paths | REWRITE | Phase 7 |
| old KYC/trust UI | REWRITE | Phase 8 |
| duplicate catalog/category sources | TEMP then DELETE authority | Phase 9 |
| old platform mobile/website controls | REWRITE; remove fake controls | Phase 10 |
| old staff role-only UI | REWRITE/DELETE | Phase 13 |
| old analytics/security/settings UI | REWRITE/DELETE | Phase 14 |
| middleware `/admin/marketplace` redirects | TEMP ADAPTER | Phase 15 |
| legacy `Admin`/simple-token utilities | REVIEW non-CRM callers; do not use for CRM V2 | Phase 15 |

---

## 15. Phase 0 code-side completion status

Implemented on the V2 branch:
- canonical permission vocabulary and per-staff overrides
- owner-only/non-delegable permissions
- live AdminUser/AdminSession guards
- immediate session invalidation for privilege changes
- canonical peppered staff password hashing
- one-time session/action-bound TOTP step-up
- secure 2FA enrollment confirmation
- maker-checker approval state machine
- policy/risk evaluator
- append-only approval events
- payout break-glass freeze enforced inside payout transactions
- approval idempotency payload binding
- obsolete CRM province/branch access helper removed
- obsolete CRM customer API removed
- legacy admin login fallback removed
- admin device-recording identity mismatch removed
- TypeScript/security/finance/build gates added

Still external/production operational work before release:
- Cloudflare Access policy on `admin.maintainex.lk`
- direct-origin bypass lock
- disable/remove automated production test SUPER_ADMIN accounts
- enable and verify owner TOTP in production
- final production smoke after deployment

Phase 1 may proceed on the isolated branch while these production-edge items remain pre-release blockers.
