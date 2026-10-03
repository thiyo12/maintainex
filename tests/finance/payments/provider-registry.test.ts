import { afterEach, describe, expect, it } from 'vitest'
import {
  isPayPalMarketVerified,
  parseProviderCapabilities,
  parseProviderList,
  selectProviderFromConfigs,
  type PaymentProviderConfigLike,
} from '@/lib/finance/payments/provider-registry'

const originalVerifiedMarkets = process.env.PAYPAL_MARKET_CHECKOUT_VERIFIED

afterEach(() => {
  if (originalVerifiedMarkets === undefined) {
    delete process.env.PAYPAL_MARKET_CHECKOUT_VERIFIED
  } else {
    process.env.PAYPAL_MARKET_CHECKOUT_VERIFIED = originalVerifiedMarkets
  }
})

function config(
  overrides: Partial<PaymentProviderConfigLike> = {}
): PaymentProviderConfigLike {
  return {
    countryCode: 'CA',
    provider: 'PAYPAL',
    enabled: true,
    environment: 'SANDBOX',
    supportedCurrencies: JSON.stringify(['CAD']),
    paymentMethods: JSON.stringify(['PAYPAL']),
    capabilities: JSON.stringify({
      checkout: true,
      capture: true,
      refund: true,
      webhooks: true,
      reconciliation: true,
    }),
    captureMode: 'CAPTURE',
    operationalStatus: 'ACTIVE',
    priority: 10,
    ...overrides,
  }
}

describe('payment provider registry', () => {
  it('fails closed when a market has no explicit provider configuration', () => {
    expect(
      selectProviderFromConfigs([], { countryCode: 'CA', currency: 'CAD' })
    ).toBeNull()
  })

  it('does not leak provider enablement across markets', () => {
    expect(
      selectProviderFromConfigs(
        [config({ countryCode: 'CA' })],
        { countryCode: 'CH', currency: 'CHF' }
      )
    ).toBeNull()
  })

  it('requires an active, enabled provider with explicit checkout capability', () => {
    expect(
      selectProviderFromConfigs(
        [config({ enabled: false })],
        { countryCode: 'CA', currency: 'CAD' }
      )
    ).toBeNull()

    expect(
      selectProviderFromConfigs(
        [config({ operationalStatus: 'MAINTENANCE' })],
        { countryCode: 'CA', currency: 'CAD' }
      )
    ).toBeNull()

    expect(
      selectProviderFromConfigs(
        [config({ capabilities: JSON.stringify({ refund: true }) })],
        { countryCode: 'CA', currency: 'CAD' }
      )
    ).toBeNull()
  })

  it('rejects currencies that are not explicitly enabled for the provider', () => {
    expect(
      selectProviderFromConfigs(
        [config()],
        { countryCode: 'CA', currency: 'USD' }
      )
    ).toBeNull()
  })

  it('rejects non-CAD PayPal sandbox checkout even if the CA config advertises it', () => {
    expect(
      selectProviderFromConfigs(
        [config({ supportedCurrencies: JSON.stringify(['CAD', 'USD']) })],
        { countryCode: 'CA', currency: 'USD' }
      )
    ).toBeNull()
  })

  it('never selects PayHere for a new checkout even if it has higher priority', () => {
    const selected = selectProviderFromConfigs(
      [
        config({ provider: 'PAYPAL', priority: 20 }),
        config({
          provider: 'PAYHERE',
          priority: 1,
          supportedCurrencies: JSON.stringify(['CAD']),
        }),
      ],
      { countryCode: 'CA', currency: 'CAD' }
    )

    expect(selected?.provider).toBe('PAYPAL')
  })

  it('restricts sandbox PayPal checkout to the controlled CA fixture', () => {
    expect(isPayPalMarketVerified('CA', 'SANDBOX')).toBe(true)
    expect(isPayPalMarketVerified('LK', 'SANDBOX')).toBe(false)
    expect(isPayPalMarketVerified('US', 'SANDBOX')).toBe(false)
  })

  it('requires an explicit allowlist for live markets and hard-blocks Sri Lanka', () => {
    delete process.env.PAYPAL_MARKET_CHECKOUT_VERIFIED
    expect(isPayPalMarketVerified('CA', 'LIVE')).toBe(false)

    process.env.PAYPAL_MARKET_CHECKOUT_VERIFIED = 'CA,LK'
    expect(isPayPalMarketVerified('CA', 'LIVE')).toBe(true)
    expect(isPayPalMarketVerified('LK', 'LIVE')).toBe(false)
  })

  it('honors an explicit PayPal request and refuses legacy PayHere requests', () => {
    expect(
      selectProviderFromConfigs(
        [config()],
        { countryCode: 'CA', currency: 'CAD', requestedProvider: 'PAYPAL' }
      )?.provider
    ).toBe('PAYPAL')

    expect(
      selectProviderFromConfigs(
        [config({ provider: 'PAYHERE' })],
        { countryCode: 'CA', currency: 'CAD', requestedProvider: 'PAYHERE' }
      )
    ).toBeNull()
  })

  it('parses provider metadata defensively', () => {
    expect(parseProviderList('["cad"," CAD ","usd",9]')).toEqual(['CAD', 'USD'])
    expect(parseProviderList('not-json')).toEqual([])
    expect(parseProviderCapabilities('{"checkout":true,"refund":false}')).toEqual({
      checkout: true,
      refund: false,
    })
    expect(parseProviderCapabilities('[]')).toEqual({})
  })
})
