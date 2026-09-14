-- Phase 10.4 Final Correction: Restore global idempotencyKey uniqueness
-- and remove empty-string userId default.

-- Step 1: Drop the compound unique index that weakened the invariant
DROP INDEX IF EXISTS "IdempotencyRecord_idempotencyKey_userId_operation_key";

-- Step 2: Backfill empty-string userId to NULL (old callers had no actor)
UPDATE "IdempotencyRecord" SET "userId" = NULL WHERE "userId" = '';

-- Step 3: Restore global unique constraint on idempotencyKey
CREATE UNIQUE INDEX "IdempotencyRecord_idempotencyKey_key" ON "IdempotencyRecord"("idempotencyKey");

-- Step 4: Make userId nullable (drop NOT NULL)
ALTER TABLE "IdempotencyRecord" ALTER COLUMN "userId" DROP NOT NULL;

-- Step 5: Add request fingerprint column for conflict detection
ALTER TABLE "IdempotencyRecord" ADD COLUMN "requestFingerprint" TEXT;
