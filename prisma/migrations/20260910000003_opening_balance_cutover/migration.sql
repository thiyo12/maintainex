-- Opening balance cutover: backfill FinancialLedger with opening entries
-- for every WalletBalance row that has no existing OPENING_BALANCE credit.
-- Idempotent: uses wallet-specific idempotency keys, ON CONFLICT DO NOTHING.

INSERT INTO "FinancialLedger" (
  "id", "groupId", "accountId", "accountType", "entryType",
  "amount", "currency", "referenceType", "referenceId",
  "idempotencyKey", "description", "createdBy", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  'opening_' || wb."walletId",
  wb."walletId",
  CASE wb."walletType" WHEN 'CUSTOMER' THEN 'CUSTOMER_WALLET' WHEN 'PROVIDER' THEN 'PROVIDER_WALLET' ELSE wb."walletType" || '_WALLET' END,
  'CREDIT',
  wb."balance",
  'LKR',
  'OPENING_BALANCE',
  'opening-' || wb."walletId",
  'opening-balance-' || wb."walletId" || '-' || wb."version",
  'Opening balance cutover from WalletBalance snapshot',
  'system',
  CURRENT_TIMESTAMP
FROM "WalletBalance" wb
WHERE wb."balance" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "FinancialLedger" fl
    WHERE fl."referenceType" = 'OPENING_BALANCE'
      AND fl."referenceId" = 'opening-' || wb."walletId"
      AND fl."entryType" = 'CREDIT'
  )
ON CONFLICT ("idempotencyKey") DO NOTHING;

INSERT INTO "FinancialLedger" (
  "id", "groupId", "accountId", "accountType", "entryType",
  "amount", "currency", "referenceType", "referenceId",
  "idempotencyKey", "description", "createdBy", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  'opening_' || wb."walletId",
  'OPENING_BALANCE_OFFSET',
  'PLATFORM',
  'DEBIT',
  wb."balance",
  'LKR',
  'OPENING_BALANCE',
  'opening-' || wb."walletId",
  'opening-balance-offset-' || wb."walletId" || '-' || wb."version",
  'Opening balance offset for WalletBalance snapshot',
  'system',
  CURRENT_TIMESTAMP
FROM "WalletBalance" wb
WHERE wb."balance" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "FinancialLedger" fl
    WHERE fl."referenceType" = 'OPENING_BALANCE'
      AND fl."referenceId" = 'opening-' || wb."walletId"
      AND fl."entryType" = 'DEBIT'
  )
ON CONFLICT ("idempotencyKey") DO NOTHING;
