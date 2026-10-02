import { describe, expect, it } from 'vitest'
import {
  parseProviderCapabilities,
  parseProviderList,
  selectProviderFromConfigs,
  type PaymentProviderConfigLike,
} from '@/lib/finance/payments/provider-registry'

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

  it('selects the lowest-priority eligible provider deterministically', () => {
    const selected = selectProviderFromConfigs(
      [
        config({ provider: 'PAYPAL', priority: 20 }),
        config({
          provider: 'PAYHERE',
          priority: 5,
          supportedCurrencies: JSON.stringify(['CAD']),
        }),
      ],
      { countryCode: 'CA', currency: 'CAD' }
    )

    expect(selected?.provider).toBe('PAYHERE')
    expect(selected?.environment).toBe('SANDBOX')
  })

  it('honors an explicit requested provider without silently falling back', () => {
    const selected = selectProviderFromConfigs(
      [
        config({ provider: 'PAYPAL', priority: 20 }),
        config({
          provider: 'PAYHERE',
          priority: 5,
          supportedCurrencies: JSON.stringify(['CAD']),
        }),
      ],
      {
        countryCode: 'CA',
        currency: 'CAD',
        requestedProvider: 'PAYPAL',
      }
    )

    expect(selected?.provider).toBe('PAYPAL')
    expect(
      selectProviderFromConfigs(
        [config({ provider: 'PAYPAL' })],
        {
          countryCode: 'CA',
          currency: 'CAD',
          requestedProvider: 'UNKNOWN',
        }
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
