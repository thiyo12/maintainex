# MaintainEX CRM V2 — Trust Boundary Map

This document defines the first trust boundaries to validate before CRM V2 implementation expands.

## System view

```
UNTRUSTED INTERNET
  |
  +-- Public website / web booking
  +-- Customer mobile app
  +-- Tasker mobile app
  +-- Company users
  +-- CRM staff browser
  +-- Payment/webhook senders
  +-- File-upload clients
  |
  v
CLOUDFLARE / EDGE
  |
  +-- Public WAF/rate limits
  +-- Admin hostname: Cloudflare Access + MFA
  |
  v
TRAEFIK / ORIGIN ROUTING
  |
  v
MAINTAINEX APPLICATION BOUNDARY
  |
  +-- Authentication/session verification
  +-- CRM authorization/permission checks
  +-- Country/market scope
  +-- Input validation/rate limiting
  |
  v
DOMAIN SERVICES
  |
  +-- job/quote lifecycle
  +-- messaging/notifications
  +-- finance/payment/escrow
  +-- KYC/trust/safety
  +-- catalog/market configuration
  |
  v
POSTGRESQL / PRIVATE STORAGE / THIRD-PARTY SERVICES
```

---

## TB-01 — Internet -> Admin hostname edge

### Assets
- CRM login
- CRM pages
- CRM APIs
- staff sessions
- internal operational data

### Attacker capabilities
Assume:
- hostname can be discovered
- URL paths can be guessed
- requests can be automated
- headers/user-agent can be spoofed
- login can be brute-forced
- direct-origin/VPS routing may be attempted
- scanners can probe common admin/API paths

### Required controls
- [ ] admin.maintainex.lk proxied through Cloudflare
- [ ] Cloudflare Access policy is deny-by-default
- [ ] only approved staff identities allowed
- [ ] MFA required at Access layer
- [ ] HTTPS only
- [ ] noindex/nofollow/noarchive
- [ ] frame protection
- [ ] Cloudflare/WAF rate controls
- [ ] direct-origin bypass blocked
- [ ] Traefik host routing limited to expected host
- [ ] public maintainex.lk behavior unaffected

### Current status
- Traefik admin routing: implemented
- noindex/frame protection: implemented
- Cloudflare DNS: user created record
- Cloudflare Access/MFA: still to verify/finish
- direct-origin lock: not yet accepted as complete

### Acceptance tests
- [ ] non-approved identity cannot reach MaintainEX CRM login
- [ ] approved identity + MFA reaches application
- [ ] HTTP redirects to HTTPS
- [ ] direct origin cannot bypass Access using Host header/SNI tricks
- [ ] public domains continue to work

---

## TB-02 — CRM staff browser -> MaintainEX CRM API

### Assets
- jobs
- users
- finance
- disputes
- KYC
- settings
- staff management

### Attacker capabilities
Assume a user can:
- modify JavaScript
- call APIs directly
- change IDs
- forge hidden fields
- bypass disabled buttons
- replay requests
- alter request bodies
- inspect all frontend code

### Required controls
Every CRM API:
- [ ] authenticates server-side
- [ ] verifies live session
- [ ] verifies live AdminUser status
- [ ] checks explicit permission
- [ ] applies per-staff ALLOW/DENY overrides
- [ ] applies country/market scope
- [ ] validates object ownership/scope
- [ ] validates input with allowlisted schema
- [ ] rate-limits according to risk
- [ ] enforces same-origin/CSRF rules for cookie mutations
- [ ] returns minimum DTO
- [ ] audits privileged mutation

### Never trust from browser
- role
- permission
- country entitlement
- owner/customer/provider identity
- financial amount
- currency
- commission
- payment status
- escrow status
- lifecycle status
- payout destination
- verification result

### Acceptance tests
- [ ] hidden button API call still denied
- [ ] changed job/user/company ID is denied when out of scope
- [ ] explicit DENY override beats role template
- [ ] cross-country object access fails
- [ ] cross-origin mutation fails
- [ ] oversized/invalid input fails safely

---

## TB-03 — JWT/cookie claims -> live staff/session state

### Why this boundary exists
A cryptographically valid token can be stale.

Examples:
- staff was disabled after login
- role changed after login
- permission override changed
- country access removed
- session revoked
- password/security reset occurred

### Required controls
Sensitive requests verify:
- [ ] AdminUser exists
- [ ] AdminUser is active
- [ ] deletedAt is null
- [ ] account is not locked where relevant
- [ ] AdminSession exists
- [ ] session belongs to actor
- [ ] session is not revoked
- [ ] session is not expired
- [ ] current DB role is used
- [ ] current DB country scope is used
- [ ] current permission overrides are used

### Acceptance tests
- [ ] disable staff -> existing token loses access
- [ ] revoke session -> token loses access
- [ ] remove country -> existing token loses scoped data access
- [ ] add explicit DENY -> existing token loses action permission

---

## TB-04 — User-supplied object ID -> canonical database object

### Risk
IDOR/BOLA: a legitimate authenticated user changes:
- jobId
- customerId
- taskerId
- companyId
- disputeId
- payoutId
- KYC document ID

### Required object-access sequence
1. authenticate actor
2. load target object
3. derive target owner/country/company from database
4. compare against actor permission/scope
5. only then return/mutate

### Rules
- [ ] caller-controlled IDs never prove authorization
- [ ] protected-object existence is not unnecessarily disclosed
- [ ] nested relationships are authorized too
- [ ] download/file routes repeat object authorization
- [ ] search endpoints cannot be used to enumerate forbidden IDs

### Acceptance tests
- [ ] staff LK -> CA job denied
- [ ] Company A -> Company B employee denied
- [ ] Customer A -> Customer B attachment denied
- [ ] unrelated dispute evidence denied

