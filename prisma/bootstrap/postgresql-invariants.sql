-- PostgreSQL invariants that cannot be represented in prisma/schema.prisma.
-- Keep this file synchronized with the matching Prisma migrations and CI
-- bootstrap. It is applied only to a verified empty database.

ALTER TABLE "ProviderOpportunity"
  DROP CONSTRAINT IF EXISTS "ProviderOpportunity_xor_provider";
ALTER TABLE "ProviderOpportunity"
  ADD CONSTRAINT "ProviderOpportunity_xor_provider"
  CHECK (
    ("taskerId" IS NOT NULL AND "companyId" IS NULL)
    OR
    ("taskerId" IS NULL AND "companyId" IS NOT NULL)
  );

CREATE UNIQUE INDEX "JobVerificationPin_one_active_per_job"
  ON "JobVerificationPin"("jobId") WHERE "status" = 'ACTIVE';

CREATE OR REPLACE FUNCTION check_job_review_owner()
RETURNS TRIGGER AS $review_owner$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "MarketplaceJob"
    WHERE id = NEW."jobId" AND "customerId" = NEW."customerId"
  ) THEN
    RAISE EXCEPTION 'Customer does not own this job';
  END IF;
  RETURN NEW;
END;
$review_owner$ LANGUAGE plpgsql;

CREATE TRIGGER trg_job_review_owner_check
  BEFORE INSERT ON "JobReview"
  FOR EACH ROW EXECUTE FUNCTION check_job_review_owner();

CREATE UNIQUE INDEX "CompanyJobAssignment_active_per_job_idx"
  ON "CompanyJobAssignment"("jobId")
  WHERE "status" IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS');

