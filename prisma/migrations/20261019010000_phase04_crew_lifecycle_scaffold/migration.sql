-- Phase 04 scaffold: crew identity/version and optional assignment slots.
-- Additive and inert: NO application path creates crew rows yet.
-- Keep CompanyJobAssignment_active_per_job_idx intact until atomic multi-worker
-- acceptance, identity, scheduling, PIN and work-start barriers are complete.
CREATE TABLE "CompanyCrewDispatch" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "requiredWorkersCount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'FORMING',
  "leadWorkerUserId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyCrewDispatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanyCrewDispatch_size_check" CHECK ("requiredWorkersCount" BETWEEN 2 AND 12),
  CONSTRAINT "CompanyCrewDispatch_version_check" CHECK ("version" >= 1),
  CONSTRAINT "CompanyCrewDispatch_status_check" CHECK (
    "status" IN ('FORMING', 'READY', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'CANCELLED')
  )
);

CREATE UNIQUE INDEX "CompanyCrewDispatch_jobId_key" ON "CompanyCrewDispatch"("jobId");
CREATE INDEX "CompanyCrewDispatch_companyId_status_idx" ON "CompanyCrewDispatch"("companyId", "status");
ALTER TABLE "CompanyCrewDispatch" ADD CONSTRAINT "CompanyCrewDispatch_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "MarketplaceJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyCrewDispatch" ADD CONSTRAINT "CompanyCrewDispatch_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyJobAssignment"
  ADD COLUMN "crewDispatchId" TEXT,
  ADD COLUMN "crewSlot" INTEGER,
  ADD COLUMN "crewRole" TEXT,
  ADD COLUMN "crewArrivedAt" TIMESTAMP(3),
  ADD COLUMN "crewIdentityConfirmedAt" TIMESTAMP(3);
ALTER TABLE "CompanyJobAssignment" ADD CONSTRAINT "CompanyJobAssignment_crew_shape_check" CHECK (
  ("crewDispatchId" IS NULL AND "crewSlot" IS NULL AND "crewRole" IS NULL
    AND "crewArrivedAt" IS NULL AND "crewIdentityConfirmedAt" IS NULL)
  OR ("crewDispatchId" IS NOT NULL AND "crewSlot" BETWEEN 1 AND 12
    AND "crewRole" IN ('LEAD', 'MEMBER'))
);
CREATE UNIQUE INDEX "CompanyJobAssignment_crewDispatchId_crewSlot_key"
  ON "CompanyJobAssignment"("crewDispatchId", "crewSlot");
CREATE INDEX "CompanyJobAssignment_crewDispatchId_idx" ON "CompanyJobAssignment"("crewDispatchId");
ALTER TABLE "CompanyJobAssignment" ADD CONSTRAINT "CompanyJobAssignment_crewDispatchId_fkey"
  FOREIGN KEY ("crewDispatchId") REFERENCES "CompanyCrewDispatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
