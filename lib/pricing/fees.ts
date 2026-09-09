import { PricingConfig } from './types'

export function computeUrgencyModifier(
  urgency: string,
  config: PricingConfig,
): { amount: bigint; bps: number; ruleId: string } {
  switch (urgency.toUpperCase()) {
    case 'URGENT':
      return { amount: 0n, bps: config.urgentModifierBps, ruleId: 'urgency_urgent' }
    case 'EMERGENCY':
      return { amount: 0n, bps: config.emergencyModifierBps, ruleId: 'urgency_emergency' }
    default:
      return { amount: 0n, bps: 0, ruleId: 'urgency_normal' }
  }
}

export function applyModifierBps(baseAmount: bigint, modifierBps: bigint): bigint {
  return (baseAmount * modifierBps) / 10000n
}

export function capUrgencySurge(surgeAmount: bigint, baseAmount: bigint, capBps: number): bigint {
  const maxSurge = (baseAmount * BigInt(capBps)) / 10000n
  return surgeAmount > maxSurge ? maxSurge : surgeAmount
}

export function computePlatformFee(amount: bigint, rateBps: number): bigint {
  return (amount * BigInt(rateBps)) / 10000n
}

export function validatePriceAmount(amount: bigint, config: PricingConfig): { valid: boolean; error?: string } {
  if (amount < 0n) return { valid: false, error: 'Negative price rejected' }
  if (amount === 0n) return { valid: false, error: 'Zero price rejected' }
  if (amount < config.minJobAmountCents) return { valid: false, error: `Below minimum ${config.minJobAmountCents}` }
  if (amount > config.maxJobAmountCents) return { valid: false, error: `Above maximum ${config.maxJobAmountCents}` }
  return { valid: true }
}
