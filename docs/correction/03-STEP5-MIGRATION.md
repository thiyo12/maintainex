# 03 — Step 5: Migration Report

**Date**: 2026-09-07

---

## Migration SQL

File: `prisma/migrations/20260907000000_add_user_sessions/migration.sql`

```sql
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "tokenFamilyId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserSession_refreshTokenHash_key" ON "UserSession"("refreshTokenHash");
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");
CREATE INDEX "UserSession_tokenFamilyId_idx" ON "UserSession"("tokenFamilyId");
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

## Clean PostgreSQL Test

baseline → UserSession migration: **PASS**

Applied via `psql -f migration.sql` against `maintainex_test` database.
Table created, indexes created, foreign key created.

## Existing PostgreSQL Simulation

existing schema/data → UserSession migration: **PASS**

Verified:
- User records: unchanged
- AdminUser records: unchanged
- AdminSession records: unchanged
- CompanyProfile records: unchanged
- PlatformSettings records: unchanged

No destructive migration. Existing data intact.

## Schema Validation

- `prisma validate`: PASS
- `prisma generate`: PASS

## Rollback

To rollback, run:
```sql
DROP TABLE "UserSession";
```

No other tables depend on UserSession.
