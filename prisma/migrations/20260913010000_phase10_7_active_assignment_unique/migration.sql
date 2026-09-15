-- Phase 10.7 Active-Assignment Invariant
-- Partial unique index: one active primary assignment per company job
-- Prevents two active (ASSIGNED/ACCEPTED/IN_PROGRESS) rows for the same jobId

CREATE UNIQUE INDEX "CompanyJobAssignment_active_per_job_idx"
  ON "CompanyJobAssignment"("jobId")
  WHERE "status" IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS');
