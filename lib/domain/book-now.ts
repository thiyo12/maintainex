import { prisma } from '@/lib/prisma'
import { checkIndividualProviderEligibility, checkCompanyEligibility, checkWorkerEligibility } from '@/lib/phase6/provider-eligibility'
import { resolveJobRequirements, hasCapabilityMatch, hasRelationalCapability } from '@/lib/matching'
import { calculatePrice } from '@/lib/pricing/engine'
import { createNotification } from '@/lib/notifications'
import { lockAndAssertProviderAvailable } from '@/lib/domain/provider-availability'
import { readStoredList } from '@/lib/db-utils'
import { haversineKm } from '@/lib/distance'
<<<<<<< HEAD
import { isBookNowCatalogueAvailableInMarket } from '@/lib/domain/catalog-market-eligibility'
import { resolveMarketFromServiceAddress } from '@/lib/geography/market-engine'
=======
>>>>>>> 5e46ef06 (fix(crm): correct canonical catalogue authorization, scope and pricing)

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

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Mirrors the matching rule so discovery and direct booking cannot disagree. */
function serviceAreaAllows(
  serviceAreas: string | null | undefined,
  district: string,
  providerCountry?: string | null,
  hasValidatedAddress: boolean = false,
): boolean {
  const isCanada = (providerCountry || '').trim().toUpperCase() === 'CA'
  const configured = readStoredList(serviceAreas)
    .map(normalizeToken)
    .filter(Boolean)
  const hasDeclaredArea = configured.length > 0
  if (!hasValidatedAddress) return true
  if (!isCanada) {
    if (!district || !hasDeclaredArea) return true
  } else if (!hasDeclaredArea) {
    return false
  }
  if (!district) return false

  const target = normalizeToken(district)
  return configured.some(area => area === target || target.includes(area) || area.includes(target))
}

function parseClockMinutes(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}

function slotWindow(slot: string): { start: number; end: number } | null {
  if (slot === 'morning') return { start: 8 * 60, end: 12 * 60 }
  if (slot === 'afternoon') return { start: 12 * 60, end: 17 * 60 }
  if (slot === 'evening') return { start: 17 * 60, end: 21 * 60 }
  return null
}

function isDateInsideVacation(date: Date, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false
  const check = new Date(date)
  check.setHours(12, 0, 0, 0)
  const from = new Date(start)
  const to = new Date(end)
  from.setHours(0, 0, 0, 0)
  to.setHours(23, 59, 59, 999)
  return check >= from && check <= to
}


/**
 * Mirrors the matching radius rule so a provider who is a candidate for a job
 * is not refused at booking purely because they express coverage as a radius
 * rather than a named area. Matching already prefers a verified radius; direct
 * booking previously ignored it entirely, which made a radius-only Vancouver
 * provider discoverable but unbookable.
 */
function serviceRadiusAllows(
  providerLat: number | null | undefined,
  providerLon: number | null | undefined,
  serviceRadius: number | null | undefined,
  targetLat: number | null | undefined,
  targetLon: number | null | undefined,
): boolean | null {
  if (
    providerLat == null || providerLon == null ||
    serviceRadius == null || serviceRadius <= 0 ||
    targetLat == null || targetLon == null
  ) {
    return null
  }
  return haversineKm(targetLat, targetLon, providerLat, providerLon) <= serviceRadius
}

