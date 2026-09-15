-- AlterTable
ALTER TABLE "PriceBenchmark" ADD COLUMN "geographyLevel" TEXT NOT NULL DEFAULT 'COUNTRY',
ADD COLUMN "submittedBy" TEXT,
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "supersededFromId" TEXT;
