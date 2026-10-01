-- CRM V2 emergency controls.
CREATE TABLE "CrmEmergencyControl" (
    "id" TEXT NOT NULL,
    "controlKey" TEXT NOT NULL,
    "market" TEXT NOT NULL DEFAULT 'GLOBAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "activatedBy" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "deactivatedBy" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrmEmergencyControl_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmEmergencyControl_controlKey_market_key"
ON "CrmEmergencyControl"("controlKey", "market");

CREATE INDEX "CrmEmergencyControl_active_expiresAt_idx"
ON "CrmEmergencyControl"("active", "expiresAt");

CREATE INDEX "CrmEmergencyControl_market_active_idx"
ON "CrmEmergencyControl"("market", "active");
