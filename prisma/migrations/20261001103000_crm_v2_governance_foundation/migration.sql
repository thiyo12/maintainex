-- CRM V2 governance foundation.
-- Additive only: existing admin/session/business tables remain unchanged.

CREATE TABLE "AdminPermissionOverride" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminPermissionOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminPermissionOverride_adminUserId_permission_key"
ON "AdminPermissionOverride"("adminUserId", "permission");

CREATE INDEX "AdminPermissionOverride_adminUserId_effect_idx"
ON "AdminPermissionOverride"("adminUserId", "effect");

CREATE INDEX "AdminPermissionOverride_permission_effect_idx"
ON "AdminPermissionOverride"("permission", "effect");

ALTER TABLE "AdminPermissionOverride"
ADD CONSTRAINT "AdminPermissionOverride_adminUserId_fkey"
FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CrmApprovalRequest" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "initiatorAdminId" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "amountMinor" BIGINT,
    "currency" TEXT,
    "tier" TEXT NOT NULL,
    "reversibility" TEXT NOT NULL,
    "reasonCode" TEXT,
    "note" TEXT,
    "riskFlags" TEXT NOT NULL DEFAULT '[]',
    "policyVersion" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "requiredApprovers" TEXT NOT NULL DEFAULT '[]',
    "expiresAt" TIMESTAMP(3),
    "executionRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmApprovalRequest_idempotencyKey_key"
ON "CrmApprovalRequest"("idempotencyKey");

CREATE INDEX "CrmApprovalRequest_status_createdAt_idx"
ON "CrmApprovalRequest"("status", "createdAt");

CREATE INDEX "CrmApprovalRequest_actionId_status_idx"
ON "CrmApprovalRequest"("actionId", "status");

CREATE INDEX "CrmApprovalRequest_initiatorAdminId_createdAt_idx"
ON "CrmApprovalRequest"("initiatorAdminId", "createdAt");

CREATE INDEX "CrmApprovalRequest_market_status_idx"
ON "CrmApprovalRequest"("market", "status");

CREATE INDEX "CrmApprovalRequest_targetType_targetId_idx"
ON "CrmApprovalRequest"("targetType", "targetId");

CREATE INDEX "CrmApprovalRequest_expiresAt_idx"
ON "CrmApprovalRequest"("expiresAt");

CREATE TABLE "CrmApprovalDecision" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminRole" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrmApprovalDecision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmApprovalDecision_requestId_adminId_key"
ON "CrmApprovalDecision"("requestId", "adminId");

CREATE INDEX "CrmApprovalDecision_requestId_decidedAt_idx"
ON "CrmApprovalDecision"("requestId", "decidedAt");

CREATE INDEX "CrmApprovalDecision_adminId_decidedAt_idx"
ON "CrmApprovalDecision"("adminId", "decidedAt");

ALTER TABLE "CrmApprovalDecision"
ADD CONSTRAINT "CrmApprovalDecision_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "CrmApprovalRequest"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CrmApprovalEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorAdminId" TEXT,
    "actorRole" TEXT,
    "permission" TEXT,
    "market" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "correlationId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrmApprovalEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrmApprovalEvent_requestId_createdAt_idx"
ON "CrmApprovalEvent"("requestId", "createdAt");

CREATE INDEX "CrmApprovalEvent_eventType_createdAt_idx"
ON "CrmApprovalEvent"("eventType", "createdAt");

CREATE INDEX "CrmApprovalEvent_actorAdminId_createdAt_idx"
ON "CrmApprovalEvent"("actorAdminId", "createdAt");

CREATE INDEX "CrmApprovalEvent_targetType_targetId_idx"
ON "CrmApprovalEvent"("targetType", "targetId");

CREATE INDEX "CrmApprovalEvent_correlationId_idx"
ON "CrmApprovalEvent"("correlationId");

ALTER TABLE "CrmApprovalEvent"
ADD CONSTRAINT "CrmApprovalEvent_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "CrmApprovalRequest"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
