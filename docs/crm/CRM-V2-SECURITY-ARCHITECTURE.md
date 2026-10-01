# MaintainEX CRM V2 — Security-by-Design Architecture

## Purpose

Every CRM V2 feature is designed twice:

1. **Developer lens** — how the feature should work correctly.
2. **Attacker lens** — how it could be abused, bypassed, scraped, forged, replayed, escalated, leaked, or made inconsistent.

No feature is implementation-ready until both reviews are complete.

---

## 1. Trust boundaries

### Public / untrusted
Treat all of these as attacker-controlled:
- browser input
- URL/query/path parameters
- form fields
- file uploads
- request headers
- cookies received from clients
- bearer tokens before verification
- mobile app requests
- website booking requests
- webhook payloads before signature verification
- IDs such as jobId, userId, companyId, payoutId
- client-side hidden fields
- client-side role/permission state
- browser localStorage/sessionStorage
- device identifiers
- geolocation supplied by client
- search/filter/sort parameters

### Trusted only after verification
- canonical authenticated staff session
- live AdminUser state from database
- live AdminSession state from database
- server-side permission evaluation
- server-side country/market scope
- canonical job/payment lifecycle state
- signed and verified payment webhooks
- validated internal service-to-service requests

### Server-only secrets
Never expose these to browser, mobile bundle, HTML, API JSON, logs, analytics, audit payloads, GitHub, or screenshots:
- DATABASE_URL
- JWT_SECRET
- JWT_REFRESH_SECRET
- NEXTAUTH_SECRET
- PASSWORD_PEPPER
- MARKETPLACE_JWT_SECRET
- STAFF_JWT_SECRET
- INTERNAL_SYNC_SECRET
- payment merchant secrets
- API private keys
- encryption keys
- webhook secrets
- TOTP secrets
- password hashes
- OTP hashes
- refresh-token hashes
- internal infrastructure credentials

Any value prefixed with NEXT_PUBLIC_ is assumed public by design and must never contain a secret.

---

## 2. Data exposure classification

### Public data
Safe for public website/app responses only when intentionally published:
- public service names/descriptions
- public category images/icons
- public provider display name where product requires it
- public ratings/review summaries
- public service availability
- public pricing guidance
- public offer content
- public business profile fields explicitly approved for display

### Authenticated user data
Return only to the owning customer/tasker/company or explicitly authorized counterpart:
- booking address
- phone/email
- chat messages
- job attachments
- exact schedule
- private profile fields
- wallet state
- payment status
- dispute content
- verification state

### Staff-only operational data
Never send to public/mobile endpoints unless product behavior explicitly requires it:
- internal notes
- risk score/reasons
- fraud flags
- staff comments
- audit logs
- internal SLA
- moderation history
- suspension reasons marked internal
- internal payout/settlement diagnostics

### Secret / highly sensitive
Never return directly:
- passwordHash
- refreshTokenHash
- totpSecret
- OTP/PIN secret values after generation where not required
- merchantSecret
- private API keys
- raw authorization headers
- cookies
- access/refresh tokens in logs/audit records
- database connection strings

---

## 3. Mandatory feature design review

Before coding any page, endpoint, action, or worker, document:

### Developer questions
- What business problem does this solve?
- What is the canonical source of truth?
- Which app/web/CRM surfaces consume it?
- What state transitions are allowed?
- What happens on retry?
- What happens on partial failure?
- What is the rollback/recovery path?
- What is the audit requirement?
- What permissions are required?
- What market/country scope applies?

### Attacker questions
- Can an unauthenticated caller reach it?
- Can a lower-role staff member call the API directly?
- Can one customer/tasker/company access another entity by changing an ID?
- Can a staff member cross country/market boundaries?
- Can an action be replayed?
- Can it be executed twice concurrently?
- Can malformed/oversized input exhaust resources?
- Can a URL fetch cause SSRF?
- Can uploaded content execute code/script?
- Can search/filter input reach raw SQL?
- Can output reveal secrets or internal fields?
- Can logs/audit records leak credentials?
- Can a compromised staff account cause irreversible damage?
- Can an attacker bypass the UI and call the backend directly?
- Can origin/VPS access bypass Cloudflare protections?
- Can stale JWT claims bypass a revoked role/session?
- Can a request forge price, currency, commission, ownership, or lifecycle state?

If any answer is unclear, implementation stops until the design is resolved.

---

## 4. CRM V2 request pattern

Every privileged endpoint follows:

1. Authenticate.
2. Verify live session.
3. Verify live staff account is active.
4. Rate-limit.
5. Verify CSRF/same-origin for cookie mutations.
6. Check explicit permission.
7. Enforce country/market scope.
8. Validate request schema and size.
9. Fetch target object from canonical storage.
10. Verify object-level authorization.
11. Verify lifecycle/business invariant.
12. Execute through canonical domain service.
13. Use transaction/idempotency where required.
14. Write redacted audit record.
15. Emit security event when relevant.
16. Return the minimum necessary response fields.
17. Use no-store for sensitive responses.

