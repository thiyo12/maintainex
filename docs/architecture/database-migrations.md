# Database Migrations

Migration strategy, naming conventions, rollback procedures, and foreign key constraints for MaintainEX.

---

## Migration Tool

MaintainEX uses Prisma Migrate for schema management.

- Schema file: `prisma/schema.prisma`
- Migrations directory: `prisma/migrations/`
- Database: PostgreSQL (production), SQLite (development)

### Environment Switching

The schema file switches providers for local development:

```bash
# Local development (SQLite)
sed -i '' 's/provider = "postgresql"/provider = "sqlite"/' prisma/schema.prisma

# Production tarball (PostgreSQL)
sed -i '' 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
```

**Critical**: The tarball deployed to VPS MUST have `provider = "postgresql"` or new containers fail silently.

---

## Naming Conventions

### Migration Files

Format: `YYYYMMDDHHMMSS_description`

Examples:
- `20260901120000_add_job_verification_pin`
- `20260902140000_add_company_job_assignment`
- `20260903100000_expand_admin_roles_to_six`

Description rules:
- Use snake_case
- Start with a verb: `add_`, `create_`, `modify_`, `remove_`, `rename_`
- Be specific: `add_pin_rotation_fields` not `update_pins`
- Reference the entity, not the feature: `add_escrow_refund_status` not `add_refund_feature`

### Model Naming

Prisma model names use PascalCase:
- `MarketplaceJob` (not `marketplace_jobs`)
- `JobVerificationPin` (not `job_verification_pins`)
- `CompanyJobAssignment` (not `company_job_assignments`)

### Field Naming

- IDs: `id` (CUID default)
- Foreign keys: `modelNameId` (e.g., `jobId`, `companyId`)
- Booleans: `isActive`, `isSuspended`, `isBanned`
- Timestamps: `createdAt`, `updatedAt`
- Status fields: `status` with UPPER_SNAKE_CASE enum values

---

## Foreign Key Constraints

### Prisma Defaults

Prisma generates foreign keys with `onDelete` and `onUpdate` actions. MaintainEX defaults:

| Relationship | onDelete | onUpdate | Rationale |
|-------------|----------|----------|-----------|
| Parent -> Child (1:N) | `Cascade` | `Cascade` | Child cannot exist without parent |
| Optional reference | `SetNull` | `Cascade` | Preserve record, remove reference |
| Many-to-many | `Cascade` | `Cascade` | Junction table follows parent |

### Critical Constraints

```prisma
model MarketplaceJob {
  id         String @id @default(cuid())
  customerId String
  customer   User   @relation(fields: [customerId], references: [id], onDelete: Cascade)
  // ...
}

model JobQuote {
  id         String @id @default(cuid())
  jobId      String
  job        MarketplaceJob @relation(fields: [jobId], references: [id], onDelete: Cascade)
  // ...
}

model JobEscrow {
  id    String @id @default(cuid())
  jobId String
  job   MarketplaceJob @relation(fields: [jobId], references: [id], onDelete: Cascade)
  // ...
}
```

### Caution: Cascade Chains

