import { prisma } from '@/lib/prisma'
import { requireJobMarket } from '@/lib/geography/market-engine'
import { readStoredList } from '@/lib/db-utils'

/** Legacy capabilities can be JSON lists or old comma-separated labels.
 * An empty JSON array is NOT a declared capability, even if the string is truthy.
 */
export function hasDeclaredProviderCapabilities(stored: string | null | undefined): boolean {
  return readStoredList(stored).some(value => value.trim().length > 0)
}

export interface ProviderEligibility {
  eligible: boolean
  reasons: string[]
}

export async function checkIndividualProviderEligibility(userId: string): Promise<ProviderEligibility> {
  const reasons: string[] = []

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { identityStatus: true, isActive: true, isSuspended: true, isBanned: true, role: true },
  })
  if (!user) {
    return { eligible: false, reasons: ['User not found'] }
  }

  if (user.isActive === false) reasons.push('Account is inactive')
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

  const hasLegacySkills = hasDeclaredProviderCapabilities(profile.skills)
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
    },
  })
  if (!company) {
    return { eligible: false, reasons: ['Company not found'] }
  }

  if (company.verificationStatus !== 'VERIFIED') reasons.push('Company verification not approved')
  if (!company.isVerified) reasons.push('Company not marked as verified')

  const hasLegacyServices = hasDeclaredProviderCapabilities(company.services)
  if (!hasLegacyServices) {
    const relationalSpecialtyCount = await prisma.companySpecialty.count({ where: { companyId } })
    if (relationalSpecialtyCount === 0) {
      reasons.push('No service capabilities declared')
    }
  }
  if (company.subscriptionStatus === 'CANCELLED') reasons.push('Subscription cancelled')

  // CompanyProfile.userId is the historical creator link. Ownership transfer
  // changes TeamMember roles, not that creator link. Check the actual active
  // owners' global restrictions so a suspended successor never authorizes
  // onboarding and a healthy transferred company is not penalized when the
  // original creator later becomes inactive.
  const owners = await prisma.teamMember.findMany({
    where: { companyId, role: 'COMPANY_OWNER', status: 'ACTIVE' },
    select: {
      user: {
        select: { isActive: true, isSuspended: true, isBanned: true },
      },
    },
  })
  const unrestrictedOwner = owners.some(owner =>
    owner.user && owner.user.isActive && !owner.user.isSuspended && !owner.user.isBanned
  )
  if (owners.length === 0) {
    reasons.push('No active company owner')
  } else if (!unrestrictedOwner) {
    if (owners.every(owner => !owner.user)) {
      reasons.push('Company owner account is missing')
    } else if (owners.every(owner => !owner.user || owner.user.isActive === false)) {
      reasons.push('Company owner account is inactive')
    } else if (owners.every(owner => !owner.user || owner.user.isSuspended)) {
      reasons.push('Company owner account is suspended')
    } else if (owners.every(owner => !owner.user || owner.user.isBanned)) {
      reasons.push('Company owner account is banned')
    } else {
      reasons.push('No unrestricted active company owner')
    }
  }

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
    select: { identityStatus: true, isActive: true, isSuspended: true, isBanned: true },
  })
  if (!user) {
    return { eligible: false, reasons: ['User account not found'] }
  }

  if (requiredJobId && member.role !== 'WORKER') {
    reasons.push('Company member does not hold the worker role')
  }
  if (user.isActive === false) reasons.push('Worker account is inactive')
  if (user.isSuspended) reasons.push('Worker account is suspended')
  if (user.isBanned) reasons.push('Worker account is banned')
  if (user.identityStatus !== 'VERIFIED') reasons.push('Worker identity not verified')

  if (requiredJobId) {
    const job = await prisma.marketplaceJob.findUnique({
      where: { id: requiredJobId },
      select: {
        categoryId: true,
        serviceTemplateId: true,
        templateJobId: true,
        preferredDate: true,
        preferredTimeSlot: true,
        workerIdentityCheckRequired: true,
        workersCount: true,
        countryCode: true,
        latitude: true,
        longitude: true,
      },
    })
    if (!job) {
      reasons.push('Job not found')
    } else {
      // Phase 03: a company worker may only be assigned to a job in their own
      // market. Assignment overwrites the job's target provider, so this must be
      // decided from the validated service address, not from stored metadata.
      const jobMarket = requireJobMarket(job)
      if (!jobMarket.ok) {
        reasons.push('Job service address is not in a supported market')
      } else {
        const workerProfile = await prisma.taskerProfile.findUnique({
          where: { userId },
          select: { countryCode: true },
        })
        const workerUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { countryCode: true },
        })
        const workerCountry = (workerProfile?.countryCode || workerUser?.countryCode || '')
          .trim()
          .toUpperCase()
        if (!workerCountry) {
          reasons.push('Worker market is unknown')
        } else if (workerCountry !== jobMarket.countryCode) {
          reasons.push('Worker market does not match the job market')
        }
      }
    }

    if (job) {
      // PostgreSQL permits only one active CompanyJobAssignment per job.
      // Until a crew workflow exists, a single assignee cannot represent a
      // multi-worker service. Do not claim full capacity from one worker.
      if (job.workersCount > 1) {
        reasons.push('Job requires a multi-worker crew; one worker is insufficient')
      }
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
              select: { id: true, jobCategoryId: true, templateJobId: true },
            })
          : Promise.resolve(null),
      ])

      // Reject contradictory catalogue pointers rather than using an unrelated
      // service's category to grant a worker permission. Historical jobs with
      // no service template remain supported as category-level bookings.
      if (job.serviceTemplateId && (
        !template ||
        template.jobCategoryId !== job.categoryId ||
        (job.templateJobId && template.templateJobId &&
          job.templateJobId !== template.templateJobId)
      )) {
        reasons.push('Job service category does not match its catalogue selection')
      }

      const requiredCategoryId = job.categoryId
      const requiredTemplateJobId = job.templateJobId || template?.templateJobId || null
      const relationalCapability = profile
        ? await prisma.taskerSkill.findFirst({
            where: {
              taskerId: profile.id,
              // A worker selecting one TemplateJob must not inherit every
              // sibling capability in the same category. Category matching is
              // retained only for legacy bookings without a specific job ID.
              ...(requiredTemplateJobId
                ? { jobId: requiredTemplateJobId }
                : { job: { categoryId: requiredCategoryId } }),
            },
            select: { id: true },
          })
        : null

      const normalize = (stored: string | null | undefined) =>
        new Set(readStoredList(stored).map(value => value.trim().toLowerCase()).filter(Boolean))
      // Company membership skills are explicitly granted by dispatch/management.
      // TaskerProfile.skills contains *derived* category labels written by
      // syncCategorySkills after selecting any one TemplateJob. Combining the
      // two gave a worker every sibling service in that category.
      const memberTokens = normalize(member.skills)
      const profileTokens = normalize(profile?.skills)
      const categoryTokens = [
        requiredCategoryId, category?.id, category?.name, category?.slug,
      ].filter((value): value is string => !!value).map(value => value.trim().toLowerCase())
      const exactTokens = [
        job.serviceTemplateId, requiredTemplateJobId,
      ].filter((value): value is string => !!value).map(value => value.trim().toLowerCase())

      const explicitMemberCategoryGrant = categoryTokens.some(token => memberTokens.has(token))
      const exactDeclaredCapability = exactTokens.some(token =>
        memberTokens.has(token) || profileTokens.has(token))
      const historicalCategoryCapability =
        !requiredTemplateJobId && categoryTokens.some(token => profileTokens.has(token))
      const declaredCapability =
        explicitMemberCategoryGrant || exactDeclaredCapability || historicalCategoryCapability

      if (!relationalCapability && !declaredCapability) {
        reasons.push('Worker lacks required capability for this job')
      }

      if (job.workerIdentityCheckRequired) {
        const approvedIdentity = await prisma.providerIdentity.findFirst({
          where: {
            currentUserId: userId,
            identityType: { in: ['TASKER', 'COMPANY_WORKER'] },
            kycStatus: 'VERIFIED',
            verifiedPhotoUrl: { not: null },
          },
          select: { id: true },
        })
        if (!approvedIdentity) {
          reasons.push('Worker verified profile photo not approved')
        }
      }

      if (!job.preferredDate) {
        // No date cannot establish a non-overlapping appointment.
        // A worker already performing any active assignment is unavailable.
        const busy = await prisma.companyJobAssignment.findFirst({
          where: {
            workerUserId: userId,
            status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
            jobId: { not: requiredJobId },
          },
          select: { id: true },
        })
        if (busy) {
          reasons.push('Worker has an active assignment and no date to prove capacity')
        }
      } else {
        const dayStart = new Date(job.preferredDate)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(dayStart)
        dayEnd.setDate(dayEnd.getDate() + 1)

        const slotFilter =
          job.preferredTimeSlot && job.preferredTimeSlot !== 'anytime'
            ? {
                OR: [
                  { preferredTimeSlot: job.preferredTimeSlot },
                  { preferredTimeSlot: 'anytime' },
                  { preferredTimeSlot: null },
                ],
              }
            : {}

        const conflictingAssignments = await prisma.companyJobAssignment.findMany({
          where: {
            workerUserId: userId,
            jobId: { not: requiredJobId },
            OR: [
              // An unfinished job blocks additional dispatch regardless of
              // its original appointment date: it is active real-world work.
              { status: 'IN_PROGRESS' },
              {
                status: { in: ['ASSIGNED', 'ACCEPTED'] },
                job: {
                  OR: [
                    { preferredDate: null },
                    { preferredDate: { gte: dayStart, lt: dayEnd }, ...slotFilter },
                  ],
                },
              },
            ],
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
