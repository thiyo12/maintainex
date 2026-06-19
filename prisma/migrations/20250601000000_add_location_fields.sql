-- AlterTable: TaskerProfile - add serviceRadius
ALTER TABLE "TaskerProfile" ADD COLUMN "serviceRadius" DOUBLE PRECISION;

-- AlterTable: CompanyProfile - add location fields
ALTER TABLE "CompanyProfile" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "CompanyProfile" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "CompanyProfile" ADD COLUMN "serviceRadius" DOUBLE PRECISION;

-- AlterTable: JobPosting - add isRemote
ALTER TABLE "JobPosting" ADD COLUMN "isRemote" BOOLEAN NOT NULL DEFAULT false;

-- Indexes for location queries
CREATE INDEX "TaskerProfile_latitude_longitude_idx" ON "TaskerProfile"("latitude", "longitude");
CREATE INDEX "CompanyProfile_latitude_longitude_idx" ON "CompanyProfile"("latitude", "longitude");
CREATE INDEX "JobPosting_latitude_longitude_idx" ON "JobPosting"("latitude", "longitude");
CREATE INDEX "JobPosting_isRemote_idx" ON "JobPosting"("isRemote");
