-- AlterTable: Add actor tracking fields to JobQuote
ALTER TABLE "JobQuote" ADD COLUMN "actorUserId" TEXT;
ALTER TABLE "JobQuote" ADD COLUMN "actorRole" TEXT;
