import { prisma } from '@/lib/prisma'
import { checkIndividualProviderEligibility, checkCompanyEligibility, checkWorkerEligibility } from '@/lib/phase6/provider-eligibility'
import { resolveJobRequirements, hasCapabilityMatch, hasRelationalCapability } from '@/lib/matching'
import { calculatePrice } from '@/lib/pricing/engine'
import { createNotification } from '@/lib/notifications'

export interface BookNowInput {
  customerId: string
  templateJobId: string
  providerId: string
  providerType?: 'INDIVIDUAL' | 'COMPANY'
  scheduledDate: Date
  timeSlot: string
  address: string
  district: string
  notes?: string
  latitude?: number
  longitude?: number
  countryCode?: string
}

function parseLegacyCapabilities(value: string | null): string[] {
  if (!value || value === '[]' || value === '') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return [value]
  }
}

export async function createBookNowJob(input: BookNowInput) {
  const templateJob = await prisma.templateJob.findUnique({
    where: { id: input.templateJobId },
    select: {
      id: true,
      name: true,
      description: true,
      categoryId: true,
      isActive: true,
    },
  })
  if (!templateJob?.isActive) throw new Error('Template job not found or inactive')

  const resolvedProviderType = input.providerType ?? 'INDIVIDUAL'

  const finalCountryCode = typeof input.countryCode === 'string' && /^[A-Za-z]{2,3}$/.test(input.countryCode)
    ? input.countryCode.toUpperCase()
    : 'LK'

  const linkedServiceTemplate = await prisma.serviceTemplate.findFirst({
    where: {
      templateJobId: templateJob.id,
      jobCategoryId: templateJob.categoryId,
      isActive: true,
    },
    select: { id: true },
  })

  const requirements = await resolveJobRequirements(
    prisma,
    templateJob.categoryId,
    linkedServiceTemplate?.id,
    templateJob.id,
  )
  if (!requirements) throw new Error('Invalid template/category relationship')

  let resolvedProviderUserId: string
  let resolvedProviderEntityId: string
  let resolvedNotificationUserId: string

  if (resolvedProviderType === 'COMPANY') {
    const company = await prisma.companyProfile.findUnique({
      where: { id: input.providerId },
      select: { id: true, userId: true, companyName: true },
    })
    if (!company) throw new Error('Company not found')

    const eligibility = await checkCompanyEligibility(company.id)
    if (!eligibility.eligible) {
      throw new Error(`Company not eligible: ${eligibility.reasons.join('; ')}`)
    }

    const specialty = await prisma.companySpecialty.findFirst({
      where: { companyId: company.id, jobId: templateJob.id },
    })
    if (!specialty) {
      const catSpecialty = await prisma.companySpecialty.findFirst({
        where: { companyId: company.id, categoryId: templateJob.categoryId },
      })
      if (!catSpecialty) throw new Error('Company lacks required capability for this booking')
    }

    resolvedProviderUserId = company.userId
    resolvedProviderEntityId = company.id

    const owner = await prisma.teamMember.findFirst({
      where: { companyId: company.id, role: 'COMPANY_OWNER', status: 'ACTIVE' },
      select: { userId: true },
    })
    resolvedNotificationUserId = owner?.userId ?? company.userId
  } else {
    const provider = await prisma.taskerProfile.findFirst({
      where: {
        OR: [
          { id: input.providerId },
          { userId: input.providerId },
        ],
      },
      select: {
        id: true,
        userId: true,
        skills: true,
        taskerSkills: { select: { jobId: true } },
        user: { select: { name: true } },
      },
    })
    if (!provider) throw new Error('Provider not found')
    if (provider.userId === input.customerId) throw new Error('Cannot book yourself')

    const eligibility = await checkIndividualProviderEligibility(provider.userId)
    if (!eligibility.eligible) {
      throw new Error(`Provider is not eligible: ${eligibility.reasons.join('; ')}`)
    }

    const relationalMatch = hasRelationalCapability(
      provider.taskerSkills.map(skill => skill.jobId),
      requirements,
    )
    const legacyMatch = hasCapabilityMatch(parseLegacyCapabilities(provider.skills), requirements)
    if (!relationalMatch && !legacyMatch) {
      throw new Error('Provider lacks required capability for this booking')
    }

    resolvedProviderUserId = provider.userId
    resolvedProviderEntityId = provider.userId
    resolvedNotificationUserId = provider.userId
  }

  const pricing = await calculatePrice(prisma, {
    jobId: `pending-book-now-${Date.now()}-${input.customerId}`,
    categoryId: templateJob.categoryId,
    serviceTemplateId: linkedServiceTemplate?.id,
    mode: 'BOOK_NOW',
    urgency: 'NORMAL',
    quantity: 1,
    countryCode: finalCountryCode,
    providerId: resolvedProviderEntityId,
    providerType: resolvedProviderType,
  })

  const smartBooking = JSON.stringify({
    district: input.district,
    timeSlot: input.timeSlot,
    countryCode: finalCountryCode,
  })

  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.marketplaceJob.create({
      data: {
        customerId: input.customerId,
        title: templateJob.name,
        description: templateJob.description || `Quick booking: ${templateJob.name}`,
        categoryId: templateJob.categoryId,
        serviceTemplateId: linkedServiceTemplate?.id || null,
        templateJobId: templateJob.id,
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: pricing.providerGross,
        aiEstimateJson: JSON.stringify({
          baseAmount: pricing.baseAmount.toString(),
          urgencyAmount: pricing.urgencyAmount.toString(),
          serviceModifiers: pricing.serviceModifiers.toString(),
          providerGross: pricing.providerGross.toString(),
          platformFeeBps: pricing.platformFeeBps,
          platformFeeAmount: pricing.platformFeeAmount.toString(),
          customerTotal: pricing.customerTotal.toString(),
          currency: pricing.currency,
          pricingVersion: pricing.pricingVersion,
          ruleIds: pricing.ruleIds,
        }),
        preferredDate: input.scheduledDate,
        preferredTimeSlot: input.timeSlot,
        addressStreet: input.address,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        smartBookingJson: smartBooking,
        status: 'OPEN',
        urgency: 'normal',
        workersCount: 1,
        materialHandling: 'tasker_brings',
        countryCode: finalCountryCode,
        targetTaskerId: resolvedProviderUserId,
      },
    })

    const quote = await tx.jobQuote.create({
      data: {
        jobId: job.id,
        providerId: resolvedProviderEntityId,
        providerType: resolvedProviderType,
        price: pricing.providerGross,
        estimatedCompletionTime: '1-2 hours',
        message: input.notes || 'BOOK_NOW instant booking',
        attachments: '[]',
        status: 'PENDING',
      },
    })

    return { job, quote }
  })

  await createNotification({
    userId: resolvedNotificationUserId,
    title: 'New direct booking',
    body: `${result.job.title} has been booked with you.`,
    referenceType: 'JOB_MATCH',
    referenceId: result.job.id,
  })

  return {
    job: { ...result.job, budgetAmount: result.job.budgetAmount?.toString() ?? null },
    quote: { ...result.quote, price: result.quote.price.toString() },
    notifiedCount: 1,
  }
}
