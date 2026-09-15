-- Phase 10.1: Profession & Skill Eligibility Foundation
-- Adds 10 new models for profession taxonomy, provider capabilities,
-- service requirements, jurisdiction foundations, and submission workflow.
-- Extends CompanySpecialty with optional professionId FK.
-- No data is deleted. No monetary values are altered.

-- =============================================
-- 1. Profession — global taxonomy
-- =============================================
CREATE TABLE "Profession" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "i18nKey" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Profession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Profession_slug_key" ON "Profession"("slug");
CREATE UNIQUE INDEX "Profession_i18nKey_key" ON "Profession"("i18nKey");

-- =============================================
-- 3. ProfessionSkill — skills under a profession
-- =============================================
CREATE TABLE "ProfessionSkill" (
  "id" TEXT NOT NULL,
  "professionId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "i18nKey" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProfessionSkill_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionSkill_professionId_fkey" FOREIGN KEY ("professionId")
    REFERENCES "Profession"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProfessionSkill_professionId_slug_key" ON "ProfessionSkill"("professionId", "slug");
CREATE INDEX "ProfessionSkill_professionId_idx" ON "ProfessionSkill"("professionId");

-- =============================================
-- 2b. Extend CompanySpecialty — add professionId
-- =============================================
ALTER TABLE "CompanySpecialty" ADD COLUMN "professionId" TEXT;
ALTER TABLE "CompanySpecialty" ADD CONSTRAINT "CompanySpecialty_professionId_fkey"
  FOREIGN KEY ("professionId") REFERENCES "Profession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CompanySpecialty_professionId_idx" ON "CompanySpecialty"("professionId");

-- =============================================
-- 4. TaskerProfession — tasker → profession capability
-- =============================================
CREATE TABLE "TaskerProfession" (
  "id" TEXT NOT NULL,
  "taskerProfileId" TEXT NOT NULL,
  "professionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TaskerProfession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskerProfession_taskerProfileId_fkey" FOREIGN KEY ("taskerProfileId")
    REFERENCES "TaskerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskerProfession_professionId_fkey" FOREIGN KEY ("professionId")
    REFERENCES "Profession"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaskerProfession_taskerProfileId_professionId_key" ON "TaskerProfession"("taskerProfileId", "professionId");
CREATE INDEX "TaskerProfession_taskerProfileId_idx" ON "TaskerProfession"("taskerProfileId");
CREATE INDEX "TaskerProfession_professionId_idx" ON "TaskerProfession"("professionId");
CREATE INDEX "TaskerProfession_status_idx" ON "TaskerProfession"("status");

-- =============================================
-- 5. TaskerProfessionSkill — tasker profession → skill
-- =============================================
CREATE TABLE "TaskerProfessionSkill" (
  "id" TEXT NOT NULL,
  "taskerProfessionId" TEXT NOT NULL,
  "professionSkillId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TaskerProfessionSkill_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskerProfessionSkill_taskerProfessionId_fkey" FOREIGN KEY ("taskerProfessionId")
    REFERENCES "TaskerProfession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskerProfessionSkill_professionSkillId_fkey" FOREIGN KEY ("professionSkillId")
    REFERENCES "ProfessionSkill"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaskerProfessionSkill_taskerProfessionId_professionSkillId_key" ON "TaskerProfessionSkill"("taskerProfessionId", "professionSkillId");
CREATE INDEX "TaskerProfessionSkill_taskerProfessionId_idx" ON "TaskerProfessionSkill"("taskerProfessionId");
CREATE INDEX "TaskerProfessionSkill_professionSkillId_idx" ON "TaskerProfessionSkill"("professionSkillId");

-- =============================================
-- 6. CompanyProfession — company → profession capability
-- =============================================
CREATE TABLE "CompanyProfession" (
  "id" TEXT NOT NULL,
  "companyProfileId" TEXT NOT NULL,
  "professionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompanyProfession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanyProfession_companyProfileId_fkey" FOREIGN KEY ("companyProfileId")
    REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompanyProfession_professionId_fkey" FOREIGN KEY ("professionId")
    REFERENCES "Profession"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CompanyProfession_companyProfileId_professionId_key" ON "CompanyProfession"("companyProfileId", "professionId");
CREATE INDEX "CompanyProfession_companyProfileId_idx" ON "CompanyProfession"("companyProfileId");
CREATE INDEX "CompanyProfession_professionId_idx" ON "CompanyProfession"("professionId");
CREATE INDEX "CompanyProfession_status_idx" ON "CompanyProfession"("status");

-- =============================================
-- 7. CompanyProfessionSkill — company profession → skill
-- =============================================
CREATE TABLE "CompanyProfessionSkill" (
  "id" TEXT NOT NULL,
  "companyProfessionId" TEXT NOT NULL,
  "professionSkillId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanyProfessionSkill_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanyProfessionSkill_companyProfessionId_fkey" FOREIGN KEY ("companyProfessionId")
    REFERENCES "CompanyProfession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompanyProfessionSkill_professionSkillId_fkey" FOREIGN KEY ("professionSkillId")
    REFERENCES "ProfessionSkill"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CompanyProfessionSkill_companyProfessionId_professionSkillId_key" ON "CompanyProfessionSkill"("companyProfessionId", "professionSkillId");
CREATE INDEX "CompanyProfessionSkill_companyProfessionId_idx" ON "CompanyProfessionSkill"("companyProfessionId");
CREATE INDEX "CompanyProfessionSkill_professionSkillId_idx" ON "CompanyProfessionSkill"("professionSkillId");

-- =============================================
-- 8. ServiceProfessionRequirement — service → profession
-- =============================================
CREATE TABLE "ServiceProfessionRequirement" (
  "id" TEXT NOT NULL,
  "serviceTemplateId" TEXT NOT NULL,
  "professionId" TEXT NOT NULL,
  "alternativeGroupId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceProfessionRequirement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ServiceProfessionRequirement_professionId_fkey" FOREIGN KEY ("professionId")
    REFERENCES "Profession"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ServiceProfessionRequirement_serviceTemplateId_professionId_key" ON "ServiceProfessionRequirement"("serviceTemplateId", "professionId");
CREATE INDEX "ServiceProfessionRequirement_serviceTemplateId_idx" ON "ServiceProfessionRequirement"("serviceTemplateId");
CREATE INDEX "ServiceProfessionRequirement_professionId_idx" ON "ServiceProfessionRequirement"("professionId");
CREATE INDEX "ServiceProfessionRequirement_alternativeGroupId_idx" ON "ServiceProfessionRequirement"("alternativeGroupId");

-- =============================================
-- 9. ServiceSkillRequirement — service profession → skill requirement
-- =============================================
CREATE TABLE "ServiceSkillRequirement" (
  "id" TEXT NOT NULL,
  "serviceProfessionReqId" TEXT NOT NULL,
  "professionSkillId" TEXT NOT NULL,
  "requirementMode" TEXT NOT NULL DEFAULT 'REQUIRED_ALL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceSkillRequirement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ServiceSkillRequirement_serviceProfessionReqId_fkey" FOREIGN KEY ("serviceProfessionReqId")
    REFERENCES "ServiceProfessionRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ServiceSkillRequirement_professionSkillId_fkey" FOREIGN KEY ("professionSkillId")
    REFERENCES "ProfessionSkill"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ServiceSkillRequirement_serviceProfessionReqId_professionSkillId_key" ON "ServiceSkillRequirement"("serviceProfessionReqId", "professionSkillId");
CREATE INDEX "ServiceSkillRequirement_serviceProfessionReqId_idx" ON "ServiceSkillRequirement"("serviceProfessionReqId");
CREATE INDEX "ServiceSkillRequirement_professionSkillId_idx" ON "ServiceSkillRequirement"("professionSkillId");
CREATE INDEX "ServiceSkillRequirement_requirementMode_idx" ON "ServiceSkillRequirement"("requirementMode");

-- =============================================
-- 10. ProfessionSubmission — provider submission workflow
-- =============================================
CREATE TABLE "ProfessionSubmission" (
  "id" TEXT NOT NULL,
  "submittedById" TEXT NOT NULL,
  "requestedName" TEXT NOT NULL,
  "description" TEXT,
  "suggestedServices" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "canonicalProfessionId" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProfessionSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProfessionSubmission_status_idx" ON "ProfessionSubmission"("status");
CREATE INDEX "ProfessionSubmission_submittedById_idx" ON "ProfessionSubmission"("submittedById");

-- =============================================
-- 11. ProfessionJurisdictionRequirement — jurisdiction credentials
-- =============================================
CREATE TABLE "ProfessionJurisdictionRequirement" (
  "id" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "province" TEXT,
  "professionId" TEXT NOT NULL,
  "skillId" TEXT,
  "credentialRequired" BOOLEAN NOT NULL DEFAULT false,
  "credentialType" TEXT,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProfessionJurisdictionRequirement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfessionJurisdictionRequirement_professionId_fkey" FOREIGN KEY ("professionId")
    REFERENCES "Profession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProfessionJurisdictionRequirement_skillId_fkey" FOREIGN KEY ("skillId")
    REFERENCES "ProfessionSkill"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProfessionJurisdictionRequirement_countryCode_province_professionId_skillId_key"
  ON "ProfessionJurisdictionRequirement"("countryCode", "province", "professionId", "skillId");
CREATE INDEX "ProfessionJurisdictionRequirement_countryCode_idx" ON "ProfessionJurisdictionRequirement"("countryCode");
CREATE INDEX "ProfessionJurisdictionRequirement_professionId_idx" ON "ProfessionJurisdictionRequirement"("professionId");
