# Phase 9 — Security Architecture

## Security Layers

The application enforces security through six concentric layers applied at request time:

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Middleware** | `middleware.ts` | IP blocklist, in-memory rate limiting, request ID injection, security headers, AI crawler detection |
| **Auth** | `middleware.ts:116-150`, `lib/admin-rbac.ts` | JWT verification (HMAC SHA-256), legacy token fallback, cookie + Bearer header extraction |
| **RBAC** | `lib/admin-types.ts`, `lib/admin-rbac.ts:49-58` | 6-role system (SUPER_ADMIN, MANAGER, FINANCE, USER_MANAGEMENT, SUPPORT, TECHNICAL) with per-route `adminAuthorize()` |
| **Rate Limiting** | `lib/rate-limit/` | Pluggable store (memory / Redis), 13 named policies, financial mutation guard |
| **Idempotency** | `middleware.ts:226-234` | Client-supplied `X-Request-Id` passthrough with validation (max 128 chars, alphanumeric + `-_`) |
| **Audit** | `lib/admin-audit.ts`, `lib/admin-rbac.ts:67-97` | `AuditLog` table writes on every mutating admin action with before/after snapshots |

## Request Lifecycle

```
Client Request
  │
  ├─ AI Crawler Detection (User-Agent check)
  │    └─ Yes → allow with X-Robots-Tag: all, return early
  │
  ├─ IP Extraction (x-forwarded-for → x-real-ip → 'unknown')
  │
  ├─ IP Blocklist Sync (background fetch to /api/internal/security/ip-blocklist, 60s TTL)
  │    └─ IP blocked → 403 { error, code: 'IP_BLOCKED' }
  │
  ├─ In-Memory Rate Limit (per-IP, per-type)
  │    └─ Exceeded → 429 with Retry-After + X-RateLimit-Remaining/Reset
  │
  ├─ Route Matching
  │    ├─ /admin/login, /admin/api/auth → pass through with coconut headers
  │    ├─ /admin/* (non-login) → getSession() → 301 to login if no session
  │    │    └─ Valid roles: SUPER_ADMIN, MANAGER, FINANCE, USER_MANAGEMENT, SUPPORT, TECHNICAL
  │    ├─ /api/health → pass through, CORS *
  │    ├─ /api/mobile/* → pass through, mobile CORS headers
  │    └─ Other /api/* → getSession() → 401 if no session
  │
  ├─ Security Headers Applied
  │    ├─ Standard: X-Frame-Options, X-Content-Type-Options, HSTS, etc.
  │    └─ Coconut (login/admin): additionally X-Robots-Tag: noindex, Cache-Control: no-store
  │
  └─ X-Request-Id set on response
```

## Rate Limiting Architecture

Two independent rate limiting systems operate:

### 1. Middleware In-Memory Rate Limiter (`middleware.ts:235-266`)

- **Scope**: Per-IP, per-route-type (default/auth/admin)
- **Storage**: In-process `Map<string, { count, windowStart }>` with 60s cleanup interval
- **Limits**: default=100/min, auth=5/min, admin=200/min
- **Failure mode**: fail-open (request proceeds if store fails)
- **Limitation**: Resets on container restart; not shared across replicas

### 2. Route-Level Financial Guard (`lib/rate-limit/financial-guard.ts`)

- **Scope**: Per-user (x-user-id or IP), per-action (financial mutations)
- **Storage**: Pluggable `RateLimitStore` — `MemoryRateLimitStore` (default) or `RedisRateLimitStore` (if `REDIS_URL` set)
- **Limit**: 20 requests/minute for `FINANCIAL_MUTATION` policy
- **Failure mode**: fail-closed (returns 429 if store is unavailable)
- **Policies**: 13 named policies in `lib/rate-limit/policies.ts`

### Rate Limit Response Format

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many financial requests. Try again later."
  }
}
```

Headers: `Retry-After`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Error Response Format

All API errors follow a structured format that never exposes internals:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "requestId": "a1b2c3d4"
  }
}
```

**Guarantees**:
- No stack traces in production responses
- No Prisma error messages leaked (caught by `toSafeError()` in `lib/errors/app-error.ts`)
- No SQL fragments exposed
- Internal errors map to generic `"An internal error occurred. Please try again later."`
- Database URLs masked in backup logs: `config.databaseUrl.replace(/:[^@]+@/, ':***@')`

**Error codes defined** (`lib/errors/app-error.ts:44-57`):
`INTERNAL_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `VALIDATION_ERROR`, `COUNTRY_MISMATCH`, `CURRENCY_MISMATCH`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA`, `SERVICE_UNAVAILABLE`

## Sensitive Data Redaction

### Log Redaction (`lib/observability/redaction.ts`)

Automatic redaction applied to every log line via `redactObject()`:

**Exact key matches** (28 keys): `password`, `passwordHash`, `token`, `accessToken`, `refreshToken`, `secret`, `apiKey`, `otp`, `otpCode`, `privateKey`, `databaseUrl`, `smtp_password`, `pepper`, `totpSecret`, `codeHash`, `refreshTokenHash`, `jwt`, `session`, `sessionId`, `credentials`, and more.

**Pattern matches**: `/password/i`, `/secret/i`, `/token/i`, `/otp/i`, `/cookie/i`, `/authorization/i`, `/private.?key/i`, `/database.?url/i`

**Behavior**: Sensitive values replaced with `[REDACTED]`. Email fields preserved. Max object depth: 10 levels.

## Security Event Model

Defined in `lib/security/events.ts`:

