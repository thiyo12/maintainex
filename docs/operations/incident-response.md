# Operations — Incident Response

## Security Event Triage

### Event Severity Classification

Events are auto-classified by `emitSecurityEvent()` based on type (`lib/security/events.ts:50-81`):

| Severity | Event Types | Response Time |
|----------|-------------|---------------|
| **Critical** | `credential_stuffing_detected`, `financial_amount_mismatch`, `metadata_tamper_detected` | Immediate |
| **High** | `ip_blocked`, `unauthorized_access_attempt`, `path_traversal_attempt`, `ai_boundary_exceeded`, `account_banned` | < 1 hour |
| **Medium** | `login_lockout`, `rate_limit_hit`, `idempotency_violation`, `bot_detected`, `account_suspended`, `dispute_created`, `wallet_withdrawal` | < 4 hours |
| **Low** | `login_failure`, `otp_verify_failure`, `kyc_rejected`, `password_reset_request` | Next business day |
| **Info** | `login_success`, `otp_send`, `account_created`, `kyc_submitted`, etc. | Monitored |

### Investigation Steps

1. **Query security logs**: `GET /api/admin/security/logs` with filters
2. **Check failed logins**: `GET /api/admin/security/failed-logins` — look for patterns across IPs
3. **Monitor dashboard**: `GET /api/admin/security/monitor` — credential stuffing and bot metrics
4. **Correlate with request IDs**: Use `requestId` from error responses to trace full request path

## Rate Limiting Response

### Middleware Rate Limit (429)

**Trigger**: IP exceeds 100 requests/minute (default) or 5/minute (auth routes)

**Response**:
```json
{
  "error": "Rate limit exceeded. Try again later."
}
```

**Headers**: `Retry-After`, `X-RateLimit-Remaining: 0`, `X-RateLimit-Reset`

**Action**: None required — automatic unblock when window expires.

### Financial Guard Rate Limit (429)

**Trigger**: User exceeds 20 financial mutations/minute

**Response**:
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many financial requests. Try again later."
  }
}
```

**Action**:
1. Check if legitimate high-volume operation (bulk settlement, etc.)
2. If abuse: add IP to blocklist via `POST /api/admin/security/blocked-ips`
3. Monitor for automated attacks

### Persistent Blocking

IPs can be blocked via the `IpBlock` model:
- **Database**: `prisma.ipBlock.create({ data: { ip, reason, expiresAt } })`
- **Sync**: Middleware fetches blocklist every 60s from `/api/internal/security/ip-blocklist`
- **Expiry**: Optional `expiresAt` field; expired blocks auto-removed on next sync

## Account Lockout Procedures

### Admin Login Lockout

**Model**: `AdminLoginAttempt` table tracks all login attempts

**Lockout conditions** (implemented in `lib/admin-auth.ts`):
- 5 failed attempts → temporary lockout
- Lockout duration increases with consecutive failures

**Manual unlock**:
```sql
-- Find locked account
SELECT * FROM "AdminLoginAttempt" WHERE "email" = 'admin@example.com' AND success = false ORDER BY "createdAt" DESC LIMIT 10;

-- Clear lockout (if implemented via Redis or in-memory)
-- Check admin user status
SELECT id, email, "isLocked", "lockedUntil" FROM "AdminUser" WHERE email = 'admin@example.com';
```

### Mobile User Lockout

**Cross-IP aggregation** (Phase 7): Failed logins are aggregated across IPs per account, not per IP.

**Lockout conditions**:
- 5 failed OTP verifications → code invalidated, must request new code
- Per-account login lockout after repeated failures

**Manual intervention**:
```sql
-- Check user lock status
SELECT id, email, "isActive", "isSuspended" FROM "User" WHERE phone = '+94771234567';

-- Reactivate if incorrectly locked
UPDATE "User" SET "isActive" = true WHERE id = '<user-id>';
```

## Financial Discrepancy Response

### Detection

1. **Security events**: `financial_amount_mismatch` and `metadata_tamper_detected` are `critical` severity
2. **Metrics**: Financial counters in `/api/admin/security/monitor`
3. **Audit trail**: `AuditLog` entries for all escrow/wallet operations

### Investigation

1. **Query audit logs**:
```sql
SELECT * FROM "AuditLog"
WHERE "action" IN ('ESCROW_RELEASE', 'ESCROW_REFUND', 'WALLET_FREEZE')
AND "createdAt" > NOW() - INTERVAL '24 hours'
ORDER BY "createdAt" DESC;
```

2. **Check wallet transactions**:
```sql
SELECT * FROM "WalletTransaction"
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
ORDER BY "createdAt" DESC;
```

3. **Verify escrow state**:
```sql
SELECT * FROM "JobEscrow" WHERE "status" NOT IN ('RELEASED', 'REFUNDED', 'DISPUTED')
AND "updatedAt" < NOW() - INTERVAL '7 days';
```

### Containment

1. **Freeze affected wallet**: `prisma.providerWallet.update({ where: { id }, data: { isFrozen: true } })`
2. **Flag user for review**: `prisma.adminFlag.create({ data: { userId, reason } })`
3. **Create work queue item**: `createWorkItem({ category: 'fraud', title: 'Financial discrepancy', ... })`
4. **Notify FINANCE role**: Auto-assigned via work queue

### Resolution

1. **Verify legitimate vs fraudulent**: Check transaction patterns, user history
2. **Process refund/chargeback**: Via admin financial controls
3. **Document findings**: Add notes to `AdminFlag` and `AdminAlert`
4. **Update fraud score**: Risk scoring system will factor into future decisions

## Database Incident Response

### Connection Failure

**Symptoms**: Readiness check returns `database: "failed"`, application errors

**Response**:
1. Check PostgreSQL container: `docker ps | grep postgres`
2. Check container logs: `docker logs <postgres-container> --tail 50`
3. Verify connection string: `DATABASE_URL` accessible from app container
4. Restart if needed: `docker restart <postgres-container>`

### Migration Failure

**Symptoms**: Readiness check returns `migrations: "pending"`, schema mismatch errors

**Response**:
1. Check migration status: `npx prisma migrate status`
2. Apply pending: `npx prisma migrate deploy`
3. If migration is broken: `npx prisma migrate resolve --rolled-back <migration>`
4. Revert application to matching version

### Data Corruption

**Response**:
1. **Stop writes**: Disable affected API endpoints or put app in maintenance mode
2. **Assess scope**: Query affected tables
3. **Restore from backup**: Use latest verified backup
4. **Replay transactions**: Apply `AuditLog` entries to restore lost operations
5. **Verify integrity**: Run reconciliation queries

### Performance Degradation

**Response**:
1. **Check slow queries**: Enable Prisma query logging
2. **Check connection pool**: Monitor active connections
3. **Check memory**: Readiness endpoint reports heap usage
4. **Scale vertically**: Increase container resources if needed
5. **Kill long-running queries**: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';`
