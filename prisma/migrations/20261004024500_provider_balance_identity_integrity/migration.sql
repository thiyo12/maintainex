ALTER TABLE "MarketplaceJob"
ADD COLUMN "workerIdentityCheckRequired" BOOLEAN NOT NULL DEFAULT false;

-- Provider identity, financial standing, cash-commission controls, and worker identity verification.
-- Additive only. Existing payment, escrow, settlement, wallet, and ledger tables remain authoritative.

CREATE TABLE "ProviderIdentity" (
    "id" TEXT NOT NULL,
    "identityType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "currentUserId" TEXT,
    "parentProviderIdentityId" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'LK',
    "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "standingStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "verifiedDisplayName" TEXT,
    "verifiedPhotoUrl" TEXT,
    "photoLocked" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderIdentityClaim" (
    "id" TEXT NOT NULL,
    "providerIdentityId" TEXT NOT NULL,
    "claimType" TEXT NOT NULL,
    "claimHash" TEXT NOT NULL,
    "isStrongIdentifier" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderIdentityClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderFinancialAccount" (
    "id" TEXT NOT NULL,
    "providerIdentityId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "commissionDue" BIGINT NOT NULL DEFAULT 0,
    "availableEarnings" BIGINT NOT NULL DEFAULT 0,
    "pendingEarnings" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'CLEAR',
    "cashJobsAllowed" BOOLEAN NOT NULL DEFAULT true,
    "onlineJobsAllowed" BOOLEAN NOT NULL DEFAULT true,
    "manualReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "oldestCommissionDueAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastEvaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderFinancialAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderFinancialPolicyConfig" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "warningThresholdMinor" BIGINT NOT NULL,
    "cashRestrictionThresholdMinor" BIGINT NOT NULL,
    "reviewThresholdMinor" BIGINT NOT NULL,
    "maxDebtAgeDays" INTEGER NOT NULL DEFAULT 14,
    "allowOnlineWhenCashRestricted" BOOLEAN NOT NULL DEFAULT true,
    "autoOffsetOnlineEarnings" BOOLEAN NOT NULL DEFAULT true,
    "settlementCadence" TEXT NOT NULL DEFAULT 'REALTIME',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderFinancialPolicyConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderPhotoChangeRequest" (
    "id" TEXT NOT NULL,
    "providerIdentityId" TEXT NOT NULL,
    "requestedPhotoUrl" TEXT NOT NULL,
    "requestReason" TEXT,
    "livenessStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "faceMatchStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderPhotoChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobWorkerIdentityCheck" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerIdentityId" TEXT NOT NULL,
    "assignedWorkerUserId" TEXT,
    "displayNameSnapshot" TEXT NOT NULL,
    "photoSnapshotUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "mismatchReportedAt" TIMESTAMP(3),
    "mismatchReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobWorkerIdentityCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderIntegritySignal" (
    "id" TEXT NOT NULL,
    "providerIdentityId" TEXT,
    "userId" TEXT,
    "jobId" TEXT,
    "signalType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "signalHash" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "metadata" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderIntegritySignal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderIdentity_identityType_subjectId_key"
ON "ProviderIdentity"("identityType", "subjectId");

CREATE INDEX "ProviderIdentity_currentUserId_idx"
ON "ProviderIdentity"("currentUserId");

CREATE INDEX "ProviderIdentity_parentProviderIdentityId_idx"
ON "ProviderIdentity"("parentProviderIdentityId");

CREATE INDEX "ProviderIdentity_countryCode_standingStatus_idx"
ON "ProviderIdentity"("countryCode", "standingStatus");

CREATE INDEX "ProviderIdentity_kycStatus_idx"
ON "ProviderIdentity"("kycStatus");

CREATE UNIQUE INDEX "ProviderIdentityClaim_providerIdentityId_claimType_claimHash_key"
ON "ProviderIdentityClaim"("providerIdentityId", "claimType", "claimHash");

CREATE INDEX "ProviderIdentityClaim_claimType_claimHash_idx"
ON "ProviderIdentityClaim"("claimType", "claimHash");

CREATE INDEX "ProviderIdentityClaim_providerIdentityId_status_idx"
ON "ProviderIdentityClaim"("providerIdentityId", "status");

CREATE UNIQUE INDEX "ProviderFinancialAccount_providerIdentityId_currency_key"
ON "ProviderFinancialAccount"("providerIdentityId", "currency");

CREATE INDEX "ProviderFinancialAccount_status_currency_idx"
ON "ProviderFinancialAccount"("status", "currency");

CREATE INDEX "ProviderFinancialAccount_cashJobsAllowed_currency_idx"
ON "ProviderFinancialAccount"("cashJobsAllowed", "currency");

CREATE INDEX "ProviderFinancialAccount_commissionDue_idx"
ON "ProviderFinancialAccount"("commissionDue");

CREATE UNIQUE INDEX "ProviderFinancialPolicyConfig_countryCode_providerType_currency_key"
ON "ProviderFinancialPolicyConfig"("countryCode", "providerType", "currency");

CREATE INDEX "ProviderFinancialPolicyConfig_countryCode_enabled_idx"
ON "ProviderFinancialPolicyConfig"("countryCode", "enabled");

CREATE INDEX "ProviderPhotoChangeRequest_providerIdentityId_status_idx"
ON "ProviderPhotoChangeRequest"("providerIdentityId", "status");

CREATE INDEX "ProviderPhotoChangeRequest_status_createdAt_idx"
ON "ProviderPhotoChangeRequest"("status", "createdAt");

CREATE UNIQUE INDEX "JobWorkerIdentityCheck_jobId_providerIdentityId_key"
ON "JobWorkerIdentityCheck"("jobId", "providerIdentityId");

CREATE INDEX "JobWorkerIdentityCheck_jobId_status_idx"
ON "JobWorkerIdentityCheck"("jobId", "status");

CREATE INDEX "JobWorkerIdentityCheck_providerIdentityId_status_idx"
ON "JobWorkerIdentityCheck"("providerIdentityId", "status");

CREATE INDEX "JobWorkerIdentityCheck_customerId_createdAt_idx"
ON "JobWorkerIdentityCheck"("customerId", "createdAt");

CREATE INDEX "ProviderIntegritySignal_providerIdentityId_status_idx"
ON "ProviderIntegritySignal"("providerIdentityId", "status");

CREATE INDEX "ProviderIntegritySignal_userId_status_idx"
ON "ProviderIntegritySignal"("userId", "status");

CREATE INDEX "ProviderIntegritySignal_jobId_idx"
ON "ProviderIntegritySignal"("jobId");

CREATE INDEX "ProviderIntegritySignal_signalType_severity_idx"
ON "ProviderIntegritySignal"("signalType", "severity");

CREATE INDEX "ProviderIntegritySignal_createdAt_idx"
ON "ProviderIntegritySignal"("createdAt");

ALTER TABLE "ProviderIdentityClaim"
ADD CONSTRAINT "ProviderIdentityClaim_providerIdentityId_fkey"
FOREIGN KEY ("providerIdentityId") REFERENCES "ProviderIdentity"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProviderFinancialAccount"
ADD CONSTRAINT "ProviderFinancialAccount_providerIdentityId_fkey"
FOREIGN KEY ("providerIdentityId") REFERENCES "ProviderIdentity"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProviderPhotoChangeRequest"
ADD CONSTRAINT "ProviderPhotoChangeRequest_providerIdentityId_fkey"
FOREIGN KEY ("providerIdentityId") REFERENCES "ProviderIdentity"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
