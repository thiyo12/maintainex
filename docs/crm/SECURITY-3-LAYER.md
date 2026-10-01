# MaintainEX CRM — Three-Layer Security Standard

All new CRM surfaces must pass all three layers before a route is considered production-ready.

## Layer 1 — Request / Attack Boundary

Goal: stop abusive or forged requests before business logic executes.

Required controls:

- Cloudflare/TLS/WAF remain the outer edge.
- Existing middleware security headers and IP blocklist remain enabled.
- CRM API rate limits:
  - reads: 180 requests/minute/IP
  - normal mutations: 40 requests/minute/IP, fail closed
  - sensitive mutations: 10 requests/minute/IP, fail closed
- Cookie-authenticated POST/PATCH/PUT/DELETE requests require same-origin requests.
- Cross-site mutation attempts return 403.
- Bearer-token requests are not treated as cookie-CSRF requests.
- Admin/API responses must be no-store for sensitive surfaces.

Implementation:

- `middleware.ts`
- `lib/crm/security.ts`
- `lib/shared/rate-limit/*`

## Layer 2 — Identity / RBAC / Data Isolation

Goal: a valid login must still never grant access to data outside the staff member's authority.

Required controls:

- Canonical staff/admin session only.
- Every CRM endpoint declares its required permission.
- Role permissions come from the canonical `ROLE_PERMISSIONS` map.
- Non-`SUPER_ADMIN` data access must be scoped to `assignedCountries`.
- A non-super admin with no assigned countries fails closed with 403.
- Object-level authorization is required before reads or mutations.
- A caller-controlled ID (jobId, customerId, branchId, providerId, companyId) is never trusted by itself.
- Cross-country and cross-owner object access must return 403/404 without leaking protected data.

Implementation:

- `lib/auth/authentication/admin-auth.ts`
- `lib/auth/authorization/admin-rbac.ts`
- `lib/crm/security.ts`
- route-specific ownership checks

## Layer 3 — Sensitive Action / Data Safety

Goal: if an authenticated and authorized account is compromised or makes a mistake, sensitive operations remain bounded, validated, traceable and recoverable.

Required controls:

- Validate every mutation payload against an allowlisted schema.
- Do not pass arbitrary request objects directly into Prisma updates.
- Redact passwords, hashes, tokens, OTPs, merchant secrets, API keys, auth headers and cookies from CRM output/audit payloads.
- Sensitive operations must use canonical domain/finance services rather than directly changing financial state.
- Financial writes require existing idempotency/concurrency protections.
- Every privileged CRM mutation must create an audit record with:
  - admin ID/email/role
  - target entity
  - before/after state (redacted)
  - IP/user-agent
  - result/risk level
- Destructive or financial actions must use fail-closed rate limiting.
- Security events are emitted for unauthorized access attempts.

Implementation:

- `lib/crm/security.ts`
- `lib/crm/validation.ts`
- `lib/crm/audit.ts`
- `lib/security/events.ts`
- canonical job/finance lifecycle services

## Required route pattern

New CRM endpoints should follow this structure:

```ts
const guard = await guardCrmRequest(request, {
  permission: 'jobs:manage',
  level: 'sensitive',
  requireCountryScope: true,
})
if (!guard.ok) return guard.response

const security = guard.context

// 1. Parse + validate allowlisted input.
// 2. Fetch target object.
// 3. Verify target country/ownership with security context.
// 4. Call canonical domain service.
// 5. Create redacted audit record.
// 6. Return only necessary fields.
```

## Mandatory tests for each CRM module

Every new CRM module must include negative tests for:

1. unauthenticated request
2. wrong role / missing permission
3. no assigned country for scoped staff
4. cross-country access
5. forged object ID / IDOR
6. cross-origin cookie-authenticated mutation
7. rate-limit behavior for sensitive mutations
8. invalid payload / oversized input
9. sensitive-field redaction
10. audit record creation for privileged mutations

## Release gate

A CRM phase cannot be marked complete when any of the following is true:

- new P0/P1 security issue
- unscoped admin query
- privileged write without audit
- financial mutation bypasses canonical service
- sensitive write fails open when the rate-limit/security service fails
- cross-origin cookie mutation is accepted
- secret/token/OTP data appears in a CRM response or audit record
- new security regression test fails

This CRM standard sits on top of MaintainEX's existing platform security layers. It does not replace the existing Cloudflare, middleware, authentication, IDOR, validation, financial concurrency or database protections.
