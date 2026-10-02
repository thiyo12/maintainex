-- Payment-provider control plane for international marketplace payments.
-- This migration stores operational metadata only. Provider credentials remain in
-- server environment variables and are never persisted in these tables.

CREATE TABLE "PaymentProviderConfig" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "environment" TEXT NOT NULL DEFAULT 'SANDBOX',
    "supportedCurrencies" TEXT NOT NULL DEFAULT '[]',
    "paymentMethods" TEXT NOT NULL DEFAULT '[]',
    "capabilities" TEXT NOT NULL DEFAULT '{}',
    "captureMode" TEXT NOT NULL DEFAULT 'CAPTURE',
    "operationalStatus" TEXT NOT NULL DEFAULT 'DISABLED',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "commissionRateBps" INTEGER,
    "refundPolicy" TEXT,
    "settlementConfig" TEXT,
    "feeConfig" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentProviderConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentProviderTransaction" (
    "id" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "providerAuthorizationId" TEXT,
    "providerCaptureId" TEXT,
    "status" TEXT NOT NULL,
    "grossAmount" BIGINT NOT NULL,
    "providerFee" BIGINT,
    "netSettlement" BIGINT,
    "currency" TEXT NOT NULL,
    "reconciliationStatus" TEXT NOT NULL DEFAULT 'UNRECONCILED',
    "reconciliationReference" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentProviderTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentProviderRefund" (
    "id" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "countryCode" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRefundId" TEXT,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "initiatedByAdminId" TEXT,
    "approvalRequestId" TEXT,
    "completedAt" TIMESTAMP(3),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentProviderRefund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentProviderEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "providerTransactionId" TEXT,
    "countryCode" TEXT,
    "eventType" TEXT NOT NULL,
    "eventStatus" TEXT,
    "payloadHash" TEXT NOT NULL,
    "payload" TEXT,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "processingStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "occurredAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentProviderEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentProviderConfig_countryCode_provider_key"
    ON "PaymentProviderConfig"("countryCode", "provider");
CREATE INDEX "PaymentProviderConfig_countryCode_enabled_priority_idx"
    ON "PaymentProviderConfig"("countryCode", "enabled", "priority");
CREATE INDEX "PaymentProviderConfig_provider_enabled_idx"
    ON "PaymentProviderConfig"("provider", "enabled");

CREATE UNIQUE INDEX "PaymentProviderTransaction_provider_providerOrderId_key"
    ON "PaymentProviderTransaction"("provider", "providerOrderId");
CREATE UNIQUE INDEX "PaymentProviderTransaction_provider_providerCaptureId_key"
    ON "PaymentProviderTransaction"("provider", "providerCaptureId");
CREATE INDEX "PaymentProviderTransaction_paymentIntentId_createdAt_idx"
    ON "PaymentProviderTransaction"("paymentIntentId", "createdAt");
CREATE INDEX "PaymentProviderTransaction_jobId_createdAt_idx"
    ON "PaymentProviderTransaction"("jobId", "createdAt");
CREATE INDEX "PaymentProviderTransaction_countryCode_provider_status_idx"
    ON "PaymentProviderTransaction"("countryCode", "provider", "status");
CREATE INDEX "PaymentProviderTransaction_reconciliationStatus_createdAt_idx"
    ON "PaymentProviderTransaction"("reconciliationStatus", "createdAt");

CREATE UNIQUE INDEX "PaymentProviderRefund_provider_providerRefundId_key"
    ON "PaymentProviderRefund"("provider", "providerRefundId");
CREATE INDEX "PaymentProviderRefund_paymentIntentId_createdAt_idx"
    ON "PaymentProviderRefund"("paymentIntentId", "createdAt");
CREATE INDEX "PaymentProviderRefund_providerTransactionId_createdAt_idx"
    ON "PaymentProviderRefund"("providerTransactionId", "createdAt");
CREATE INDEX "PaymentProviderRefund_countryCode_provider_status_idx"
    ON "PaymentProviderRefund"("countryCode", "provider", "status");

CREATE UNIQUE INDEX "PaymentProviderEvent_provider_externalEventId_key"
    ON "PaymentProviderEvent"("provider", "externalEventId");
CREATE INDEX "PaymentProviderEvent_paymentIntentId_createdAt_idx"
    ON "PaymentProviderEvent"("paymentIntentId", "createdAt");
CREATE INDEX "PaymentProviderEvent_providerTransactionId_createdAt_idx"
    ON "PaymentProviderEvent"("providerTransactionId", "createdAt");
CREATE INDEX "PaymentProviderEvent_countryCode_provider_eventType_idx"
    ON "PaymentProviderEvent"("countryCode", "provider", "eventType");
CREATE INDEX "PaymentProviderEvent_processingStatus_createdAt_idx"
    ON "PaymentProviderEvent"("processingStatus", "createdAt");
