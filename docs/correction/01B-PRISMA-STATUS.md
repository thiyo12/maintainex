# Phase 1B — Prisma Status

## Phase 0 vs Phase 1 Discrepancy

Phase 0 reported:
- `npx prisma validate` → PASS
- `npx prisma generate` → PASS

Phase 1B reports:
- `npx prisma validate` → FAIL
- `npx prisma generate` → FAIL

## Root Cause

The local `prisma/schema.prisma` has `provider = "sqlite"`. The schema contains:

```prisma
model OTP {
  metadata Json?  // Line 99
}
```

SQLite does not support `Json` type. When Prisma validates locally (without the Docker `sed` swap), it fails.

## Why Phase 0 Passed

Phase 0 likely ran against the schema after the Docker `sed` swap (which changes `provider = "sqlite"` to `provider = "postgresql"`). Or Phase 0 ran on the VPS where PostgreSQL is the provider.

## Why Phase 1B Fails

Phase 1B runs locally where `provider = "sqlite"` is the committed state. The `Json` type is invalid for SQLite.

## Is This Caused by Phase 1?

**NO.** Phase 1 did not modify `prisma/schema.prisma`. The `metadata Json?` field on OTP was added in a previous commit (referenced as pending in Phase 0: "Prisma schema push needed for OTP metadata field").

## Production Impact

Production uses Docker with `sed` swap to PostgreSQL. The `Json` type works on PostgreSQL. This is a local-only validation issue.

## Recommendation

Mark for Phase 2: Standardize on PostgreSQL for local development.
