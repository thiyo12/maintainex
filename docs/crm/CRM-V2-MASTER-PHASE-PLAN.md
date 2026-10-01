# MaintainEX CRM V2 — Master Phase Plan

## Product objective

CRM V2 becomes the single operational control plane for MaintainEX across:
- customer app
- tasker app
- company app
- website booking
- jobs/quotes/messaging
- payments/escrow/wallets/payouts/commission/settlements
- KYC/trust/safety
- catalog/pricing/markets
- notifications/promotions
- real estate
- subscriptions/memberships/vouchers
- workforce/company operations
- analytics/audit/security/system health

CRM V2 replaces the existing CRM implementation on the same route contracts. There is no permanent old/new parallel CRM.

---

# Design contract

Every CRM V2 page MUST follow the approved reference design.

## Global visual rules

- Dark charcoal left navigation rail
- Light neutral operational canvas
- MaintainEX amber/yellow primary accent
- White operational cards
- Soft neutral borders
- Compact professional typography
- Dense but readable tables
- Same spacing scale across all pages
- Same status-color semantics everywhere
- Same header/search/market/notification/profile bar everywhere
- Same modal/drawer/button/input/table patterns everywhere
- No old-admin visual components after the owning phase migrates

## Primary layout

Left navigation:
- Dashboard
- Jobs
- Customers
- Taskers
- Companies
- Finance
- Disputes
- Trust & Safety
- Analytics
- App & Web
- Real Estate
- Staff
- Settings

Top bar:
- global search
- current market/country
- notifications
- operator identity/security status

## Design gate

A page cannot be marked complete if:
- it uses the old admin color scheme
- it introduces a different card/table/modal style
- it reuses an old admin page as-is
- it has inconsistent spacing/typography/status colors
- it does not match the approved CRM reference system

---

# Phase 0 — Platform map, security foundation, legacy inventory

## Purpose
Understand the whole platform before building visual modules.

## Work
- [x] Create isolated CRM V2 branch
- [x] Security architecture
- [x] Trust-boundary map
- [x] Module review checklist
- [x] Legacy-retirement rules
- [ ] Inventory all CRM pages/APIs/helpers
- [ ] Inventory all mobile/customer/tasker/company functions
- [ ] Inventory website booking/public APIs
- [ ] Inventory all canonical DB models
- [ ] Inventory cron/background workflows
- [ ] Inventory third-party integrations
- [ ] Inventory high-risk direct Prisma writes
- [ ] Inventory duplicate/legacy category systems
- [ ] Inventory duplicate/legacy role systems
- [ ] Create feature-to-source-of-truth map
- [ ] Create control-capability matrix

## Security foundation
- [ ] canonical staff permission vocabulary
- [ ] per-staff ALLOW/DENY override model
- [ ] owner-only permissions
- [ ] country/market scope
- [ ] immediate session revocation behavior
- [ ] canonical password hashing
- [ ] test SUPER_ADMIN cleanup
- [ ] admin device-recording fix
- [ ] Cloudflare Access
- [ ] MFA
- [ ] direct-origin lock

## Legacy removal
- [ ] assign every old CRM component/helper/API to KEEP / REWRITE / TEMP / DELETE

## Exit gate
- [ ] TypeScript green
- [ ] auth/RBAC tests green
- [ ] security tests green
- [ ] no production behavior changed unintentionally

---

# Phase 1 — CRM V2 design system and application shell

## Build
- [ ] design tokens
- [ ] typography
- [ ] spacing/grid
- [ ] color/status system
- [ ] page header
- [ ] metric card
- [ ] data card
- [ ] table
- [ ] filters
- [ ] search
- [ ] tabs
- [ ] badges
- [ ] forms
- [ ] drawer
- [ ] modal
- [ ] confirmation dialog
- [ ] timeline
- [ ] activity feed
- [ ] notes panel
- [ ] finance card
- [ ] risk card
- [ ] loading/empty/error/permission states
- [ ] responsive behavior

## Shell
- [ ] flat navigation
- [ ] global search
- [ ] market selector
- [ ] notifications
- [ ] operator profile
- [ ] security/session indicator
- [ ] permission-aware navigation

## Legacy removal
- [ ] replace old AdminLayout
- [ ] remove old nested admin navigation
- [ ] remove mixed legacy dark-page styles

## Exit gate
- [ ] approved-reference visual match
- [ ] accessibility baseline
- [ ] responsive baseline
- [ ] production build green

---

# Phase 2 — Dashboard + Jobs + Job 360

## Dashboard
- [ ] Active Jobs
- [ ] Escrow Held
- [ ] Revenue
- [ ] Disputes
- [ ] Jobs & Revenue trend
- [ ] Job Status distribution
- [ ] Recent Jobs
- [ ] Alerts / Pending Actions
- [ ] Live Activity
- [ ] System Health

