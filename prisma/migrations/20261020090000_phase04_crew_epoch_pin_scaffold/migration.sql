-- Phase 04: inert, version-bound per-worker and group PIN challenge schema.
-- Additive only. This migration DOES NOT mint a code, remove the single-worker
-- assignment unique index, enable PIN routes, or transition any booking.
-- Do not apply to production without founder release/migration approval.
CREATE TABLE "CompanyCrewPinChallenge" (
  "id" TEXT NOT NULL,
  "crewDispatchId" TEXT NOT NULL,
  "assignmentId" TEXT,
  "crewVersion" INTEGER NOT NULL,
  "purpose" TEXT NOT NULL,
  "pinHash" TEXT NOT NULL,
  "issuedByCustomerId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyCrewPinChallenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanyCrewPinChallenge_version_check" CHECK ("crewVersion" >= 1),
  CONSTRAINT "CompanyCrewPinChallenge_shape_check" CHECK (
    ("purpose" = 'ARRIVAL' AND "assignmentId" IS NOT NULL)
    OR ("purpose" = 'WORK_START' AND "assignmentId" IS NULL)
  ),
  CONSTRAINT "CompanyCrewPinChallenge_status_check" CHECK (
    "status" IN ('ACTIVE', 'CONSUMED', 'REVOKED', 'EXPIRED')
  ),
  CONSTRAINT "CompanyCrewPinChallenge_attempts_check" CHECK ("failedAttempts" BETWEEN 0 AND 5),
  CONSTRAINT "CompanyCrewPinChallenge_window_check" CHECK (
    "expiresAt" > "createdAt"
    AND "expiresAt" <= "createdAt" + INTERVAL '10 minutes'
  ),
  CONSTRAINT "CompanyCrewPinChallenge_consumed_check" CHECK (
    "status" <> 'CONSUMED' OR "consumedAt" IS NOT NULL
  ),
  CONSTRAINT "CompanyCrewPinChallenge_revoked_check" CHECK (
    "status" <> 'REVOKED' OR "revokedAt" IS NOT NULL
  )
);

CREATE INDEX "CompanyCrewPinChallenge_crewDispatchId_crewVersion_idx"
  ON "CompanyCrewPinChallenge"("crewDispatchId", "crewVersion");
CREATE INDEX "CompanyCrewPinChallenge_assignmentId_idx"
  ON "CompanyCrewPinChallenge"("assignmentId");
CREATE INDEX "CompanyCrewPinChallenge_expiresAt_status_idx"
  ON "CompanyCrewPinChallenge"("expiresAt", "status");

-- Two unique shapes: one ARRIVAL code per worker/epoch and one group START
-- code per crew/epoch. Nulls in a composite unique key are not unique in PG,
-- hence the explicit mutually exclusive partial indexes below.
CREATE UNIQUE INDEX "CompanyCrewPinChallenge_worker_epoch_key"
  ON "CompanyCrewPinChallenge"("crewDispatchId", "crewVersion", "assignmentId", "purpose")
  WHERE "assignmentId" IS NOT NULL;
CREATE UNIQUE INDEX "CompanyCrewPinChallenge_group_epoch_key"
  ON "CompanyCrewPinChallenge"("crewDispatchId", "crewVersion", "purpose")
  WHERE "assignmentId" IS NULL;

ALTER TABLE "CompanyCrewPinChallenge"
  ADD CONSTRAINT "CompanyCrewPinChallenge_crewDispatchId_fkey"
  FOREIGN KEY ("crewDispatchId") REFERENCES "CompanyCrewDispatch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyCrewPinChallenge"
  ADD CONSTRAINT "CompanyCrewPinChallenge_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "CompanyJobAssignment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
