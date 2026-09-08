-- AlterTable: Add new columns to Session table (was UserSession in intermediate design)
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "refreshTokenHash" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "tokenFamilyId" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "revokeReason" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_tokenFamilyId_idx" ON "Session"("tokenFamilyId");
