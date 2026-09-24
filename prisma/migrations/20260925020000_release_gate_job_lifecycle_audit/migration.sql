-- Release-gate auditability: persistent canonical lifecycle timeline per marketplace job.

CREATE TABLE "JobLifecycleEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromState" TEXT,
    "toState" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobLifecycleEvent_jobId_createdAt_idx"
ON "JobLifecycleEvent"("jobId", "createdAt");

CREATE INDEX "JobLifecycleEvent_action_idx"
ON "JobLifecycleEvent"("action");

CREATE INDEX "JobLifecycleEvent_actorId_idx"
ON "JobLifecycleEvent"("actorId");

ALTER TABLE "JobLifecycleEvent"
ADD CONSTRAINT "JobLifecycleEvent_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "MarketplaceJob"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
