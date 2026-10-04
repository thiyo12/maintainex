import { prisma } from '@/lib/prisma'

export const PAYMENT_PROVIDER_CODES = ['PAYPAL', 'PAYHERE', 'MANUAL_BANK'] as const
export type PaymentProviderCode = (typeof PAYMENT_PROVIDER_CODES)[number]

/**
 * Only PayPal may create a new online checkout. PayHere is retained strictly
 * for historical transactions, refunds, reconciliation and audit visibility.
 */
export const NEW_ONLINE_CHECKOUT_PROVIDER_CODES = ['PAYPAL'] as const
export const LEGACY_READ_ONLY_PROVIDER_CODES = ['PAYHERE'] as const
export const PAYMENT_PROVIDER_NOT_AVAILABLE = 'PAYMENT_PROVIDER_NOT_AVAILABLE' as const

/**
 * LIVE PayPal Checkout is opt-in per market. The env value is a comma-separated
 * ISO-3166 alpha-2 allowlist confirmed against the MaintainEX merchant account.
 *
 * Sandbox launch verification is deliberately constrained to the controlled
 * Canada + CAD fixture. Sri Lanka LIVE Checkout stays hard-blocked while
 * PayPal's official Sri Lanka documentation says Checkout is not yet live.
 */
export const PAYPAL_MARKET_VERIFICATION_ENV = 'PAYPAL_MARKET_CHECKOUT_VERIFIED'
export const PAYPAL_SANDBOX_FIXTURE_COUNTRY = 'CA'
export const PAYPAL_SANDBOX_FIXTURE_CURRENCY = 'CAD'
const PAYPAL_LIVE_HARD_BLOCKED_MARKETS = new Set(['LK'])

export function isCashPaymentAvailableForMarket(
  countryCode: string,
  currency: string,
): boolean {
  return countryCode.trim().toUpperCase() === 'LK' &&
    currency.trim().toUpperCase() === 'LKR'
}

export function isProviderSelectableForNewCheckout(provider: string): boolean {
  const normalized = provider.trim().toUpperCase()
  return (NEW_ONLINE_CHECKOUT_PROVIDER_CODES as readonly string[]).includes(normalized)
}

export function isLegacyReadOnlyProvider(provider: string): boolean {
  const normalized = provider.trim().toUpperCase()
  return (LEGACY_READ_ONLY_PROVIDER_CODES as readonly string[]).includes(normalized)
}

export function verifiedPayPalMarkets(): string[] {
  const raw = process.env[PAYPAL_MARKET_VERIFICATION_ENV]
  if (!raw) return []
  return [...new Set(
    raw
      .split(',')
      .map(value => value.trim().toUpperCase())
      .filter(value => /^[A-Z]{2}$/.test(value))
  )]
}

export function isPayPalMarketVerified(
  countryCode: string,
  environment: 'SANDBOX' | 'LIVE'
): boolean {
  const country = countryCode.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(country)) return false

  if (environment === 'SANDBOX') {
    return country === PAYPAL_SANDBOX_FIXTURE_COUNTRY
  }

  if (PAYPAL_LIVE_HARD_BLOCKED_MARKETS.has(country)) return false
  return verifiedPayPalMarkets().includes(country)
}

export function blockedNewCheckoutReason(
  provider: string,
  countryCode: string,
  environment: 'SANDBOX' | 'LIVE',
  currency: string
): string | null {
  const normalizedProvider = provider.trim().toUpperCase()
  if (!isProviderSelectableForNewCheckout(normalizedProvider)) {
    return `${normalizedProvider} is not enabled for new online checkout`
  }
  if (
    normalizedProvider === 'PAYPAL' &&
    !isPayPalMarketVerified(countryCode, environment)
  ) {
    return `PayPal Checkout is not verified for ${countryCode.trim().toUpperCase()} in ${environment}`
  }
  if (
    normalizedProvider === 'PAYPAL' &&
    environment === 'SANDBOX' &&
    currency.trim().toUpperCase() !== PAYPAL_SANDBOX_FIXTURE_CURRENCY
  ) {
    return `PayPal sandbox checkout is restricted to ${PAYPAL_SANDBOX_FIXTURE_COUNTRY}/${PAYPAL_SANDBOX_FIXTURE_CURRENCY}`
  }
  return null
}

export type PaymentProviderCapabilities = {
  checkout?: boolean
  authorize?: boolean
  capture?: boolean
  refund?: boolean
  partialRefund?: boolean
  webhooks?: boolean
  disputes?: boolean
  payouts?: boolean
  reconciliation?: boolean
}

