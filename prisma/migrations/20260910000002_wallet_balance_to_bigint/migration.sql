-- WalletBalance: Float (major units / rupees) to BigInt (minor units / cents)
-- Pre-flight verified: 102 rows, 0 NULL, 0 negative, max 198765432.11
-- Conversion: multiply by 100, round to nearest integer, cast to bigint

ALTER TABLE "WalletBalance" ALTER COLUMN "balance" DROP DEFAULT;
ALTER TABLE "WalletBalance" ALTER COLUMN "availableBalance" DROP DEFAULT;
ALTER TABLE "WalletBalance" ALTER COLUMN "pendingBalance" DROP DEFAULT;

ALTER TABLE "WalletBalance"
  ALTER COLUMN "balance" SET DATA TYPE bigint USING ROUND("balance" * 100)::bigint,
  ALTER COLUMN "availableBalance" SET DATA TYPE bigint USING ROUND("availableBalance" * 100)::bigint,
  ALTER COLUMN "pendingBalance" SET DATA TYPE bigint USING ROUND("pendingBalance" * 100)::bigint;

ALTER TABLE "WalletBalance" ALTER COLUMN "balance" SET DEFAULT 0;
ALTER TABLE "WalletBalance" ALTER COLUMN "availableBalance" SET DEFAULT 0;
ALTER TABLE "WalletBalance" ALTER COLUMN "pendingBalance" SET DEFAULT 0;
