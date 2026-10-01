-- Provider-aware payment intents for the PayPal migration.
-- Existing production rows were created by the legacy PayHere integration,
-- so backfill them before making PayPal the default for new rows.
ALTER TABLE "PaymentIntent"
  ADD COLUMN "gateway" TEXT,
  ADD COLUMN "refundId" TEXT;

UPDATE "PaymentIntent"
SET "gateway" = 'PAYHERE'
WHERE "gateway" IS NULL;

ALTER TABLE "PaymentIntent"
  ALTER COLUMN "gateway" SET NOT NULL,
  ALTER COLUMN "gateway" SET DEFAULT 'PAYPAL';

CREATE INDEX "PaymentIntent_gateway_status_idx"
  ON "PaymentIntent"("gateway", "status");
