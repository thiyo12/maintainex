# API Reference

MaintainEX API route catalog. All endpoints are served by Next.js 14 App Router under `app/api/`.

---

## Authentication

| Prefix | Auth Method | Notes |
|--------|-------------|-------|
| `/api/mobile/v2/*` | JWT Bearer token | 18-day session, `Authorization: Bearer <token>` |
| `/api/admin/*` | Admin JWT + RBAC | Access + refresh tokens, role-based permissions |
| `/api/mobile/v1/*` | Legacy | Deprecated, migrating to v2 |

All write routes enforce `assertNotSuspended()` via `lib/mobile-auth.ts`.

---

## Mobile API v2 — Job Lifecycle

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/mobile/v2/jobs` | Customer | Create a new job posting |
| GET | `/api/mobile/v2/jobs` | Any | List jobs for current user (role-filtered) |
| GET | `/api/mobile/v2/jobs/[id]` | Owner | Get job detail (ownership check, sensitive field redaction) |
| PATCH | `/api/mobile/v2/jobs/[id]` | Owner | Update job details |
| POST | `/api/mobile/v2/jobs/[id]/complete` | Provider | Mark job as completed |
| POST | `/api/mobile/v2/jobs/[id]/customer-status` | Customer | Customer status update (confirm completion, report issue) |
| GET | `/api/mobile/v2/jobs/[id]/commercial-history` | Owner | Financial transaction history for job |

### Job Workspace

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/mobile/v2/jobs/[id]/workspace` | Provider | Start/progress workspace session |
| POST | `/api/mobile/v2/jobs/[id]/evidence` | Provider | Upload work evidence (photos, notes) |
| GET | `/api/mobile/v2/jobs/[id]/inspection` | Either | List inspections for job |
| GET | `/api/mobile/v2/jobs/[id]/inspection/[inspectionId]` | Either | Get inspection detail |

### Verification PIN

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/mobile/v2/jobs/[id]/pin` | Customer | Generate 6-digit verification PIN |
| POST | `/api/mobile/v2/jobs/[id]/pin/verify` | Provider | Verify PIN to start work |
| POST | `/api/mobile/v2/jobs/[id]/pin/revoke` | Customer | Revoke current PIN |
| POST | `/api/mobile/v2/jobs/[id]/pin/rotate` | Customer | Revoke and generate new PIN |

### Job Sharing

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/mobile/v2/jobs/[id]/share-address` | Provider | Share location with customer |

---

## Mobile API v2 — Quotes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/mobile/v2/quotes` | Provider | Submit a quote for a job |
| GET | `/api/mobile/v2/quotes` | Provider | List own quotes |
| POST | `/api/mobile/v2/quotes/[id]/revision` | Provider | Submit quote revision |
| POST | `/api/mobile/v2/jobs/[id]/select-quote` | Customer | Accept a specific quote |

---

## Mobile API v2 — Escrow & Payments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/mobile/v2/jobs/[id]/escrow` | Customer | Deposit funds into escrow |
| GET | `/api/mobile/v2/jobs/[id]/escrow` | Owner | Get escrow status |
| POST | `/api/mobile/v2/jobs/[id]/escrow/refund` | Customer/Admin | Request escrow refund |
| POST | `/api/mobile/v2/jobs/[id]/release-escrow` | System/Admin | Release escrow to provider |
| POST | `/api/mobile/v2/jobs/[id]/cash-payment` | Provider | Record cash payment (cash-to-agent) |
| GET | `/api/mobile/v2/wallet` | Any | Get wallet balance and recent transactions |

---

## Mobile API v2 — Matching

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/mobile/v2/match/[jobId]` | System | Trigger matching engine for job |
| GET | `/api/mobile/v2/provider/eligibility` | Provider | Check provider eligibility for categories |
| GET | `/api/mobile/v2/search` | Any | Search providers by category, location |

---

## Mobile API v2 — Pricing

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/mobile/v2/pricing/estimate` | Any | Get price estimate for job parameters |
| POST | `/api/mobile/v2/pricing/confirm` | Customer | Confirm pricing for booking |
| POST | `/api/mobile/v2/pricing/materials` | Any | Estimate materials cost |
| POST | `/api/mobile/v2/price-estimate` | Any | Quick price estimate |