ALTER TABLE "CompanyCrewPinChallenge"
  ADD CONSTRAINT "CompanyCrewPinChallenge_epoch_check"
    CHECK ("crewVersion" >= 1 AND "challengeVersion" >= 1),
  ADD CONSTRAINT "CompanyCrewPinChallenge_purpose_check"
    CHECK ("purpose" IN ('ARRIVAL', 'WORK_START')),
  ADD CONSTRAINT "CompanyCrewPinChallenge_attempt_check"
    CHECK ("failedAttempts" BETWEEN 0 AND 5),
  ADD CONSTRAINT "CompanyCrewPinChallenge_digest_check"
    CHECK ("pinDigest" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "CompanyCrewPinChallenge_expiry_check"
    CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT "CompanyCrewPinChallenge_terminal_check"
    CHECK ("consumedAt" IS NULL OR "revokedAt" IS NULL);

CREATE UNIQUE INDEX "CrewPinChallenge_one_live_idx"
  ON "CompanyCrewPinChallenge"
    ("crewDispatchId", "crewVersion", "assignmentId", "purpose")
  WHERE "consumedAt" IS NULL AND "revokedAt" IS NULL;

ALTER TABLE "CompanyCrewPresenceWitness"
  ADD CONSTRAINT "CrewPresenceWitness_positive_epoch_check"
    CHECK ("crewVersion" >= 1),
  ADD CONSTRAINT "CrewPresenceWitness_nonempty_check"
    CHECK ("workerAttestedAt" IS NOT NULL OR "customerAttestedAt" IS NOT NULL);

CREATE UNIQUE INDEX "JobQuote_one_pending_per_provider_job"
  ON "JobQuote"("jobId", "providerId") WHERE status = 'PENDING';

CREATE UNIQUE INDEX "PaymentIntent_one_active_per_job"
  ON "PaymentIntent"("jobId") WHERE status IN ('CREATED', 'PENDING');

ALTER TABLE "CommissionBankStatementImport"
  ADD CONSTRAINT "CommissionBankStatementImport_rowCount_check"
    CHECK ("rowCount" BETWEEN 1 AND 10000),
  ADD CONSTRAINT "CommissionBankStatementImport_hash_check"
    CHECK ("contentSha256" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "CommissionBankStatementImport_provenance_check"
    CHECK ("provenanceStatus" IN ('UNVERIFIED','VERIFIED','REJECTED')),
  ADD CONSTRAINT "CommissionBankStatementImport_verified_evidence_check"
    CHECK ("provenanceStatus" <> 'VERIFIED' OR ("verificationSource" IS NOT NULL AND "verificationRef" IS NOT NULL AND "verifiedAt" IS NOT NULL));

ALTER TABLE "CommissionBankTransaction"
  ADD CONSTRAINT "CommissionBankTransaction_amount_check" CHECK ("amountMinor" > 0),
  ADD CONSTRAINT "CommissionBankTransaction_direction_check" CHECK ("direction" IN ('CREDIT','DEBIT'));

ALTER TABLE "CommissionBankReconciliation"
  ADD CONSTRAINT "CommissionBankReconciliation_amount_check" CHECK ("totalAmountMinor" > 0);

ALTER TABLE "CommissionBankAllocation"
  ADD CONSTRAINT "CommissionBankAllocation_amount_check" CHECK ("amountMinor" > 0);

ALTER TABLE "CommissionBankReversal"
  ADD CONSTRAINT "CommissionBankReversal_amount_check" CHECK ("amountMinor" > 0),
  ADD CONSTRAINT "CommissionBankReversal_status_check" CHECK ("status" IN ('PENDING_REVIEW','POSTED','REJECTED'));

ALTER TABLE "CommissionBankReversalAllocation"
  ADD CONSTRAINT "CommissionBankReversalAllocation_amount_check" CHECK ("amountMinor" > 0);

CREATE OR REPLACE FUNCTION reject_immutable_commission_finance_row()
RETURNS TRIGGER AS $commission_immutable$
BEGIN
  RAISE EXCEPTION 'Commission bank audit and allocation rows are append-only';
END;
$commission_immutable$ LANGUAGE plpgsql;

ALTER TABLE "ProviderCommissionReceivable"
  ADD CONSTRAINT "ProviderCommissionReceivable_amountWaived_check"
  CHECK ("amountWaived" >= 0 AND "amountWaived" <= "amountOriginal");

ALTER TABLE "MarketplaceDisputeEvidence"
  ADD CONSTRAINT "MarketplaceDisputeEvidence_participant_check"
    CHECK ("participantType" IN ('CUSTOMER','PROVIDER','COMPANY')),
  ADD CONSTRAINT "MarketplaceDisputeEvidence_text_check"
    CHECK (length("description") BETWEEN 1 AND 4000);

ALTER TABLE "MarketplaceDisputeCorrection"
  ADD CONSTRAINT "MarketplaceDisputeCorrection_amount_check" CHECK ("amountMinor" > 0),
  ADD CONSTRAINT "MarketplaceDisputeCorrection_status_check" CHECK ("status" = 'APPLIED');

ALTER TABLE "FinancialTransferEvidence"
  ADD CONSTRAINT "FinancialTransferEvidence_type_check"
    CHECK ("transferType" IN ('REFUND','PAYOUT')),
  ADD CONSTRAINT "FinancialTransferEvidence_outcome_check"
    CHECK ("outcome" IN ('PENDING','SUCCEEDED','FAILED','REVERSED')),
  ADD CONSTRAINT "FinancialTransferEvidence_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "FinancialTransferEvidence_ids_check"
    CHECK (length("targetId") BETWEEN 1 AND 200 AND length("sourceId") BETWEEN 1 AND 100 AND "sourceId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'),
  ADD CONSTRAINT "FinancialTransferEvidence_event_reference_check"
    CHECK (length("externalEventId") BETWEEN 1 AND 200 AND length("externalReference") BETWEEN 1 AND 200),
  ADD CONSTRAINT "FinancialTransferEvidence_payload_hash_check"
    CHECK ("payloadHash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "FinancialTransferEvidence_currency_check"
    CHECK ("currency" IN ('LKR','CAD')),
  ADD CONSTRAINT "FinancialTransferEvidence_country_currency_check"
    CHECK (("countryCode" = 'LK' AND "currency" = 'LKR') OR
           ("countryCode" = 'CA' AND "currency" = 'CAD')),
  ADD CONSTRAINT "FinancialTransferEvidence_verification_method_check"
    CHECK ("verificationMethod" IN ('INDEPENDENT_API_QUERY','AUTHENTICATED_STATEMENT'));

CREATE TRIGGER trg_commission_bank_allocation_append_only
  BEFORE UPDATE OR DELETE ON "CommissionBankAllocation"
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_commission_finance_row();

CREATE TRIGGER trg_commission_bank_event_append_only
  BEFORE UPDATE OR DELETE ON "CommissionBankReconciliationEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_commission_finance_row();

CREATE TRIGGER trg_commission_bank_statement_event_append_only
  BEFORE UPDATE OR DELETE ON "CommissionBankStatementEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_commission_finance_row();

CREATE TRIGGER trg_commission_bank_reversal_allocation_append_only
  BEFORE UPDATE OR DELETE ON "CommissionBankReversalAllocation"
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_commission_finance_row();

CREATE TRIGGER trg_commission_bank_reversal_event_append_only
  BEFORE UPDATE OR DELETE ON "CommissionBankReversalEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_commission_finance_row();

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

CREATE OR REPLACE FUNCTION reject_immutable_financial_transfer_evidence()
RETURNS TRIGGER AS $transfer_evidence_immutable$
BEGIN
  RAISE EXCEPTION 'Financial transfer evidence is immutable';
END;
$transfer_evidence_immutable$ LANGUAGE plpgsql;

CREATE TRIGGER "FinancialTransferEvidence_immutable"
  BEFORE UPDATE OR DELETE ON "FinancialTransferEvidence"
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_financial_transfer_evidence();
