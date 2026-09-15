-- Phase 10.4: Inspection + Change Order + Anti-Bypass Lifecycle

-- AlterTable: MarketplaceJob
ALTER TABLE "MarketplaceJob" ADD COLUMN "requiresInspection" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MarketplaceJob" ADD COLUMN "approvedQuoteId" TEXT;
ALTER TABLE "MarketplaceJob" ADD COLUMN "approvedQuoteVersion" INTEGER;
ALTER TABLE "MarketplaceJob" ADD COLUMN "finalAuthorizedAmountCents" BIGINT;

-- CreateTable: JobInspection
CREATE TABLE "JobInspection" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "taskerId" TEXT,
    "companyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "scheduledAt" TIMESTAMP(3),
    "scheduledWindowStart" TEXT,
    "scheduledWindowEnd" TEXT,
    "arrivedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "inspectionFeeCents" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "diagnosisSummary" TEXT,
    "scopeSummary" TEXT,
    "materialsSummary" TEXT,
    "estimatedDuration" TEXT,
    "risksAndLimitations" TEXT,
    "customerNotes" TEXT,
    "providerNotes" TEXT,
    "verifiedByCustomer" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable: JobChangeOrder
CREATE TABLE "JobChangeOrder" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "baseQuoteId" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "taskerId" TEXT,
    "companyId" TEXT,
    "reason" TEXT NOT NULL,
    "scopeDelta" TEXT,
    "amountDeltaCents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "customerDecisionAt" TIMESTAMP(3),
    "approvedByCustomerId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "JobChangeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable: JobChangeOrderLineItem
CREATE TABLE "JobChangeOrderLineItem" (
    "id" TEXT NOT NULL,
    "changeOrderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unitAmountCents" BIGINT NOT NULL,
    "totalAmountCents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobChangeOrderLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: JobEvidence
CREATE TABLE "JobEvidence" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "inspectionId" TEXT,
    "uploaderId" TEXT NOT NULL,
    "uploaderType" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MarketplaceRiskEvent
CREATE TABLE "MarketplaceRiskEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "resolution" TEXT,

    CONSTRAINT "MarketplaceRiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "JobInspection_jobId_idx" ON "JobInspection"("jobId");
CREATE INDEX "JobInspection_taskerId_idx" ON "JobInspection"("taskerId");
CREATE INDEX "JobInspection_companyId_idx" ON "JobInspection"("companyId");
CREATE INDEX "JobInspection_status_idx" ON "JobInspection"("status");
CREATE INDEX "JobInspection_providerType_idx" ON "JobInspection"("providerType");

CREATE INDEX "JobChangeOrder_jobId_idx" ON "JobChangeOrder"("jobId");
CREATE INDEX "JobChangeOrder_baseQuoteId_idx" ON "JobChangeOrder"("baseQuoteId");
CREATE INDEX "JobChangeOrder_taskerId_idx" ON "JobChangeOrder"("taskerId");
CREATE INDEX "JobChangeOrder_companyId_idx" ON "JobChangeOrder"("companyId");
CREATE INDEX "JobChangeOrder_status_idx" ON "JobChangeOrder"("status");
CREATE INDEX "JobChangeOrder_createdBy_idx" ON "JobChangeOrder"("createdBy");

CREATE INDEX "JobChangeOrderLineItem_changeOrderId_idx" ON "JobChangeOrderLineItem"("changeOrderId");

CREATE INDEX "JobEvidence_jobId_idx" ON "JobEvidence"("jobId");
CREATE INDEX "JobEvidence_inspectionId_idx" ON "JobEvidence"("inspectionId");
CREATE INDEX "JobEvidence_uploaderId_idx" ON "JobEvidence"("uploaderId");

CREATE INDEX "MarketplaceRiskEvent_jobId_idx" ON "MarketplaceRiskEvent"("jobId");
CREATE INDEX "MarketplaceRiskEvent_actorUserId_idx" ON "MarketplaceRiskEvent"("actorUserId");
CREATE INDEX "MarketplaceRiskEvent_eventType_idx" ON "MarketplaceRiskEvent"("eventType");
CREATE INDEX "MarketplaceRiskEvent_severity_idx" ON "MarketplaceRiskEvent"("severity");
CREATE INDEX "MarketplaceRiskEvent_createdAt_idx" ON "MarketplaceRiskEvent"("createdAt");

-- AddForeignKey: JobInspection
ALTER TABLE "JobInspection" ADD CONSTRAINT "JobInspection_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MarketplaceJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: JobChangeOrder
ALTER TABLE "JobChangeOrder" ADD CONSTRAINT "JobChangeOrder_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MarketplaceJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: JobChangeOrderLineItem
ALTER TABLE "JobChangeOrderLineItem" ADD CONSTRAINT "JobChangeOrderLineItem_changeOrderId_fkey" FOREIGN KEY ("changeOrderId") REFERENCES "JobChangeOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: JobEvidence
ALTER TABLE "JobEvidence" ADD CONSTRAINT "JobEvidence_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MarketplaceJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobEvidence" ADD CONSTRAINT "JobEvidence_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "JobInspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: MarketplaceRiskEvent
ALTER TABLE "MarketplaceRiskEvent" ADD CONSTRAINT "MarketplaceRiskEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MarketplaceJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
