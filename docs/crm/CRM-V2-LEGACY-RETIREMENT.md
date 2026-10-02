# MaintainEX CRM V2 — Legacy Retirement Matrix

CRM V2 replaces existing admin implementation on the existing route contracts. This file prevents old and new systems from silently surviving together.

## Classification

- KEEP: canonical service/security code that remains valid.
- REWRITE: route/page stays but implementation is replaced.
- TEMP ADAPTER: temporary compatibility only; must have deletion phase.
- DELETE: obsolete after replacement is proven.

## Initial known inventory

| Area | Current artifact | Decision | Removal/replacement phase |
|---|---|---|---|
| CRM shell/navigation | `components/admin/AdminLayout.tsx` | REWRITE | Phase 1 |
| Admin session provider | `components/admin/AdminSessionProvider.tsx` | REWRITE/KEEP CONTRACT | Phase 0-1 |
| Legacy access helper | `lib/crm/access-control.ts` with ADMIN/PROVINCE_ADMIN/BRANCH_ADMIN | DELETE after consumers removed | Phase 0-7 |
| Canonical RBAC templates | `lib/auth/rbac/permissions.ts` | KEEP + EXPAND | Phase 0 |
| Canonical CRM guard | `lib/crm/security.ts` | KEEP + EXPAND | Phase 0 |
| Dashboard | `app/(admin)/admin/dashboard/page.tsx` | REWRITE | Phase 2 |
| Jobs | `app/(admin)/admin/jobs/page.tsx` | REWRITE | Phase 2 |
| Job 360 | `app/(admin)/admin/jobs/[id]/page.tsx` | REWRITE | Phase 2 |
| Customer admin components | `components/admin/Customer*.tsx` | REVIEW then DELETE/REWRITE | Phase 3 |
| Customers | `app/(admin)/admin/users/customers` | REWRITE | Phase 3 |
| Taskers | `app/(admin)/admin/users/taskers` | REWRITE | Phase 3 |
| Companies | `app/(admin)/admin/users/companies`, `/admin/companies/[id]` | REWRITE | Phase 3 |
| Financial pages | `app/(admin)/admin/financial/**` | REWRITE | Phase 4 |
| Disputes | `app/(admin)/admin/jobs/disputes` | REWRITE | Phase 4 |
| KYC | `app/(admin)/admin/kyc` | REWRITE | Phase 5 |
| Trust & Safety | `app/(admin)/admin/trust-safety/**` | REWRITE | Phase 5 |
| Website management | `app/(admin)/admin/platform/website` | REWRITE around canonical channels | Phase 6 |
| Mobile management | `app/(admin)/admin/platform/mobile` | REWRITE around real runtime controls | Phase 6 |
| Catalog management | `app/(admin)/admin/platform/catalog` | REWRITE; remove website/V2 split | Phase 6 |
| Static mobile categories | `apps/mobile/lib/categories.ts`, `categoryData.ts` | TEMP ADAPTER/OFFLINE FALLBACK | Phase 6 then remove authority |
| Staff management | `app/(admin)/admin/admins/**` | REWRITE | Phase 7 |
| Settings | `app/(admin)/admin/settings` | REWRITE with runtime proof | Phase 8 |
| Analytics/security | `app/(admin)/admin/analytics/**` | REWRITE | Phase 8 |
| Old marketplace redirects | middleware `/admin/marketplace` compatibility routes | TEMP ADAPTER | Phase 8-9 |
| Old admin utility components | remaining `components/admin/**` | REVIEW/DELETE | Per owning phase |

## Rule

No file is deleted simply because it looks old.

Before deletion:
1. find all imports/callers
2. identify behavior/security/data contract
3. move necessary behavior to canonical replacement
4. add tests
5. remove callers
6. delete
7. repository-wide search proves no references
8. build/tests stay green
