# MaintainEX SQL Compatibility Audit

## SQLite-Specific Code Found

| File | Line | Syntax | Status | Action |
|---|---|---|---|---|
| `app/api/cron/pricing-train/route.ts:56` | `datetime('now')` | FIXED | Changed to `NOW()` with quoted identifiers | Done |
| `lib/security/tokens.ts` | `INSERT/SELECT/UPDATE/DELETE` | FIXED | Added double-quoted table/column names | Done |
| `app/api/security/suspicious/route.ts` | `$queryRaw` | SAFE | Already uses double-quoted identifiers | None |
| `app/api/industries/init/route.ts` | `NOW()`, `ON CONFLICT` | SAFE | PostgreSQL-compatible | None |
| `app/api/health/route.ts` | `SELECT 1` | SAFE | Universal SQL | None |

## PostgreSQL Compatibility Notes

### Timestamp Handling
- `TIMESTAMP(3)` — Used throughout migrations. Compatible with PostgreSQL (Prisma convention).
- `now()` — Prisma's `@default(now())` maps to `CURRENT_TIMESTAMP` in both SQLite and PostgreSQL.
- `@updatedAt` — Prisma handles this at ORM level, not SQL level.

### Boolean Handling
- `BOOLEAN` with `DEFAULT true/false` — Compatible with both providers.

### Array Handling
- `TEXT[]` columns in `ApiKey.permissions`, `CompanyProfile.services`, `TeamMember.skills`, etc.
- SQLite stores these as JSON strings; PostgreSQL uses native arrays. Prisma handles the translation.

### Raw SQL Queries
- All `$executeRaw` and `$queryRaw` calls now use PostgreSQL-compatible syntax.
- Double-quoted identifiers (`"TableName"`, `"columnName"`) are required for PostgreSQL case sensitivity.

### Table Name Case Sensitivity
- PostgreSQL folds unquoted identifiers to lowercase.
- Prisma creates tables with double-quoted model names, preserving case.
- All raw SQL now uses double-quoted identifiers to match.
