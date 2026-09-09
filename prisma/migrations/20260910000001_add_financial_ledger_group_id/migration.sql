-- AddGroupIdToFinancialLedger
ALTER TABLE "FinancialLedger" ADD COLUMN "groupId" TEXT;
CREATE INDEX "FinancialLedger_groupId_idx" ON "FinancialLedger"("groupId");