## Jobs
- [ ] list
- [ ] search
- [ ] filters
- [ ] country/market
- [ ] category/service
- [ ] customer
- [ ] tasker/company
- [ ] job status
- [ ] payment state
- [ ] dispute state
- [ ] urgency/date

## Job 360
- [ ] Overview
- [ ] Lifecycle
- [ ] Quotes
- [ ] Workspace
- [ ] Finance
- [ ] Dispute
- [ ] Audit
- [ ] Customer
- [ ] Provider / Company / Worker
- [ ] Location / map
- [ ] Schedule
- [ ] Service details
- [ ] Lifecycle timeline
- [ ] Quick actions
- [ ] Payment / Escrow
- [ ] Financials
- [ ] Risk
- [ ] SLA
- [ ] Internal notes
- [ ] PIN/arrival/work/completion verification
- [ ] inspections
- [ ] evidence
- [ ] change orders

## Security
- [ ] IDOR
- [ ] country isolation
- [ ] lifecycle bypass
- [ ] action replay
- [ ] private location/contact minimization
- [ ] audit all privileged mutations

## Legacy removal
- [ ] old dashboard removed
- [ ] old jobs UI removed
- [ ] old Job 360 UI removed
- [ ] old unsafe job mutation paths retired

---

# Phase 3 — Customers

## Customer 360
- [ ] profile
- [ ] contact
- [ ] addresses
- [ ] jobs/bookings
- [ ] quotes
- [ ] payment history
- [ ] wallet
- [ ] refunds
- [ ] disputes
- [ ] reviews
- [ ] vouchers/membership
- [ ] communications
- [ ] internal notes
- [ ] notifications
- [ ] devices/sessions where appropriate
- [ ] account status
- [ ] risk/security events

## Operational controls
- [ ] suspend/reactivate
- [ ] session revoke
- [ ] support actions
- [ ] controlled profile correction
- [ ] address/privacy controls
- [ ] dispute/support linkage

## Security
- [ ] PII masking
- [ ] search enumeration protection
- [ ] object ownership
- [ ] export restrictions

## Legacy removal
- [ ] old Customer* admin components removed/replaced

---

# Phase 4 — Taskers / Providers

## Tasker 360
- [ ] identity/profile
- [ ] professions
- [ ] skills
- [ ] service categories
- [ ] job selection
- [ ] service area
- [ ] availability
- [ ] KYC
- [ ] credentials/certifications
- [ ] readiness
- [ ] jobs
- [ ] quotes
- [ ] inspections/evidence
- [ ] ratings/reviews
- [ ] earnings
- [ ] wallet
- [ ] withdrawals
- [ ] company assignments
- [ ] trust/risk
- [ ] suspension

## Security
- [ ] KYC document privacy
- [ ] eligibility tampering
- [ ] payout ownership
- [ ] cross-provider access
- [ ] availability/status abuse

## Legacy removal
- [ ] old tasker admin UI and duplicate provider controls removed

---

# Phase 5 — Companies / Workforce

## Company 360
- [ ] company profile
- [ ] KYC
- [ ] certifications
- [ ] subscription
- [ ] team
- [ ] invitations
- [ ] employees
- [ ] workforce assignments
- [ ] dispatch
- [ ] contracts
- [ ] milestones
- [ ] jobs
- [ ] quotes
- [ ] earnings
- [ ] wallet/payout
- [ ] commission/settlement
- [ ] risk
- [ ] suspension/reactivation

## Security
- [ ] cross-company isolation
- [ ] employee-role escalation
- [ ] assignment race conditions
- [ ] payout destination protection
- [ ] invite-token abuse

## Legacy removal
- [ ] duplicated company admin paths reconciled

---

# Phase 6 — Quotes + Messaging + Notifications

## Quotes
- [ ] request
- [ ] submit
- [ ] revise
- [ ] negotiate
- [ ] change order
- [ ] accept
- [ ] reject
- [ ] expire
- [ ] provider/company identity
- [ ] price integrity

## Messaging
- [ ] customer/tasker/company conversations
- [ ] CRM support access
- [ ] internal notes separate from customer chat
- [ ] attachments
- [ ] moderation
- [ ] message audit where required

## Notifications
- [ ] transactional notifications
- [ ] unread state
- [ ] push/email/SMS orchestration
- [ ] staff alerts
- [ ] broadcast campaigns
- [ ] audience preview
- [ ] delivery result

## Security
- [ ] cross-chat IDOR
- [ ] stored XSS
- [ ] spam/flood
- [ ] attachment abuse
- [ ] mass-send abuse
- [ ] PII in push previews

## Legacy removal
- [ ] duplicate message/notification paths reconciled

---

# Phase 7 — Finance control plane

