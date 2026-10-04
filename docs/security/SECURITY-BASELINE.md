# MaintainEX Security Baseline

Status: CONDITIONAL (Phase 0)

## Source baseline

- Repository: `thiyo12/maintainex`
- Repository visibility: public
- Default branch: `main`
- Audited source SHA: `e280515e44d9ee15c35a3b35aa334d212f2a643d`
- Security branch: `security/production-hardening`
- Branch base: exact audited `main` SHA above
- Previous smoke PR: #48, merged before this branch was created
- Source working rule: security changes only; no unrelated product/UI changes

## Toolchain

- Docker runtime base: Node 20 (`node:20-slim`)
- Next.js: 15.5.24
- Prisma / @prisma/client: ^5.14.0
- PostgreSQL datasource via `DATABASE_URL`
- Web TypeScript: ^5.4.5
- Mobile Expo: ^56.0.12
- React Native: 0.85.3
- Mobile TypeScript: ~6.0.3

## CI baseline

Repository workflow files:

1. `.github/workflows/phase0-7-validation.yml` — CRM V2 Release Validation
2. `.github/workflows/security-exposure-audit.yml` — Security Exposure Audit

The pre-security merged smoke head passed both workflows, including TypeScript, mobile TypeScript, Prisma/schema and migration preservation, security suites, current finance lifecycle, full regression, production build, Docker build/start/health, and non-root runtime.

## Current architecture baseline

### Application authentication

- Customer/tasker/company mobile APIs use server-issued authentication and server-side resource authorization.
- Production test OTP is intended to fail closed through environment validation and route-level production checks.
- Server/database state is authoritative; client-provided identity, role, payment state and amounts are not trusted.

### CRM authentication / authorization

Current CRM security architecture includes:

- access JWT
- live `AdminSession`
- live admin-user state
- `guardCrmRequest`
- `guardCrmAction`
- RBAC / permission overrides
- market/country scope
- governed high-risk actions

This architecture is preserved unless a concrete security defect is demonstrated.

### Payments

Current intended payment architecture:

- Sri Lanka: cash supported where policy allows
- Canada: PayPal online checkout where market/provider configuration is verified
- PayHere: legacy/historical refund/reconciliation compatibility only; not a new online checkout path
- canonical PaymentIntent / escrow / financial ledger / commission / payout state
- provider financial standing and restrictions enforced server-side

## Public production evidence

- Public web host observed: `https://maintainex.lk`
- Public homepage is reachable.
- Public browser access to `/api/health` does not expose a release SHA through the available external browser path.

## Production state not yet proven

The following evidence is required before Phase 0 can become PASS:

- exact production deployed SHA
- proof that deployed SHA is the expected release
- exact CRM/admin production hostname
- API hostname if separate
- actual production `NODE_ENV`
- actual payment environments
- actual production database environment
- actual Cloudflare/reverse-proxy topology
- complete externally reachable service/port inventory
- production migration state from the real production database

GitHub source state MUST NOT be treated as proof of production state.

## Phase 0 test/build baseline

Latest pre-security release candidate evidence:

- Security Exposure Audit: PASS
- CRM V2 Release Validation: PASS
- full regression: 262 files passed / 5 skipped / 0 failed
- production build: PASS
- Docker build/start: PASS
- Docker health check: PASS
- non-root container verification: PASS

## Phase 0 exit criteria

- [x] exact GitHub source SHA known
- [x] security branch created from exact main
- [x] source toolchain recorded
- [x] CI workflow baseline recorded
- [x] current auth/payment architecture recorded
- [x] public primary production host recorded
- [ ] exact production deployed SHA proven
- [ ] complete production host topology proven
- [ ] actual production environment/payment mode proven
- [ ] actual production migration state proven
- [ ] externally reachable service inventory proven

Phase 0 cannot be marked PASS until the unchecked production-runtime evidence is collected from the actual deployment environment.
