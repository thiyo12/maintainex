-- CreateTable
CREATE TABLE "JobVerificationPin" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastSuccessfulUseAt" TIMESTAMP(3),

    CONSTRAINT "JobVerificationPin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (compound unique for version tracking)
CREATE UNIQUE INDEX "JobVerificationPin_jobId_version_key" ON "JobVerificationPin"("jobId", "version");

-- CreateIndex (standard indexes)
CREATE INDEX "JobVerificationPin_jobId_idx" ON "JobVerificationPin"("jobId");
CREATE INDEX "JobVerificationPin_customerId_idx" ON "JobVerificationPin"("customerId");

-- Partial unique index: enforces ONE ACTIVE PIN per job at the database level
-- Concurrent INSERT with status='ACTIVE' for the same jobId will be rejected
CREATE UNIQUE INDEX "JobVerificationPin_one_active_per_job" ON "JobVerificationPin"("jobId") WHERE "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "JobVerificationPin" ADD CONSTRAINT "JobVerificationPin_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MarketplaceJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobVerificationPin" ADD CONSTRAINT "JobVerificationPin_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
