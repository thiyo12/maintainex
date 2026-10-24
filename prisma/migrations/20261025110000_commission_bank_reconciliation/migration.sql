CREATE TABLE "CommissionBankStatementImport" (
  "id" TEXT NOT NULL,
  "sourceSystem" TEXT NOT NULL,
  "statementId" TEXT NOT NULL,
  "accountRef" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "contentSha256" TEXT NOT NULL,
  "provenanceType" TEXT NOT NULL,
  "provenanceStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "verificationSource" TEXT,
  "verificationRef" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "importedByAdminId" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionBankStatementImport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionBankStatementImport_rowCount_check" CHECK ("rowCount" BETWEEN 1 AND 10000),
  CONSTRAINT "CommissionBankStatementImport_hash_check" CHECK ("contentSha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "CommissionBankStatementImport_provenance_check" CHECK ("provenanceStatus" IN ('UNVERIFIED','VERIFIED','REJECTED')),
  CONSTRAINT "CommissionBankStatementImport_verified_evidence_check" CHECK (
    "provenanceStatus" <> 'VERIFIED' OR
    ("verificationSource" IS NOT NULL AND "verificationRef" IS NOT NULL AND "verifiedAt" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "CommissionBankStatementImport_sourceSystem_statementId_key" ON "CommissionBankStatementImport"("sourceSystem", "statementId");
CREATE UNIQUE INDEX "CommissionBankStatementImport_sourceSystem_contentSha256_key" ON "CommissionBankStatementImport"("sourceSystem", "contentSha256");
CREATE INDEX "CommissionBankStatementImport_countryCode_provenanceStatus_createdAt_idx" ON "CommissionBankStatementImport"("countryCode", "provenanceStatus", "createdAt");

CREATE TABLE "CommissionBankStatementEvent" (
  "id" TEXT NOT NULL,
  "statementImportId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "evidenceHash" TEXT,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionBankStatementEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionBankStatementEvent_statement_fkey" FOREIGN KEY ("statementImportId") REFERENCES "CommissionBankStatementImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CommissionBankStatementEvent_statementImportId_createdAt_idx" ON "CommissionBankStatementEvent"("statementImportId", "createdAt");

CREATE TABLE "CommissionBankTransaction" (
  "id" TEXT NOT NULL,
  "statementImportId" TEXT NOT NULL,
  "sourceSystem" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "bankAccountRef" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "reversalOfTransactionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'UNREVIEWED',
  "mismatchCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionBankTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionBankTransaction_import_fkey" FOREIGN KEY ("statementImportId") REFERENCES "CommissionBankStatementImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommissionBankTransaction_amount_check" CHECK ("amountMinor" > 0),
  CONSTRAINT "CommissionBankTransaction_direction_check" CHECK ("direction" IN ('CREDIT','DEBIT'))
);
CREATE UNIQUE INDEX "CommissionBankTransaction_sourceSystem_bankAccountRef_transactionId_key" ON "CommissionBankTransaction"("sourceSystem", "bankAccountRef", "transactionId");
CREATE INDEX "CommissionBankTransaction_countryCode_status_createdAt_idx" ON "CommissionBankTransaction"("countryCode", "status", "createdAt");
CREATE INDEX "CommissionBankTransaction_reference_bankAccountRef_idx" ON "CommissionBankTransaction"("reference", "bankAccountRef");
CREATE INDEX "CommissionBankTransaction_reversalOfTransactionId_idx" ON "CommissionBankTransaction"("reversalOfTransactionId");

CREATE TABLE "CommissionBankReconciliation" (
  "id" TEXT NOT NULL,
  "bankTransactionId" TEXT NOT NULL,
  "providerIdentityId" TEXT NOT NULL,
  "approvalRequestId" TEXT,
  "initiatedByAdminId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "totalAmountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionBankReconciliation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionBankReconciliation_transaction_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "CommissionBankTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommissionBankReconciliation_amount_check" CHECK ("totalAmountMinor" > 0)
);
CREATE UNIQUE INDEX "CommissionBankReconciliation_bankTransactionId_key" ON "CommissionBankReconciliation"("bankTransactionId");
CREATE UNIQUE INDEX "CommissionBankReconciliation_approvalRequestId_key" ON "CommissionBankReconciliation"("approvalRequestId");
CREATE INDEX "CommissionBankReconciliation_providerIdentityId_status_createdAt_idx" ON "CommissionBankReconciliation"("providerIdentityId", "status", "createdAt");
CREATE INDEX "CommissionBankReconciliation_countryCode_status_createdAt_idx" ON "CommissionBankReconciliation"("countryCode", "status", "createdAt");

CREATE TABLE "CommissionBankAllocation" (
  "id" TEXT NOT NULL,
  "reconciliationId" TEXT NOT NULL,
  "receivableId" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionBankAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionBankAllocation_reconciliation_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "CommissionBankReconciliation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommissionBankAllocation_receivable_fkey" FOREIGN KEY ("receivableId") REFERENCES "ProviderCommissionReceivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommissionBankAllocation_amount_check" CHECK ("amountMinor" > 0)
);
CREATE UNIQUE INDEX "CommissionBankAllocation_reconciliationId_receivableId_key" ON "CommissionBankAllocation"("reconciliationId", "receivableId");
CREATE INDEX "CommissionBankAllocation_receivableId_createdAt_idx" ON "CommissionBankAllocation"("receivableId", "createdAt");

CREATE TABLE "CommissionBankReconciliationEvent" (
  "id" TEXT NOT NULL,
  "reconciliationId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorAdminId" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionBankReconciliationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionBankReconciliationEvent_reconciliation_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "CommissionBankReconciliation"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CommissionBankReconciliationEvent_reconciliationId_createdAt_idx" ON "CommissionBankReconciliationEvent"("reconciliationId", "createdAt");

CREATE OR REPLACE FUNCTION reject_immutable_commission_finance_row()
RETURNS TRIGGER AS $commission_immutable$
BEGIN
  RAISE EXCEPTION 'Commission bank audit and allocation rows are append-only';
END;
$commission_immutable$ LANGUAGE plpgsql;
CREATE TRIGGER trg_commission_bank_allocation_append_only
  BEFORE UPDATE OR DELETE ON "CommissionBankAllocation"
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_commission_finance_row();
CREATE TRIGGER trg_commission_bank_event_append_only
  BEFORE UPDATE OR DELETE ON "CommissionBankReconciliationEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_commission_finance_row();
CREATE TRIGGER trg_commission_bank_statement_event_append_only
  BEFORE UPDATE OR DELETE ON "CommissionBankStatementEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_commission_finance_row();
