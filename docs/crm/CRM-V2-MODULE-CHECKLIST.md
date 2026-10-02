# MaintainEX CRM V2 — Module Build & Security Checklist

This checklist is mandatory for every CRM V2 module. A module is not implementation-ready until the PRE-BUILD gate passes, and it is not release-ready until the RELEASE gate passes.

## A. Universal module gate

### 1. Product / source of truth
- [ ] Business requirement written in one paragraph.
- [ ] Canonical database model(s) identified.
- [ ] Canonical domain/service layer identified.
- [ ] Mobile consumer identified.
- [ ] Website consumer identified.
- [ ] CRM consumer identified.
- [ ] Legacy duplicate data/model identified.
- [ ] Legacy migration/removal plan defined.
- [ ] No fake control is planned for a runtime that does not consume it.

### 2. Trust / privacy
- [ ] Untrusted inputs listed.
- [ ] Public fields listed.
- [ ] Authenticated-user fields listed.
- [ ] Staff-only fields listed.
- [ ] Secret fields listed.
- [ ] Output DTO/select defined.
- [ ] Raw Prisma records are not returned by default.
- [ ] Logs/audits redact sensitive data.
- [ ] Cache policy defined; sensitive responses use no-store.

### 3. Identity / authorization
- [ ] Authentication requirement defined.
- [ ] Required permission(s) defined.
- [ ] Role-template behavior defined.
- [ ] Per-staff ALLOW/DENY override behavior defined.
- [ ] Owner-only/non-delegable actions identified.
- [ ] Country/market scope defined.
- [ ] Object-level authorization defined.
- [ ] Disabled/revoked staff behavior defined.
- [ ] UI visibility is not relied on as security.

### 4. Request boundary
- [ ] Input schema is allowlisted.
- [ ] String/number/array/file size limits defined.
- [ ] Search/filter/pagination limits defined.
- [ ] Same-origin/CSRF behavior defined for cookie mutations.
- [ ] Rate-limit tier selected: read / mutation / sensitive.
- [ ] Sensitive failure mode is fail-closed where required.
- [ ] URLs/redirects/remote fetch targets are allowlisted where applicable.

### 5. Business invariants
- [ ] Valid states documented.
- [ ] Valid transitions documented.
- [ ] Invalid transitions rejected server-side.
- [ ] Server-calculated fields identified.
- [ ] Client-controlled IDs/amounts/roles/statuses are independently verified.
- [ ] Retry behavior defined.
- [ ] Partial-failure behavior defined.
- [ ] Rollback/recovery path defined.

### 6. Concurrency / replay
- [ ] Can the action run twice safely?
- [ ] Idempotency key required?
- [ ] DB transaction required?
- [ ] Unique constraint/version check required?
- [ ] Concurrent mutation test defined.
- [ ] Webhook replay strategy defined where applicable.

### 7. Audit / observability
- [ ] Privileged mutations emit audit records.
- [ ] Actor ID/email/role recorded.
- [ ] Target entity recorded.
- [ ] Safe before/after state recorded.
- [ ] IP/user-agent/request ID recorded where appropriate.
- [ ] Security events emitted for denied/abusive actions.
- [ ] No secret values enter logs or audit rows.

### 8. Attacker review
- [ ] Unauthenticated access.
- [ ] Wrong-role access.
- [ ] Explicit permission DENY.
- [ ] Cross-country/market access.
- [ ] IDOR/object-ID swapping.
- [ ] Direct API call bypassing UI.
- [ ] Mass assignment.
- [ ] Injection.
- [ ] XSS/content injection.
- [ ] CSRF.
- [ ] Brute force/enumeration.
- [ ] Oversized payload.
- [ ] Replay.
- [ ] Race condition.
- [ ] Stale/revoked session.
- [ ] Sensitive-data leakage.
- [ ] Log leakage.
- [ ] File/SSRF/path-traversal risks where applicable.

### 9. Verification
- [ ] Positive happy path.
- [ ] Negative authorization tests.
- [ ] Country-scope tests.
- [ ] Invalid payload tests.
- [ ] Invalid lifecycle tests.
- [ ] Duplicate/concurrency tests where applicable.
- [ ] Audit test.
- [ ] Sensitive-field redaction test.
- [ ] TypeScript green.
- [ ] Production build green.
- [ ] Mobile/web regression tests if shared runtime changed.
- [ ] Visual review against CRM V2 design system.

## B. Module-specific checklist

