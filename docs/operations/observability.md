# Operations — Observability

## Structured Logging

The application uses **Pino** (`lib/observability/logger.ts`) for structured JSON logging.

### Configuration

- **Production**: JSON output to stdout (default Pino behavior)
- **Development**: `pino-pretty` transport with colorized, human-readable output
- **Log level**: `process.env.LOG_LEVEL` or auto-detected (`debug` in dev, `info` in prod)
- **Base context**: Every log line includes `service: "maintainex"`, `environment`, and `releaseSha`

### Logger API

```typescript
import { logger, childLogger } from '@/lib/observability/logger'

// Direct usage
logger.info('Order created', { jobId: '123', currency: 'LKR' })
logger.error('Payment failed', { err: error, orderId: '456' })

// Scoped child logger with persistent context
const log = childLogger({ requestId, actorId: userId })
log.info('Processing escrow fund')
log.warn('Low balance', { walletId, balance })
```

**Never-crash guarantee**: All logger methods wrap in try/catch — logging failures never propagate to callers.

### Standard Fields

Every enriched log line includes:

| Field | Source |
|-------|--------|
| `service` | `"maintainex"` (constant) |
| `environment` | `NODE_ENV` |
| `releaseSha` | `APP_RELEASE_SHA` env var |
| `requestId` | AsyncLocalStorage context |
| `correlationId` | AsyncLocalStorage context |
| `actorId` | AsyncLocalStorage context |
| `actorType` | AsyncLocalStorage context |
| `countryCode` | AsyncLocalStorage context |

## Request ID Propagation

### Flow

```
Incoming Request
  │
  ├─ middleware.ts: parseIncomingRequestId(request)
  │    ├─ Has X-Request-Id header? → validate (max 128, /^[a-zA-Z0-9\-_]+$/)
  │    └─ No header? → generateRequestId() (crypto.randomUUID())
  │
  ├─ Inject into AsyncLocalStorage via runWithContext()
  │
  ├─ All downstream code accesses via:
  │    ├─ getRequestContext() — full context object
  │    ├─ getRequestId() — just the ID string
  │    └─ setRequestContext({ actorId, actorType }) — enrich during request
  │
  └─ Response: X-Request-Id header set
```

### Implementation

- **Storage**: `AsyncLocalStorage<RequestContext>` in `lib/observability/request-context.ts`
- **Generation**: `crypto.randomUUID()` (v4 UUID)
- **Validation**: Incoming IDs must be ≤128 chars, matching `/^[a-zA-Z0-9\-_]+$/`
- **Fallback**: `"unknown"` if no context available

### Context Shape

```typescript
interface RequestContext {
  requestId: string
  correlationId: string
  actorId?: string
  actorType?: string
  countryCode?: string
  route?: string
  method?: string
  startTime?: number
}
```

## Log Levels

| Level | When to Use |
|-------|-------------|
| `debug` | Development-only: verbose tracing, query parameters, intermediate states |
| `info` | Normal operations: request completion, job created, escrow funded, KYC submitted |
| `warn` | Recoverable issues: rate limit hit, login failure, high memory usage, degraded health |
| `error` | Failures requiring attention: payment errors, database connection failures, unhandled exceptions |

### Security Event Levels

Security events map to log levels automatically (`lib/security/events.ts:93-123`):

| Risk Level | Log Level |
|-----------|-----------|
| `critical` | `error` |
| `high`, `medium` | `warn` |
| `low`, `info` | `info` |

## Sensitive Data Redaction

Applied automatically to every log line via `redaction.ts:50-70`.

### Redacted Keys (exact match, 28 keys)

`password`, `passwordHash`, `token`, `accessToken`, `refreshToken`, `authorization`, `cookie`, `secret`, `apiKey`, `otp`, `otpCode`, `privateKey`, `databaseUrl`, `smtp_password`, `pepper`, `totpSecret`, `codeHash`, `refreshTokenHash`, `jwt`, `session`, `sessionId`, `credentials`

### Redacted by Pattern

- `/password/i`
- `/secret/i`
- `/token/i`
- `/otp/i`
- `/cookie/i`
- `/authorization/i`
- `/private.?key/i`
- `/database.?url/i`

### Behavior

- Sensitive values → `"[REDACTED]"`
- `email` fields preserved
- Max recursion depth: 10 levels
- `redactString()` also redacts connection strings matching `key=value` patterns

## Metrics Collection

In-memory metrics stored in `lib/metrics/index.ts`.

### Metric Types

| Type | Function | Behavior |
|------|----------|----------|
| **Counter** | `incrementCounter(name, value?, labels?)` | Monotonically increasing, accumulated over time |
| **Gauge** | `setGauge(name, value, labels?)` | Point-in-time value, overwritten on each set |
| **Histogram** | `observeHistogram(name, value, labels?)` | Running average of observed values |

### System Metrics (collected every 30s by `lib/metrics/collector.ts`)

| Metric | Description |
|--------|-------------|
| `process_memory_rss_bytes` | Resident Set Size |
| `process_memory_heap_used_bytes` | V8 heap used |
| `process_memory_heap_total_bytes` | V8 heap total |
| `process_memory_external_bytes` | External memory |
| `process_uptime_seconds` | Process uptime |
| `process_active_handles` | Active libuv handles |
| `process_active_requests` | Active libuv requests |

### Financial Metrics (emitted by `lib/financial-audit.ts`)

| Metric | Labels |
|--------|--------|
| `financial_escrow_fund` | `currency` |
| `financial_escrow_release` | `currency` |
| `financial_escrow_refund` | `currency` |
| `financial_payout_request` | `currency` |
| `financial_commission_settlement` | `currency` |
| `financial_wallet_freeze` | `walletType` |
| `financial_wallet_unfreeze` | `walletType` |

### Retrieval

- `getMetrics()` → full `MetricPoint[]` array
- `getMetricsSummary()` → `Record<string, number>` name→value
- `resetMetrics()` → clear all metrics

## Health Endpoints

### Liveness: `/api/health` (`app/api/health/route.ts`)

```json
{
  "status": "healthy",
  "timestamp": "2026-09-11T19:13:00.000Z"
}
```

- **No auth required** — used by Docker HEALTHCHECK and load balancers
- **Always returns 200** if the process is running
- **No database check** — pure process liveness

### Readiness: `/api/internal/readiness` (`app/api/internal/readiness/route.ts`)

```json
{
  "status": "ready",
  "checks": {
    "database": "ok",
    "migrations": "ok"
  },
  "releaseSha": "abc123",
  "timestamp": "2026-09-11T19:13:00.000Z",
  "uptime": 3600
}
```

- **Auth required**: `x-internal-sync` header matching `INTERNAL_SYNC_SECRET`
- **Returns 200** if database is reachable and no pending migrations
- **Returns 503** if database fails or migrations are pending
- **Checks**: Raw SQL query (`SELECT 1`) + pending migration count from `_prisma_migrations`

### Health Status (`lib/metrics/health.ts`)

Internal health status evaluator:
- `healthy`: heap usage < 75%
- `degraded`: heap usage 75-90%
- `unhealthy`: heap usage > 90%
