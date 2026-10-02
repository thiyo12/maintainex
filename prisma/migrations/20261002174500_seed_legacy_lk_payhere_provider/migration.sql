-- Preserve the currently proven Sri Lanka card-payment path when the
-- provider registry becomes authoritative.
--
-- This seeds operational metadata only. No PayHere credentials are stored.
-- Existing operator configuration wins because ON CONFLICT does nothing.
-- PayPal is deliberately NOT auto-enabled in any market.

INSERT INTO "PaymentProviderConfig" (
  "id",
  "countryCode",
  "provider",
  "enabled",
  "environment",
  "supportedCurrencies",
  "paymentMethods",
  "capabilities",
  "captureMode",
  "operationalStatus",
  "priority",
  "createdAt",
  "updatedAt"
)
VALUES (
  'provider-lk-payhere-live',
  'LK',
  'PAYHERE',
  TRUE,
  'LIVE',
  '["LKR"]',
  '["CARD"]',
  '{"checkout":true,"authorize":false,"capture":true,"refund":true,"partialRefund":false,"webhooks":true,"disputes":false,"payouts":false,"reconciliation":true}',
  'CAPTURE',
  'ACTIVE',
  10,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("countryCode", "provider") DO NOTHING;
