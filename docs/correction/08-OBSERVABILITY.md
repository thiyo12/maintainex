# MaintainEX Observability Audit

## Current State

| Aspect | Status |
|---|---|
| Logging | `console.log/error/warn` — no structured logging |
| Error tracking | None (no Sentry, LogRocket, etc.) |
| Performance monitoring | None |
| Uptime monitoring | None (health check endpoint exists) |
| Database monitoring | None |
| Alerting | None (admin alerts are manual) |
| APM | None |

## What Exists

### Health Check Endpoint
- `GET /api/health` — Returns `{ status: 'ok', timestamp }`
- Used by: Vercel cron (every 5 min), manual checks
- Not used by: Docker healthcheck, load balancer

### Admin Alert System
- `AdminAlert` model in Prisma
- API: `GET/POST/PATCH/DELETE /api/admin/alerts`
- Types: `SECURITY`, `PERFORMANCE`, `SYSTEM`
- Priority: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- Read/unread tracking, notes, assignment
- **Not wired to any automated detection** — all alerts are manually created

### Audit Logging
- `AuditLog` model in Prisma
- `ActivityLog` model for admin actions
- `SecurityAudit` model for security events
- `LoginActivity` model for user logins
- **Not queried or surfaced anywhere** — logs are written but never read

### Cron Job Logging
- Each cron writes structured JSON to console
- No persistence, no aggregation
- No alerting on cron failures

## What's Missing

| Category | Missing | Priority |
|---|---|---|
| Structured logging | Winston/Pino with JSON format | P1 |
| Error tracking | Sentry or similar | P1 |
| Request tracing | Correlation IDs | P2 |
| Performance metrics | Response times, DB query times | P2 |
| Database monitoring | Query performance, connection pool | P2 |
| Uptime monitoring | External ping (UptimeRobot, etc.) | P2 |
| Alerting | Email/Slack on critical errors | P2 |
| Log aggregation | Centralized log storage | P3 |
| Dashboard | Real-time metrics dashboard | P3 |

## Recommendations

1. Add structured logging (JSON format) with correlation IDs
2. Add error tracking (Sentry) for both web and mobile
3. Add uptime monitoring for `maintainex.lk`
4. Wire admin alert system to automated detection
5. Add request tracing for debugging
6. Add performance monitoring for API response times
