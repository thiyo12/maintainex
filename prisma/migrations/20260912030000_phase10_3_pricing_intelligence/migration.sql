-- Phase 10.3: Pricing Intelligence + Regional Benchmarks + Quote Structure

-- 1. Extend ServiceTemplate with pricing mode
ALTER TABLE "ServiceTemplate" ADD COLUMN "pricingMode" TEXT NOT NULL DEFAULT 'SMART_QUOTE';
ALTER TABLE "ServiceTemplate" ADD COLUMN "benchmarkEligible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ServiceTemplate" ADD COLUMN "instantPriceCents" BIGINT;
ALTER TABLE "ServiceTemplate" ADD COLUMN "inspectionFeeCents" BIGINT;

-- 2. Extend MarketConfig with benchmark configuration
ALTER TABLE "MarketConfig" ADD COLUMN "minBenchmarkSample" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "MarketConfig" ADD COLUMN "benchmarkPercentileLow" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "MarketConfig" ADD COLUMN "benchmarkPercentileHigh" INTEGER NOT NULL DEFAULT 75;
ALTER TABLE "MarketConfig" ADD COLUMN "benchmarkOutlierIqrMult" DOUBLE PRECISION NOT NULL DEFAULT 1.5;
ALTER TABLE "MarketConfig" ADD COLUMN "benchmarkFallbackEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MarketConfig" ADD COLUMN "benchmarkResearchIntervalMonths" INTEGER NOT NULL DEFAULT 3;

-- 3. Extend JobQuote with revision and classification
ALTER TABLE "JobQuote" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'LKR';
ALTER TABLE "JobQuote" ADD COLUMN "subtotalCents" BIGINT;
ALTER TABLE "JobQuote" ADD COLUMN "taxCents" BIGINT;
ALTER TABLE "JobQuote" ADD COLUMN "totalCents" BIGINT;
ALTER TABLE "JobQuote" ADD COLUMN "benchmarkClassification" TEXT;
ALTER TABLE "JobQuote" ADD COLUMN "benchmarkId" TEXT;
ALTER TABLE "JobQuote" ADD COLUMN "revisionNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "JobQuote" ADD COLUMN "parentQuoteId" TEXT;
ALTER TABLE "JobQuote" ADD COLUMN "revisionReason" TEXT;

-- 4. Create PriceBenchmark table
CREATE TABLE "PriceBenchmark" (
    "id" TEXT NOT NULL,
    "serviceTemplateId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "region" TEXT,
    "city" TEXT,
    "currency" TEXT NOT NULL,
    "pricingMode" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "medianAmountCents" BIGINT NOT NULL DEFAULT 0,
    "lowerPercentileCents" BIGINT NOT NULL DEFAULT 0,
    "upperPercentileCents" BIGINT NOT NULL DEFAULT 0,
    "minimumObservedCents" BIGINT,
    "maximumObservedCents" BIGINT,
    "sourceType" TEXT NOT NULL,
    "sourceReference" TEXT,
    "methodologyNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMPTZ,
    "effectiveTo" TIMESTAMPTZ,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "publishedAt" TIMESTAMPTZ,
    "supersededBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PriceBenchmark_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PriceBenchmark_serviceTemplateId_fkey" FOREIGN KEY ("serviceTemplateId") REFERENCES "ServiceTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PriceBenchmark_serviceTemplateId_countryCode_region_city_version_key" ON "PriceBenchmark"("serviceTemplateId", "countryCode", "region", "city", "version");
CREATE INDEX "PriceBenchmark_serviceTemplateId_idx" ON "PriceBenchmark"("serviceTemplateId");
CREATE INDEX "PriceBenchmark_countryCode_region_city_idx" ON "PriceBenchmark"("countryCode", "region", "city");
CREATE INDEX "PriceBenchmark_status_idx" ON "PriceBenchmark"("status");
CREATE INDEX "PriceBenchmark_effectiveFrom_effectiveTo_idx" ON "PriceBenchmark"("effectiveFrom", "effectiveTo");
CREATE INDEX "PriceBenchmark_currency_idx" ON "PriceBenchmark"("currency");

-- 5. Create QuoteLineItem table
CREATE TABLE "QuoteLineItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unitAmountCents" BIGINT NOT NULL,
    "totalAmountCents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteLineItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "QuoteLineItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "JobQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "QuoteLineItem_quoteId_idx" ON "QuoteLineItem"("quoteId");
CREATE INDEX "QuoteLineItem_type_idx" ON "QuoteLineItem"("type");

-- 6. Add indexes for JobQuote revision chain
CREATE INDEX "JobQuote_parentQuoteId_idx" ON "JobQuote"("parentQuoteId");
