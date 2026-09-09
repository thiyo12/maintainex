# MaintainEX Migration Reconciliation

## Migration Directory Structure

```
prisma/migrations/
├── 20260101000000_baseline/
│   └── migration.sql          # NEW — Complete schema baseline (3372 lines)
├── _archived/
│   ├── 20240101000000_add_crm_models.sql      # Loose SQL — superseded
│   ├── 20250101000000_add_mobile_models.sql   # Loose SQL — superseded
│   ├── 20250601000000_add_location_fields.sql # Loose SQL — superseded
│   ├── 20250626000000_add_name_change_cooldown/ # Prisma — superseded
│   └── 20260830000000_add_customer_profile_fields/ # Prisma — superseded
└── migration_lock.toml        # NEW — Provider lock (postgresql)
```

## Classification

| Migration | Type | Status | Action |
|---|---|---|---|
| `20240101000000_add_crm_models.sql` | Loose SQL | Superseded | Archived — content covered by baseline |
| `20250101000000_add_mobile_models.sql` | Loose SQL | Superseded | Archived — content covered by baseline |
| `20250601000000_add_location_fields.sql` | Loose SQL | Superseded | Archived — content covered by baseline |
| `20250626000000_add_name_change_cooldown/` | Prisma | Superseded | Archived — content covered by baseline |
| `20260830000000_add_customer_profile_fields/` | Prisma | Superseded | Archived — content covered by baseline |
| `20260101000000_baseline/` | Prisma diff | ACTIVE | New deployable baseline |

## Why Archived (Not Deleted)

The old migrations are preserved in `_archived/` for:

1. **Historical evidence** — Shows what was originally created
2. **Audit trail** — Documents schema evolution
3. **Recovery reference** — If baseline needs verification
4. **No conflict** — Archived files are outside the deployable chain

## Deployable Chain

For `prisma migrate deploy`, only the baseline migration is active:

```
20260101000000_baseline → FUTURE MIGRATIONS
```

The archived files are ignored by Prisma (directories starting with `_` are skipped).

## Production Baseline Procedure

When deploying to existing production:

1. Backup database
2. Run baseline migration against empty test database to verify
3. On production: mark baseline as applied without re-running
   ```bash
   prisma migrate resolve --applied "20260101000000_baseline"
   ```
4. Future migrations deploy normally with `prisma migrate deploy`

## Conflict Prevention

The baseline contains the COMPLETE current schema. Running old migrations after baseline would:

- Attempt to create tables that already exist → FAIL
- Attempt to add columns that already exist → FAIL

This is why old migrations are archived, not kept in the deployable chain.
