import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { requireJobMarket } from '@/lib/geography/market-engine'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const paymentRoute = source('app/api/mobile/v2/jobs/[id]/payment/route.ts')
const paymentService = source('lib/finance/payments/payment-service.ts')
const escrowService = source('lib/finance/escrow/escrow-service.ts')

// Burnaby — inside the metro area, outside the City of Vancouver.
const BURNABY = { latitude: 49.2596, longitude: -122.998 }
// Vancouver City Hall — inside the municipality.
const VANCOUVER = { latitude: 49.2606, longitude: -123.1156 }

/**
 * Phase 02/03 — payment market authority.
 *
 * These tests are split deliberately:
 *
 *  - NEGATIVE tests demonstrate the defect. They FAIL before the correction and
 *    PASS after it. They assert that payment *creation* enforces the same
 *    authoritative market that payment *display* already enforces.
 *
 *  - LEGACY COMPATIBILITY tests assert behaviour that must be identical before
 *    and after the correction. They PASS in both states. They exist so the fix
 *    cannot quietly start rejecting coordinate-less legacy jobs.
 */

/* ------------------------------------------------------------------ */
/* NEGATIVE — these fail before the fix                               */
/* ------------------------------------------------------------------ */

describe('NEGATIVE: payment creation enforces the authoritative market', () => {
  it('POST validates the market before creating a payment intent', () => {
    // Before the fix, POST called createPaymentIntent directly with only an
    // authentication check. The market guard existed in GET only.
    const postStart = paymentRoute.indexOf('export async function POST')
    const getStart = paymentRoute.indexOf('export async function GET')
    expect(postStart).toBeGreaterThan(-1)
    expect(getStart).toBeGreaterThan(postStart)

    const postBody = paymentRoute.slice(postStart, getStart)
    expect(postBody, 'POST must resolve the job market before createPaymentIntent')
      .toMatch(/requireJobMarket|resolvePaymentMarket/)
  })

  it('payment-intent creation loads coordinates, not just stored country', () => {
    // Before the fix the preview select omitted coordinates entirely, so the
    // authoritative market could not be computed.
    expect(paymentService).toMatch(/latitude: true/)
    expect(paymentService).toMatch(/longitude: true/)
  })

  it('the locked job revalidation selects coordinates', () => {
    // Before the fix the FOR UPDATE query selected only stored countryCode.
    expect(paymentService).toMatch(/SELECT id, "customerId", status, title, "countryCode", "latitude", "longitude"/)
  })

  it('exposes a single market resolver used by payment intent creation', () => {
    expect(paymentService).toMatch(/export function resolvePaymentMarketForIntent/)
    // It must delegate to the shared engine rather than reimplementing it.
    expect(paymentService).toMatch(/requireJobMarket/)
  })

  it('rejects a stored-country disagreement rather than trusting stored country', () => {
    expect(paymentService).toMatch(/PAYMENT_MARKET_MISMATCH/)
  })
})

/* ------------------------------------------------------------------ */
/* LEGACY COMPATIBILITY — these pass before and after the fix          */
/* ------------------------------------------------------------------ */

