-- AlterTable: Make MarketplaceJob.budgetAmount nullable
-- Existing non-null values are preserved. New jobs may omit budget.
ALTER TABLE "MarketplaceJob" ALTER COLUMN "budgetAmount" DROP NOT NULL;
