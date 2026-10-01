# MaintainEX CRM V2 — Production Build Plan

## Mission

Rebuild MaintainEX CRM as the single production control plane for the current marketplace, mobile app, website booking, finance, trust/safety, staff and platform operations.

This is not a parallel admin product. CRM V2 replaces the existing CRM implementation on the same route contracts.

## Non-negotiable delivery rules

- Production `main` stays stable until the V2 branch passes release gates.
- Do not create a permanent `/admin-v2` route tree.
- Reuse existing public route contracts where practical: `/admin/dashboard`, `/admin/jobs`, etc.
- Replace implementation behind those routes on `feature/crm-v2-rebuild`.
- Every migrated module must retire its replaced legacy UI/helpers/API behavior before that phase is considered done.
- Compatibility adapters are temporary, documented, tested and deleted before release.
- No fake controls. CRM only exposes controls backed by real runtime behavior.
- No raw Prisma CRUD for high-risk domain transitions when a canonical service should own the state change.
- Security review and negative tests are part of implementation, not post-build cleanup.
- No merge to `main` until Phase 0-9 release gates are green.

---

# Master build sheet

## PHASE 0 — Foundations, security and legacy inventory

### 0A. Freeze and inventory
- [x] Create isolated branch `feature/crm-v2-rebuild`
- [x] Lock CRM V2 product architecture
- [x] Lock security-by-design contract
- [x] Create module build/security checklist
- [x] Create trust-boundary map
- [ ] Inventory every existing CRM page
- [ ] Inventory every CRM API route
- [ ] Inventory all old admin components/helpers
- [ ] Inventory all legacy role/permission vocabulary
- [ ] Inventory duplicate catalog/category sources
- [ ] Inventory direct Prisma mutations for high-risk domains
- [ ] Mark each legacy file: KEEP / REWRITE / ADAPT TEMPORARILY / DELETE

### 0B. Critical auth/security foundation
- [ ] Fix staff create/reset password hashing to use canonical peppered `hashPassword()`
- [ ] Define canonical permission vocabulary
- [ ] Add per-staff permission overrides
- [ ] Define owner-only/non-delegable permissions
- [ ] Define permission evaluation order
- [ ] Add immediate session impact for deactivation/security-sensitive changes
- [ ] Add tests for explicit ALLOW/DENY overrides
- [ ] Add tests for stale JWT vs live DB permissions
- [ ] Finish Cloudflare Access + MFA
- [ ] Lock direct-origin bypass
- [ ] Disable production automated test SUPER_ADMIN accounts
- [ ] Resolve admin device-recording mismatch
- [ ] Enable owner TOTP after verified first login

### 0C. Legacy exit gate
- [ ] No production-critical route uses `PROVINCE_ADMIN` / `BRANCH_ADMIN` legacy authorization
- [ ] No second admin session/auth system is introduced
- [ ] All new CRM server actions use canonical live-session authorization
- [ ] Legacy helpers have owners and removal phase assigned

### Phase 0 gate
- [ ] TypeScript green
- [ ] auth/RBAC tests green
- [ ] migration validation green
- [ ] no secret exposure
- [ ] no production behavior changed unintentionally

---

## PHASE 1 — CRM V2 design system and shell

### 1A. Design system
- [ ] Define CRM V2 design tokens
- [ ] Typography scale
- [ ] spacing/grid rules
- [ ] dark rail / light canvas shell
- [ ] amber MaintainEX accent
- [ ] status color semantics
- [ ] cards
- [ ] data tables
- [ ] tabs
- [ ] filters
- [ ] search
- [ ] drawers
- [ ] modals
- [ ] confirmation dialogs
- [ ] toasts
- [ ] skeleton/loading states
- [ ] empty/error states
- [ ] permission-denied state
- [ ] destructive/sensitive action treatment
- [ ] responsive behavior

### 1B. Application shell
- [ ] New flat primary navigation
- [ ] Dashboard
- [ ] Jobs
- [ ] Customers
- [ ] Taskers
- [ ] Companies
- [ ] Finance
- [ ] Disputes
- [ ] Trust & Safety
- [ ] Analytics
- [ ] App & Web
- [ ] Staff
- [ ] Settings
- [ ] Global search shell
- [ ] market selector
- [ ] notification center
- [ ] operator profile/session state

### 1C. Legacy exit gate
- [ ] Replace current nested accordion sidebar
- [ ] Remove old dark-page/light-page visual mixtures
- [ ] Old shell component no longer imported by migrated routes
- [ ] No duplicate V2 shell exists alongside old shell

### Phase 1 gate
- [ ] shell visual review against approved reference
- [ ] accessibility basics
- [ ] responsive checks
- [ ] session/permission navigation tests
- [ ] production build green

---

## PHASE 2 — Dashboard, Jobs and Job 360