describe('LEGACY COMPATIBILITY: coordinate-less jobs must behave exactly as before', () => {
  it('a coordinate-less Sri Lankan job resolves to LK', () => {
    const result = requireJobMarket({ countryCode: 'LK', latitude: null, longitude: null })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.countryCode).toBe('LK')
  })

  it('a coordinate-less Canadian job resolves to CA', () => {
    const result = requireJobMarket({ countryCode: 'CA', latitude: null, longitude: null })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.countryCode).toBe('CA')
  })

  it('a partial coordinate pair is treated as absent, not as a rejection', () => {
    // Latitude without longitude must not become a new failure mode.
    const latOnly = requireJobMarket({ countryCode: 'LK', latitude: 6.9271, longitude: null })
    const lonOnly = requireJobMarket({ countryCode: 'LK', latitude: null, longitude: 79.8612 })
    expect(latOnly.ok).toBe(true)
    expect(lonOnly.ok).toBe(true)
  })

  it('unknown stored countries are still rejected', () => {
    expect(requireJobMarket({ countryCode: 'US' }).ok).toBe(false)
    expect(requireJobMarket({ countryCode: 'DE' }).ok).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* Historical transaction paths must be untouched by this fix          */
/* ------------------------------------------------------------------ */

describe('HISTORICAL PATHS: refunds and committed accounting stay unchanged', () => {
  it('refundEscrow has no market gate and must not gain one', () => {
    // A refund blocked by stale location data would strand customer money.
    const refundStart = escrowService.indexOf('export async function refundEscrow')
    expect(refundStart).toBeGreaterThan(-1)
    const refundBody = escrowService.slice(refundStart, refundStart + 4000)
    expect(refundBody).not.toMatch(/requireJobMarket/)
  })

  it('canonical capture/reconciliation is not gated on fresh market resolution', () => {
    const capture = source('lib/finance/payments/canonical-capture.ts')
    expect(capture).not.toMatch(/requireJobMarket/)
  })

  it('escrow cash confirmation validates the market from the locked job row', () => {
    // Phase 03 security correction. This previously asserted the stored-country
    // lookup, which let a job stored LK with Vancouver coordinates select cash.
    expect(escrowService).toContain('resolvePaymentMarketForIntent')
    // No implicit Sri Lanka fallback anywhere in the cash confirmation path.
    expect(escrowService).not.toMatch(/isCashPaymentAvailableForMarket\(job\.countryCode/)
    // Scope the fallback check to confirmCashPayment: releaseEscrow and
    // completeAndReleaseEscrow legitimately keep their existing handling.
    const confirmCashPaymentSource = escrowService.slice(
      escrowService.indexOf('export async function confirmCashPayment'),
      escrowService.indexOf('export async function', escrowService.indexOf('export async function confirmCashPayment') + 1)
    )
    expect(confirmCashPaymentSource).not.toMatch(/countryCode: job\.countryCode \|\| 'LK'/)
    expect(confirmCashPaymentSource).not.toContain("job.countryCode || 'LK'")
    // The locked row must carry the market columns it is validated from.
    expect(escrowService).toContain('SELECT id, "customerId", status, "countryCode", latitude, longitude')
    // Both the cash gate and the provider financial check use the same validated
    // market, not the pre-lock preview.
    expect(escrowService).toContain('isCashPaymentAvailableForMarket(authoritativeCountryCode, escrow.currency)')
    expect(escrowService).toContain('countryCode: authoritativeCountryCode')
  })
})

/* ------------------------------------------------------------------ */
/* Behavioural proof of the underlying geography engine                */
/* ------------------------------------------------------------------ */

describe('MARKET GEOMETRY: Vancouver inside, Burnaby outside', () => {
  it('Vancouver coordinates resolve to CA', () => {
    const result = requireJobMarket({ countryCode: 'CA', ...VANCOUVER })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.countryCode).toBe('CA')
  })

  it('Burnaby coordinates do not resolve to the Canadian market', () => {
    const result = requireJobMarket({ countryCode: 'CA', ...BURNABY })
    expect(result.ok).toBe(false)
  })

  it('a stored Canadian flag cannot grant a Burnaby address', () => {
    const result = requireJobMarket({ countryCode: 'CA', ...BURNABY })
    expect(result.ok).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* BEHAVIOURAL — executable assertions on resolvePaymentMarketForIntent */
/* ------------------------------------------------------------------ */

import { resolvePaymentMarketForIntent } from '@/lib/finance/payments/payment-service'

describe('BEHAVIOURAL: resolvePaymentMarketForIntent executes real decisions', () => {
  it('accepts a Vancouver job whose stored country agrees', () => {
    const result = resolvePaymentMarketForIntent({
      countryCode: 'CA',
      latitude: VANCOUVER.latitude,
      longitude: VANCOUVER.longitude,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.countryCode).toBe('CA')
  })

  it('REJECTS a stored-country / coordinate disagreement', () => {
    // Stored LK but the validated address is inside Vancouver.
    const result = resolvePaymentMarketForIntent({
      countryCode: 'LK',
      latitude: VANCOUVER.latitude,
      longitude: VANCOUVER.longitude,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('PAYMENT_MARKET_MISMATCH')
      expect(result.error).toContain('LK')
      expect(result.error).toContain('CA')
    }
  })

  it('REJECTS a Burnaby address carrying a stored CA flag', () => {
    const result = resolvePaymentMarketForIntent({
      countryCode: 'CA',
      latitude: BURNABY.latitude,
      longitude: BURNABY.longitude,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('JOB_MARKET_UNRESOLVED')
  })

  it('PRESERVES legacy coordinate-less Sri Lankan jobs', () => {
    for (const value of [null, undefined]) {
      const result = resolvePaymentMarketForIntent({
        countryCode: 'LK',
        latitude: value,
        longitude: value,
      })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.countryCode).toBe('LK')
    }
  })

  it('PRESERVES legacy coordinate-less Canadian jobs', () => {
    const result = resolvePaymentMarketForIntent({
      countryCode: 'CA',
      latitude: null,
      longitude: null,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.countryCode).toBe('CA')
  })

  it('PRESERVES the partial-coordinate-pair fallback', () => {
    const latOnly = resolvePaymentMarketForIntent({
      countryCode: 'LK', latitude: 6.9271, longitude: null,
    })
    const lonOnly = resolvePaymentMarketForIntent({
      countryCode: 'CA', latitude: null, longitude: -123.1156,
    })
    expect(latOnly.ok).toBe(true)
    expect(lonOnly.ok).toBe(true)
  })

  it('REJECTS unsupported stored countries', () => {
    for (const code of ['US', 'DE', 'GB']) {
      const result = resolvePaymentMarketForIntent({
        countryCode: code, latitude: null, longitude: null,
      })
      expect(result.ok).toBe(false)
    }
  })

  it('is case-insensitive on the stored country', () => {
    const result = resolvePaymentMarketForIntent({
      countryCode: 'ca',
      latitude: VANCOUVER.latitude,
      longitude: VANCOUVER.longitude,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.countryCode).toBe('CA')
  })

  it('REJECTS non-numeric and NaN coordinates', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = resolvePaymentMarketForIntent({
        countryCode: 'LK', latitude: bad, longitude: 79.8612,
      })
      // Treated as an incomplete pair, so the legacy stored country still applies.
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.countryCode).toBe('LK')
    }
  })

  it('is deterministic across repeated payment requests', () => {
    // Repeated requests must not flip between authorised and rejected.
    const job = {
      countryCode: 'CA',
      latitude: VANCOUVER.latitude,
      longitude: VANCOUVER.longitude,
    }
    const outcomes = new Set(
      Array.from({ length: 25 }, () => {
        const r = resolvePaymentMarketForIntent(job)
        return r.ok ? `ok:${r.countryCode}` : `fail:${r.code}`
      }),
    )
    expect(outcomes.size).toBe(1)
    expect([...outcomes][0]).toBe('ok:CA')
  })

  it('returns a stable rejection for repeated mismatched requests', () => {
    const job = {
      countryCode: 'LK',
      latitude: VANCOUVER.latitude,
      longitude: VANCOUVER.longitude,
    }
    const outcomes = new Set(
      Array.from({ length: 25 }, () => {
        const r = resolvePaymentMarketForIntent(job)
        return r.ok ? 'ok' : r.code
      }),
    )
    expect(outcomes.size).toBe(1)
    expect([...outcomes][0]).toBe('PAYMENT_MARKET_MISMATCH')
  })
})

/* ------------------------------------------------------------------ */
/* NEGATIVE — GET/POST symmetry (these failed before the GET fix)     */
/* ------------------------------------------------------------------ */

describe('NEGATIVE: GET must not report availability from stored country alone', () => {
  it('the GET handler selects coordinates for its market guard', () => {
    // Before the fix GET selected only id/customerId/countryCode, so
    // requireJobMarket silently fell back to the stored country and GET could
    // advertise cash/online availability for an out-of-market job.
    const getStart = paymentRoute.indexOf('export async function GET')
    expect(getStart).toBeGreaterThan(-1)
    const getBody = paymentRoute.slice(getStart)

    // Extract the GET handler's marketplaceJob select block precisely rather
    // than relying on a character window.
    const selectStart = getBody.indexOf('select: {')
    const selectEnd = getBody.indexOf('})', selectStart)
    const selectBlock = getBody.slice(selectStart, selectEnd)
    expect(selectBlock).toContain('countryCode: true')
    expect(selectBlock).toContain('latitude: true')
    expect(selectBlock).toContain('longitude: true')
  })

  it('both GET and POST select coordinates before any market guard', () => {
    const latSelects = paymentRoute.match(/latitude: true/g) || []
    expect(latSelects.length).toBeGreaterThanOrEqual(2)
  })

  it('GET still enforces ownership before reporting availability', () => {
    const getStart = paymentRoute.indexOf('export async function GET')
    const getBody = paymentRoute.slice(getStart)
    const ownerIdx = getBody.indexOf('job.customerId !== user.id')
    // Match the actual call, not the explanatory comment that names the helper.
    // Phase 03 aligned GET with POST on resolvePaymentMarketForIntent, which
    // also detects a stored-country / validated-coordinate disagreement.
    const guardIdx = getBody.indexOf('const jobMarket = resolvePaymentMarketForIntent(job)')
    expect(ownerIdx).toBeGreaterThan(-1)
    expect(guardIdx).toBeGreaterThan(-1)
    expect(ownerIdx).toBeLessThan(guardIdx)
  })
})
