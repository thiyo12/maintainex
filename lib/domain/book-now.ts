import { prisma } from '@/lib/prisma'
import { checkIndividualProviderEligibility } from '@/lib/phase6/provider-eligibility'
import { resolveJobRequirements, hasCapabilityMatch, hasRelationalCapability } from '@/lib/matching'
import { calculatePrice } from '@/lib/pricing/engine'
import { createNotification } from '@/lib/notifications'

export interface BookNowInput {
  customerId: string
  templateJobId: string
  providerId: string
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

  // Backward compatible at the API boundary: older clients send TaskerProfile.id,
  // newer callers may send User.id. Canonical individual provider identity is User.id.
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

  const relationalMatch = hasRelationalCapability(
    provider.taskerSkills.map(skill => skill.jobId),
    requirements,
  )
  const legacyMatch = hasCapabilityMatch(parseLegacyCapabilities(provider.skills), requirements)
  if (!relationalMatch && !legacyMatch) {
    throw new Error('Provider lacks required capability for this booking')
  }

  const finalCountryCode = typeof input.countryCode === 'string' && /^[A-Za-z]{2,3}$/.test(input.countryCode)
    ? input.countryCode.toUpperCase()
    : 'LK'

  const pricing = await calculatePrice(prisma, {
    jobId: `pending-book-now-${Date.now()}-${input.customerId}`,
    categoryId: templateJob.categoryId,
    serviceTemplateId: linkedServiceTemplate?.id,
    mode: 'BOOK_NOW',
    urgency: 'NORMAL',
    quantity: 1,
    countryCode: finalCountryCode,
    providerId: provider.userId,
    providerType: 'INDIVIDUAL',
  })

  // Quote price is provider gross. Customer-facing total/fee are preserved in
  // the immutable estimate JSON until quote acceptance creates the escrow.
  const job = await prisma.marketplaceJob.create({
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
      status: 'OPEN',
      urgency: 'normal',
      workersCount: 1,
      materialHandling: 'tasker_brings',
      countryCode: finalCountryCode,
      targetTaskerId: provider.userId,
    },
  })

  const quote = await prisma.jobQuote.create({
    data: {
      jobId: job.id,
      providerId: provider.userId,
      providerType: 'INDIVIDUAL',
      price: pricing.providerGross,
      estimatedCompletionTime: '1-2 hours',
      message: input.notes || 'BOOK_NOW instant booking',
      attachments: '[]',
      status: 'PENDING',
    },
  })

  await createNotification({
    userId: provider.userId,
    title: 'New direct booking',
    body: `${job.title} has been booked with you.`,
    referenceType: 'JOB_MATCH',
    referenceId: job.id,
  })

  return {
    job: { ...job, budgetAmount: job.budgetAmount.toString() },
    quote: { ...quote, price: quote.price.toString() },
    notifiedCount: 1,
  }
}
