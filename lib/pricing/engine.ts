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

export async function calculatePrice(
  client: PrismaClient,
  input: PricingInput,
): Promise<PriceBreakdown> {
  const config = await resolvePricingConfig(client, input.countryCode || 'GLOBAL')

  const baseAmount = await resolveBaseAmount(client, input)
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
    currency: 'LKR',
    pricingVersion: config.pricingVersion,
    ruleIds,
  }
}

async function resolveBaseAmount(
  client: PrismaClient,
  input: PricingInput,
): Promise<bigint> {
  if (input.serviceTemplateId) {
    const template = await (client as any).serviceTemplate.findUnique({
      where: { id: input.serviceTemplateId },
      select: { priceMin: true, priceMax: true },
    })
    if (template) {
      const avg = Math.round(((template.priceMin || 0) + (template.priceMax || 0)) / 2 * 100)
      return BigInt(Math.max(avg, 100))
    }
  }

  if (input.categoryId) {
    const templateJobs = await (client as any).templateJob.findMany({
      where: { categoryId: input.categoryId, isActive: true },
      select: { priceMin: true, priceMax: true },
      take: 5,
    })
    if (templateJobs.length > 0) {
      const avgMin = templateJobs.reduce((s: number, t: any) => s + (t.priceMin || 0), 0) / templateJobs.length
      const avgMax = templateJobs.reduce((s: number, t: any) => s + (t.priceMax || 0), 0) / templateJobs.length
      const avg = Math.round(((avgMin + avgMax) / 2) * 100)
      return BigInt(Math.max(avg, 100))
    }
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