---

## TB-05 — CRM API -> domain services / database writes

### Risk
A correctly authenticated endpoint can still corrupt state if it writes Prisma models directly without business invariants.

### Required pattern
CRM routes do not invent their own financial/job state transitions.

Use canonical domain services for:
- [ ] job lifecycle
- [ ] quote acceptance
- [ ] payment state
- [ ] escrow release/refund
- [ ] payout
- [ ] commission/settlement
- [ ] dispute resolution
- [ ] KYC approval/rejection
- [ ] company assignment where invariants exist

### Required controls
- [ ] transaction around multi-write invariant
- [ ] state precondition checked in same transaction where necessary
- [ ] idempotency/replay protection
- [ ] server-calculated derived values
- [ ] audit after successful mutation
- [ ] partial failures recover safely

### Acceptance tests
- [ ] invalid lifecycle jump denied
- [ ] repeated request does not duplicate financial effect
- [ ] concurrent refund/payout cannot exceed source amount
- [ ] failed notification does not roll back a committed financial ledger unless business policy requires it

---

## TB-06 — Public/mobile/website clients -> marketplace API

### Actors
- anonymous website visitor
- authenticated customer
- tasker
- company user
- mobile app

### Risk
Public clients are fully untrusted and easily reverse-engineered.

### Required controls
- [ ] canonical marketplace auth
- [ ] object ownership checks
- [ ] customer/tasker/company role isolation
- [ ] app/web use same canonical catalog/jobs engine
- [ ] server calculates price-sensitive state
- [ ] public booking abuse/spam controls
- [ ] OTP/login rate limits
- [ ] no internal CRM fields returned
- [ ] mobile bundle contains no secrets

### Acceptance tests
- [ ] customer cannot call tasker/company privileged APIs
- [ ] tasker cannot alter customer payment state
- [ ] website booking cannot forge provider/price/payment status
- [ ] public catalog contains public fields only

---

## TB-07 — Payment provider/webhook -> MaintainEX finance domain

### Risk
Forged, duplicated or replayed payment callbacks can create false money state.

### Required controls
- [ ] verify provider signature/authentication
- [ ] verify merchant/account identity
- [ ] map to expected internal payment intent
- [ ] compare expected amount/currency server-side
- [ ] idempotent webhook processing
- [ ] persist provider transaction/reference safely
- [ ] replay detection
- [ ] transaction around financial state changes
- [ ] never accept payment status from frontend as authoritative

### Acceptance tests
- [ ] bad signature denied
- [ ] wrong amount denied/quarantined
- [ ] duplicate webhook has no duplicate ledger effect
- [ ] stale/unknown payment intent handled safely

---

## TB-08 — File-upload client -> private/public storage

### Risk
Uploads can carry malware, scripts, oversized payloads, fake MIME types, path traversal names, or private documents that become public.

### Required controls
- [ ] target-entity authorization
- [ ] size cap
- [ ] MIME allowlist
- [ ] content signature inspection where practical
- [ ] generated storage names
- [ ] no user-controlled filesystem paths
- [ ] private storage for KYC/disputes/internal documents
- [ ] authorized/signed retrieval
- [ ] public images re-encoded where practical
- [ ] audit sensitive document access/actions

### Acceptance tests
- [ ] wrong user cannot upload to target entity
- [ ] wrong user cannot fetch file by guessed ID/path
- [ ] executable/script upload rejected
- [ ] oversized upload rejected

---

## TB-09 — MaintainEX -> third-party outbound services

### Examples
- email
- SMS
- push
- maps
- storage/CDN
- analytics
- payment APIs

### Required controls
- [ ] minimum necessary data sent
- [ ] secrets server-side only
- [ ] outbound URLs/config allowlisted
- [ ] timeouts/retries bounded
- [ ] sensitive data omitted from push previews
- [ ] provider errors do not expose credentials to client
- [ ] webhooks/callback URLs authenticated

---

## TB-10 — Application -> logs/audit/monitoring

### Risk
Logs become a second data breach if raw request bodies, headers or secrets are recorded.

### Required controls
- [ ] password redaction
- [ ] token/cookie redaction
- [ ] TOTP/OTP redaction
- [ ] payment-secret redaction
- [ ] KYC document contents excluded
- [ ] audit contains safe before/after values only
- [ ] audit log cannot be edited by normal CRM users
- [ ] security logs themselves require restricted permission

---

## First implementation/security order

Before CRM V2 page work expands, close these boundaries in this order:

1. [ ] TB-01 Admin edge: finish Cloudflare Access + MFA + direct-origin lock
2. [ ] TB-03 Staff/session: implement canonical per-staff permission overrides and immediate revocation behavior
3. [ ] TB-02 CRM API: make all new CRM APIs use the same security guard
4. [ ] TB-04 Object authorization: standardize scoped object lookup helpers
5. [ ] TB-05 Domain-write boundary: inventory direct Prisma writes and route critical mutations through domain services
6. [ ] TB-06 App/web marketplace boundary: define canonical catalog + booking contracts
7. [ ] TB-07 Payment/webhook boundary: confirm all financial paths use verified idempotent services
8. [ ] TB-08 Upload boundary: centralize secure file policy
9. [ ] TB-09 Outbound third-party policy
10. [ ] TB-10 Logging/audit redaction validation

## Boundary release rule

A boundary is not considered closed because controls exist in one route.

It is closed only when:
- the control is centralized or consistently enforced,
- all relevant callers use it,
- negative tests prove bypass attempts fail,
- production configuration matches the code assumption,
- and no legacy route provides an alternate weaker path.
