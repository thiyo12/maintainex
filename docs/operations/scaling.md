# Operations — Scaling

## Current Architecture Constraints

### Single-Container Deployment

- **Runtime**: Single Next.js container on Docker Swarm
- **Database**: Single PostgreSQL instance (`dokploy-postgres` container)
- **In-memory state**: Rate limit counters, IP blocklist cache, metrics store — all per-container
- **No shared state layer**: No Redis configured (optional, falls back to memory)

### In-Process Rate Limiting

The middleware rate limiter (`middleware.ts:235-266`) uses an in-memory `Map`:
- Resets on container restart
- Not shared across replicas
- 60s cleanup interval for stale entries

### In-Memory Metrics

`lib/metrics/index.ts` stores all metrics in a `Map`:
- Lost on restart
- Not aggregated across replicas
- No external metrics backend (Prometheus, Datadog, etc.)

## Known Scale Issues

### Unbounded Database Queries

Audit identified **51 unbounded queries** — queries without `limit` or pagination:

| Category | Example | Risk |
|----------|---------|------|
| `prisma.user.findMany()` without `take` | User listing, search results | OOM on large tables |
| `prisma.marketplaceJob.findMany()` without pagination | Job feeds, admin lists | Slow response, memory pressure |
| `prisma.auditLog.findMany()` without limit | Security log queries | Table scan on high-volume logs |
| `prisma.walletTransaction.findMany()` without limit | Financial reports | Unbounded result sets |
| `prisma.conversation.findMany()` with nested includes | Chat history | N+1 + unbounded |

### N+1 Query Patterns

Common patterns causing excessive database round-trips:

1. **Loop-based creates**: `for (const item of items) { await prisma.lineItem.create({ data: item }) }` — should use `createMany`
2. **Sequential lookups**: Fetching related records inside loops instead of `include` or `findMany` with `whereIn`
3. **Admin panel list views**: Loading related entities per-row instead of batch loading

## Recommended Index Additions

Based on query patterns observed in the codebase:

```sql
-- Financial queries (high volume, time-range filtered)
CREATE INDEX idx_wallet_transaction_user_created ON "WalletTransaction"("userId", "createdAt" DESC);
CREATE INDEX idx_wallet_transaction_reference ON "WalletTransaction"("referenceType", "createdAt" DESC);

-- Job queries (status + customer/provider filtered)
CREATE INDEX idx_marketplace_job_status_customer ON "MarketplaceJob"("status", "customerId");
CREATE INDEX idx_marketplace_job_status_provider ON "MarketplaceJob"("status", "providerId");
CREATE INDEX idx_marketplace_job_created ON "MarketplaceJob"("createdAt" DESC);

-- Security audit (time-range + action filtered)
CREATE INDEX idx_security_audit_action_created ON "SecurityAudit"("action", "createdAt" DESC);
CREATE INDEX idx_security_audit_user_created ON "SecurityAudit"("userId", "createdAt" DESC);

-- Failed logins (aggregation + time-range)
CREATE INDEX idx_failed_login_email_time ON "FailedLogin"("email", "createdAt" DESC);
CREATE INDEX idx_failed_login_ip_time ON "FailedLogin"("ipAddress", "createdAt" DESC);

-- Admin alerts (work queue queries)
CREATE INDEX idx_admin_alert_role_status_priority ON "AdminAlert"("assignedRole", "status", "priority", "createdAt");

-- Audit log (admin activity queries)
CREATE INDEX idx_audit_log_admin_created ON "AuditLog"("adminUserId", "createdAt" DESC);
CREATE INDEX idx_audit_log_action_created ON "AuditLog"("action", "createdAt" DESC);
```

## Connection Pool Tuning

### Current Configuration

Prisma uses its default connection pool: `DATABASE_URL?connection_limit=10`

### Recommended for Production

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname?connection_limit=20&pool_timeout=10
```

| Parameter | Default | Recommended | Notes |
|-----------|---------|-------------|-------|
| `connection_limit` | 10 | 20 | Increase for concurrent admin + mobile + web |
| `pool_timeout` | 10s | 10s | Keep default — fail fast |
| `statement_cache_size` | -1 (unlimited) | 100 | Bound prepared statement cache |

### Connection Monitoring

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Connection by database
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;

-- Idle connections (potential pool waste)
SELECT count(*) FROM pg_stat_activity WHERE state = 'idle';
```

## Redis Requirements for Multi-Replica

### Why Redis

When running multiple container replicas:
- In-memory rate limits are per-replica (not shared)
- In-memory metrics are per-replica (not aggregated)
- IP blocklist sync is per-replica (redundant fetches)

### Redis Configuration

```bash
REDIS_URL=redis://localhost:6379
```

**Auto-detection**: `lib/rate-limit/index.ts` automatically uses `RedisRateLimitStore` when `REDIS_URL` is set, falling back to `MemoryRateLimitStore`.

### Redis Store Implementation (`lib/rate-limit/redis-store.ts`)

- **Client**: `ioredis` (lazy-loaded, optional dependency)
- **Connection**: Lazy connect with 3s timeout, 3 max retries
- **Operations**: `INCR` + `PEXPIRE` for atomic increment-with-TTL
- **Failure mode**: Throws on unavailable Redis — callers handle via `fail-closed` or `fail-open` policy

### What Redis Enables

| Feature | Without Redis | With Redis |
|---------|--------------|------------|
| Rate limiting | Per-replica (inconsistent) | Global (consistent) |
| IP blocklist | Per-replica sync | Shared, single source |
| Metrics | Per-replica | Centralized |
| Session store | Cookie-only | Shared sessions |

## Deferred Improvements

### High Priority

1. **Prisma query pagination**: Add `take`/`skip` to all `findMany` calls — prevent OOM on large tables
2. **N+1 elimination**: Batch related-entity loading with `include` or `findMany` with `whereIn`
3. **Structured query logging**: Enable Prisma query logging in production for slow query identification
4. **Connection pool monitoring**: Expose pool stats via metrics endpoint

### Medium Priority

5. **Redis integration**: Configure `REDIS_URL` for distributed rate limiting and metrics
6. **Prometheus/Datadog export**: External metrics backend for alerting and dashboards
7. **Database read replicas**: Separate read-heavy queries (admin lists, reports) to replicas
8. **Connection pooler**: PgBouncer or similar for connection multiplexing

### Low Priority

9. **Request queuing**: Bull/BullMQ for async job processing (email, push notifications)
10. **CDN for static assets**: Move `public/` to Cloudflare/CloudFront
11. **Horizontal pod autoscaling**: Kubernetes HPA based on CPU/memory metrics
12. **Multi-region deployment**: Geographic distribution for mobile API latency