### 2A. Dashboard
- [ ] Canonical read model
- [ ] Active Jobs
- [ ] Escrow Held
- [ ] Revenue
- [ ] Disputes
- [ ] Jobs & Revenue trend
- [ ] Job Status
- [ ] Recent Jobs
- [ ] Alerts / Pending Actions
- [ ] Live Activity
- [ ] System Health
- [ ] market scope applied
- [ ] no fake metrics

### 2B. Jobs
- [ ] secure list/search/filter/pagination
- [ ] canonical statuses
- [ ] country/market isolation
- [ ] customer/provider/company links
- [ ] lifecycle-aware actions

### 2C. Job 360
- [ ] Overview
- [ ] Lifecycle
- [ ] Quotes
- [ ] Workspace
- [ ] Finance
- [ ] Dispute
- [ ] Audit
- [ ] customer card
- [ ] provider/company/worker card
- [ ] location/map
- [ ] schedule
- [ ] service details
- [ ] lifecycle timeline
- [ ] quick action rail
- [ ] payment/escrow card
- [ ] financial summary
- [ ] risk assessment
- [ ] SLA
- [ ] internal notes

### 2D. Security/business gates
- [ ] IDOR tests
- [ ] cross-country tests
- [ ] invalid lifecycle transition tests
- [ ] direct API bypass tests
- [ ] private contact/location minimization
- [ ] audit all privileged mutations

### 2E. Legacy exit gate
- [ ] Old dashboard implementation removed/replaced
- [ ] Old jobs UI removed/replaced
- [ ] Old Job 360 presentation removed/replaced
- [ ] No old job mutation path bypasses canonical lifecycle service
- [ ] Dead imports/helpers removed

---

## PHASE 3 — Customers, Taskers, Companies

### Customers
- [ ] Customer 360
- [ ] identity/profile
- [ ] bookings/jobs
- [ ] payments/refunds summary
- [ ] disputes/support
- [ ] notes
- [ ] risk/security state
- [ ] account actions
- [ ] PII masking

### Taskers
- [ ] Tasker 360
- [ ] skills/services
- [ ] KYC/credentials
- [ ] availability
- [ ] jobs/quotes
- [ ] wallet/payout summary
- [ ] ratings
- [ ] violations/risk
- [ ] suspension controls

### Companies
- [ ] Company 360
- [ ] company identity/KYC
- [ ] workforce/employees
- [ ] employee assignment
- [ ] service coverage
- [ ] jobs
- [ ] finance/settlement
- [ ] company risk
- [ ] suspend/reactivate

### Legacy exit gate
- [ ] Remove old customer admin components not used by V2
- [ ] Remove old tasker/company CRUD assumptions
- [ ] Remove legacy province/branch access paths from these modules
- [ ] One canonical People data-access layer remains

---

## PHASE 4 — Quotes, messaging, finance and disputes

### Quotes / negotiation
- [ ] quote states
- [ ] provider identity
- [ ] price/change-order integrity
- [ ] acceptance/rejection
- [ ] replay protection
- [ ] negotiation trace

### Messaging
- [ ] conversation permissions
- [ ] customer/tasker/company threads
- [ ] internal staff notes separated from user chat
- [ ] attachments
- [ ] notification linkage
- [ ] abuse/spam controls
- [ ] stored-XSS protection

### Finance
- [ ] payments
- [ ] escrow
- [ ] cash state
- [ ] refunds
- [ ] payouts
- [ ] wallets
- [ ] commission
- [ ] settlements
- [ ] ledger view
- [ ] gateway references
- [ ] reconciliation

### Disputes
- [ ] queue
- [ ] evidence
- [ ] parties
- [ ] lifecycle
- [ ] resolution
- [ ] financial effect
- [ ] appeal/escalation if supported
- [ ] audit

### Legacy exit gate
- [ ] no direct UI-driven financial status mutation
- [ ] legacy finance CRUD paths retired
- [ ] duplicate settlement/commission logic removed
- [ ] replaced message/dispute screens deleted
- [ ] one canonical financial lifecycle remains

---

## PHASE 5 — Trust, KYC, reviews and moderation

- [ ] KYC queue
- [ ] identity docs
- [ ] provider/company credentials
- [ ] risk events
- [ ] fraud/cheating reports
- [ ] reviews/ratings moderation
- [ ] suspension/ban workflows
- [ ] private evidence retrieval
- [ ] access audit for sensitive documents
- [ ] malware/file validation policy

### Legacy exit gate
- [ ] old KYC/moderation screens removed
- [ ] no public file URL for private documents
- [ ] no duplicated risk/cheating workflow

---

## PHASE 6 — Canonical marketplace catalog + App & Web

### 6A. Canonical catalog
- [ ] categories
- [ ] subcategories
- [ ] service templates
- [ ] booking questions/attributes
- [ ] pricing mode
- [ ] price guidance
- [ ] on-site/remote
- [ ] tasker/company eligibility
- [ ] country/market availability
- [ ] ordering/featured state
- [ ] localization
- [ ] images/icons
- [ ] app visibility
- [ ] website visibility

