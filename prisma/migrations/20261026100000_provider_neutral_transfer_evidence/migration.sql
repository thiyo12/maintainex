CREATE TABLE "FinancialTransferEvidence" (
    "id" TEXT NOT NULL,
    "transferType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "externalReference" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "verificationMethod" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialTransferEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FinancialTransferEvidence_type_check"
      CHECK ("transferType" IN ('REFUND', 'PAYOUT')),
    CONSTRAINT "FinancialTransferEvidence_outcome_check"
      CHECK ("outcome" IN ('PENDING', 'SUCCEEDED', 'FAILED', 'REVERSED')),
    CONSTRAINT "FinancialTransferEvidence_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "FinancialTransferEvidence_ids_check"
      CHECK (length("targetId") BETWEEN 1 AND 200 AND length("sourceId") BETWEEN 1 AND 100 AND "sourceId" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'),
    CONSTRAINT "FinancialTransferEvidence_event_reference_check"
      CHECK (length("externalEventId") BETWEEN 1 AND 200 AND length("externalReference") BETWEEN 1 AND 200),
    CONSTRAINT "FinancialTransferEvidence_payload_hash_check"
      CHECK ("payloadHash" ~ '^[a-f0-9]{64}$'),
    CONSTRAINT "FinancialTransferEvidence_currency_check"
      CHECK ("currency" IN ('LKR', 'CAD')),
    CONSTRAINT "FinancialTransferEvidence_country_currency_check"
      CHECK (("countryCode" = 'LK' AND "currency" = 'LKR') OR
             ("countryCode" = 'CA' AND "currency" = 'CAD')),
    CONSTRAINT "FinancialTransferEvidence_verification_method_check"
      CHECK ("verificationMethod" IN ('INDEPENDENT_API_QUERY', 'AUTHENTICATED_STATEMENT'))
);

CREATE UNIQUE INDEX "FinancialTransferEvidence_sourceId_externalEventId_key"
  ON "FinancialTransferEvidence"("sourceId", "externalEventId");
CREATE INDEX "FinancialTransferEvidence_transferType_targetId_createdAt_idx"
  ON "FinancialTransferEvidence"("transferType", "targetId", "createdAt");
CREATE INDEX "financial_transfer_evidence_market_currency_status_idx"
  ON "FinancialTransferEvidence"("countryCode", "currency", "outcome", "createdAt");

CREATE UNIQUE INDEX "PaymentProviderRefund_approvalRequestId_key"
  ON "PaymentProviderRefund"("approvalRequestId");

-- Evidence rows are append-only audit records. Corrections arrive as new events.
CREATE FUNCTION maintainex_financial_transfer_evidence_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Financial transfer evidence is immutable';
END;
$$;

CREATE TRIGGER "FinancialTransferEvidence_immutable"
  BEFORE UPDATE OR DELETE ON "FinancialTransferEvidence"
  FOR EACH ROW EXECUTE FUNCTION maintainex_financial_transfer_evidence_immutable();
