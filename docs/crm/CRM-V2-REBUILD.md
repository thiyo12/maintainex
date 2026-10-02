# MaintainEX CRM V2 Rebuild

## Non-negotiable product direction

CRM V2 is a new operations product for the current MaintainEX marketplace. It must not inherit old admin information architecture, old website service taxonomy, or legacy permission assumptions.

Reference visual direction:
- dark compact left rail
- white/light operational canvas
- amber/yellow MaintainEX accent
- global search + market selector + notifications + operator identity
- dense but readable operational cards/tables
- consistent page headers, tabs, status chips, action rails and audit surfaces
- Job 360 uses an operational workspace layout, not a generic CRUD detail page

## Architecture rules

1. Preserve verified backend/security/financial logic unless a change is required for CRM V2.
2. Replace the admin presentation layer with a new CRM V2 shell and primitives.
3. Every CRM page must use the same CRM V2 design system.
4. Remove user-visible dependence on old admin concepts and old website category structures.
5. Mobile app and website booking must consume one canonical marketplace catalog.
6. Website booking is a channel of the marketplace, not a separate service catalog.
7. Staff roles are templates. The owner can grant or deny specific permissions per staff member.
8. Sensitive actions remain server-authorized, rate-limited and audited.
9. No page may claim to manage a runtime capability unless the app/web runtime actually consumes it.
10. Production main remains stable while CRM V2 is built and validated on this branch.

## Canonical CRM navigation

Flat primary navigation:
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
- Staff
- Settings

Secondary navigation belongs inside the relevant workspace, not as deep nested accordion navigation in the main rail.

## Dashboard

Must match the approved reference structure:
- Active Jobs
- Escrow Held
- Revenue
- Disputes
- Jobs & Revenue trend
- Job Status distribution
- Recent Jobs
- Alerts / Pending Actions
- Live Activity
- System Health

All values must come from canonical live APIs. No placeholder KPIs.

## Job 360

Top identity strip:
- job ID/title/status
- customer
- provider/company/worker
- location
- amount
- previous/next navigation

Tabs:
- Overview
- Lifecycle
- Quotes
- Workspace
- Finance
- Dispute
- Audit

Overview composition:
- Customer
- Provider / Company / Worker
- Location + map
- Schedule
- Service details
- Job lifecycle
- right action rail

Right action rail:
- Quick Actions
- Payment / Escrow
- Financials
- Risk Assessment
- SLA
- Internal Notes

Actions must be lifecycle-aware and server-authorized.

## Canonical marketplace catalog

Current problem:
- mobile has static category definitions
- CRM currently exposes Website categories/services separately from V2 templates
- this creates old/new taxonomy drift

Target:
- one server-backed marketplace taxonomy
- categories
- subcategories
- service templates
- attributes/questions
- pricing mode
- price guidance/ranges
- remote/on-site mode
- country/market availability
- customer visibility
- tasker/company eligibility
- mobile visibility
- website-booking visibility
- ordering/featured state
- localization keys
- images/icons

Mobile and web booking consume the same canonical catalog API.
Static mobile data may remain only as an offline fallback during migration.

## App & Web operations

CRM must manage:
- canonical catalog
- website booking channel
- mobile booking channel
- customer experience content
- tasker experience content
- company experience content
- offers/promotions
- notifications/broadcasts
- market configuration
- pricing configuration
- feature/channel availability
- operational banners
- maintenance/readiness state
- supported countries/areas
- version/release controls only where runtime wiring exists

## A-to-Z marketplace operations

CRM coverage:
- customers
- taskers
- companies and employees
- jobs/bookings
- quote lifecycle and negotiation
- chat/message trace
- notifications
- arrival/work/completion verification
- payments
- escrow
- cash state
- refunds
- payouts
- wallets
- commission
- settlements
- disputes
- KYC/credentials
- fraud/risk/cheating
- reviews/ratings moderation
- categories/services/templates
- areas/markets/currencies
- offers/promotions
- app/web channel configuration
- staff and permissions
- audit logs
- security events
- system health

## Staff permission model

Existing fixed roles remain as templates:
- SUPER_ADMIN
- MANAGER
- FINANCE
- USER_MANAGEMENT
- SUPPORT
- TECHNICAL

Add owner-controlled per-staff overrides.

Effective permission:
1. Start with role-template permissions.
2. Apply explicit DENY overrides.
3. Apply explicit ALLOW overrides only where owner policy permits.
4. Country/market scope remains independent and fail-closed.
5. SUPER_ADMIN-sensitive capabilities cannot be delegated accidentally.
6. Every permission change is audited.

Target permission groups:
- dashboard
- jobs
- customers
- taskers
- companies
- quotes
- messages
- finance
- payments
- escrow
- refunds
- payouts
- commission
- settlements
- disputes
- kyc
- trust_safety
- reviews
- catalog
- website
- mobile
- promotions
- notifications
- analytics
- audit
- security
- staff
- settings

Each group supports granular view/create/edit/approve/resolve/manage actions where applicable.

Staff UI must support:
- role template
- per-permission toggles
- market/country scope
- read-only vs mutation capabilities
- sensitive-action warnings
- active/disabled state
- session revocation
- 2FA status
- audit history

## Legacy removal rules

Do not use legacy UI/IA as the design source.
Specifically retire user-visible dependence on:
- generic old admin dashboards
- PROVINCE_ADMIN / BRANCH_ADMIN permission vocabulary
- separate old website category management
- inconsistent dark-page/white-page mixtures
- nested legacy admin navigation

Compatibility adapters may exist internally during migration but must not define CRM V2 behavior.

## Delivery gates

Each converted page must pass:
- visual consistency review against the approved CRM reference
- TypeScript
- production build
- RBAC positive + negative tests
- country-scope tests
- API mutation audit test
- no placeholder/fake metrics
- mobile/web regression where shared catalog/config changed

Final release requires:
- every CRM page converted
- canonical catalog migration complete
- staff custom permissions complete
- full Phase 0-9 validation green
- production Docker health green
- live admin smoke test green
