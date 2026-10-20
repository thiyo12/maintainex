-- Phase04 internal-only, additive per-worker PIN challenge ledger.
-- NO endpoint creates or consumes records; absolutely no work-start activation.
-- Preserve original JobVerificationPin and legacy active-assignment index.
CREATE TABLE "CompanyCrewPinChallenge" (
  "id" TEXT NOT NULL,
  "crewDispatchId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "crewVersion" INTEGER NOT NULL,
  "purpose" TEXT NOT NULL,
  "challengeVersion" INTEGER NOT NULL DEFAULT 1,
  "pinDigest" TEXT NOT NULL,
  "issuedByCustomerUserId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyCrewPinChallenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanyCrewPinChallenge_epoch_check" CHECK ("crewVersion" >= 1 AND "challengeVersion" >= 1),
  CONSTRAINT "CompanyCrewPinChallenge_purpose_check" CHECK ("purpose" IN ('ARRIVAL', 'WORK_START')),
  CONSTRAINT "CompanyCrewPinChallenge_attempt_check" CHECK ("failedAttempts" BETWEEN 0 AND 5),
  CONSTRAINT "CompanyCrewPinChallenge_digest_check" CHECK ("pinDigest" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "CompanyCrewPinChallenge_expiry_check" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "CompanyCrewPinChallenge_terminal_check" CHECK ("consumedAt" IS NULL OR "revokedAt" IS NULL)
);
CREATE UNIQUE INDEX "CrewPinChallenge_scope_version_key" ON "CompanyCrewPinChallenge"
  ("crewDispatchId", "crewVersion", "assignmentId", "purpose", "challengeVersion");
-- Keep at most one unconsumed/unrevoked challenge per person and purpose.
-- Rotation must revoke the previous challenge before writing a successor.
CREATE UNIQUE INDEX "CrewPinChallenge_one_live_idx" ON "CompanyCrewPinChallenge"
  ("crewDispatchId", "crewVersion", "assignmentId", "purpose")
  WHERE "consumedAt" IS NULL AND "revokedAt" IS NULL;
CREATE INDEX "CrewPinChallenge_crew_purpose_idx" ON "CompanyCrewPinChallenge"
  ("crewDispatchId", "crewVersion", "purpose");
CREATE INDEX "CrewPinChallenge_assignment_expiry_idx" ON "CompanyCrewPinChallenge"
  ("assignmentId", "purpose", "expiresAt");
ALTER TABLE "CompanyCrewPinChallenge" ADD CONSTRAINT "CompanyCrewPinChallenge_crewDispatchId_fkey"
  FOREIGN KEY ("crewDispatchId") REFERENCES "CompanyCrewDispatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyCrewPinChallenge" ADD CONSTRAINT "CompanyCrewPinChallenge_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "CompanyJobAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
