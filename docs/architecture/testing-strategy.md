# Testing Strategy

MaintainEX testing approach: test pyramid, phase-based testing, staging environment, and CI/CD integration.

---

## Test Pyramid

```
         /  E2E  \          <- 5% (critical paths only)
        /----------\
       / Integration \       <- 15% (API routes, DB queries)
      /----------------\
     /    Unit Tests     \    <- 80% (business logic, utilities)
    /----------------------\
```

### Unit Tests

**Coverage target**: 80% of business logic functions.

Focus areas:
- `lib/domain/job-lifecycle.ts` — State machine transitions, actor resolution
- `lib/domain/company-job-assignment.ts` — Assignment creation, revocation, uniqueness
- `lib/domain/commercial-immutability.ts` — Mutability assertion logic
- `lib/matching/eligibility.ts` — Gate evaluation, exclusion reasons
- `lib/matching/scoring.ts` — Score component calculation
- `lib/matching/waves.ts` — Wave progression, idempotency
- `lib/pricing/engine.ts` — Price calculation, bounds checking
- `lib/pricing/fees.ts` — Urgency modifiers, commission computation
- `lib/ledger.ts` — Transaction balancing, idempotency, fingerprinting
- `lib/profession/index.ts` — CRUD operations, validation

Unit tests use in-memory mocks for PrismaClient. No database required.

### Integration Tests

**Coverage target**: 15% of routes, focused on write operations.

Focus areas:
- API route handlers: request parsing, auth checks, response formatting
- Database queries: correct joins, filtering, pagination
- Middleware chains: auth -> RBAC -> business logic -> response
- Ledger posting: end-to-end transaction flow with real schema

Integration tests use SQLite in-memory database with Prisma.

### End-to-End Tests

**Coverage target**: Critical user journeys only.

Critical paths:
1. Customer posts job -> matching triggers -> provider accepts -> work starts -> job completes -> payment released
2. Provider submits quote -> customer accepts -> escrow deposited -> work begins -> PIN verified
3. Admin suspends user -> user blocked from write operations -> audit logged
4. Company assigns worker -> worker accepts -> job progresses -> assignment completes

E2E tests use Playwright for web and Detox for mobile.

---

## Phase-Based Testing

The project follows a phased development model. Each phase has explicit test gates.

### Phase Gate Criteria

| Phase | Test Requirement | Gate |
|-------|-----------------|------|
| Security hardening | 11 security fixes verified | All 11 PASS |
| Admin panel | RBAC enforcement on all routes | Role matrix PASS |
| Mobile auth | OTP flow, JWT lifecycle, rate limits | Flow PASS |
| Matching engine | Wave progression, eligibility gates | Scenario matrix PASS |
| Financial ledger | Transaction balancing, idempotency | Accounting verification PASS |
| Deploy verification | 22-point checklist | All 22 PASS |

### Verification Checklists

Deployment verification uses a structured checklist (see Phase 6 in `AGENTS.md`):
- SUPER_ADMIN login
- RBAC role enforcement (all 6 roles)
- Work queue auto-assignment
- Job cancel/flag/refund
- Commission calculation
- Mobile flows (login, post job, accept quote, start work)
- Push notification delivery
- Site infrastructure (SSL, CDN, DNS)

---

## Staging Environment

### Setup

Staging mirrors production architecture:

| Component | Production | Staging |
|-----------|-----------|---------|
| Database | PostgreSQL on Docker | PostgreSQL on Docker (separate container) |
| App | Next.js on Docker Swarm | Next.js on same VPS, different port |
| Mobile | App Store build | Expo development build |
| CDN | Cloudflare | Cloudflare (staging subdomain) |

### Data

Staging uses a sanitized copy of production data:
- User emails hashed or replaced with `test+N@example.com`
- Phone numbers masked
- Financial amounts preserved for testing
- Secrets rotated to staging-specific values

### Deployment

Staging deploys on every merge to `main`:
1. Build `.next` output
2. Swap SQLite provider to PostgreSQL
3. Run `prisma migrate deploy`
4. Docker build and push
5. Smoke test: health check + critical path verification

---

## CI/CD Pipeline

### Pipeline Stages

```
Lint -> Type Check -> Unit Tests -> Integration Tests -> Build -> Deploy
```

### Commands

| Stage | Command | Fail Action |
|-------|---------|-------------|
| Lint | `npm run lint` | Block merge |
| Type check | `npm run typecheck` | Block merge |
| Unit tests | `npm run test:unit` | Block merge |
| Integration tests | `npm run test:integration` | Block merge |
| Build | `npm run build` | Block deploy |
| Deploy staging | Docker build + push | Alert on failure |
| Deploy production | Manual gate | Requires approval |

### Code Quality Gates

- No TypeScript `any` types in new code
- All API routes require input validation (Zod schemas)
- All write routes require `assertNotSuspended()` check
- All financial routes require idempotency key
- Lint rules enforced: no `console.log` in production code, no unused imports

---

## Coverage Reporting

Coverage reports generated per test run:
- Unit: Istanbul/nyc, minimum 80% line coverage
- Integration: minimum 70% route coverage for write operations
- E2E: no coverage threshold; manual scenario validation

Coverage drops below threshold block CI pipeline. Reports uploaded as artifacts for review.
