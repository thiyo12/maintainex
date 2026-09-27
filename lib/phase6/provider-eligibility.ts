import { prisma } from '@/lib/prisma'
import { readStoredList } from '@/lib/db-utils'

export interface ProviderEligibility {
  eligible: boolean
  reasons: string[]
}

export async function checkIndividualProviderEligibility(userId: string): Promise<ProviderEligibility> {
  const reasons: string[] = []

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { identityStatus: true, isSuspended: true, isBanned: true, role: true },
  })
  if (!user) {
    return { eligible: false, reasons: ['User not found'] }
  }

  if (user.isSuspended) reasons.push('Account is suspended')
  if (user.isBanned) reasons.push('Account is banned')
  if (user.identityStatus !== 'VERIFIED') reasons.push('Identity not verified')

  const profile = await prisma.taskerProfile.findUnique({
    where: { userId },
    select: { id: true, verificationStatus: true, isVerified: true, skills: true },
  })
  if (!profile) {
    return { eligible: false, reasons: ['Provider profile not found'] }
  }

  if (profile.verificationStatus !== 'VERIFIED') reasons.push('Provider verification not approved')
  if (!profile.isVerified) reasons.push('Provider not marked as verified')

  const hasLegacySkills = profile.skills && profile.skills !== '[]' && profile.skills !== ''
  if (!hasLegacySkills) {
    const relationalSkillCount = await prisma.taskerSkill.count({ where: { taskerId: profile.id } })
    if (relationalSkillCount === 0) {
      reasons.push('No service capabilities declared')
    }
  }

  return { eligible: reasons.length === 0, reasons }
}

export async function checkCompanyEligibility(companyId: string): Promise<ProviderEligibility> {
  const reasons: string[] = []

  const company = await prisma.companyProfile.findUnique({
    where: { id: companyId },
    select: {
      verificationStatus: true,
      isVerified: true,
      services: true,
      subscriptionStatus: true,
      userId: true,
    },
  })
  if (!company) {
    return { eligible: false, reasons: ['Company not found'] }
  }

  if (company.verificationStatus !== 'VERIFIED') reasons.push('Company verification not approved')
  if (!company.isVerified) reasons.push('Company not marked as verified')

  const hasLegacyServices = company.services && company.services !== ''
  if (!hasLegacyServices) {
    const relationalSpecialtyCount = await prisma.companySpecialty.count({ where: { companyId } })
    if (relationalSpecialtyCount === 0) {
      reasons.push('No service capabilities declared')
    }
  }
  if (company.subscriptionStatus === 'CANCELLED') reasons.push('Subscription cancelled')

  const user = await prisma.user.findUnique({
    where: { id: company.userId },
    select: { isSuspended: true, isBanned: true },
  })
  if (user?.isSuspended) reasons.push('Company owner account is suspended')
  if (user?.isBanned) reasons.push('Company owner account is banned')

  const ownerCount = await prisma.teamMember.count({
    where: { companyId, role: 'COMPANY_OWNER', status: 'ACTIVE' },
  })
  if (ownerCount === 0) reasons.push('No active company owner')

  return { eligible: reasons.length === 0, reasons }
}

export async function checkWorkerEligibility(
  companyId: string,
  userId: string,
  requiredJobId?: string
): Promise<ProviderEligibility> {
  const reasons: string[] = []

  const member = await prisma.teamMember.findFirst({
    where: { companyId, userId, status: 'ACTIVE' },
  })
  if (!member) {
    return { eligible: false, reasons: ['Not an active member of this company'] }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { identityStatus: true, isSuspended: true, isBanned: true },
  })
  if (!user) {
    return { eligible: false, reasons: ['User account not found'] }
  }

  if (user.isSuspended) reasons.push('Worker account is suspended')
  if (user.isBanned) reasons.push('Worker account is banned')
  if (user.identityStatus !== 'VERIFIED') reasons.push('Worker identity not verified')

  if (requiredJobId) {
    const job = await prisma.marketplaceJob.findUnique({
      where: { id: requiredJobId },
      select: { categoryId: true, serviceTemplateId: true, preferredDate: true, preferredTimeSlot: true },
    })
    if (!job) {
      reasons.push('Job not found')
    } else {
      const [profile, category, template] = await Promise.all([
        prisma.taskerProfile.findUnique({
          where: { userId },
          select: { id: true, skills: true },
        }),
        prisma.jobCategory.findUnique({
          where: { id: job.categoryId },
          select: { id: true, name: true, slug: true },
        }),
        job.serviceTemplateId
          ? prisma.serviceTemplate.findUnique({
              where: { id: job.serviceTemplateId },
              select: { id: true, jobCategoryId: true },
            })
          : Promise.resolve(null),
      ])

      const requiredCategoryId = template?.jobCategoryId || job.categoryId
      const relationalCapability = profile
        ? await prisma.taskerSkill.findFirst({
            where: {
              taskerId: profile.id,
              job: { categoryId: requiredCategoryId },
            },
            select: { id: true },
          })
        : null

      const capabilityTokens = new Set(
        readStoredList(member.skills)
          .concat(profile ? readStoredList(profile.skills) : [])
          .map(value => value.trim().toLowerCase())
          .filter(Boolean)
      )
      const categoryTokens = [
        requiredCategoryId,
        category?.id,
        category?.name,
        category?.slug,
        job.serviceTemplateId,
      ]
        .filter((value): value is string => !!value)
        .map(value => value.trim().toLowerCase())

      const declaredCapability = categoryTokens.some(token => capabilityTokens.has(token))

      if (!relationalCapability && !declaredCapability) {
        reasons.push('Worker lacks required capability for this job')
      }

      if (job.preferredDate) {
        const conflictingAssignments = await prisma.companyJobAssignment.findMany({
          where: {
            workerUserId: userId,
            status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
            jobId: { not: requiredJobId },
            job: {
              preferredDate: job.preferredDate,
              preferredTimeSlot: job.preferredTimeSlot || undefined,
            },
          },
          select: { id: true, jobId: true },
        })
        if (conflictingAssignments.length > 0) {
          reasons.push('Worker has a scheduling conflict with another assignment on the same date/time')
        }
      }
    }
  }

  return { eligible: reasons.length === 0, reasons }
}
