-- Phase04 additive, inert per-person dual attestation evidence.
-- Not a physical presence proof, and does not enable dispatch, arrival, PIN
-- authorization, work start, workspace or payments.
CREATE TABLE "CompanyCrewPresenceWitness" (
  "id" TEXT NOT NULL,
  "crewDispatchId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "crewVersion" INTEGER NOT NULL,
  "workerUserId" TEXT NOT NULL,
  "customerUserId" TEXT NOT NULL,
  "workerAttestedAt" TIMESTAMP(3),
  "customerAttestedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyCrewPresenceWitness_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CrewPresenceWitness_positive_epoch_check" CHECK ("crewVersion" >= 1),
  CONSTRAINT "CrewPresenceWitness_nonempty_check" CHECK (
    "workerAttestedAt" IS NOT NULL OR "customerAttestedAt" IS NOT NULL
  )
);
CREATE UNIQUE INDEX "CrewPresenceWitness_scope_key"
  ON "CompanyCrewPresenceWitness"("crewDispatchId", "crewVersion", "assignmentId");
CREATE INDEX "CrewPresenceWitness_job_epoch_idx"
  ON "CompanyCrewPresenceWitness"("jobId", "crewVersion");
ALTER TABLE "CompanyCrewPresenceWitness" ADD CONSTRAINT "CrewPresenceWitness_crew_fkey"
  FOREIGN KEY ("crewDispatchId") REFERENCES "CompanyCrewDispatch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyCrewPresenceWitness" ADD CONSTRAINT "CrewPresenceWitness_assignment_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "CompanyJobAssignment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
