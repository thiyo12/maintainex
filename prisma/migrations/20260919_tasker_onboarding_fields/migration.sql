-- Persist the mandatory Tasker registration fields introduced by the V3.3 onboarding flow.
-- IF NOT EXISTS keeps this migration safe for environments where dateOfBirth/address
-- were provisioned manually while the feature branch was under development.
ALTER TABLE "TaskerProfile"
  ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "experienceSummary" TEXT;
