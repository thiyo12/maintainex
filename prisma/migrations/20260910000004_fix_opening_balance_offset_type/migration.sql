-- Fix opening balance offset accountType: 'PLATFORM' → 'OPENING_BALANCE_OFFSET'
-- The offset entry for opening balance cutover is not platform revenue.
-- accountType is free text (String), no schema change required.

UPDATE "FinancialLedger"
SET "accountType" = 'OPENING_BALANCE_OFFSET'
WHERE "accountId" = 'OPENING_BALANCE_OFFSET'
  AND "referenceType" = 'OPENING_BALANCE'
  AND "accountType" = 'PLATFORM';
