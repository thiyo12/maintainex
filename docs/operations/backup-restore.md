# Operations — Backup & Restore

## Backup Architecture

### Full Backup Script (`backup.sh`)

A comprehensive 5-part backup producing a single timestamped `.tar.gz` archive:

| Part | Source | Method |
|------|--------|--------|
| **Source code** | Git HEAD | `git archive --format=tar HEAD` |
| **Database** | Live PostgreSQL on VPS | `pg_dump` via SSH → `docker exec` on `maintainex-db` container |
| **Uploads** | `public/uploads/` | Direct `cp -r` |
| **Environment files** | `.env.example`, `mobile/.env` | Direct copy |
| **Docker config** | `Dockerfile`, `nixpacks.toml`, `.dockerignore` | Direct copy |

**Archive**: `$HOME/maintainex-backup/maintainex-full-backup-YYYY-MM-DD.tar.gz`

### Database Backup Module (`lib/backup/index.ts`)

Programmatic backup with gzip compression:

```typescript
import { createDatabaseBackup, listBackups, cleanupOldBackups, verifyBackup } from '@/lib/backup'
```

**Configuration** (environment variables):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `BACKUP_DIR` | `/var/backups/maintainex` | Output directory |
| `BACKUP_RETENTION_DAYS` | `30` | Days before old backups are deleted |

**Output format**: `maintainex-db-{timestamp}.sql.gz` (gzip-compressed SQL dump)

**Safety**: Database URL masked in logs: `config.databaseUrl.replace(/:[^@]+@/, ':***@')`

## Backup Configuration

### Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
BACKUP_DIR=/var/backups/maintainex
BACKUP_RETENTION_DAYS=30
INTERNAL_SYNC_SECRET=<internal-sync-secret>
```

### Retention Policy

- Default: 30 days
- Cleanup runs via `cleanupOldBackups()` — deletes files matching `maintainex-db-*.sql.gz` older than `BACKUP_RETENTION_DAYS`

## Restore Procedure

### From Full Archive

```bash
# 1. Extract archive
tar -xzf maintainex-full-backup-YYYY-MM-DD.tar.gz
cd code/

# 2. Install dependencies
npm install

# 3. Restore database (on VPS)
psql -U postgres -d postgres < database/maintainex-live-dump.sql

# 4. Rebuild and deploy
npm run build
# Follow deployment process in REBUILD.md
```

### From Database-Only Backup

```bash
# Decompress
gunzip maintainex-db-TIMESTAMP.sql.gz

# Restore
psql -U postgres -d postgres < maintainex-db-TIMESTAMP.sql
```

### Prisma Migration Status Check

After restore, verify migration state:

```sql
SELECT COUNT(*) FROM "_prisma_migrations" WHERE "finished_at" IS NULL;
```

If pending migrations exist, run:

```bash
npx prisma migrate deploy
```

## Verification Steps

### Backup Integrity Check

```typescript
const result = await verifyBackup(filepath)
// { valid: true, size: 1234567 }
```

Checks:
1. File size > 100 bytes
2. Valid gzip magic bytes (`0x1f 0x8b`)

### Post-Restore Verification

1. **Database connectivity**: `curl http://localhost:3000/api/internal/readiness -H "x-internal-sync: $SECRET"` — expect `database: "ok"`, `migrations: "ok"`
2. **Application health**: `curl http://localhost:3000/api/health` — expect `{ "status": "healthy" }`
3. **User count**: `SELECT COUNT(*) FROM "User"` — verify expected user count
4. **Admin login**: Attempt login at `/admin/login` with known credentials

## Financial Reconciliation Checklist

After any database restore, verify financial integrity:

1. **Escrow balances**: `SELECT SUM("escrowAmount") FROM "JobEscrow" WHERE "status" IN ('FUNDED', 'PARTIALLY_RELEASED')`
2. **Wallet balances**: `SELECT SUM(balance) FROM "ProviderWallet"` and `SELECT SUM(balance) FROM "CustomerWallet"`
3. **Settlement status**: Check no settlements are in inconsistent states
4. **Transaction log**: Verify `WalletTransaction` entries match wallet balance changes
5. **Commission calculations**: Spot-check recent `CommissionSettlement` entries
6. **Audit log continuity**: Verify `AuditLog` entries exist for recent admin actions