export type PaymentProviderConfigLike = {
  countryCode: string
  provider: string
  enabled: boolean
  environment: string
  supportedCurrencies: string
  paymentMethods: string
  capabilities: string
  captureMode: string
  operationalStatus: string
  priority: number
}

export type ResolvedPaymentProvider = {
  countryCode: string
  provider: PaymentProviderCode
  environment: 'SANDBOX' | 'LIVE'
  currency: string
  paymentMethods: string[]
  capabilities: PaymentProviderCapabilities
  captureMode: string
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    const value = JSON.parse(raw)
    return value as T
  } catch {
    return fallback
  }
}

export function parseProviderList(raw: string): string[] {
  const values = parseJson<unknown>(raw, [])
  if (!Array.isArray(values)) return []
  return [...new Set(
    values
      .filter((value): value is string => typeof value === 'string')
      .map(value => value.trim().toUpperCase())
      .filter(Boolean)
  )]
}

export function parseProviderCapabilities(raw: string): PaymentProviderCapabilities {
  const value = parseJson<unknown>(raw, {})
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const source = value as Record<string, unknown>
  const result: PaymentProviderCapabilities = {}
  const keys: (keyof PaymentProviderCapabilities)[] = [
    'checkout',
    'authorize',
    'capture',
    'refund',
    'partialRefund',
    'webhooks',
    'disputes',
    'payouts',
    'reconciliation',
  ]

  for (const key of keys) {
    if (typeof source[key] === 'boolean') result[key] = source[key] as boolean
  }
  return result
}

export function normalizePaymentProvider(value: string): PaymentProviderCode | null {
  const normalized = value.trim().toUpperCase()
  return (PAYMENT_PROVIDER_CODES as readonly string[]).includes(normalized)
    ? normalized as PaymentProviderCode
    : null
}

export function selectProviderFromConfigs(
  configs: PaymentProviderConfigLike[],
  input: {
    countryCode: string
    currency: string
    requestedProvider?: string | null
  }
): ResolvedPaymentProvider | null {
  const countryCode = input.countryCode.trim().toUpperCase()
  const currency = input.currency.trim().toUpperCase()
  const requested = input.requestedProvider
    ? normalizePaymentProvider(input.requestedProvider)
    : null

  if (!/^[A-Z]{2}$/.test(countryCode) || !/^[A-Z]{3}$/.test(currency)) return null
  if (input.requestedProvider && !requested) return null

  const eligible = configs
    .filter(config => config.countryCode.trim().toUpperCase() === countryCode)
    .filter(config => config.enabled)
    .filter(config => config.operationalStatus.trim().toUpperCase() === 'ACTIVE')
    .map(config => {
      const provider = normalizePaymentProvider(config.provider)
      const environment = config.environment.trim().toUpperCase()
      const currencies = parseProviderList(config.supportedCurrencies)
      const capabilities = parseProviderCapabilities(config.capabilities)

      if (!provider) return null
      if (requested && provider !== requested) return null
      if (environment !== 'SANDBOX' && environment !== 'LIVE') return null
      if (
        blockedNewCheckoutReason(
          provider,
          countryCode,
          environment as 'SANDBOX' | 'LIVE',
          currency
        )
      ) return null
      if (!currencies.includes(currency)) return null
      if (capabilities.checkout !== true) return null

      return {
        config,
        resolved: {
          countryCode,
          provider,
          environment: environment as 'SANDBOX' | 'LIVE',
          currency,
          paymentMethods: parseProviderList(config.paymentMethods),
          capabilities,
          captureMode: config.captureMode.trim().toUpperCase() || 'CAPTURE',
        } satisfies ResolvedPaymentProvider,
      }
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((a, b) =>
      a.config.priority - b.config.priority ||
      a.resolved.provider.localeCompare(b.resolved.provider)
    )

  return eligible[0]?.resolved || null
}

export async function resolvePaymentProviderForMarket(input: {
  countryCode: string
  currency: string
  requestedProvider?: string | null
}): Promise<ResolvedPaymentProvider | null> {
  const countryCode = input.countryCode.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(countryCode)) return null

  const configs = await prisma.paymentProviderConfig.findMany({
    where: {
      countryCode,
      enabled: true,
    },
    orderBy: [
      { priority: 'asc' },
      { provider: 'asc' },
    ],
  })

  return selectProviderFromConfigs(configs, {
    ...input,
    countryCode,
  })
}

export function providerSupports(
  provider: ResolvedPaymentProvider,
  capability: keyof PaymentProviderCapabilities
): boolean {
  return provider.capabilities[capability] === true
}
