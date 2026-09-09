# MaintainEX Backup & Restore

## Current State

| Property | Status |
|---|---|
| Backup commands exist | YES (manual `pg_dump`) |
| Automated backups | UNKNOWN — needs verification |
| Backup frequency | UNKNOWN |
| Retention policy | UNKNOWN |
| Encryption | UNKNOWN |
| Restore tested | UNKNOWN |

## Production Backup Procedure

### Manual Backup (VPS)

```bash
# SSH to VPS
ssh -i ~/.ssh/id_ed25519_ssaaxcy root@147.93.106.54

# Find DB container
docker ps --filter name=maintainex-db --format "{{.Names}}"

# Backup
docker exec <db_container> pg_dump -U postgres postgres > /tmp/maintainex_backup_$(date +%Y%m%d_%H%M%S).sql

# Copy to host
docker cp <db_container>:/tmp/maintainex_backup_*.sql /root/backups/

# Cleanup old backups (keep 7 days)
find /root/backups/ -name "*.sql" -mtime +7 -delete
```

### Restore Procedure

```bash
# Stop the app first
docker service update --image <current_image> maintainex-mx-vcaohy

# Restore database
docker exec -i <db_container> psql -U postgres postgres < /path/to/backup.sql

# Verify
docker exec <db_container> psql -U postgres postgres -c "SELECT COUNT(*) FROM \"User\""

# Restart app
docker service update --force maintainex-mx-vcaohy
```

## Backup Format

- Format: Plain SQL (`pg_dump` default)
- Encoding: UTF-8
- Compression: None (add `| gzip` for compression)

## Recommendations

| Item | Current | Recommended |
|---|---|---|
| Format | Plain SQL | Custom format (`-Fc`) for selective restore |
| Frequency | Manual | Daily automated via cron |
| Retention | Unknown | 30 days |
| Encryption | None | GPG encryption for off-site storage |
| Testing | Unknown | Monthly restore test to staging |
| Off-site | None | Copy to S3/similar |

## Restore Test (Staging)

To verify backups are restorable:

1. Spin up staging PostgreSQL
2. Restore backup
3. Run `npx prisma migrate status`
4. Verify record counts match production
5. Run smoke tests
