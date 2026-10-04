-- Provider post-payout chargeback / dispute-loss adjustments.
-- Additive only: existing commission receivables and wallet balances are unchanged.

ALTER TABLE "ProviderFinancialAccount"
  ADD COLUMN "adjustmentDue" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "oldestAdjustmentDueAt" TIMESTAMP(3);

CREATE TABLE "ProviderBalanceAdjustment" (
  "id" TEXT NOT NULL,
  "providerIdentityId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "escrowId" TEXT NOT NULL,
  "paymentIntentId" TEXT,
  "adjustmentType" TEXT NOT NULL,
  "sourceProvider" TEXT NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "amountOriginal" BIGINT NOT NULL,
  "amountRemaining" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3) NOT NULL,
  "settledAt" TIMESTAMP(3),
  "reason" TEXT,
  "metadata" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderBalanceAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderBalanceAdjustmentRecovery" (
  "id" TEXT NOT NULL,
  "adjustmentId" TEXT NOT NULL,
  "providerIdentityId" TEXT NOT NULL,
  "sourceJobId" TEXT,
  "sourceEscrowId" TEXT,
  "amount" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderBalanceAdjustmentRecovery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderBalanceAdjustment_idempotencyKey_key"
  ON "ProviderBalanceAdjustment"("idempotencyKey");
CREATE UNIQUE INDEX "ProviderBalanceAdjustment_sourceProvider_sourceReference_adjustmentType_key"
  ON "ProviderBalanceAdjustment"("sourceProvider", "sourceReference", "adjustmentType");
CREATE INDEX "ProviderBalanceAdjustment_providerIdentityId_currency_status_dueAt_idx"
  ON "ProviderBalanceAdjustment"("providerIdentityId", "currency", "status", "dueAt");
CREATE INDEX "ProviderBalanceAdjustment_jobId_idx"
  ON "ProviderBalanceAdjustment"("jobId");
CREATE INDEX "ProviderBalanceAdjustment_escrowId_idx"
  ON "ProviderBalanceAdjustment"("escrowId");
CREATE INDEX "ProviderBalanceAdjustment_paymentIntentId_idx"
  ON "ProviderBalanceAdjustment"("paymentIntentId");

CREATE UNIQUE INDEX "ProviderBalanceAdjustmentRecovery_idempotencyKey_key"
  ON "ProviderBalanceAdjustmentRecovery"("idempotencyKey");
CREATE INDEX "ProviderBalanceAdjustmentRecovery_providerIdentityId_createdAt_idx"
  ON "ProviderBalanceAdjustmentRecovery"("providerIdentityId", "createdAt");
CREATE INDEX "ProviderBalanceAdjustmentRecovery_adjustmentId_idx"
  ON "ProviderBalanceAdjustmentRecovery"("adjustmentId");
CREATE INDEX "ProviderBalanceAdjustmentRecovery_sourceEscrowId_idx"
  ON "ProviderBalanceAdjustmentRecovery"("sourceEscrowId");

CREATE INDEX "ProviderFinancialAccount_adjustmentDue_idx"
  ON "ProviderFinancialAccount"("adjustmentDue");

ALTER TABLE "ProviderBalanceAdjustment"
  ADD CONSTRAINT "ProviderBalanceAdjustment_providerIdentityId_fkey"
  FOREIGN KEY ("providerIdentityId") REFERENCES "ProviderIdentity"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProviderBalanceAdjustmentRecovery"
  ADD CONSTRAINT "ProviderBalanceAdjustmentRecovery_adjustmentId_fkey"
  FOREIGN KEY ("adjustmentId") REFERENCES "ProviderBalanceAdjustment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProviderBalanceAdjustmentRecovery"
  ADD CONSTRAINT "ProviderBalanceAdjustmentRecovery_providerIdentityId_fkey"
  FOREIGN KEY ("providerIdentityId") REFERENCES "ProviderIdentity"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