### 6B. Website booking
- [ ] same catalog as mobile
- [ ] same marketplace job engine
- [ ] same quote lifecycle
- [ ] same customer identity rules
- [ ] bot/spam controls
- [ ] payment path where supported

### 6C. App/Web operations
- [ ] customer channel controls
- [ ] tasker channel controls
- [ ] company channel controls
- [ ] promotions/offers
- [ ] notifications/broadcasts
- [ ] market config
- [ ] pricing config
- [ ] operational banners
- [ ] maintenance/readiness
- [ ] version/release controls only where runtime consumes them

### Legacy exit gate
- [ ] old Website Categories removed as independent source of truth
- [ ] static mobile taxonomy no longer authoritative
- [ ] duplicate V2 template/catalog concepts reconciled
- [ ] compatibility fallback explicitly temporary
- [ ] mobile + web proven against canonical catalog

---

## PHASE 7 — Staff and permission control plane

- [ ] staff directory
- [ ] role templates
- [ ] granular permission matrix
- [ ] explicit ALLOW
- [ ] explicit DENY
- [ ] non-delegable owner permissions
- [ ] country/market scope
- [ ] active/disabled state
- [ ] 2FA status
- [ ] session list/revocation
- [ ] password reset workflow
- [ ] permission-change audit
- [ ] staff activity
- [ ] prevent self-escalation
- [ ] prevent unauthorized SUPER_ADMIN creation
- [ ] immediate live-session impact

### Legacy exit gate
- [ ] role-only UI removed
- [ ] legacy permission helper removed
- [ ] all CRM nav/API permission evaluation uses canonical evaluator
- [ ] no duplicate admin role vocabulary

---

## PHASE 8 — Analytics, search, settings, audit and system health

- [ ] global search with strict scope
- [ ] analytics
- [ ] operational reports
- [ ] settings
- [ ] audit log
- [ ] security monitor
- [ ] system health
- [ ] safe exports
- [ ] data retention controls where supported
- [ ] no infrastructure secret exposure

### Legacy exit gate
- [ ] remove replaced analytics/security pages
- [ ] remove old settings controls not wired to runtime
- [ ] remove legacy redirects/routes no longer needed
- [ ] delete unused old admin components/helpers/APIs

---

## PHASE 9 — Final legacy demolition, integration and release

### 9A. Dead-code sweep
- [ ] no imports from retired CRM UI modules
- [ ] no legacy permission vocabulary
- [ ] no duplicate catalog source
- [ ] no duplicate financial mutation path
- [ ] no orphan admin API route
- [ ] no old CRM navigation
- [ ] no deprecated compatibility adapter unless explicitly release-approved
- [ ] tree search proves deleted modules are unreferenced

### 9B. Full validation
- [ ] Prisma schema validate
- [ ] migrations validate
- [ ] Web TypeScript
- [ ] Mobile TypeScript
- [ ] RBAC tests
- [ ] country isolation tests
- [ ] IDOR tests
- [ ] CRM security tests
- [ ] financial lifecycle tests
- [ ] catalog/mobile/web regression
- [ ] production build
- [ ] Docker build
- [ ] container health
- [ ] non-root runtime
- [ ] security exposure audit
- [ ] dependency/security review
- [ ] visual consistency review of every CRM page

### 9C. Release / rollback
- [ ] DB backup
- [ ] migration dry-run
- [ ] deployment rollback image
- [ ] feature/cutover plan
- [ ] post-deploy smoke tests
- [ ] admin owner login
- [ ] staff permission tests
- [ ] Job 360
- [ ] finance
- [ ] dispute/KYC
- [ ] catalog
- [ ] mobile regression
- [ ] website regression
- [ ] audit/security logs
- [ ] health

RELEASE APPROVAL: PASS / FAIL

---

# Legacy-removal rule applied to every module

For each module:

```
1. Inspect old implementation
2. Identify behavior/data/security that must be preserved
3. Build new implementation against canonical contracts
4. Run functional + negative security tests
5. Switch route/imports to new implementation
6. Remove old component/helper/API path
7. Search repository for remaining references
8. Run TypeScript/build/tests
9. Mark legacy module retired
```

A module is NOT complete while both old and new implementations remain reachable.

---

# Engineering Definition of Done

A module is done only when:

- [ ] it works with real canonical data
- [ ] it controls the actual app/web runtime
- [ ] server-side authorization is enforced
- [ ] sensitive data is minimized
- [ ] failure and retry behavior is correct
- [ ] concurrency risks are addressed
- [ ] privileged actions are audited
- [ ] attacker review passed
- [ ] negative tests passed
- [ ] V2 visual system is applied
- [ ] replaced legacy code is removed
- [ ] no new P0/P1 findings