Deleting a `User` cascades to:
- `MarketplaceJob` (customer's jobs)
- `JobQuote` (provider's quotes)
- `JobEscrow` (job's escrow)
- `CompanyJobAssignment` (worker's assignments)
- `LedgerEntry` (financial records)

**Never delete users with financial history.** Use soft-delete (`isActive = false`) instead.

---

## Rollback Strategy

### Prisma Migrate Rollback

Prisma does not support automatic down migrations. Rollback requires manual intervention.

#### Pre-Migration Backup

Before any migration on production:

```bash
# Dump current schema state
docker exec dokploy-postgres pg_dump -U postgres -d postgres > /tmp/pre-migration-$(date +%Y%m%d).sql

# Record migration state
npx prisma migrate status
```

#### Manual Rollback Steps

1. Identify the migration to roll back
2. Review the SQL in `prisma/migrations/<migration_name>/migration.sql`
3. Write inverse SQL (e.g., `ALTER TABLE ... DROP COLUMN` for an `ADD COLUMN`)
4. Apply inverse SQL to database
5. Remove migration entry from `_prisma_migrations` table
6. Update `schema.prisma` to match the rolled-back state
7. Run `npx prisma generate` to update client

#### Rollback Testing

Test all rollbacks in staging before production:
1. Apply migration
2. Verify application works
3. Apply rollback SQL
4. Verify application works
5. Document any data loss

### Safe Migration Patterns

| Pattern | Safe? | Notes |
|---------|-------|-------|
| `ADD COLUMN` (nullable) | Yes | No data lock |
| `ADD COLUMN` (NOT NULL + default) | Yes | Default fills existing rows |
| `DROP COLUMN` | Risky | Data loss; requires app code removal first |
| `RENAME COLUMN` | Risky | Breaks queries during deployment |
| `ALTER TYPE` | Risky | Requires data migration for existing rows |

### Deployment Order for Schema Changes

1. Add new column (nullable or with default)
2. Deploy app code that reads/writes new column
3. Backfill existing rows if needed
4. Add NOT NULL constraint if needed
5. Remove old column reference from app code
6. Drop old column

This 3-deployment cycle ensures zero-downtime schema changes.

---

## Migration Testing

### Local Development

```bash
# Create migration from schema changes
npx prisma migrate dev --name add_new_feature

# Reset database (destructive)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

### Staging

```bash
# Apply pending migrations
npx prisma migrate deploy

# Verify schema matches
npx prisma db pull --schema=prisma/schema.prisma
```

### Production

```bash
# Apply migrations (after backup)
npx prisma migrate deploy

# Verify
npx prisma migrate status
```

**Never run `prisma migrate dev` or `prisma migrate reset` on production.**

---

## Common Migration Patterns

### Adding a New Model

```prisma
model NewModel {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  // fields...
}
```

### Adding a Field to Existing Model

```prisma
model ExistingModel {
  // ... existing fields
  newField String? // nullable for backward compatibility
}
```

### Creating a Many-to-Many Relation

```prisma
model ModelA {
  id     String   @id @default(cuid())
  modelsB ModelB[]
}

model ModelB {
  id     String   @id @default(cuid())
  modelsA ModelA[]
}

// Prisma creates join table automatically
// For explicit junction table with extra fields:
model ModelAB {
  id       String @id @default(cuid())
  modelAId String
  modelBId String
  modelA   ModelA @relation(fields: [modelAId], references: [id])
  modelB   ModelB @relation(fields: [modelBId], references: [id])

  @@unique([modelAId, modelBId])
}
```

### Renaming a Model

Prisma does not support model renames. Workaround:
1. Create new model
2. Deploy code using new model
3. Migrate data via SQL script
4. Drop old model

---

## Fresh Database Bootstrap

### Why Bootstrap Is Needed

The historical migration chain (28 migrations) cannot replay on a completely empty database. Migration `20250626000000_add_name_change_cooldown` references the `User` table before the later-timestamped baseline `20260101000000_baseline` creates it. This is because the baseline was applied during initial setup before migration tracking was established, and subsequent migrations were recorded retrospectively.

Production and staging are unaffected: the baseline was applied first during initial deployment, then migrations were tracked in `_prisma_migrations` afterward.

### Existing vs. Empty Database

| Scenario | Command |
|----------|---------|
| Existing database (production, staging, local dev with data) | `npx prisma migrate deploy` |
| Completely empty database (new staging, disaster recovery, CI) | `./scripts/bootstrap-fresh-database.sh` |

### Bootstrap Procedure

For a completely empty PostgreSQL database:

```bash
# 1. Set environment
export DATABASE_URL="postgresql://user:pass@host:5432/dbname?schema=public"

# 2. Run bootstrap
./scripts/bootstrap-fresh-database.sh
```

The script will:
1. Refuse to run if the database is not empty
2. Generate the canonical baseline SQL from `prisma/schema.prisma`
3. Apply it to create all 152 tables
4. Mark all 28 historical migrations as applied in `_prisma_migrations`
5. Run `prisma migrate deploy` to verify consistency
6. Run `prisma migrate status` to confirm schema is up to date

### Disaster Recovery

If production needs to be rebuilt from scratch:

1. Provision empty PostgreSQL database
2. Run `./scripts/bootstrap-fresh-database.sh` with `DATABASE_URL`
3. Restore data from `pg_dump` backup (if available)
4. Verify with `prisma migrate status` → "Database schema is up to date"

### Why Not `prisma db push`?

`prisma db push` is designed for rapid prototyping and does not create migration records. It cannot be used for production bootstrap because:
- It doesn't track applied changes in `_prisma_migrations`
- Future `prisma migrate deploy` calls would fail (drift detection)
- No audit trail of schema changes

### Why Not Rewrite Historical Migrations?

Rewriting or reordering the historical migration files (e.g., moving `20260101000000_baseline` before `20250626000000`) would:
- Create checksum mismatches in existing `_prisma_migrations` tables
- Require `prisma migrate resolve` on every existing environment
- Risk breaking production/staging migration history

The bootstrap approach avoids touching any existing migration files or records.
