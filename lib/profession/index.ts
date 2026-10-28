import { PrismaClient, Prisma } from '@prisma/client'
import type {
  ProfessionCreateInput,
  ProfessionUpdateInput,
  ProfessionSkillCreateInput,
  ServiceProfessionRequirementInput,
  ServiceSkillRequirementInput,
  TaskerProfessionInput,
  TaskerProfessionSkillInput,
  CompanyProfessionInput,
  CompanyProfessionSkillInput,
  ProfessionSubmissionInput,
  SubmissionReviewInput,
  ProfessionWithSkills,
  ProviderProfessionCapability,
  ValidationResult,
  RequirementMode,
} from './types'

// =============================================
// PROFESSION CRUD (Global Taxonomy)
// =============================================

export async function createProfession(
  client: PrismaClient,
  input: ProfessionCreateInput,
) {
  return client.profession.create({
    data: {
      slug: input.slug,
      i18nKey: input.i18nKey,
      description: input.description,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? false,
    },
  })
}

export async function updateProfession(
  client: PrismaClient,
  id: string,
  input: ProfessionUpdateInput,
) {
  return client.profession.update({
    where: { id },
    data: input,
  })
}

export async function deactivateProfession(
  client: PrismaClient,
  id: string,
) {
  return client.profession.update({
    where: { id },
    data: { isActive: false },
  })
}

