-- Phase 8: Country Engine — Schema Migration
-- Base: b45cbedc907ffadd199a25f42b757feff3e57c05
-- All new columns use DEFAULT values so existing rows are safe.
-- No data is deleted. No monetary values are altered.

-- =============================================
-- 1. User — add countryCode
-- =============================================
ALTER TABLE "User" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'LK';

-- =============================================
-- 2. Category — add countryCode
-- =============================================
ALTER TABLE "Category" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'LK';

-- =============================================
-- 3. Service — add countryCode
-- =============================================
ALTER TABLE "Service" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'LK';

-- =============================================
-- 4. TaskerSkill — add countryCode
-- =============================================
ALTER TABLE "TaskerSkill" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'LK';

-- =============================================
-- 5. TaskerProfile — add countryCode
-- =============================================
ALTER TABLE "TaskerProfile" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'LK';

-- =============================================
-- 6. CompanyProfile — add countryCode
-- =============================================
ALTER TABLE "CompanyProfile" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'LK';

-- =============================================
-- 7. Dispute — add countryCode
-- =============================================
ALTER TABLE "Dispute" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'LK';

-- =============================================
-- 8. IdentityDocument — add countryCode
-- =============================================
ALTER TABLE "IdentityDocument" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'LK';

-- =============================================
-- 9. OffPlatformDeal — add countryCode
-- =============================================
ALTER TABLE "OffPlatformDeal" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'LK';

-- =============================================
-- 10. Payout — add currency, countryCode
-- =============================================
ALTER TABLE "Payout" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'LKR';
ALTER TABLE "Payout" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'LK';

-- =============================================
-- 11. JobEscrow — add currency
-- =============================================
ALTER TABLE "JobEscrow" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'LKR';

-- =============================================
-- 12. CommissionSettlement — add currency, countryCode
-- =============================================
ALTER TABLE "CommissionSettlement" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'LKR';
ALTER TABLE "CommissionSettlement" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'LK';

-- =============================================
-- 13. ProviderWallet — add currency
-- =============================================
ALTER TABLE "ProviderWallet" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'LKR';

-- =============================================
-- 14. CustomerWallet — add currency
-- =============================================
ALTER TABLE "CustomerWallet" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'LKR';

-- =============================================
-- 15. WalletTransaction — add currency
-- =============================================
ALTER TABLE "WalletTransaction" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'LKR';

-- =============================================
-- 16. WeeklySettlement — add currency, countryCode
-- =============================================
ALTER TABLE "WeeklySettlement" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'LKR';
ALTER TABLE "WeeklySettlement" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'LK';

-- =============================================
-- 17. CommissionPayment — add currency, countryCode
-- =============================================
ALTER TABLE "CommissionPayment" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'LKR';
ALTER TABLE "CommissionPayment" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'LK';

-- =============================================
-- 18. MarketConfig — add defaultCurrency
-- =============================================
ALTER TABLE "MarketConfig" ADD COLUMN "defaultCurrency" TEXT NOT NULL DEFAULT 'LKR';

-- =============================================
-- 19. WalletBalance — add currency, update unique constraint
-- =============================================
-- Step 1: Add currency column with default
ALTER TABLE "WalletBalance" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'LKR';

-- Step 2: Drop old unique constraint
ALTER TABLE "WalletBalance" DROP CONSTRAINT IF EXISTS "WalletBalance_walletType_walletId_key";

-- Step 3: Create new unique constraint including currency
ALTER TABLE "WalletBalance" ADD CONSTRAINT "WalletBalance_walletType_walletId_currency_key" UNIQUE ("walletType", "walletId", "currency");