---

## Mobile API v2 — Provider & Company

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/mobile/v2/schedule` | Provider | Get availability schedule |
| POST | `/api/mobile/v2/availability` | Provider | Update availability |
| POST | `/api/mobile/v2/subtasks` | Provider | Create subtasks for job |
| GET | `/api/mobile/v2/quality` | Provider | Get quality metrics |
| GET | `/api/mobile/v2/trust` | Provider | Get trust score |
| GET | `/api/mobile/v2/certifications` | Provider | List certifications |
| GET | `/api/mobile/v2/identity` | Any | Get identity verification status |

---

## Mobile API v2 — Change Orders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/mobile/v2/jobs/[id]/change-orders` | Either | Create change order |
| PATCH | `/api/mobile/v2/jobs/[id]/change-orders/[changeOrderId]` | Either | Update change order |

---

## Mobile API v2 — Custom Jobs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/mobile/v2/custom-jobs` | Customer | Request custom job (no template match) |

---

## Mobile API v2 — Reviews

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/mobile/v2/jobs/[id]/reviews` | Either | Submit review for completed job |

---

## Mobile API v2 — Book Now

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/mobile/v2/book-now` | Customer | Instant booking (pre-qualified provider) |

---

## Mobile API v2 — Categories & Templates

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/mobile/v2/professions` | Any | List active professions |
| GET | `/api/mobile/v2/professions/[id]/skills` | Any | List skills for profession |
| GET | `/api/mobile/v2/service-templates` | Any | List service templates |
| GET | `/api/mobile/v2/locations` | Any | Location data (countries, regions) |

---

## Admin API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/users` | users:view | List all users |
| PATCH | `/api/admin/users/[id]` | users:edit | Update user (suspend, ban, role) |
| GET | `/api/admin/jobs` | jobs:view | List all jobs |
| PATCH | `/api/admin/jobs/[id]` | jobs:manage | Moderate job (cancel, flag, refund) |
| GET | `/api/admin/companies` | companies:view | List companies |
| PATCH | `/api/admin/companies/[id]` | companies:edit | Update company |
| GET | `/api/admin/disputes` | disputes:view | List disputes |
| POST | `/api/admin/disputes/[id]/resolve` | disputes:resolve | Resolve dispute |
| GET | `/api/admin/commission` | commission:view | Commission dashboard |
| POST | `/api/admin/commission/settle` | commission:manage | Process settlement |
| GET | `/api/admin/escrows` | commission:view | List escrow records |
| GET | `/api/admin/security` | security:view | Security monitoring |
| POST | `/api/admin/security/audit` | security:audit | Run security audit |
| GET | `/api/admin/identity` | kyc:view | KYC review queue |
| PATCH | `/api/admin/identity/[id]` | kyc:approve | Approve/reject KYC |
| GET | `/api/admin/queue` | queue:view | Work queue |
| POST | `/api/admin/queue/[id]/assign` | queue:assign | Assign queue item |
| GET | `/api/admin/seed-categories` | settings:edit | Seed job categories |

---

## Response Shapes

### Success

```json
{
  "data": { ... },
  "meta": {
    "total": 42,
    "page": 1,
    "pageSize": 20
  }
}
```

### Error

```json
{
  "error": "Human-readable message",
  "reason": "MACHINE_READABLE_CODE",
  "details": { ... }
}
```

### Common Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `SUSPENDED` | 403 | Account is suspended |
| `NOT_FOUND` | 404 | Resource does not exist |
| `IDEMPOTENCY_CONFLICT` | 409 | Same key, different payload |
| `IMMUTABLE` | 409 | Resource is financially frozen |
| `RATE_LIMITED` | 429 | Too many requests |