export async function getProfessionBySlug(
  client: PrismaClient,
  slug: string,
) {
  return client.profession.findUnique({
    where: { slug },
    include: {
      skills: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
}

export async function listActiveProfessions(
  client: PrismaClient,
) {
  return client.profession.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      skills: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  }) as Promise<ProfessionWithSkills[]>
}

export async function getProfessionWithSkills(
  client: PrismaClient,
  id: string,
) {
  return client.profession.findUnique({
    where: { id },
    include: {
      skills: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
}

// =============================================
// PROFESSION SKILL CRUD
// =============================================

export async function createProfessionSkill(
  client: PrismaClient,
  input: ProfessionSkillCreateInput,
) {
  return client.professionSkill.create({
    data: {
      professionId: input.professionId,
      slug: input.slug,
      i18nKey: input.i18nKey,
      description: input.description,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? false,
    },
  })
}

export async function deactivateProfessionSkill(
  client: PrismaClient,
  id: string,
) {
  return client.professionSkill.update({
    where: { id },
    data: { isActive: false },
  })
}

// =============================================
// TASKER PROFESSION CAPABILITY
// =============================================

export async function assignTaskerProfession(
  client: PrismaClient,
  input: TaskerProfessionInput,
) {
  const profession = await client.profession.findUnique({
    where: { id: input.professionId },
    select: { id: true, isActive: true },
  })
  if (!profession) throw new Error('Profession not found')
  if (!profession.isActive) throw new Error('Cannot assign inactive profession')

  const tasker = await client.taskerProfile.findUnique({
    where: { id: input.taskerProfileId },
    select: { id: true },
  })
  if (!tasker) throw new Error('Tasker not found')

  return client.taskerProfession.create({
    data: {
      taskerProfileId: input.taskerProfileId,
      professionId: input.professionId,
      status: 'PENDING',
    },
  })
}

export async function addTaskerProfessionSkill(
  client: PrismaClient,
  input: TaskerProfessionSkillInput,
) {
  const taskerProfession = await client.taskerProfession.findUnique({
    where: { id: input.taskerProfessionId },
    select: {
      id: true, professionId: true, status: true,
      profession: { select: { isActive: true } },
    },
  })
  if (!taskerProfession) throw new Error('Tasker profession not found')
  // Pending capability requests may collect skills for review; rejected,
  // suspended, or deactivated professions must not accept new skills.
  if (!taskerProfession.profession.isActive ||
      !['PENDING', 'APPROVED'].includes(taskerProfession.status)) {
    throw new Error('Cannot add skill to inactive profession')
  }

  const skill = await client.professionSkill.findUnique({
    where: { id: input.professionSkillId },
    select: { id: true, professionId: true, isActive: true },
  })
  if (!skill) throw new Error('Profession skill not found')
  if (!skill.isActive) throw new Error('Cannot add inactive skill')
  if (skill.professionId !== taskerProfession.professionId) {
    throw new Error('Skill does not belong to this profession')
  }

  return client.taskerProfessionSkill.create({
    data: {
      taskerProfessionId: input.taskerProfessionId,
      professionSkillId: input.professionSkillId,
    },
  })
}

export async function getTaskerProfessions(
  client: PrismaClient,
  taskerProfileId: string,
) {
  return client.taskerProfession.findMany({
    where: { taskerProfileId },
    include: {
      profession: {
        select: { id: true, slug: true, i18nKey: true },
      },
      skills: {
        include: {
          professionSkill: {
            select: { id: true, slug: true, i18nKey: true },
          },
        },
      },
    },
  }) as Promise<ProviderProfessionCapability[]>
}

export async function approveTaskerProfession(
  client: PrismaClient,
  taskerProfessionId: string,
  approvedBy: string,
) {
  return client.taskerProfession.update({
    where: { id: taskerProfessionId },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy,
    },
  })
}

// =============================================
// COMPANY PROFESSION CAPABILITY
// =============================================

export async function assignCompanyProfession(
  client: PrismaClient,
  input: CompanyProfessionInput,
) {
  const profession = await client.profession.findUnique({
    where: { id: input.professionId },
    select: { id: true, isActive: true },
  })
  if (!profession) throw new Error('Profession not found')
  if (!profession.isActive) throw new Error('Cannot assign inactive profession')

  const company = await client.companyProfile.findUnique({
    where: { id: input.companyProfileId },
    select: { id: true },
  })
  if (!company) throw new Error('Company not found')

  return client.companyProfession.create({
    data: {
      companyProfileId: input.companyProfileId,
      professionId: input.professionId,
      status: 'PENDING',
    },
  })
}

export async function addCompanyProfessionSkill(
  client: PrismaClient,
  input: CompanyProfessionSkillInput,
) {
  const companyProfession = await client.companyProfession.findUnique({
    where: { id: input.companyProfessionId },
    select: {
      id: true, professionId: true, status: true,
      profession: { select: { isActive: true } },
    },
  })
  if (!companyProfession) throw new Error('Company profession not found')
  if (!companyProfession.profession.isActive ||
      !['PENDING', 'APPROVED'].includes(companyProfession.status)) {
    throw new Error('Cannot add skill to inactive profession')
  }

  const skill = await client.professionSkill.findUnique({
    where: { id: input.professionSkillId },
    select: { id: true, professionId: true, isActive: true },
  })
  if (!skill) throw new Error('Profession skill not found')
  if (!skill.isActive) throw new Error('Cannot add inactive skill')
  if (skill.professionId !== companyProfession.professionId) {
    throw new Error('Skill does not belong to this profession')
  }

  return client.companyProfessionSkill.create({
    data: {
      companyProfessionId: input.companyProfessionId,
      professionSkillId: input.professionSkillId,
    },
  })
}

export async function getCompanyProfessions(
  client: PrismaClient,
  companyProfileId: string,
) {
  return client.companyProfession.findMany({
    where: { companyProfileId },
    include: {
      profession: {
        select: { id: true, slug: true, i18nKey: true },
      },
      skills: {
        include: {
          professionSkill: {
            select: { id: true, slug: true, i18nKey: true },
          },
        },
      },
    },
  }) as Promise<ProviderProfessionCapability[]>
}

export async function approveCompanyProfession(
  client: PrismaClient,
  companyProfessionId: string,
  approvedBy: string,
) {
  return client.companyProfession.update({
    where: { id: companyProfessionId },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy,
    },
  })
}

// =============================================
// SERVICE REQUIREMENTS
// =============================================

export async function setServiceProfessionRequirement(
  client: PrismaClient,
  input: ServiceProfessionRequirementInput,
) {
  const profession = await client.profession.findUnique({
    where: { id: input.professionId },
    select: { id: true, isActive: true },
  })
  if (!profession) throw new Error('Profession not found')
  if (!profession.isActive) throw new Error('Cannot require inactive profession')

  return client.serviceProfessionRequirement.upsert({
    where: {
      serviceTemplateId_professionId: {
        serviceTemplateId: input.serviceTemplateId,
        professionId: input.professionId,
      },
    },
    update: {
      alternativeGroupId: input.alternativeGroupId,
    },
    create: {
      serviceTemplateId: input.serviceTemplateId,
      professionId: input.professionId,
      alternativeGroupId: input.alternativeGroupId,
    },
  })
}

export async function setServiceSkillRequirement(
  client: PrismaClient,
  input: ServiceSkillRequirementInput,
) {
  const [skill, serviceRequirement] = await Promise.all([
    client.professionSkill.findUnique({
      where: { id: input.professionSkillId },
      select: { id: true, isActive: true, professionId: true },
    }),
    client.serviceProfessionRequirement.findUnique({
      where: { id: input.serviceProfessionReqId },
      select: { id: true, professionId: true },
    }),
  ])
  if (!skill) throw new Error('Profession skill not found')
  if (!skill.isActive) throw new Error('Cannot require inactive skill')
  if (!serviceRequirement) throw new Error('Service profession requirement not found')
  if (skill.professionId !== serviceRequirement.professionId) {
    throw new Error('Skill does not belong to the required profession')
  }

  return client.serviceSkillRequirement.upsert({
    where: {
      serviceProfessionReqId_professionSkillId: {
        serviceProfessionReqId: input.serviceProfessionReqId,
        professionSkillId: input.professionSkillId,
      },
    },
    update: {
      requirementMode: input.requirementMode,
    },
    create: {
      serviceProfessionReqId: input.serviceProfessionReqId,
      professionSkillId: input.professionSkillId,
      requirementMode: input.requirementMode,
    },
  })
}

export async function getServiceRequirements(
  client: PrismaClient,
  serviceTemplateId: string,
) {
  return client.serviceProfessionRequirement.findMany({
    where: { serviceTemplateId },
    include: {
      profession: {
        select: { id: true, slug: true, i18nKey: true },
      },
      skillRequirements: {
        include: {
          professionSkill: {
            select: { id: true, slug: true, i18nKey: true },
          },
        },
      },
    },
  })
}

// =============================================
// PROFESSION SUBMISSION
// =============================================

export async function createProfessionSubmission(
  client: PrismaClient,
  input: ProfessionSubmissionInput,
) {
  return client.professionSubmission.create({
    data: {
      submittedById: input.submittedById,
      requestedName: input.requestedName,
      description: input.description,
      suggestedServices: input.suggestedServices
        ? JSON.stringify(input.suggestedServices)
        : null,
    },
  })
}

export async function reviewProfessionSubmission(
  client: PrismaClient,
  input: SubmissionReviewInput,
) {
  const submission = await client.professionSubmission.findUnique({
    where: { id: input.submissionId },
    select: { id: true, status: true, submittedById: true },
  })
  if (!submission) throw new Error('Submission not found')
  if (submission.status !== 'SUBMITTED' && submission.status !== 'UNDER_REVIEW') {
    throw new Error('Submission already reviewed')
  }
  if (submission.submittedById && submission.submittedById === input.reviewedBy) {
    throw new Error('Self-review prohibited: reviewer cannot review own submission')
  }

  return client.professionSubmission.update({
    where: { id: input.submissionId },
    data: {
      status: input.status,
      canonicalProfessionId: input.canonicalProfessionId,
      reviewedBy: input.reviewedBy,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote,
    },
  })
}

export async function listPendingSubmissions(
  client: PrismaClient,
) {
  return client.professionSubmission.findMany({
    where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
    orderBy: { createdAt: 'asc' },
  })
}

// =============================================
// VALIDATION HELPERS
// =============================================

export async function validateTaskerProfessionAssignment(
  client: PrismaClient,
  taskerProfileId: string,
  professionId: string,
): Promise<ValidationResult> {
  const errors: string[] = []

  const profession = await client.profession.findUnique({
    where: { id: professionId },
    select: { id: true, isActive: true },
  })
  if (!profession) errors.push('Profession not found')
  else if (!profession.isActive) errors.push('Profession is inactive')

  const tasker = await client.taskerProfile.findUnique({
    where: { id: taskerProfileId },
    select: { id: true },
  })
  if (!tasker) errors.push('Tasker not found')

  const existing = await client.taskerProfession.findUnique({
    where: {
      taskerProfileId_professionId: { taskerProfileId, professionId },
    },
    select: { id: true },
  })
  if (existing) errors.push('Profession already assigned to this tasker')

  return { valid: errors.length === 0, errors }
}

export async function validateTaskerProfessionSkill(
  client: PrismaClient,
  taskerProfessionId: string,
  professionSkillId: string,
): Promise<ValidationResult> {
  const errors: string[] = []

  const taskerProfession = await client.taskerProfession.findUnique({
    where: { id: taskerProfessionId },
    select: { id: true, professionId: true },
  })
  if (!taskerProfession) {
    errors.push('Tasker profession not found')
    return { valid: false, errors }
  }

  const skill = await client.professionSkill.findUnique({
    where: { id: professionSkillId },
    select: { id: true, professionId: true, isActive: true },
  })
  if (!skill) {
    errors.push('Profession skill not found')
  } else {
    if (!skill.isActive) errors.push('Skill is inactive')
    if (skill.professionId !== taskerProfession.professionId) {
      errors.push('Skill does not belong to this profession')
    }
  }

  return { valid: errors.length === 0, errors }
}

// =============================================
// ELIGIBILITY HELPERS (Phase 10.2 will use these)
// =============================================

export async function getProviderProfessionEligibility(
  client: PrismaClient,
  providerType: 'tasker' | 'company',
  providerId: string,
  serviceTemplateId: string,
) {
  const requirements = await client.serviceProfessionRequirement.findMany({
    where: { serviceTemplateId },
    include: {
      profession: { select: { id: true, isActive: true } },
      skillRequirements: {
        include: {
          professionSkill: { select: { id: true, isActive: true } },
        },
      },
    },
  })

  if (requirements.length === 0) {
    return { eligible: true, matchedProfessionId: null, matchedSkills: [] }
  }

  const providerProfessions = providerType === 'tasker'
    ? await client.taskerProfession.findMany({
        where: {
          taskerProfileId: providerId, status: 'APPROVED',
          profession: { isActive: true },
        },
        include: {
          profession: { select: { isActive: true } },
          skills: {
            where: { professionSkill: { isActive: true } },
            select: { professionSkillId: true },
          },
        },
      })
    : await client.companyProfession.findMany({
        where: {
          companyProfileId: providerId, status: 'APPROVED',
          profession: { isActive: true },
        },
        include: {
          profession: { select: { isActive: true } },
          skills: {
            where: { professionSkill: { isActive: true } },
            select: { professionSkillId: true },
          },
        },
      })

  // Query filters protect the real DB. Check returned relations as well so
  // stale or incorrectly materialized eligibility evidence also fails closed.
  const activeProfessions = providerProfessions.filter(p => p.profession?.isActive === true)
  const professionIds = new Set(activeProfessions.map(p => p.professionId))
  const skillIds = new Set(
    activeProfessions.flatMap(p =>
      p.skills.map((s: { professionSkillId: string }) => s.professionSkillId)
    ),
  )

  for (const req of requirements) {
    // Deactivation never silently waives the service's profession rule.
    if (!req.profession.isActive || !professionIds.has(req.professionId)) continue

    const allSkills = req.skillRequirements.map(sr => ({
      skillId: sr.professionSkillId,
      active: sr.professionSkill.isActive,
      mode: sr.requirementMode as RequirementMode,
    }))

    const requiredAll = allSkills.filter(s => s.mode === 'REQUIRED_ALL')
    const requiredAny = allSkills.filter(s => s.mode === 'REQUIRED_ANY_OF')

    const hasAllRequired = requiredAll.every(s => s.active && skillIds.has(s.skillId))
    const hasAnyRequired = requiredAny.length === 0 ||
      requiredAny.some(s => s.active && skillIds.has(s.skillId))

    if (hasAllRequired && hasAnyRequired) {
      return {
        eligible: true,
        matchedProfessionId: req.professionId,
        matchedSkills: allSkills.filter(s => s.active && skillIds.has(s.skillId)).map(s => s.skillId),
      }
    }
  }

  return { eligible: false, matchedProfessionId: null, matchedSkills: [] }
}