```typescript
interface SecurityEvent {
  type: SecurityEventType   // 24 event types
  riskLevel: RiskLevel      // info | low | medium | high | critical
  actorId?: string
  actorType?: 'user' | 'admin' | 'system' | 'anonymous'
  ip?: string
  userAgent?: string
  details?: Record<string, unknown>
  requestId?: string
  timestamp: Date
}
```

**Event types** (24 total):
`login_success`, `login_failure`, `login_lockout`, `otp_send`, `otp_verify_success`, `otp_verify_failure`, `password_change`, `password_reset_request`, `account_created`, `account_suspended`, `account_banned`, `kyc_submitted`, `kyc_approved`, `kyc_rejected`, `dispute_created`, `dispute_resolved`, `wallet_withdrawal`, `wallet_deposit`, `admin_action`, `rate_limit_hit`, `ip_blocked`, `ip_unblocked`, `idempotency_violation`, `financial_amount_mismatch`, `metadata_tamper_detected`, `path_traversal_attempt`, `unauthorized_access_attempt`, `credential_stuffing_detected`, `bot_detected`, `ai_boundary_exceeded`

**Emission**: `emitSecurityEvent()` logs via Pino at the appropriate level (critical→error, high/medium→warn, info→info). Security event logging must never crash the caller.

## AI Boundary Controls

Defined in `lib/security/ai-boundary.ts`:

The `checkAIBoundary()` function guards AI-facing endpoints against prompt injection and data exfiltration:

- **Input length limit**: 10,000 characters max
- **Blocked patterns** (20 regex patterns): prompt injection (`ignore previous instructions`), role manipulation (`you are now a`), security bypass (`bypass security`), credential extraction (`reveal secret`, `dump users`), SQL injection (`drop table`, `delete from`), XSS (`<script`, `javascript:`)
- **Returns**: `{ allowed: boolean, reason?: string }`
- **Usage**: Check input before passing to AI/LLM endpoints

## Risk Scoring System

Defined in `lib/security/risk-scoring.ts`:

The `calculateRiskScore()` function evaluates cumulative security events:

| Factor | Weight | Condition |
|--------|--------|-----------|
| Repeated auth failure | 30 | ≥5 failed logins/OTP attempts |
| Moderate auth failure | 15 | 3-4 failed attempts |
| Credential stuffing | 80 | `credential_stuffing_detected` event present |
| Bot activity | 25 | `bot_detected` event present |
| IP block history | 20 | `ip_blocked` event present |
| Historical failures | up to 25 | `context.failedLoginCount ≥ 3` |
| High activity | 15 | `context.recentActivityCount > 100` |
| Financial fraud | 95 | `metadata_tamper_detected` or `financial_amount_mismatch` |

**Thresholds**: none(0), low(20), medium(50), high(80), critical(95)
**Action**: `shouldBlock = true` when level is `high` or `critical`

## RBAC Permission Matrix

6 roles with granular permissions defined in `lib/admin-types.ts:12-79`:

| Capability | SUPER_ADMIN | MANAGER | FINANCE | USER_MGMT | SUPPORT | TECHNICAL |
|-----------|:-----------:|:-------:|:-------:|:---------:|:-------:|:---------:|
| User ban/suspend | ✓ | - | - | ✓ | - | - |
| KYC approve/reject | ✓ | - | - | ✓ | - | - |
| Job cancel | ✓ | - | - | - | - | - |
| Escrow/wallet manage | ✓ | - | ✓ | - | - | - |
| Dispute resolve | ✓ | ✓ | - | - | ✓ | - |
| Work queue assign | ✓ | ✓ | - | - | - | - |
| Admin CRUD | ✓ | - | - | - | - | - |
| Security audit | ✓ | - | - | - | - | ✓ |

## Financial Audit Trail

Every financial mutation emits security events and increments metrics (`lib/financial-audit.ts`):

- `auditEscrowFund` → `wallet_deposit` event + `financial_escrow_fund` counter
- `auditEscrowRelease` → `wallet_withdrawal` event + `financial_escrow_release` counter
- `auditEscrowRefund` → `wallet_deposit` event + `financial_escrow_refund` counter
- `auditPayoutRequest` → `wallet_withdrawal` event + `financial_payout_request` counter
- `auditCommissionSettlement` → `admin_action` event + `financial_commission_settlement` counter
- `auditWalletFreeze` / `auditWalletUnfreeze` → `admin_action` events + counters

## Fraud Detection

`lib/fraud-detection.ts` provides:
- **Chat scanning**: Regex detection of phone numbers, emails, payment keywords with automatic sanitization
- **Device fingerprinting**: Max 3 accounts per device via `UserDevice` model
- **Dispute abuse**: Flags users with ≥30% dispute rate after 5+ completed bookings
- **Chargeback abuse**: Freezes wallet after ≥2 chargebacks in 90 days
- **Threshold flagging**: ≥5 fraud events in 7 days → admin flag for review

## Work Queue System

`lib/work-queue.ts` auto-creates `AdminAlert` entries:

| Category | Assigned Role | SLA | Severity |
|----------|--------------|-----|----------|
| kyc | USER_MANAGEMENT | 24h | medium |
| dispute | SUPPORT | 48h | high |
| settlement | FINANCE | 72h | high |
| flagged_job | MANAGER | 24h | medium |
| fraud | MANAGER | 12h | critical |
| payout | FINANCE | 48h | high |
| system | TECHNICAL | 7 days | low |
| tasker_escalation | MANAGER | 12h | high |

Assignment: round-robin to staff with fewest open alerts in the target role.
