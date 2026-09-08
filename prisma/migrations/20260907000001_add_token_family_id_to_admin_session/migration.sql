-- AlterTable: Add tokenFamilyId to AdminSession
ALTER TABLE "AdminSession" ADD COLUMN "tokenFamilyId" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "AdminSession_tokenFamilyId_idx" ON "AdminSession"("tokenFamilyId");
