# MaintainEX Debt Map

## Testing Debt

| Category | Current | Target | Priority |
|---|---|---|---|
| Server-side tests | 0 | 40+ | P0 |
| API route tests | 0 | 30+ | P0 |
| Auth tests | 0 | 10+ | P0 |
| Payment tests | 0 | 20+ | P0 |
| Integration tests | 0 | 15+ | P1 |
| E2E tests | 0 | 10+ | P2 |
| Coverage threshold | 0% | 60% | P1 |
| npm test script | Missing | Defined | P1 |
| CI/CD | None | GitHub Actions | P2 |

## Security Debt

| Issue | Severity | Fix Effort |
|---|---|---|
| Path traversal in `/api/files/[...path]` | P0 | 15 min |
| Unauthenticated CV upload | P0 | 30 min |
| Conversation messages IDOR | P1 | 30 min |
| Invoice cross-branch edit/delete | P1 | 30 min |
| Bookings GET no ownership | P2 | 15 min |
| CORS wildcard bug | P1 | 15 min |
| Admin CORS no origin validation | P1 | 30 min |
| In-memory rate limiting | P1 | 2 hrs |
| Middleware dual auth system | P2 | 2 hrs |
| CSP unsafe-inline/eval | P2 | 1 hr |

## Financial Debt

| Issue | Severity | Fix Effort |
|---|---|---|
| Escrow-release no transaction | P0 | 1 hr |
| Escrow-release no idempotency | P0 | 1 hr |
| Cash-payment commission bug | P0 | 30 min |
| Float money in wallets | P0 | 4 hrs |
| Individual providers 0% commission | P1 | 30 min |
| Provider withdrawal no balance check | P1 | 1 hr |
| Read-before-write audit trail | P1 | 2 hrs |
| Inconsistent commission formulas | P2 | 2 hrs |
| Customer withdrawal bookkeeping-only | P2 | 1 hr |
| isFrozen never checked | P3 | 30 min |

## Architecture Debt

| Issue | Severity | Fix Effort |
|---|---|---|
| SQLite/PostgreSQL split | P0 | 4 hrs |
| 5 parallel job systems | P1 | 8 hrs (deprecation) |
| 3 admin auth mechanisms | P2 | 4 hrs |
| 4 inconsistent commission formulas | P2 | 2 hrs |
| No migration history | P1 | 2 hrs |
| Dead schema fields (8+) | P2 | 1 hr |
| DemandForecast never consumed | P3 | 30 min |
| QualityMetric never consumed | P3 | 30 min |
| Frozen wallet check never enforced | P3 | 30 min |
| pendingBalance never used | P3 | 30 min |
| Category overlaps JobCategory | P3 | 1 hr |
| Settings overlaps AppSetting | P3 | 1 hr |
| PayoutRequest overlaps Payout | P2 | 1 hr |

## Code Quality Debt

| Issue | Severity | Fix Effort |
|---|---|---|
| Zero comments in codebase | P3 | Ongoing |
| `eslint-disable` on many hooks | P3 | 1 hr |
| `dangerouslySetInnerHTML` in 10 components | P2 | 2 hrs |
| 14 empty catch blocks | P2 | 1 hr |
| 5 TODO comments with no issue tracker | P3 | 30 min |