Client-side permission checks are UX only. Server authorization is mandatory.

---

## 5. Authorization model

### Role templates
- SUPER_ADMIN
- MANAGER
- FINANCE
- USER_MANAGEMENT
- SUPPORT
- TECHNICAL

### Per-staff overrides
Role template permissions are only defaults.

Each staff account can have explicit:
- ALLOW
- DENY

Effective permission rules:
- explicit DENY wins over role-template permission
- explicit ALLOW may extend the role only when the permission is delegable
- non-delegable owner-only permissions remain SUPER_ADMIN only
- country/market scope is independent from permission scope
- disabled staff and revoked sessions fail immediately
- permission changes revoke or invalidate active authorization state where necessary

### Owner-only/non-delegable examples
- create/delete SUPER_ADMIN
- alter owner security
- change payment gateway secrets
- modify security policy
- change audit retention
- disable global protections
- change production-secret configuration

---

## 6. Module threat requirements

### Dashboard
Developer:
- read-only aggregation from canonical APIs
- no fake metrics

Attacker:
- prevent data leakage across market scope
- prevent expensive unrestricted aggregation
- rate-limit search/analytics endpoints
- no sensitive internals in health cards

### Jobs / Job 360
Developer:
- canonical job lifecycle
- lifecycle-aware actions
- quotes/messages/payment/dispute/audit relationships

Attacker:
- IDOR on job ID
- forged state transition
- bypass start/completion verification
- unauthorized cancellation
- quote tampering
- attachment access control
- location/privacy leakage
- repeated action/replay

### Customers
Attacker focus:
- PII minimization
- search enumeration
- account takeover tools
- unauthorized profile edits
- notes visibility
- export abuse

### Taskers
Attacker focus:
- KYC/credential bypass
- rating manipulation
- fake availability
- eligibility tampering
- payout ownership
- document exposure

### Companies / employees
Attacker focus:
- cross-company access
- employee assignment abuse
- privilege escalation through company role
- company payout destination tampering
- removal/reassignment races

### Payments / escrow / refunds / payouts
Highest-risk module.

Required:
- server-calculated amounts
- currency validation
- immutable financial ledger
- idempotency keys
- database transaction/concurrency controls
- signed webhook verification
- replay protection
- refund ceiling
- payout ownership verification
- no direct UI-driven status update
- dual confirmation or step-up auth for high-impact actions where appropriate
- complete audit trail

Never trust:
- amount
- commission
- currency
- payment status
- escrow status
- payout destination
when supplied by client.

### Disputes
Attacker focus:
- evidence access
- malicious file uploads
- double resolution
- biased/unauthorized action
- internal-note leakage
- financial resolution replay

### KYC / credentials
Attacker focus:
- private document leakage
- file malware/content type tricks
- path traversal
- object-store public exposure
- forged approval
- approval without required evidence
- retention/privacy rules

### Messaging
Attacker focus:
- cross-conversation IDOR
- stored XSS
- spam/flooding
- prohibited attachment types
- notification abuse
- staff impersonation
- sensitive data in push notification previews

### Catalog / App & Web
Attacker focus:
- unauthorized publication
- malicious HTML/URLs in descriptions
- fake pricing
- invalid market exposure
- app/web taxonomy drift
- dangerous remote image URLs
- publishing inactive/unapproved templates

### Notifications / broadcasts
Attacker focus:
- mass-message abuse
- phishing content
- unintended audience
- repeated sends
- secrets/PII in push content

Large broadcasts require:
- explicit audience preview
- confirmation
- permission
- audit
- idempotency

### Staff
Critical module.

Attacker focus:
- privilege escalation
- self-granting permissions
- creation of hidden admin accounts
- session persistence after disable
- country-scope expansion
- 2FA disabling
- audit deletion

Rules:
- staff cannot grant permissions they are not authorized to delegate
- staff cannot elevate themselves
- sensitive changes require re-authentication/step-up
- session revocation on password/security/role changes where appropriate
- immutable security audit trail

### Settings
Attacker focus:
- turning off security
- changing commission/payment rules
- changing maintenance/feature flags
- unsafe URLs
- configuration injection

Settings require typed schemas, allowlists and audit.

---

## 7. Frontend rules

Assume all frontend code is visible to an attacker.

Never place in frontend:
- secrets
- hidden admin passwords
- service credentials
- privileged business logic relied upon for security
- unrestricted internal API URLs
- trust decisions

Frontend may:
- hide unavailable actions for UX
- display permission-aware UI
- validate input for UX
- show redacted operational data

Backend must independently repeat all security checks.

Use:
- output encoding
- React text rendering rather than unsafe HTML
- strict URL validation
- CSP where compatible
- no sensitive localStorage values where HttpOnly cookies can be used

Avoid dangerouslySetInnerHTML unless sanitization is formally reviewed.

---

## 8. API response rules

Use explicit response DTOs/selects.

Do not return raw Prisma records by default.

