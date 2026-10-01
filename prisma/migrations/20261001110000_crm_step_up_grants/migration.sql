-- One-time CRM step-up grants for sensitive admin actions.
CREATE TABLE "CrmStepUpGrant" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrmStepUpGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrmStepUpGrant_adminUserId_sessionId_actionId_idx"
ON "CrmStepUpGrant"("adminUserId", "sessionId", "actionId");

CREATE INDEX "CrmStepUpGrant_expiresAt_idx"
ON "CrmStepUpGrant"("expiresAt");

CREATE INDEX "CrmStepUpGrant_usedAt_idx"
ON "CrmStepUpGrant"("usedAt");
