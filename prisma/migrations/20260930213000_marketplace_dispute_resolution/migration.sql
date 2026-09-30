-- Marketplace dispute persistence and CRM financial-resolution queue.
-- Additive only: legacy Dispute -> JobPosting remains for historical V1 records.

CREATE TABLE "MarketplaceDispute" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolutionAction" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "countryCode" TEXT NOT NULL DEFAULT 'LK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceDispute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceDispute_jobId_key"
ON "MarketplaceDispute"("jobId");

CREATE INDEX "MarketplaceDispute_status_createdAt_idx"
ON "MarketplaceDispute"("status", "createdAt");

CREATE INDEX "MarketplaceDispute_countryCode_status_idx"
ON "MarketplaceDispute"("countryCode", "status");

CREATE INDEX "MarketplaceDispute_raisedById_idx"
ON "MarketplaceDispute"("raisedById");

CREATE INDEX "MarketplaceDispute_escrowId_idx"
ON "MarketplaceDispute"("escrowId");

ALTER TABLE "MarketplaceDispute"
ADD CONSTRAINT "MarketplaceDispute_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "MarketplaceJob"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
