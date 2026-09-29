# Module Boundaries, Layers, and Import Rules

## Module shape

Each module under `lib/modules/<name>/` may use four layers (Section 12). Use layers where
they are useful — do not create ceremony around a 20-line helper.

```
domain/            pure business rules, no Prisma, no HTTP, no I/O
application/       use cases orchestrating domain + infrastructure
infrastructure/    Prisma, PayHere, Expo Push, SMS, storage, Redis
contracts/         Zod schemas, DTOs, commands, queries, API shapes
```

### Examples

- **domain**: job transition rules, escrow state machine, payout states, commission math,
  provider/company authorization rules.
- **application**: `acceptQuote()`, `cancelJob()`, `fundEscrow()`, `raiseDispute()`,
  `resolveDispute()`, `completeJob()`, `requestPayout()`.
- **infrastructure**: Prisma repositories, PayHere gateway, Expo push, SMS provider.
- **contracts**: request/response Zod schemas shared by route + tests.

## Thin route rule (Section 13)

```
route.ts → authenticate → validate → authorize → call application service → return response
```

Forbidden inside a route: multi-table money mutation, escrow/ledger rules, job-state
determination, notification side-effect chains. Those live in application services.
(Fat legacy routes are migrated opportunistically — see migration-map Phase G.)

## Permission model (Section 17)

One permission source, backend-first:

- Backend: `requirePermission("users:view")` etc.
- Frontend: `can("users:view")` generated from the same source.
- Country/market isolation is always enforced server-side.
- Canonical permission vocabulary lives in `lib/modules/admin/rbac/` (single file, no
  per-page role arrays).

## Import rules (Section 26)

- Prefer aliases: `@/lib/modules/finance`, `@/lib/modules/marketplace`, `@/components/admin`
  (tsconfig already maps `@/*` → `./*`).
- No deep relative climbs (`../../../../lib/...`).
- No circular dependencies: `modules/*` may import `lib/shared/*` and, sparingly, other
  modules' `contracts/` — never another module's `infrastructure/`.
- Domain layer imports nothing outward (no Prisma, no Next, no React).

## What belongs where

| Code | Home |
|---|---|
| Business rule used by ≥2 surfaces | `lib/modules/<domain>` |
| Pure utility (money math, time, errors) | `lib/shared/*` |
| Web-only presentation | `components/public` / `components/admin` |
| Mobile-only presentation | `apps/mobile/features/*` |
| Route glue | `app/api/**` (thin) |
| Prisma writes for important mutations | module application services (Section 27) |

## Anti-duplication rule (Section 28)

Before creating any new service/route/model/helper/component/API client, search for an
existing implementation. Reuse or migrate. New files use explicit professional names
(`accept-quote.ts`, `fund-escrow.ts`) — never `new.ts`, `fix2.ts`, `misc.ts`, `temp.ts`.

## Database rule (Section 27)

- Prisma is infrastructure; no random direct writes from UI/API files for important
  mutations.
- Never destructive production commands; never production data in tests.
- Schema change requires: reason → migration → test → compatibility → rollback note.