Every endpoint asks:
- what fields are actually required by this screen?
- can any field identify private infrastructure?
- does this expose internal risk/security metadata?
- does this expose another user's PII?
- does this reveal whether a protected object exists?

For unauthorized object access, prefer responses that do not unnecessarily confirm protected object existence.

---

## 9. File upload rules

All uploads require:
- authentication where appropriate
- authorization to target entity
- maximum size
- allowlisted MIME/type
- content signature validation where feasible
- generated storage names
- no user-controlled filesystem paths
- malware/content scanning where practical
- private storage for KYC/dispute/internal files
- signed/authorized retrieval
- image re-encoding for public images where practical
- audit for sensitive document access/actions

Never trust file extension alone.

---

## 10. Search / export rules

Global CRM search can become a data-exfiltration endpoint.

Required:
- staff permission scope
- market scope
- minimum query length
- server-side result cap
- pagination
- rate limit
- field-level response minimization
- no password/token/security-secret searching

Exports require:
- explicit permission
- row cap or asynchronous controlled export
- audit
- redaction
- country/market scope
- secure expiration if downloadable

---

## 11. Logging and auditing

### Application logs
Must not contain:
- plaintext passwords
- tokens
- cookie values
- TOTP secrets
- payment secrets
- raw KYC documents
- full sensitive request bodies

### Audit records
Record:
- actor
- role
- permission used
- target
- action
- safe before/after values
- time
- IP
- user agent
- result
- request/correlation ID where useful

Audit logs must not be editable through normal CRM operations.

---

## 12. Browser / edge security

CRM production target:
- Cloudflare proxy
- Cloudflare Access for private admin hostname
- MFA
- HTTPS only
- HSTS
- X-Frame-Options DENY on CRM
- noindex/nofollow/noarchive
- no-store
- strict referrer policy
- CSP after compatibility review
- origin lock so direct VPS access cannot bypass Cloudflare/Access
- rate limiting/WAF rules
- bot/scanner controls appropriate for admin host

A hidden URL is only an additional obscurity layer, never an authentication mechanism.

---

## 13. Database safety

Use:
- least-privileged DB credentials where feasible
- parameterized ORM queries
- transactions for multi-write invariants
- uniqueness constraints
- foreign keys
- state/version checks for concurrency-sensitive workflows
- append-only ledger patterns for financial history

Avoid:
- raw SQL constructed with user input
- blind mass update/delete
- hard deletion of audit/financial history
- client-controlled Prisma data spreads

---

## 14. Supply-chain / code security

Before release:
- lockfile committed
- dependency audit reviewed
- no secret in repository/history
- CI security exposure audit
- no dev/debug endpoints in production
- seed/setup endpoints blocked in production
- source maps reviewed for production exposure policy
- container runs non-root
- minimal runtime image
- health/readiness endpoints reveal minimal information

---

## 15. Secure failure behavior

On security/control dependency failure:
- financial mutation: fail closed
- permission evaluation: fail closed
- market scope: fail closed
- session lookup: fail closed
- CSRF/origin validation: fail closed
- sensitive rate limit service: fail closed where policy requires

Do not expose stack traces or internal exception details to clients.

Return safe error codes/messages and log redacted diagnostic detail server-side.

---

## 16. Pre-build security gate for every CRM V2 module

Required checklist:

- [ ] Canonical source of truth identified
- [ ] Trust boundaries documented
- [ ] Public/private/secret fields classified
- [ ] Authentication requirement defined
- [ ] Permission(s) defined
- [ ] Object-level authorization defined
- [ ] Country/market isolation defined
- [ ] Input schema + limits defined
- [ ] Output DTO defined
- [ ] Rate limit policy defined
- [ ] CSRF/origin policy defined
- [ ] Idempotency/concurrency design defined where needed
- [ ] Audit events defined
- [ ] Sensitive-field redaction defined
- [ ] Failure mode defined
- [ ] Abuse cases defined
- [ ] Negative tests defined
- [ ] Runtime consumer verified
- [ ] Rollback/recovery defined

No implementation begins until these are complete for the module.

---

## 17. Current issues to resolve before CRM V2 production release

Known from current production/review:
- remove/disable automated test SUPER_ADMIN accounts in production
- verify owner/admin 2FA rollout
- fix admin login device-recording path so AdminUser IDs are not written through a User-only relation
- finish Cloudflare Access protection for admin hostname
- lock origin access so Access cannot be bypassed through direct origin routing
- reconcile legacy authorization vocabulary with canonical CRM RBAC
- replace separate old website/mobile catalog concepts with the canonical marketplace catalog

These are release/security tasks, not visual-design tasks.

---

## Final principle

A CRM screen is not complete because it renders.

It is complete only when:
- the operation is real,
- the data source is canonical,
- the authorization is enforced server-side,
- abusive paths have been considered,
- sensitive data is minimized,
- failures are recoverable,
- actions are auditable,
- and automated negative tests prove obvious bypasses fail.
