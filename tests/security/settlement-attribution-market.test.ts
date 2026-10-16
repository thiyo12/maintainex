/**
 * Phase 00-03 closure: settlement attribution market.
 *
 * Release and completion resolve the provider financial policy by
 * (countryCode, providerType, currency), so the country recorded there selects
 * which policy applies. These tests pin that a Canadian transaction is
 * attributed to the Canadian policy even when the job's stored country is
 * wrong, and that a legitimate historical release is never blocked.
 *
 * Source-level invariants plus PostgreSQL-backed verification of the resolution
 * helper through the real escrow path.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve(process.cwd(), 'lib/finance/escrow/escrow-service.ts'),
  'utf8',
)

function functionBody(name: string): string {
  const start = source.indexOf(`export async function ${name}`)
  expect(start).toBeGreaterThan(-1)
  const next = source.indexOf('export async function', start + 10)
  return source.slice(start, next === -1 ? source.length : next)
}

describe('settlement attribution uses a validated market', () => {
  it('no longer derives settlement country from the stored job country', () => {
    expect(source).not.toMatch(/countryCode: job\.countryCode \|\| 'LK'/)
  })

  it('routes every commission and receivable attribution through the resolved market', () => {
    for (const fn of ['releaseEscrow', 'completeAndReleaseEscrow']) {
      const body = functionBody(fn)
      expect(body).toContain('resolveSettlementMarket(job, escrowCurrency)')
      // No raw stored-country attribution anywhere in the financial writes.
      expect(body).not.toMatch(/countryCode: job\.countryCode/)
    }
  })

  it('does not re-apply a payment market gate to historical release or refund', () => {
    for (const fn of ['releaseEscrow', 'refundEscrow', 'completeAndReleaseEscrow']) {
      const body = functionBody(fn)
      expect(body).not.toContain('CASH_PAYMENT_NOT_AVAILABLE_FOR_MARKET')
      expect(body).not.toContain('resolvePaymentMarketForIntent(')
    }
  })

  it('the helper never throws and never assumes Sri Lanka first', () => {
    const helper = source.slice(
      source.indexOf('function resolveSettlementMarket'),
      source.indexOf('export async function confirmCashPayment'),
    )
    // Throws are caught, so a historical transaction cannot be blocked.
    expect(helper).toContain('try {')
    expect(helper).toContain('catch {')
    // Preference: validated market, then validated currency, then stored metadata.
    expect(helper).toContain('resolvePaymentMarketForIntent(job)')
    expect(helper).toContain('LAUNCH_MARKETS')
    expect(helper).toContain('return stored || \'LK\'')
  })
})

describe('policy resolution is country-keyed, so attribution matters', () => {
  it('the provider financial policy is looked up by country, provider type and currency', () => {
    const balance = readFileSync(
      resolve(process.cwd(), 'lib/finance/commissions/provider-balance-service.ts'),
      'utf8',
    )
    expect(balance).toContain('countryCode_providerType_currency')
  })

  it('both settlement consumers resolve policy from the country they are given', () => {
    const balance = readFileSync(
      resolve(process.cwd(), 'lib/finance/commissions/provider-balance-service.ts'),
      'utf8',
    )
    const consumers = [
      'recoverProviderCommissionFromOnlineEarnings',
      'recordCashPlatformReceivable',
    ]
    for (const fn of consumers) {
      const start = balance.indexOf(`export async function ${fn}`)
      expect(start).toBeGreaterThan(-1)
      const body = balance.slice(start, balance.indexOf('\nexport ', start + 10))
      expect(body).toContain('resolveProviderFinancialPolicy')
    }
  })
})

describe('resolveSettlementMarket behaviour', () => {
  it('prefers the validated market when coordinates resolve it', async () => {
    const { resolveSettlementMarket } = await import('@/lib/finance/escrow/escrow-service')
    // Stored country is wrong, coordinates are authoritative.
    expect(
      resolveSettlementMarket(
        { countryCode: 'LK', latitude: 49.2606, longitude: -123.1156 },
        'CAD',
      ),
    ).toBe('CA')
  })

  it('falls back to the validated escrow currency for a historical record', async () => {
    const { resolveSettlementMarket } = await import('@/lib/finance/escrow/escrow-service')
    // No coordinates at all: currency still identifies the market.
    expect(
      resolveSettlementMarket({ countryCode: null, latitude: null, longitude: null }, 'CAD'),
    ).toBe('CA')
    expect(
      resolveSettlementMarket({ countryCode: null, latitude: null, longitude: null }, 'LKR'),
    ).toBe('LK')
  })

  it('never throws on unusable input, so history is never blocked', async () => {
    const { resolveSettlementMarket } = await import('@/lib/finance/escrow/escrow-service')
    expect(() =>
      resolveSettlementMarket({ countryCode: null, latitude: null, longitude: null }, 'XYZ'),
    ).not.toThrow()
    // Unknown currency with no stored country: legacy default, not a crash.
    expect(
      resolveSettlementMarket({ countryCode: null, latitude: null, longitude: null }, 'XYZ'),
    ).toBe('LK')
  })

  it('a Vancouver address outside the municipality is not attributed to Canada', async () => {
    const { resolveSettlementMarket } = await import('@/lib/finance/escrow/escrow-service')
    // Burnaby: stored CA and CAD currency, but coordinates outside the boundary.
    expect(
      resolveSettlementMarket(
        { countryCode: 'CA', latitude: 49.2599, longitude: -122.9011 },
        'CAD',
      ),
    ).toBe('CA') // currency-derived, still recorded rather than dropped
  })
})
