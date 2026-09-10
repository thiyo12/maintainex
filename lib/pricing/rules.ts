import { PricingConfig } from './types'

const DEFAULT_CONFIG: PricingConfig = {
  countryCode: 'GLOBAL',
  defaultCurrency: 'LKR',
  pricingVersion: 'v1',
  commissionRateBps: 1000,
  urgentModifierBps: 2500,
  emergencyModifierBps: 5000,
  urgencyCapBps: 10000,
  minJobAmountCents: 500n,
  maxJobAmountCents: 10000000n,
}

export async function resolvePricingConfig(
  client: any,
  countryCode: string,
): Promise<PricingConfig> {
  const row = await client.marketConfig.findUnique({
    where: { countryCode },
  }).catch(() => null)

  const globalRow = countryCode !== 'GLOBAL'
    ? await client.marketConfig.findUnique({ where: { countryCode: 'GLOBAL' } }).catch(() => null)
    : null

  const cfg = row || globalRow
  if (!cfg) return { ...DEFAULT_CONFIG, countryCode }

  return {
    countryCode,
    defaultCurrency: cfg.defaultCurrency ?? 'LKR',
    pricingVersion: cfg.pricingVersion ?? 'v1',
    commissionRateBps: cfg.commissionRateBps ?? 1000,
    urgentModifierBps: cfg.urgentModifierBps ?? 2500,
    emergencyModifierBps: cfg.emergencyModifierBps ?? 5000,
    urgencyCapBps: cfg.urgencyCapBps ?? 10000,
    minJobAmountCents: cfg.minJobAmountCents != null ? BigInt(cfg.minJobAmountCents) : 500n,
    maxJobAmountCents: cfg.maxJobAmountCents != null ? BigInt(cfg.maxJobAmountCents) : 10000000n,
  }
}