## Finance overview
- [ ] revenue
- [ ] payment volume
- [ ] escrow
- [ ] wallet liability
- [ ] refunds
- [ ] payouts
- [ ] commission
- [ ] settlements
- [ ] gateway reconciliation

## Payments
- [ ] intents
- [ ] gateway state
- [ ] cash payment state
- [ ] transaction references
- [ ] failures/retries

## Escrow
- [ ] hold
- [ ] release
- [ ] refund
- [ ] auto-release state
- [ ] dispute lock

## Wallets
- [ ] customer/tasker/company balances
- [ ] ledger
- [ ] freeze/unfreeze
- [ ] adjustment through controlled domain service only

## Payouts / withdrawals
- [ ] payout requests
- [ ] destination verification
- [ ] processing
- [ ] rejection
- [ ] reconciliation

## Commission / settlements
- [ ] commission rules
- [ ] company/tasker obligations
- [ ] weekly settlements
- [ ] overdue state
- [ ] payment confirmation

## Security
- [ ] server-calculated money
- [ ] immutable ledger
- [ ] idempotency
- [ ] concurrency
- [ ] webhook verification
- [ ] replay protection
- [ ] dual/step-up controls for high-impact actions where required
- [ ] complete audit

## Legacy removal
- [ ] direct UI-driven financial status writes removed
- [ ] duplicate finance logic removed

---

# Phase 8 — Disputes + Trust & Safety + KYC + Reviews

## Disputes
- [ ] queue
- [ ] evidence
- [ ] parties
- [ ] lifecycle
- [ ] assignments
- [ ] resolution
- [ ] financial impact
- [ ] internal notes
- [ ] escalation

## KYC / credentials
- [ ] customer identity where applicable
- [ ] tasker identity
- [ ] company identity
- [ ] certifications
- [ ] approval/rejection
- [ ] expiry/revocation

## Trust & Safety
- [ ] fraud events
- [ ] cheating reports
- [ ] risk events
- [ ] suspensions/bans
- [ ] IP/security linkage
- [ ] moderation

## Reviews
- [ ] review queue
- [ ] moderation
- [ ] fraud/manipulation detection
- [ ] rating disputes

## Security
- [ ] private storage
- [ ] signed/authorized file retrieval
- [ ] evidence access logging
- [ ] double-resolution prevention
- [ ] internal-risk-data restriction

## Legacy removal
- [ ] old KYC/trust/moderation flows removed

---

# Phase 9 — Canonical catalog, professions, pricing and markets

## Canonical marketplace catalog
- [ ] category
- [ ] subcategory
- [ ] profession
- [ ] skills
- [ ] service template
- [ ] booking questions
- [ ] pricing mode
- [ ] price range
- [ ] materials/pricing data
- [ ] remote/on-site
- [ ] provider/company eligibility
- [ ] country/market visibility
- [ ] app visibility
- [ ] website visibility
- [ ] icons/images
- [ ] translations
- [ ] ordering
- [ ] featured state

## Pricing
- [ ] price estimates
- [ ] pricing confirmation
- [ ] market pricing config
- [ ] commission config
- [ ] price snapshot/version
- [ ] benchmark workflow if retained

## Markets / locations
- [ ] country
- [ ] province/state
- [ ] city/district/area
- [ ] supported regions
- [ ] currency
- [ ] limits
- [ ] availability

## Legacy removal
- [ ] old website category source retired
- [ ] mobile static category source downgraded to temporary fallback
- [ ] V2 template/category split reconciled
- [ ] one canonical taxonomy remains

---

# Phase 10 — Website booking + App & Web controls

## Website booking
- [ ] same catalog as app
- [ ] same customer identity rules
- [ ] same job engine
- [ ] same quote engine
- [ ] same pricing rules
- [ ] same payment state
- [ ] same dispute path
- [ ] bot/spam/rate protection

## Mobile runtime controls
Only expose controls the app actually consumes:
- [ ] channel availability
- [ ] maintenance/readiness
- [ ] service visibility
- [ ] market availability
- [ ] operational banners
- [ ] promotions
- [ ] notification controls
- [ ] feature flags where safely wired
- [ ] version requirements where safely wired

## Website runtime controls
- [ ] booking visibility
- [ ] content/operational banners
- [ ] catalog visibility
- [ ] offers
- [ ] market availability
- [ ] maintenance mode

## Critical rule
CRM can control configuration and operational state.
CRM does NOT dynamically patch application source-code defects.
Source-code bugs require a tested code deployment.

## Legacy removal
- [ ] old platform/mobile/website admin pages replaced
- [ ] fake/non-wired controls removed

---

# Phase 11 — Offers, subscriptions, vouchers and memberships