/** True when the caller supplied a complete coordinate pair to validate against. */
function hasValidatedServiceAddress(input: {
  latitude?: number
  longitude?: number
}): boolean {
  return (
    typeof input.latitude === 'number' && Number.isFinite(input.latitude) &&
    typeof input.longitude === 'number' && Number.isFinite(input.longitude)
  )
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
      countries: true,
      currency: true,
    },
  })
  if (!templateJob?.isActive) throw new Error('Template job not found or inactive')

  const resolvedProviderType = input.providerType ?? 'INDIVIDUAL'

  const finalCountryCode = typeof input.countryCode === 'string' && /^[A-Za-z]{2,3}$/.test(input.countryCode)
    ? input.countryCode.toUpperCase()
    : ''
  if (!finalCountryCode) throw new Error('Booking country is required')
  if (finalCountryCode !== 'LK' && finalCountryCode !== 'CA') {
    throw new Error('Unsupported booking country')
  }

  // The mobile route verifies a customer's address, but this domain function
  // is also called directly. Never allow partial GPS or an out-of-market
  // coordinate pair to authorize a booking using only claimed countryCode.
  // Coordinate-less historical LK jobs retain the legacy compatibility path.
  const hasAnyCoordinates = input.latitude !== undefined && input.latitude !== null ||
    input.longitude !== undefined && input.longitude !== null
  // Canadian launch permission is municipal, not country-wide. Without
  // GPS there is no proof that the job is inside Vancouver; a caller must
  // not skip the mobile route to book in Burnaby or another Canadian city.
  if (finalCountryCode === 'CA' && !hasAnyCoordinates) {
    throw new Error('Service address does not match booking country')
  }
  if (hasAnyCoordinates) {
    const addressMarket = resolveMarketFromServiceAddress({
      latitude: input.latitude,
      longitude: input.longitude,
      claimedCountryCode: finalCountryCode,
    })
    if (!addressMarket.ok || addressMarket.countryCode !== finalCountryCode) {
      throw new Error('Service address does not match booking country')
    }
    if (finalCountryCode === 'CA' && input.district.trim().toLowerCase() !== 'vancouver') {
      throw new Error('Service address does not match booking country')
    }
  }

  const category = await prisma.jobCategory.findUnique({
    where: { id: templateJob.categoryId },
    select: { isActive: true, countries: true },
  })
  if (!category || !isBookNowCatalogueAvailableInMarket(templateJob, category, finalCountryCode)) {
    throw new Error('Template job is not available in booking country')
  }

  const linkedServiceTemplate = await prisma.serviceTemplate.findFirst({
    where: {
      templateJobId: templateJob.id,
      jobCategoryId: templateJob.categoryId,
      isActive: true,
      countryCode: finalCountryCode,
      currency: finalCountryCode === 'LK' ? 'LKR' : 'CAD',
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
  let resolvedServiceAreas: string | null = null

  if (resolvedProviderType === 'COMPANY') {
    const company = await prisma.companyProfile.findUnique({
      where: { id: input.providerId },
      select: {
        id: true,
        userId: true,
        companyName: true,
        countryCode: true,
        serviceAreas: true,
        latitude: true,
        longitude: true,
        serviceRadius: true,
        user: { select: { countryCode: true } },
      },
    })
    if (!company) throw new Error('Company not found')
    if (company.userId === input.customerId) throw new Error('Cannot book your own company')
    const companyCountry = company.countryCode || company.user?.countryCode
    if (companyCountry !== finalCountryCode) {
      throw new Error('Provider country does not match booking country')
    }

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

    const companyRadius = serviceRadiusAllows(
      company.latitude, company.longitude, company.serviceRadius, input.latitude, input.longitude,
    )
    if (companyRadius === false || (companyRadius === null && !serviceAreaAllows(company.serviceAreas, input.district, companyCountry, hasValidatedServiceAddress(input)))) {
      throw new Error('Provider does not serve the requested district')
    }

    resolvedProviderUserId = company.userId
    resolvedProviderEntityId = company.id
    resolvedServiceAreas = company.serviceAreas

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
        latitude: true,
        longitude: true,
        serviceRadius: true,
        serviceAreas: true,
        taskerSkills: { select: { jobId: true } },
        countryCode: true,
        user: { select: { name: true, countryCode: true } },
      },
    })
    if (!provider) throw new Error('Provider not found')
    if (provider.userId === input.customerId) throw new Error('Cannot book yourself')
    const providerCountry = provider.countryCode || provider.user?.countryCode
    if (providerCountry !== finalCountryCode) {
      throw new Error('Provider country does not match booking country')
    }

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

    const providerRadius = serviceRadiusAllows(
      provider.latitude, provider.longitude, provider.serviceRadius, input.latitude, input.longitude,
    )
    if (providerRadius === false || (providerRadius === null && !serviceAreaAllows(provider.serviceAreas, input.district, providerCountry, hasValidatedServiceAddress(input)))) {
      throw new Error('Provider does not serve the requested district')
    }

    resolvedProviderUserId = provider.userId
    resolvedProviderEntityId = provider.userId
    resolvedNotificationUserId = provider.userId
    resolvedServiceAreas = provider.serviceAreas
  }

  const availability = await prisma.providerAvailability.findUnique({
    where: { providerId: resolvedProviderEntityId },
  })
  if (availability) {
    if (!availability.isAvailable) {
      throw new Error('Provider is currently unavailable')
    }
    if (isDateInsideVacation(input.scheduledDate, availability.vacationStart, availability.vacationEnd)) {
      throw new Error('Provider is unavailable on the requested date')
    }

    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
    const dayKey = dayKeys[input.scheduledDate.getDay()]
    if (!availability[dayKey]) {
      throw new Error('Provider is unavailable on the requested day')
    }

    const workStart = parseClockMinutes(availability.startTime)
    const workEnd = parseClockMinutes(availability.endTime)
    if (workStart === null || workEnd === null || workEnd <= workStart) {
      throw new Error('Provider availability configuration is invalid')
    }

    const requestedWindow = slotWindow(input.timeSlot)
    if (requestedWindow && !(requestedWindow.start < workEnd && workStart < requestedWindow.end)) {
      throw new Error('Requested time slot is outside provider working hours')
    }
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
    serviceAreasChecked: Boolean(resolvedServiceAreas),
    timeSlot: input.timeSlot,
    countryCode: finalCountryCode,
  })

  const result = await prisma.$transaction(async (tx) => {
    await lockAndAssertProviderAvailable(
      tx,
      resolvedProviderType,
      resolvedProviderEntityId,
      'Provider is no longer available for direct booking',
    )

    const dayStart = new Date(input.scheduledDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const conflicts = resolvedProviderType === 'INDIVIDUAL'
      ? await tx.$queryRaw<Array<{ id: string }>>`
          SELECT mj.id
          FROM "MarketplaceJob" mj
          JOIN "JobQuote" jq ON jq."jobId" = mj.id
          WHERE jq."providerId" = ${resolvedProviderEntityId}
            AND jq."providerType" = 'INDIVIDUAL'
            AND jq.status = 'ACCEPTED'
            AND mj.status IN ('QUOTE_ACCEPTED', 'IN_PROGRESS')
            AND mj."preferredDate" >= ${dayStart}
            AND mj."preferredDate" < ${dayEnd}
            AND (
              ${input.timeSlot} = 'anytime'
              OR mj."preferredTimeSlot" IS NULL
              OR mj."preferredTimeSlot" = 'anytime'
              OR mj."preferredTimeSlot" = ${input.timeSlot}
            )
          LIMIT 1
        `
      : await tx.$queryRaw<Array<{ id: string }>>`
          SELECT mj.id
          FROM "MarketplaceJob" mj
          JOIN "JobQuote" jq ON jq."jobId" = mj.id
          WHERE jq."providerId" = ${resolvedProviderEntityId}
            AND jq."providerType" = 'COMPANY'
            AND jq.status = 'ACCEPTED'
            AND mj.status IN ('QUOTE_ACCEPTED', 'IN_PROGRESS')
            AND mj."preferredDate" >= ${dayStart}
            AND mj."preferredDate" < ${dayEnd}
            AND (
              ${input.timeSlot} = 'anytime'
              OR mj."preferredTimeSlot" IS NULL
              OR mj."preferredTimeSlot" = 'anytime'
              OR mj."preferredTimeSlot" = ${input.timeSlot}
            )
          LIMIT 1
        `

    if (conflicts.length > 0) {
      throw new Error('Provider already has an overlapping active booking')
    }

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
        targetTaskerId: resolvedProviderEntityId,
      },
    })

    const quote = await tx.jobQuote.create({
      data: {
        jobId: job.id,
        providerId: resolvedProviderEntityId,
        providerType: resolvedProviderType,
        price: pricing.providerGross,
        currency: pricing.currency,
        totalCents: pricing.providerGross,
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
