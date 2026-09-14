-- DropJobOtp: Remove legacy plaintext Job OTP table
-- The secure JobVerificationPin system (hashed, rate-limited, locked) replaces this.
DROP TABLE IF EXISTS "JobOtp";
