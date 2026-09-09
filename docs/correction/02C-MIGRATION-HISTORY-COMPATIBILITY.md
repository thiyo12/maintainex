# MaintainEX Migration History Compatibility

## Migration Directory Structure

```
prisma/migrations/
├── 20260101000000_baseline/
│   └── migration.sql          # Complete schema baseline (3372 lines)
├── _archived/
│   ├── 20240101000000_add_crm_models.sql
│   ├── 20250101000000_add_mobile_models.sql
│   ├── 20250601000000_add_location_fields.sql
│   ├── 20250626000000_add_name_change_cooldown/
│   └── 20260830000000_add_customer_profile_fields/
└── migration_lock.toml
```

## `_archived` Directory Behavior

Prisma ignores directories starting with `_` in the migrations folder. The archived migrations are:

1. **Not in the deployable chain** — `prisma migrate deploy` will not attempt to apply them
2. **Preserved for historical evidence** — Shows what was originally created
3. **Safe to keep** — No conflict with the baseline migration

## Production `_prisma_migrations` Compatibility

### Case A: No useful migration history (db push was primary)

Production may have:
- No `_prisma_migrations` table
- Empty `_prisma_migrations` table
- Partial/unreliable entries

**Resolution:** Create `_prisma_migrations` table and mark baseline as applied:
```sql
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
VALUES ('baseline-001', 'checksum', NOW(), '20260101000000_baseline', NOW(), 1);
```

### Case B: Some old archived migrations recorded

Production may have entries for:
- `20240101000000_add_crm_models`
- `20250101000000_add_mobile_models`
- `20250601000000_add_location_fields`
- `20250626000000_add_name_change_cooldown`
- `20260830000000_add_customer_profile_fields`

**Resolution:** Mark baseline as applied alongside existing entries:
```sql
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
VALUES ('baseline-001', 'checksum', NOW(), '20260101000000_baseline', NOW(), 1)
ON CONFLICT DO NOTHING;
```

The old entries remain but are harmless — the baseline contains the complete schema state.

## Why This Is Safe

1. **Baseline is idempotent** — It creates the complete schema from empty
2. **Old migrations are superseded** — Their changes are included in the baseline
3. **No double-application** — Prisma tracks which migrations have been applied
4. **No data loss** — Baseline resolution does not touch existing data

## Verified On

- Clean PostgreSQL database: PASS (123 tables created)
- Existing-schema database with data: PASS (data preserved after baseline resolution)
