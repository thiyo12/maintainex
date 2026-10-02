-- Every new payment intent must declare its provider explicitly.
-- Existing rows are preserved; only the column default is removed.
ALTER TABLE "PaymentIntent"
  ALTER COLUMN "gateway" DROP DEFAULT;
