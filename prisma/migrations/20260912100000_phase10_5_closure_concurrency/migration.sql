-- Phase 10.5 Closure: Concurrency safety + review ownership
-- Atomic PIN purpose consumption + JobReview defense-in-depth trigger

-- 1. Add per-purpose verification timestamps to JobVerificationPin
ALTER TABLE "JobVerificationPin" ADD COLUMN "arrivalVerifiedAt" TIMESTAMP(3);
ALTER TABLE "JobVerificationPin" ADD COLUMN "workStartVerifiedAt" TIMESTAMP(3);
ALTER TABLE "JobVerificationPin" ADD COLUMN "completionVerifiedAt" TIMESTAMP(3);

-- 2. JobReview ownership trigger (defense-in-depth)
-- Application/domain authorization is the primary control.
-- This trigger is a secondary DB-level guard.
CREATE OR REPLACE FUNCTION check_job_review_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "MarketplaceJob"
    WHERE id = NEW."jobId" AND "customerId" = NEW."customerId"
  ) THEN
    RAISE EXCEPTION 'Customer does not own this job';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists (idempotent migration)
DROP TRIGGER IF EXISTS trg_job_review_owner_check ON "JobReview";

CREATE TRIGGER trg_job_review_owner_check
BEFORE INSERT ON "JobReview"
FOR EACH ROW EXECUTE FUNCTION check_job_review_owner();
