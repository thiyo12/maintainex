-- Additive dispute evidence and governed commission correction history.
ALTER TABLE "ProviderCommissionReceivable"
  ADD COLUMN "amountWaived" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "ProviderCommissionReceivable"
  ADD CONSTRAINT "ProviderCommissionReceivable_amountWaived_check"
  CHECK ("amountWaived" >= 0 AND "amountWaived" <= "amountOriginal");

CREATE TABLE "MarketplaceDisputeEvidence" (
  "id" TEXT NOT NULL,
  "disputeId" TEXT NOT NULL,
  "submittedById" TEXT NOT NULL,
  "participantType" TEXT NOT NULL,
  "evidenceType" TEXT NOT NULL DEFAULT 'NOTE',
  "description" TEXT NOT NULL,
  "contentSha256" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceDisputeEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceDisputeEvidence_dispute_fkey" FOREIGN KEY ("disputeId") REFERENCES "MarketplaceDispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceDisputeEvidence_participant_check" CHECK ("participantType" IN ('CUSTOMER','PROVIDER','COMPANY')),
  CONSTRAINT "MarketplaceDisputeEvidence_text_check" CHECK (length("description") BETWEEN 1 AND 4000)
);
CREATE UNIQUE INDEX "MarketplaceDisputeEvidence_disputeId_submittedById_idempotencyKey_key" ON "MarketplaceDisputeEvidence"("disputeId","submittedById","idempotencyKey");
CREATE INDEX "MarketplaceDisputeEvidence_disputeId_createdAt_idx" ON "MarketplaceDisputeEvidence"("disputeId","createdAt");
CREATE INDEX "MarketplaceDisputeEvidence_submittedById_createdAt_idx" ON "MarketplaceDisputeEvidence"("submittedById","createdAt");

CREATE TABLE "MarketplaceDisputeEvidenceEvent" (
  "id" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceDisputeEvidenceEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceDisputeEvidenceEvent_evidence_fkey" FOREIGN KEY ("evidenceId") REFERENCES "MarketplaceDisputeEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "MarketplaceDisputeEvidenceEvent_evidenceId_createdAt_idx" ON "MarketplaceDisputeEvidenceEvent"("evidenceId","createdAt");

CREATE TABLE "MarketplaceDisputeCorrection" (
  "id" TEXT NOT NULL,
  "disputeId" TEXT NOT NULL,
  "receivableId" TEXT NOT NULL,
  "approvalRequestId" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'APPLIED',
  "appliedByAdminId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceDisputeCorrection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceDisputeCorrection_dispute_fkey" FOREIGN KEY ("disputeId") REFERENCES "MarketplaceDispute"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceDisputeCorrection_receivable_fkey" FOREIGN KEY ("receivableId") REFERENCES "ProviderCommissionReceivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceDisputeCorrection_approval_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "CrmApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceDisputeCorrection_amount_check" CHECK ("amountMinor" > 0),
  CONSTRAINT "MarketplaceDisputeCorrection_status_check" CHECK ("status" = 'APPLIED')
);
CREATE UNIQUE INDEX "MarketplaceDisputeCorrection_approvalRequestId_key" ON "MarketplaceDisputeCorrection"("approvalRequestId");
CREATE INDEX "MarketplaceDisputeCorrection_disputeId_createdAt_idx" ON "MarketplaceDisputeCorrection"("disputeId","createdAt");
CREATE INDEX "MarketplaceDisputeCorrection_receivableId_createdAt_idx" ON "MarketplaceDisputeCorrection"("receivableId","createdAt");

CREATE TABLE "MarketplaceDisputeCorrectionEvent" (
  "id" TEXT NOT NULL,
  "correctionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorAdminId" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceDisputeCorrectionEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceDisputeCorrectionEvent_correction_fkey" FOREIGN KEY ("correctionId") REFERENCES "MarketplaceDisputeCorrection"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "MarketplaceDisputeCorrectionEvent_correctionId_createdAt_idx" ON "MarketplaceDisputeCorrectionEvent"("correctionId","createdAt");

CREATE TRIGGER trg_marketplace_dispute_evidence_immutable
  BEFORE UPDATE OR DELETE ON "MarketplaceDisputeEvidence"
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_commission_finance_row();
CREATE TRIGGER trg_marketplace_dispute_evidence_event_immutable
  BEFORE UPDATE OR DELETE ON "MarketplaceDisputeEvidenceEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_commission_finance_row();
CREATE TRIGGER trg_marketplace_dispute_correction_immutable
  BEFORE UPDATE OR DELETE ON "MarketplaceDisputeCorrection"
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_commission_finance_row();
CREATE TRIGGER trg_marketplace_dispute_correction_event_immutable
  BEFORE UPDATE OR DELETE ON "MarketplaceDisputeCorrectionEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_commission_finance_row();
