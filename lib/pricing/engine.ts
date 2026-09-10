import { PrismaClient } from '@prisma/client'
import { PricingInput, PriceBreakdown } from './types'
import { resolvePricingConfig } from './rules'
import { computeUrgencyModifier, applyModifierBps, capUrgencySurge, computePlatformFee, validatePriceAmount } from './fees'

export class PriceBoundsError extends Error {
  constructor(message: string, public readonly minCents: bigint, public readonly maxCents: bigint, public readonly actual: bigint) {
    super(message)
    this.name = 'PriceBoundsError'
  }
}

export class PricingInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PricingInputError'
  }
}

interface ResolvedPricingIdentifiers {
  categoryId: string
  serviceTemplateId?: string
}

export async function validatePricingIdentifiers(
  client: PrismaClient,
  input: Pick<PricingInput, 'jobId' | 'categoryId' | 'serviceTemplateId'>,
): Promise<ResolvedPricingIdentifiers> {
  let categoryId = input.categoryId?.trim() || ''
  let serviceTemplateId = input.serviceTemplateId?.trim() || undefined

  if (input.jobId && !input.jobId.startsWith('estimate-') && !input.jobId.startsWith('pending-')) {
    const job = await client.marketplaceJob.findUnique({
      where: { id: input.jobId },
      select: { categoryId: true, serviceTemplateId: true },
    })
    if (!job) throw new PricingInputError('Job not found')
    if (categoryId && categoryId !== job.categoryId) throw new PricingInputError('categoryId does not match job')
    if (serviceTemplateId && serviceTemplateId !== (job.serviceTemplateId || undefined)) {
      throw new PricingInputError('serviceTemplateId does not match job')
    }
    categoryId = job.categoryId
    serviceTemplateId = job.serviceTemplateId || undefined
  }

  let serviceTemplateCategoryId: string | null = null
  if (serviceTemplateId) {
    const template = await client.serviceTemplate.findUnique({
      where: { id: serviceTemplateId },
      select: { id: true, jobCategoryId: true, templateJobId: true },
    })
    if (!template) throw new PricingInputError('Service template not found')
    serviceTemplateCategoryId = template.jobCategoryId

    if (template.templateJobId) {
      const linkedJob = await client.templateJob.findUnique({
        where: { id: template.templateJobId },
        select: { categoryId: true },
      })
      if (!linkedJob || linkedJob.categoryId !== template.jobCategoryId) {
        throw new PricingInputError('Service template has invalid TemplateJob relationship')
      }
    }

    if (!categoryId) categoryId = template.jobCategoryId
    if (categoryId !== template.jobCategoryId) {
      throw new PricingInputError('Service template does not belong to category')
    }
  }

  if (!categoryId) throw new PricingInputError('categoryId is required')
  const category = await client.jobCategory.findUnique({ where: { id: categoryId }, select: { id: true } })
  if (!category) throw new PricingInputError('Category not found')
  if (serviceTemplateCategoryId && serviceTemplateCategoryId !== category.id) {
    throw new PricingInputError('Service template/category mismatch')
  }

  return { categoryId, serviceTemplateId }
}

export async function calculatePrice(
  client: PrismaClient,
  input: PricingInput,
): Promise<PriceBreakdown> {
  const identifiers = await validatePricingIdentifiers(client, input)
  const config = await resolvePricingConfig(client, input.countryCode || 'GLOBAL')

  const baseAmount = await resolveBaseAmount(client, {
    ...input,
    categoryId: identifiers.categoryId,
    serviceTemplateId: identifiers.serviceTemplateId,
  })
  const urgency = computeUrgencyModifier(input.urgency, config)
  const urgencyAmount = capUrgencySurge(
    applyModifierBps(baseAmount, BigInt(urgency.bps)),
    baseAmount,
    config.urgencyCapBps,
  )
  const serviceModifiers = computeServiceModifiers(input)
  const providerGross = baseAmount + urgencyAmount + serviceModifiers
  const platformFeeAmount = computePlatformFee(providerGross, config.commissionRateBps)
  const customerTotal = providerGross + platformFeeAmount

  const validation = validatePriceAmount(customerTotal, config)
  if (!validation.valid) {
    throw new PriceBoundsError(
      validation.error!,
      config.minJobAmountCents,
      config.maxJobAmountCents,
      customerTotal,
    )
  }

  const ruleIds = [urgency.ruleId]
  if (serviceModifiers > 0n) ruleIds.push('service_modifiers')

  return {
    baseAmount,
    urgencyAmount,
    serviceModifiers,
    providerGross,
    platformFeeBps: config.commissionRateBps,
    platformFeeAmount,
    customerTotal,
    currency: config.defaultCurrency || 'LKR',
    pricingVersion: config.pricingVersion,
    ruleIds,
  }
}

async function resolveBaseAmount(
  client: PrismaClient,
  input: PricingInput,
): Promise<bigint> {
  if (input.serviceTemplateId) {
    const template = await client.serviceTemplate.findUnique({
      where: { id: input.serviceTemplateId },
      select: { priceMin: true, priceMax: true },
    })
    if (template) {
      const avg = Math.round((((template.priceMin ?? 0) + (template.priceMax ?? 0)) / 2) * 100)
      return BigInt(Math.max(avg, 100))
    }
  }

  const templateJobs = await client.templateJob.findMany({
    where: { categoryId: input.categoryId, isActive: true },
    select: { priceMin: true, priceMax: true },
    take: 5,
  })
  if (templateJobs.length > 0) {
    const avgMin = templateJobs.reduce((sum, item) => sum + (item.priceMin ?? 0), 0) / templateJobs.length
    const avgMax = templateJobs.reduce((sum, item) => sum + (item.priceMax ?? 0), 0) / templateJobs.length
    const avg = Math.round(((avgMin + avgMax) / 2) * 100)
    return BigInt(Math.max(avg, 100))
  }

  return 5000n
}

function computeServiceModifiers(input: PricingInput): bigint {
  let modifier = 0n
  if (input.quantity && input.quantity > 1) {
    modifier += BigInt(input.quantity - 1) * 2000n
  }
  if (input.durationMinutes && input.durationMinutes > 60) {
    const extraBlocks = Math.floor((input.durationMinutes - 60) / 30)
    modifier += BigInt(extraBlocks) * 1500n
  }
  return modifier
}

export function validateQuotePrice(
  priceMinorUnits: bigint,
  customerBudget: bigint,
): { valid: boolean; error?: string } {
  if (priceMinorUnits <= 0n) return { valid: false, error: 'Quote price must be positive' }
  if (customerBudget > 0n && priceMinorUnits > customerBudget * 3n) {
    return { valid: false, error: 'Quote exceeds 3x customer budget' }
  }
  return { valid: true }
}
