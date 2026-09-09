# MaintainEX Risk Summary

## Risk Matrix

| # | Risk | Severity | Impact | Effort | Domain |
|---|---|---|---|---|---|
| 1 | Path traversal in file serving | P0 | .env exfiltration | 15 min | Security |
| 2 | Escrow-release no transaction | P0 | Money inconsistency | 1 hr | Financial |
| 3 | Escrow-release double credit | P0 | Double payout | 1 hr | Financial |
| 4 | Cash-payment commission bug | P0 | Nonsensical commission | 30 min | Financial |
| 5 | Float money in wallets | P0 | Precision loss | 4 hrs | Financial |
| 6 | SQLite/PostgreSQL split | P0 | Production failures | 4 hrs | Database |
| 7 | ProviderWallet double credit | P0 | Double payout | 2 hrs | Financial |
| 8 | Unauthenticated CV upload | P0 | Disk filling | 30 min | Security |
| 9 | Conversation messages IDOR | P1 | Private message leak | 30 min | Security |
| 10 | Invoice cross-branch tampering | P1 | Data breach | 30 min | Security |
| 11 | CORS wildcard bug | P1 | Auth bypass | 15 min | Security |
| 12 | Admin CORS no origin validation | P1 | CSRF | 30 min | Security |
| 13 | In-memory rate limiting | P1 | Bypassed in prod | 2 hrs | Security |
| 14 | Individual providers 0% commission | P1 | Revenue loss | 30 min | Financial |
| 15 | Provider withdrawal no balance check | P1 | Negative balance | 1 hr | Financial |
| 16 | Read-before-write audit trail | P1 | Inaccurate audit | 2 hrs | Financial |
| 17 | Pricing train SQLite in PostgreSQL | P1 | Silent failure | 30 min | Database |
| 18 | No migration history | P1 | Schema drift | 2 hrs | Database |
| 19 | Middleware dual auth system | P2 | Auth inconsistency | 2 hrs | Security |
| 20 | Inconsistent commission formulas | P2 | Revenue variance | 2 hrs | Financial |

## Top 20 Risks by Priority

1. **Path traversal** — Full server compromise possible right now
2. **Escrow transaction** — Money can be in inconsistent state
3. **Double credit** — Provider can receive payment twice
4. **Commission bug** — Cash jobs calculate wrong commission
5. **Float money** — Precision loss in financial calculations
6. **SQLite/PostgreSQL** — Production can silently break
7. **Unauthenticated uploads** — Anyone can fill disk
8. **Message IDOR** — Private conversations readable
9. **Invoice tampering** — Staff can edit other branches
10. **CORS bug** — Mobile API fully public
11. **Admin CORS** — Any origin gets admin credentials
12. **Rate limiting** — Bypassed in distributed deployment
13. **Zero commission** — Individual providers pay nothing
14. **Withdrawal** — No balance validation
15. **Audit trail** — Incorrect balance history
16. **Pricing train** — Silently broken in production
17. **No migrations** — Schema drift risk
18. **Dual auth** — Middleware disagrees with routes
19. **Commission variance** — Same job, different amounts
20. **Dead code** — Schema fields never used

## Risk by Domain

| Domain | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|
| Security | 3 | 5 | 4 | 0 | 12 |
| Financial | 5 | 4 | 2 | 2 | 13 |
| Database | 1 | 2 | 0 | 0 | 3 |
| Architecture | 0 | 0 | 2 | 2 | 4 |
| Code Quality | 0 | 0 | 2 | 3 | 5 |
| **Total** | **9** | **11** | **10** | **7** | **37** |

## Estimated Fix Effort

| Priority | Items | Total Effort |
|---|---|---|
| P0 (must fix) | 8 | ~13 hours |
| P1 (should fix) | 11 | ~13 hours |
| P2 (nice to have) | 10 | ~12 hours |
| P3 (cleanup) | 7 | ~4 hours |
| **Total** | **36** | **~42 hours** |

## Recommended Phase 1 Scope (15 hours)

Security (4 hrs):
- Fix path traversal in `/api/files/[...path]`
- Fix CORS wildcard bug
- Fix admin CORS origin validation
- Add auth to CV upload

Financial (6 hrs):
- Wrap escrow-release in transaction with idempotency
- Fix cash-payment commission formula
- Add provider withdrawal balance check
- Fix individual provider commission rate
- Add unique constraint on JobEscrow.jobId

Database (3 hrs):
- Fix pricing-train SQLite raw query
- Create proper migration history
- Standardize on PostgreSQL for dev

Auth (2 hrs):
- Fix middleware dual auth system
- Unify admin JWT verification
