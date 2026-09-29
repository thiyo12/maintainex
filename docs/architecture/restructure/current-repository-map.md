# Current Repository Map (Section 41C)

Snapshot at baseline: `origin/main` = `dbae2f73`.

## Surface inventory

| Surface | Location | Scale |
|---|---|---|
| **Mobile App** (customer/tasker/company) | `apps/mobile/` | 116 screens in `app/`, 38 lib files, 2 API clients, no `features/` layer |
| **Public Website** | `app/(public)/**` (pages incl. homepage `app/(public)/page.tsx`) + `components/` | 18 pages in the `(public)` group; system pages `app/setup`, `app/maintenance` at root |
| **CRM / Admin (web)** | `app/(admin)/admin/**` pages (+ `app/(admin)/layout.tsx` AdminLayout wrapper) + `app/api/admin` | 50 admin API routes; pages are thin (0 direct prisma imports) |
| **Website admin login** | `app/(auth)/admin/login/**` | standalone auth surface — no group layout above it (nesting: root → login layout) |
| **Shared Backend** | `lib/` (flat) | 173 ts files, no domain structure |
| **API surface** | `app/api/` | **256 route.ts files** — see generations below |
| **Database** | `prisma/schema.prisma` | postgresql; 3 release-gate migrations added at sync; 395 unique/index rules |
| **Tests** | `tests/` + `apps/mobile/**/__tests__` | 158 test files (146 under `tests/`), 25 mostly `phaseN` dirs |
| **Docs** | `docs/` | 228 md (~160 prior audits in `docs/correction/`) |
| **Deployment** | `deploy-rsync.sh`, `.github/workflows/phase0-7-validation.yml` | Docker Swarm on VPS (`maintainex-mx-vcaohy`), image `prod-latest`; CI billing-blocked |

## API route generations (256 total)

| Generation | Count | Path | Auth style |
|---|---|---|---|
| Mobile v2 (current) | 55 | `app/api/mobile/v2/**` | `marketplace-auth` / mobile JWT |
| Mobile legacy (v1) | 73 | `app/api/mobile/**` (non-v2) | `mobile-auth` JWT |
| CRM/Admin | 50 | `app/api/admin/**` | simple-token (37) + `authenticateStaffRequest` (7) + login/2FA (JWT) |
| Website/legacy | ~72 | other `app/api/**` (incl. payments 3, webhooks 1, auth, jobs, chat…) | `auth-utils` session / mixed |
| PayHere | 3 | `app/api/payments/payhere/{[intentId],cancel,return}` | gateway redirect callbacks |

## `lib/` — flat, unstructured (the core problem)

173 files with no domain grouping. Heavy hitters and their importers:

| File(s) | Importers | Note |
|---|---|---|
| `lib/auth/compatibility/mobile-auth.ts` | 89 files | mobile JWT + suspension assert (root shim retired Phase H) |
| `lib/auth/authentication/auth-utils.ts` | 51 files | website session (`getSession`) (root shim retired Phase H) |
| `lib/auth/authentication/admin-auth.ts` | 37 files | HMAC simple-token (37 admin routes) (root shim retired Phase H) |
| `lib/auth/marketplace-auth.ts` | 24 files | v2 marketplace auth |
| `lib/pricing/*` (dir) | 23 files | canonical pricing |
| `lib/notifications/` (dir) | ~26 files | canonical notifications (both root shims retired Phase H) |
| `lib/domain/job-lifecycle.ts` | 17 files | job transitions (escrow re-exports removed Phase H) |
| `lib/finance/ledger/ledger-service.ts` | 13 files | canonical ledger writes (root shim retired Phase H) |
| `lib/auth/staff-sessions.ts` | 7 files | `authenticateStaffRequest` used by 7 admin routes |
| `lib/payment/*` (dir) | 5 files | payment service + PayHere adapter |
| `lib/auth/authentication/admin-jwt.ts` | 5 files | login/refresh/2FA token issuance (root shim retired Phase H) |
| `lib/finance/payouts/payout-engine.ts` | 4 files | payouts (root shim retired Phase H) |

## Mobile

- Two transport clients `apps/mobile/api/{client,v2-client}.ts`; root shims
  `lib/api.ts`/`lib/api-v2.ts` retired Phase H (114 call sites on `@/api/<domain>`).
- Screens up to 1329 lines (`app/(customer)/jobs/v2/create.tsx`); business logic lives in screens.
- Route groups exist: `(auth)`, `(customer)`, `(tasker)`, `(company)` — but no `features/`,
  `api/`, `hooks/`, `state/` layers.
- `apps/mobile/lib/icons.tsx` had JSX in a `.ts` file (renamed at baseline; removed
  Phase H — zero importers).

## Tests

- 146 files under `tests/` in `phaseN` buckets (phase0…phase10-8, release-gate, e2e-fix-batch).
- 2 mobile i18n tests under `apps/mobile/lib/i18n/__tests__/`.
- CI workflow (`.github/workflows/phase0-7-validation.yml`) runs: `npm ci` → `npm ci` mobile →
  `prisma generate` → `prisma validate` → migrate deploy → tsc → selected suites → full
  `vitest run tests` → `npm run build`. Currently never starts (GitHub billing).

## Deployment

- `deploy-rsync.sh` → tarball (`.next` + `prisma` + `public`) → VPS docker cp/commit → service update.
- Local schema provider is postgresql (AGENTS.md deploy steps sed it; verify before tarball).
- Production site: https://maintainex.lk (live system — no destructive ops).
