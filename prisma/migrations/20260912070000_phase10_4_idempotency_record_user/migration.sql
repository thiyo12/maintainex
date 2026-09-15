-- DropExistingUniqueIndex:IdempotencyRecord.idempotencyKey
ALTER TABLE "IdempotencyRecord" DROP CONSTRAINT IF EXISTS "IdempotencyRecord_idempotencyKey_key";
DROP INDEX IF EXISTS "IdempotencyRecord_idempotencyKey_key";

-- AlterTable: Add userId column with default
ALTER TABLE "IdempotencyRecord" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';

-- CreateIndex: Compound unique constraint on (idempotencyKey, userId, operation)
CREATE UNIQUE INDEX "IdempotencyRecord_idempotencyKey_userId_operation_key" ON "IdempotencyRecord"("idempotencyKey", "userId", "operation");

-- CreateIndex: Standalone index on idempotencyKey (replaces the old unique index)
CREATE INDEX "IdempotencyRecord_idempotencyKey_idx" ON "IdempotencyRecord"("idempotencyKey");

-- CreateIndex: Lookup index on (userId, operation)
CREATE INDEX "IdempotencyRecord_userId_operation_idx" ON "IdempotencyRecord"("userId", "operation");