- [ ] seasonal offers
- [ ] flash offers
- [ ] vouchers
- [ ] customer memberships
- [ ] company subscriptions
- [ ] subscription plans
- [ ] eligibility
- [ ] redemption/claim state
- [ ] market/channel visibility
- [ ] expiry
- [ ] fraud/abuse controls

## Security
- [ ] duplicate redemption
- [ ] price manipulation
- [ ] eligibility forgery
- [ ] unauthorized plan changes

---

# Phase 12 — Real Estate

The current app includes a real-estate module and it must either be deliberately managed by CRM or deliberately separated.

## CRM coverage
- [ ] listings
- [ ] owners/agents
- [ ] approval/rejection
- [ ] listing status
- [ ] images
- [ ] pricing
- [ ] inquiries
- [ ] favorites metrics
- [ ] boosts/featured state
- [ ] moderation
- [ ] fraud/risk
- [ ] market/location
- [ ] analytics

## Security
- [ ] listing ownership
- [ ] image/file safety
- [ ] inquiry PII
- [ ] boost/payment integrity
- [ ] moderation audit

## Legacy decision
- [ ] confirm real estate stays inside MaintainEX core or becomes separate product module

---

# Phase 13 — Staff control plane

## Staff
- [ ] staff directory
- [ ] role templates
- [ ] granular permission matrix
- [ ] explicit ALLOW
- [ ] explicit DENY
- [ ] country/market scope
- [ ] owner-only permissions
- [ ] active/disabled state
- [ ] session list
- [ ] session revoke
- [ ] password reset
- [ ] 2FA status
- [ ] staff activity
- [ ] audit history

## Security
- [ ] prevent self-escalation
- [ ] prevent unauthorized SUPER_ADMIN creation
- [ ] non-delegable owner permissions
- [ ] immediate live-session impact
- [ ] security changes audited
- [ ] step-up auth for high-risk staff changes where required

## Legacy removal
- [ ] role-only staff UI removed
- [ ] legacy access helper removed
- [ ] one permission evaluator remains

---

# Phase 14 — Analytics, search, audit, security and system health

## Global search
- [ ] jobs
- [ ] customers
- [ ] taskers
- [ ] companies
- [ ] disputes
- [ ] payments where authorized
- [ ] listings where authorized
- [ ] strict permission/market filtering
- [ ] result caps
- [ ] no secret indexing

## Analytics
- [ ] operational
- [ ] financial
- [ ] marketplace
- [ ] customer
- [ ] provider
- [ ] company
- [ ] real estate
- [ ] funnel/conversion
- [ ] SLA/performance

## Audit/security
- [ ] immutable admin audit
- [ ] failed logins
- [ ] blocked IPs
- [ ] suspicious events
- [ ] permission changes
- [ ] sensitive document access
- [ ] financial operations

## Health
- [ ] app health
- [ ] DB
- [ ] queue/cron readiness
- [ ] payment integration status
- [ ] notification integration status
- [ ] safe diagnostics only

## Legacy removal
- [ ] old analytics/security/settings pages removed
- [ ] old redirects/adapters removed when no longer needed

---

# Phase 15 — Complete legacy demolition and release

## Legacy demolition
- [ ] no old AdminLayout
- [ ] no old admin navigation
- [ ] no PROVINCE_ADMIN / BRANCH_ADMIN logic
- [ ] no duplicate catalog source of truth
- [ ] no duplicate financial mutation logic
- [ ] no orphan CRM APIs
- [ ] no old page implementation still reachable
- [ ] no temporary compatibility adapter without explicit approval
- [ ] repository-wide dead-code search clean

## Full validation
- [ ] Prisma validation
- [ ] migration validation
- [ ] Web TypeScript
- [ ] Mobile TypeScript
- [ ] auth/RBAC
- [ ] country isolation
- [ ] IDOR
- [ ] security-negative tests
- [ ] finance lifecycle
- [ ] job lifecycle
- [ ] company/workforce
- [ ] messaging
- [ ] KYC/trust
- [ ] catalog/mobile/web
- [ ] offers/subscriptions
- [ ] real estate
- [ ] analytics/search
- [ ] production build
- [ ] Docker build
- [ ] health
- [ ] non-root runtime
- [ ] secret exposure audit
- [ ] visual consistency review for every CRM page

## Production release
- [ ] DB backup
- [ ] rollback image
- [ ] migration dry-run
- [ ] admin owner login smoke
- [ ] staff permissions
- [ ] Dashboard
- [ ] Job 360
- [ ] Customers
- [ ] Taskers
- [ ] Companies
- [ ] Finance
- [ ] Disputes/KYC
- [ ] Catalog
- [ ] App/Web
- [ ] Real Estate
- [ ] audit/security
- [ ] customer app regression
- [ ] tasker app regression
- [ ] company app regression
- [ ] website regression

RELEASE: PASS / FAIL