| Module | Risk | Canonical focus | Mandatory security focus | Ready to build |
|---|---|---|---|---|
| Dashboard | Medium | aggregated operational APIs | market scope, expensive queries, no internal secret leakage, no fake metrics | [ ] |
| Jobs list | High | canonical job lifecycle | IDOR, market scope, search enumeration, status integrity | [ ] |
| Job 360 | Critical | job + quote + payment + dispute + audit graph | object auth, lifecycle bypass, private location/contact data, sensitive actions | [ ] |
| Customers | High | canonical user/customer records | PII minimization, IDOR, enumeration, account actions, exports | [ ] |
| Taskers | High | provider/tasker profile + eligibility | KYC leakage, credential access, eligibility/availability tampering, payout ownership | [ ] |
| Companies | High | company + workforce + assignments | cross-company access, employee-role escalation, payout destination changes | [ ] |
| Quotes / negotiation | High | quote lifecycle | quote ownership, price tampering, replay/duplicate acceptance, message linkage | [ ] |
| Messaging | High | conversation/message records | cross-chat IDOR, stored XSS, spam, attachment control, notification privacy | [ ] |
| Finance overview | Critical | canonical financial ledger/state | field minimization, market/currency isolation, no client-calculated money | [ ] |
| Payments | Critical | payment intents + gateway state | server-calculated amount/currency, signed webhook, replay, idempotency | [ ] |
| Escrow | Critical | escrow state machine | unauthorized release/refund, lifecycle checks, concurrency, audit | [ ] |
| Refunds | Critical | refund state machine | refund ceiling, duplicate refund, gateway verification, step-up auth | [ ] |
| Payouts | Critical | payout ledger/destination | destination ownership, duplicate payout, staff permissions, audit | [ ] |
| Commission | Critical | commission/settlement ledger | server-calculated fees, currency isolation, immutable history | [ ] |
| Settlements | Critical | company/tasker settlement cycle | double settlement, wrong recipient, week/currency scope, audit | [ ] |
| Disputes | Critical | dispute + evidence + financial resolution | evidence privacy, double resolution, refund/release replay, internal-note leakage | [ ] |
| KYC | Critical | identity/credential records | private files, approval integrity, file validation, retention/access audit | [ ] |
| Trust & Safety | Critical | risk/security events | restricted reasons, action escalation, false-positive handling, audit immutability | [ ] |
| Reviews / ratings | High | canonical reviews | manipulation, self-review, moderation abuse, hidden/internal review state | [ ] |
| Catalog | High | canonical marketplace taxonomy | unauthorized publish, taxonomy drift, malicious text/URL, market exposure | [ ] |
| Website booking | Critical | same marketplace job/quote engine | public abuse, bot spam, pricing/job integrity, account/guest ownership | [ ] |
| Mobile marketplace control | High | canonical runtime config consumed by app | fake switches, unsafe feature flags, stale client compatibility | [ ] |
| Offers / promotions | High | offer rules + visibility | unauthorized publication, price manipulation, date/market validation | [ ] |
| Notifications | High | canonical notification engine | mass-send abuse, wrong audience, PII in push, idempotent broadcast | [ ] |
| Markets / areas | High | country/currency/location config | cross-market contamination, unsupported currency/location state | [ ] |
| Analytics | High | scoped aggregates | data exfiltration, expensive queries, privacy-preserving aggregation | [ ] |
| Global search | Critical | multi-entity search | cross-scope leakage, result caps, enumeration, secret/index exclusion | [ ] |
| Staff management | Critical | AdminUser + AdminSession + permission overrides | privilege escalation, self-grant, hidden admins, session revocation, 2FA | [ ] |
| Settings | Critical | canonical runtime-consumed settings | security disablement, unsafe toggles, typed schemas, owner-only settings | [ ] |
| Audit | Critical | append-only audit/security history | tamper resistance, redaction, access restriction, retention | [ ] |
| Security monitor | Critical | security event data | sensitive infrastructure leakage, restricted actions, false trust signals | [ ] |
| System health | High | readiness/health telemetry | minimal disclosure, no internal topology/secrets, scoped diagnostics | [ ] |

## C. Module implementation order

Do not build all pages in parallel.

1. [ ] Security foundation + canonical permissions
2. [ ] CRM V2 design system/shell
3. [ ] Dashboard read model
4. [ ] Jobs list
5. [ ] Job 360
6. [ ] Customers / Taskers / Companies
7. [ ] Quotes / Messaging
8. [ ] Finance / Payments / Escrow / Refunds / Payouts / Commission / Settlements
9. [ ] Disputes / KYC / Trust & Safety
10. [ ] Canonical marketplace catalog
11. [ ] Website booking channel
12. [ ] Mobile/App & Web controls
13. [ ] Promotions / Notifications / Markets
14. [ ] Staff + per-user permission overrides
15. [ ] Analytics / Search / Audit / Security / Health
16. [ ] Legacy-admin removal
17. [ ] Full integration + release validation

## D. PRE-BUILD decision

A module may enter implementation only when:
- [ ] source of truth is verified
- [ ] trust boundary is mapped
- [ ] privacy classification is complete
- [ ] server permission model is defined
- [ ] abuse cases are documented
- [ ] negative tests are planned
- [ ] runtime consumer is proven

PRE-BUILD: PASS / FAIL

## E. RELEASE decision

A module may enter production only when:
- [ ] functional acceptance passes
- [ ] server authorization tests pass
- [ ] object/country isolation tests pass
- [ ] audit/redaction tests pass
- [ ] concurrency/idempotency tests pass where relevant
- [ ] production build passes
- [ ] shared mobile/web regressions pass
- [ ] UI matches CRM V2 system
- [ ] no P0/P1 security findings remain

RELEASE: PASS / FAIL
