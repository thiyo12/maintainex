-- Phase 10.7 — Company Workforce: formal job assignment tracking
-- Additive migration: new table only, no changes to existing tables

CREATE TABLE "CompanyJobAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "workerUserId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyJobAssignment_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one assignment per worker per job
CREATE UNIQUE INDEX "CompanyJobAssignment_jobId_workerUserId_key" ON "CompanyJobAssignment"("jobId", "workerUserId");

-- Indexes for query patterns
CREATE INDEX "CompanyJobAssignment_companyId_idx" ON "CompanyJobAssignment"("companyId");
CREATE INDEX "CompanyJobAssignment_workerUserId_idx" ON "CompanyJobAssignment"("workerUserId");
CREATE INDEX "CompanyJobAssignment_jobId_idx" ON "CompanyJobAssignment"("jobId");
CREATE INDEX "CompanyJobAssignment_status_idx" ON "CompanyJobAssignment"("status");

-- Foreign keys
ALTER TABLE "CompanyJobAssignment" ADD CONSTRAINT "CompanyJobAssignment_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyJobAssignment" ADD CONSTRAINT "CompanyJobAssignment_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "MarketplaceJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyJobAssignment" ADD CONSTRAINT "CompanyJobAssignment_workerUserId_fkey"
    FOREIGN KEY ("workerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
