-- Additive, append-only commission bank reversal workflow. Existing postings
-- are never mutated or deleted; reversals reference the original transaction,
-- reconciliation, recovery and allocation records.
CREATE TABLE "CommissionBankReversal" (
  "id" TEXT NOT NULL,
  "bankTransactionId" TEXT NOT NULL,
  "originalBankTransactionId" TEXT NOT NULL,
  "originalReconciliationId" TEXT NOT NULL,
  "providerIdentityId" TEXT NOT NULL,
  "initiatedByAdminId" TEXT NOT NULL,
  "approvalRequestId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionBankReversal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionBankReversal_transaction_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "CommissionBankTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommissionBankReversal_original_transaction_fkey" FOREIGN KEY ("originalBankTransactionId") REFERENCES "CommissionBankTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommissionBankReversal_reconciliation_fkey" FOREIGN KEY ("originalReconciliationId") REFERENCES "CommissionBankReconciliation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommissionBankReversal_identity_fkey" FOREIGN KEY ("providerIdentityId") REFERENCES "ProviderIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommissionBankReversal_amount_check" CHECK ("amountMinor" > 0),
  CONSTRAINT "CommissionBankReversal_status_check" CHECK ("status" IN ('PENDING_REVIEW','POSTED','REJECTED'))
);
CREATE UNIQUE INDEX "CommissionBankReversal_bankTransactionId_key" ON "CommissionBankReversal"("bankTransactionId");
CREATE UNIQUE INDEX "CommissionBankReversal_approvalRequestId_key" ON "CommissionBankReversal"("approvalRequestId");
CREATE INDEX "CommissionBankReversal_originalReconciliationId_status_createdAt_idx" ON "CommissionBankReversal"("originalReconciliationId","status","createdAt");
CREATE INDEX "CommissionBankReversal_providerIdentityId_countryCode_status_idx" ON "CommissionBankReversal"("providerIdentityId","countryCode","status");

CREATE TABLE "CommissionBankReversalAllocation" (
  "id" TEXT NOT NULL,
  "reversalId" TEXT NOT NULL,
  "originalAllocationId" TEXT NOT NULL,
  "recoveryId" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionBankReversalAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionBankReversalAllocation_reversal_fkey" FOREIGN KEY ("reversalId") REFERENCES "CommissionBankReversal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommissionBankReversalAllocation_original_allocation_fkey" FOREIGN KEY ("originalAllocationId") REFERENCES "CommissionBankAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommissionBankReversalAllocation_recovery_fkey" FOREIGN KEY ("recoveryId") REFERENCES "ProviderCommissionRecovery"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommissionBankReversalAllocation_amount_check" CHECK ("amountMinor" > 0)
);
CREATE UNIQUE INDEX "CommissionBankReversalAllocation_reversalId_originalAllocationId_key" ON "CommissionBankReversalAllocation"("reversalId","originalAllocationId");
CREATE INDEX "CommissionBankReversalAllocation_originalAllocationId_idx" ON "CommissionBankReversalAllocation"("originalAllocationId");
CREATE INDEX "CommissionBankReversalAllocation_recoveryId_idx" ON "CommissionBankReversalAllocation"("recoveryId");

CREATE TABLE "CommissionBankReversalEvent" (
  "id" TEXT NOT NULL,
  "reversalId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorAdminId" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionBankReversalEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionBankReversalEvent_reversal_fkey" FOREIGN KEY ("reversalId") REFERENCES "CommissionBankReversal"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CommissionBankReversalEvent_reversalId_createdAt_idx" ON "CommissionBankReversalEvent"("reversalId","createdAt");

CREATE TRIGGER trg_commission_bank_reversal_allocation_append_only
  BEFORE UPDATE OR DELETE ON "CommissionBankReversalAllocation"
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_commission_finance_row();
CREATE TRIGGER trg_commission_bank_reversal_event_append_only
  BEFORE UPDATE OR DELETE ON "CommissionBankReversalEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_commission_finance_row();
