-- Phase 11: market-aware company subscription plans and immutable subscription snapshots.

ALTER TABLE "SubscriptionPlan"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'LKR',
ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'LK';

CREATE INDEX "SubscriptionPlan_countryCode_isActive_idx"
ON "SubscriptionPlan"("countryCode", "isActive");

ALTER TABLE "CompanySubscription"
ADD COLUMN "priceSnapshot" DOUBLE PRECISION,
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'LKR',
ADD COLUMN "planNameSnapshot" TEXT;

UPDATE "CompanySubscription" cs
SET
  "priceSnapshot" = sp."price",
  "currency" = sp."currency",
  "planNameSnapshot" = sp."name"
FROM "SubscriptionPlan" sp
WHERE cs."planId" = sp."id"
  AND (
    cs."priceSnapshot" IS NULL
    OR cs."planNameSnapshot" IS NULL
  );
