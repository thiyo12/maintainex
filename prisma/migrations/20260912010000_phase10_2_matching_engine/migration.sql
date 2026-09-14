-- Phase 10.2: Canonical Matching Engine — Schema Migration
-- Adds ProviderOpportunity model for fair opportunity tracking.
-- Extends MarketConfig with wave, fairness, and new provider parameters.
-- No data is deleted. No monetary values are altered.

-- =============================================
-- 1. ProviderOpportunity — opportunity tracking
-- =============================================
CREATE TABLE "ProviderOpportunity" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "taskerId" TEXT,
  "companyId" TEXT,
  "providerType" TEXT NOT NULL,
  "waveNumber" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "response" TEXT,
  "rankAtSend" INTEGER,
  "scoreSnapshot" DOUBLE PRECISION,
  "eligibilitySnapshot" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProviderOpportunity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProviderOpportunity_jobId_taskerId_key" ON "ProviderOpportunity"("jobId", "taskerId");
CREATE UNIQUE INDEX "ProviderOpportunity_jobId_companyId_key" ON "ProviderOpportunity"("jobId", "companyId");
CREATE INDEX "ProviderOpportunity_jobId_idx" ON "ProviderOpportunity"("jobId");
CREATE INDEX "ProviderOpportunity_taskerId_sentAt_idx" ON "ProviderOpportunity"("taskerId", "sentAt");
CREATE INDEX "ProviderOpportunity_companyId_sentAt_idx" ON "ProviderOpportunity"("companyId", "sentAt");
CREATE INDEX "ProviderOpportunity_status_idx" ON "ProviderOpportunity"("status");
CREATE INDEX "ProviderOpportunity_waveNumber_idx" ON "ProviderOpportunity"("waveNumber");

-- =============================================
-- 2. MarketConfig — extend matching parameters
-- =============================================
ALTER TABLE "MarketConfig" ADD COLUMN "weightFairness" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "MarketConfig" ADD COLUMN "weightPreferredSkill" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "MarketConfig" ADD COLUMN "wave1Size" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "MarketConfig" ADD COLUMN "wave2Size" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "MarketConfig" ADD COLUMN "wave3Size" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "MarketConfig" ADD COLUMN "wave1ExpiryMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "MarketConfig" ADD COLUMN "wave2ExpiryMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "MarketConfig" ADD COLUMN "wave3ExpiryMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "MarketConfig" ADD COLUMN "newProviderBaseline" DOUBLE PRECISION NOT NULL DEFAULT 50;
ALTER TABLE "MarketConfig" ADD COLUMN "maxOpportunityBoost" DOUBLE PRECISION NOT NULL DEFAULT 15;
