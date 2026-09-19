-- Tasker registration must persist legal onboarding details before KYC.
ALTER TABLE "TaskerProfile"
  ADD COLUMN "dateOfBirth" TIMESTAMP(3),
  ADD COLUMN "address" TEXT;
