-- Phase 0-7 closure: make canonical financial/pricing schema reproducible.
-- Production-safe forward migration: these tables may already exist on databases
-- historically synchronized with Prisma db push, so every create/index is guarded.

CREATE TABLE IF NOT EXISTS "FinancialLedger" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  "entryType" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'LKR',
  "referenceType" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "description" TEXT,
  "createdBy" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialLedger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FinancialLedger_idempotencyKey_key" ON "FinancialLedger"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "FinancialLedger_accountId_accountType_idx" ON "FinancialLedger"("accountId", "accountType");
CREATE INDEX IF NOT EXISTS "FinancialLedger_referenceType_referenceId_idx" ON "FinancialLedger"("referenceType", "referenceId");

CREATE TABLE IF NOT EXISTS "IdempotencyRecord" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "metadata" TEXT,
  "resultPayload" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyRecord_idempotencyKey_key" ON "IdempotencyRecord"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "IdempotencyRecord_idempotencyKey_idx" ON "IdempotencyRecord"("idempotencyKey");

CREATE TABLE IF NOT EXISTS "WalletBalance" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "walletType" TEXT NOT NULL,
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "availableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pendingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WalletBalance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WalletBalance_walletType_walletId_key" ON "WalletBalance"("walletType", "walletId");
CREATE INDEX IF NOT EXISTS "WalletBalance_walletId_idx" ON "WalletBalance"("walletId");
CREATE INDEX IF NOT EXISTS "WalletBalance_walletType_idx" ON "WalletBalance"("walletType");

-- Backfill existing legacy wallet balances once when a canonical cache row is
-- missing. Existing canonical rows are never overwritten, which keeps this safe
-- on databases that already ran part of the Phase 5 rollout.
INSERT INTO "WalletBalance" (
  "id", "walletId", "walletType", "balance", "availableBalance",
  "pendingBalance", "version", "createdAt", "updatedAt"
)
SELECT
  'wb_customer_' || cw.id,
  cw.id,
  'CUSTOMER',
  cw.balance,
  cw.balance,
  0,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "CustomerWallet" cw
ON CONFLICT ("walletType", "walletId") DO NOTHING;

INSERT INTO "WalletBalance" (
  "id", "walletId", "walletType", "balance", "availableBalance",
  "pendingBalance", "version", "createdAt", "updatedAt"
)
SELECT
  'wb_provider_' || pw.id,
  pw.id,
  'PROVIDER',
  pw."availableBalance",
  pw."availableBalance",
  pw."pendingBalance",
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ProviderWallet" pw
ON CONFLICT ("walletType", "walletId") DO NOTHING;

CREATE TABLE IF NOT EXISTS "PriceSnapshot" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "pricingVersion" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'LKR',
  "baseAmount" BIGINT NOT NULL,
  "urgencyAmount" BIGINT NOT NULL DEFAULT 0,
  "serviceModifiers" BIGINT NOT NULL DEFAULT 0,
  "platformFeeBps" INTEGER NOT NULL,
  "platformFeeAmount" BIGINT NOT NULL,
  "providerGross" BIGINT NOT NULL,
  "customerTotal" BIGINT NOT NULL,
  "ruleIds" TEXT NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PriceSnapshot_jobId_idx" ON "PriceSnapshot"("jobId");

CREATE TABLE IF NOT EXISTS "MarketConfig" (
  "id" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "matchingVersion" TEXT NOT NULL DEFAULT 'v1',
  "pricingVersion" TEXT NOT NULL DEFAULT 'v1',
  "weightCapability" INTEGER NOT NULL DEFAULT 30,
  "weightReliability" INTEGER NOT NULL DEFAULT 20,
  "weightReputation" INTEGER NOT NULL DEFAULT 20,
  "weightAvailability" INTEGER NOT NULL DEFAULT 15,
  "weightTravel" INTEGER NOT NULL DEFAULT 10,
  "weightExperience" INTEGER NOT NULL DEFAULT 5,
  "urgentModifierBps" INTEGER NOT NULL DEFAULT 2500,
  "emergencyModifierBps" INTEGER NOT NULL DEFAULT 5000,
  "urgencyCapBps" INTEGER NOT NULL DEFAULT 10000,
  "commissionRateBps" INTEGER NOT NULL DEFAULT 1000,
  "minJobAmountCents" BIGINT NOT NULL DEFAULT 500,
  "maxJobAmountCents" BIGINT NOT NULL DEFAULT 10000000,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarketConfig_countryCode_key" ON "MarketConfig"("countryCode");
