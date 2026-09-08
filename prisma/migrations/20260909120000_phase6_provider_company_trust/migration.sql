-- Phase 6: Provider / Company / Trust Architecture

-- AlterTable: TeamMember
ALTER TABLE "TeamMember" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "TeamMember" ADD COLUMN "invitedBy" TEXT;
ALTER TABLE "TeamMember" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: TeamInvite
ALTER TABLE "TeamInvite" ADD COLUMN "invitedBy" TEXT;

-- CreateTable: Certification
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "holderType" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "certificationType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "referenceNumber" TEXT,
    "issuedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verificationNote" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "documentUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CompanyAuditLog
CREATE TABLE "CompanyAuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "description" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProviderDocument
CREATE TABLE "ProviderDocument" (
    "id" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verificationNote" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Certification_holderType_holderId_idx" ON "Certification"("holderType", "holderId");
CREATE INDEX "Certification_verificationStatus_idx" ON "Certification"("verificationStatus");
CREATE INDEX "Certification_expiryDate_idx" ON "Certification"("expiryDate");

CREATE INDEX "CompanyAuditLog_companyId_idx" ON "CompanyAuditLog"("companyId");
CREATE INDEX "CompanyAuditLog_actorId_idx" ON "CompanyAuditLog"("actorId");
CREATE INDEX "CompanyAuditLog_action_idx" ON "CompanyAuditLog"("action");
CREATE INDEX "CompanyAuditLog_createdAt_idx" ON "CompanyAuditLog"("createdAt");

CREATE INDEX "ProviderDocument_providerType_providerId_idx" ON "ProviderDocument"("providerType", "providerId");
CREATE INDEX "ProviderDocument_verificationStatus_idx" ON "ProviderDocument"("verificationStatus");

-- AddForeignKey
ALTER TABLE "CompanyAuditLog" ADD CONSTRAINT "CompanyAuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (TeamMember unique constraint)
CREATE UNIQUE INDEX "TeamMember_companyId_userId_key" ON "TeamMember"("companyId", "userId");
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");
