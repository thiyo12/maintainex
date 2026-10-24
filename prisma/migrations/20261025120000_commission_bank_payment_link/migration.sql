ALTER TABLE "CommissionBankReconciliation"
  ADD COLUMN "commissionPaymentId" TEXT;

ALTER TABLE "CommissionBankReconciliation"
  ADD CONSTRAINT "CommissionBankReconciliation_commissionPayment_fkey"
  FOREIGN KEY ("commissionPaymentId") REFERENCES "CommissionPayment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CommissionBankReconciliation_commissionPaymentId_status_createdAt_idx"
  ON "CommissionBankReconciliation"("commissionPaymentId", "status", "createdAt");
