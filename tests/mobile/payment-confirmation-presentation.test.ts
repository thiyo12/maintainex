import { describe, it, expect } from 'vitest'
import {
  canSubmitPayment,
  createStaleResponseGuard,
  derivePaymentPresentation,
  resolveDisplayCurrency,
  type PaymentFetchState,
  type PaymentOptionsLike,
} from '../../apps/mobile/features/jobs/screens/customer/v2/confirm/payment-presentation'

const LK_OPTIONS: PaymentOptionsLike = {
  cash: { available: true, reason: null },
  online: { available: false, reason: 'NO_VERIFIED_ONLINE_PROVIDER' },
}

const VANCOUVER_OPTIONS: PaymentOptionsLike = {
  cash: { available: true, reason: null },
  online: { available: true, reason: null },
}

const ready = (options: PaymentOptionsLike): PaymentFetchState => ({ kind: 'ready', options })

describe('Sri Lanka job — cash-only deployment', () => {
  it('offers cash and explains that online payment is unavailable', () => {
    const p = derivePaymentPresentation({
      fetch: ready(LK_OPTIONS),
      escrowStatus: 'PENDING_PAYMENT',
      paymentStatus: null,
    })
    expect(p.canShowActions).toBe(true)
    expect(p.canPayCash).toBe(true)
    expect(p.canPayOnline).toBe(false)
    expect(p.notice).toBe('ONLINE_UNAVAILABLE')
  })
})

describe('Vancouver job — online provider configured', () => {
  it('offers both methods for a valid market', () => {
    const p = derivePaymentPresentation({
      fetch: ready(VANCOUVER_OPTIONS),
      escrowStatus: 'PENDING_PAYMENT',
      paymentStatus: null,
    })
    expect(p.canPayOnline).toBe(true)
    expect(p.canPayCash).toBe(true)
    expect(p.notice).toBeNull()
  })

  it('never assumes LKR for a Vancouver quote', () => {
    expect(resolveDisplayCurrency({ quoteCurrency: 'CAD' })).toBe('CAD')
    expect(resolveDisplayCurrency({ escrowCurrency: 'CAD', quoteCurrency: 'LKR' })).toBe('CAD')
  })

  it('reports no currency rather than assuming one when unknown', () => {
    expect(resolveDisplayCurrency({})).toBeNull()
    expect(resolveDisplayCurrency({ quoteCurrency: '' })).toBeNull()
  })

  it('normalises a lowercase currency from the payload', () => {
    expect(resolveDisplayCurrency({ quoteCurrency: 'cad' })).toBe('CAD')
  })
})

describe('invalid market', () => {
  const invalid: PaymentFetchState = {
    kind: 'invalidMarket',
    code: 'PAYMENT_MARKET_MISMATCH',
    error: 'stored country LK does not match the validated service address',
  }

  it('hides every payment action', () => {
    const p = derivePaymentPresentation({
      fetch: invalid,
      escrowStatus: 'PENDING_PAYMENT',
      paymentStatus: null,
    })
    expect(p.canShowActions).toBe(false)
    expect(p.canPayOnline).toBe(false)
    expect(p.canPayCash).toBe(false)
  })

  it('surfaces the market error so the customer sees why', () => {
    const p = derivePaymentPresentation({
      fetch: invalid,
      escrowStatus: 'PENDING_PAYMENT',
      paymentStatus: null,
    })
    expect(p.notice).toBe('INVALID_MARKET')
    expect(p.marketError).toContain('does not match')
  })

  it('cannot be submitted through either handler', () => {
    const p = derivePaymentPresentation({ fetch: invalid, escrowStatus: 'PENDING_PAYMENT', paymentStatus: null })
    expect(canSubmitPayment(p, 'online')).toBe(false)
    expect(canSubmitPayment(p, 'cash')).toBe(false)
  })

  it('stays hidden for an out-of-municipal-boundary job', () => {
    const p = derivePaymentPresentation({
      fetch: { kind: 'invalidMarket', code: 'JOB_MARKET_UNRESOLVED', error: 'outside launch geography' },
      escrowStatus: 'PENDING_PAYMENT',
      paymentStatus: null,
    })
    expect(p.canShowActions).toBe(false)
    expect(p.notice).toBe('INVALID_MARKET')
  })
})

describe('unknown / failed payment-status request', () => {
  it('does not treat a failed request as a valid market', () => {
    const p = derivePaymentPresentation({
      fetch: { kind: 'failed' },
      escrowStatus: 'PENDING_PAYMENT',
      paymentStatus: null,
    })
    expect(p.canShowActions).toBe(false)
    expect(p.notice).toBe('UNAVAILABLE')
    expect(canSubmitPayment(p, 'cash')).toBe(false)
  })

  it('does not treat an in-flight request as a valid market', () => {
    const p = derivePaymentPresentation({
      fetch: { kind: 'unknown' },
      escrowStatus: 'PENDING_PAYMENT',
      paymentStatus: null,
    })
    expect(p.canShowActions).toBe(false)
    expect(canSubmitPayment(p, 'online')).toBe(false)
  })

  it('does not expose actions merely because an escrow is pending', () => {
    const p = derivePaymentPresentation({
      fetch: { kind: 'failed' },
      escrowStatus: 'PENDING_PAYMENT',
      paymentStatus: 'CREATED',
    })
    expect(p.canShowActions).toBe(false)
  })
})

describe('cash-only and no-payment-method cases', () => {
  it('hides online when only cash is allowed', () => {
    const p = derivePaymentPresentation({
      fetch: ready({ cash: { available: true, reason: null }, online: { available: false, reason: 'NO_VERIFIED_ONLINE_PROVIDER' } }),
      escrowStatus: 'PENDING_PAYMENT',
      paymentStatus: null,
    })
    expect(p.canPayCash).toBe(true)
    expect(p.canPayOnline).toBe(false)
    expect(canSubmitPayment(p, 'online')).toBe(false)
  })

  it('reports NO_METHODS when the provider is restricted on both rails', () => {
    const p = derivePaymentPresentation({
      fetch: ready({
        cash: { available: false, reason: 'PROVIDER_CASH_RESTRICTED' },
        online: { available: false, reason: 'PROVIDER_ONLINE_RESTRICTED' },
      }),
      escrowStatus: 'PENDING_PAYMENT',
      paymentStatus: null,
    })
    expect(p.canPayOnline).toBe(false)
    expect(p.canPayCash).toBe(false)
    expect(p.notice).toBe('NO_METHODS')
    expect(canSubmitPayment(p, 'cash')).toBe(false)
    expect(canSubmitPayment(p, 'online')).toBe(false)
  })
})

describe('settled historical payment', () => {
  it('shows no new actions once escrow is settled', () => {
    const p = derivePaymentPresentation({
      fetch: ready(VANCOUVER_OPTIONS),
      escrowStatus: 'SETTLED',
      paymentStatus: 'SUCCESS',
    })
    expect(p.canShowActions).toBe(false)
    expect(p.notice).toBeNull()
  })

  it('shows no new actions for a protected escrow already paid online', () => {
    const p = derivePaymentPresentation({
      fetch: ready(VANCOUVER_OPTIONS),
      escrowStatus: 'PROTECTED',
      paymentStatus: 'SUCCESS',
    })
    expect(p.canShowActions).toBe(false)
  })

  it('keeps a pending payment resumable', () => {
    const p = derivePaymentPresentation({
      fetch: ready(VANCOUVER_OPTIONS),
      escrowStatus: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
    })
    expect(p.canShowActions).toBe(true)
    expect(p.canPayOnline).toBe(true)
  })

  it('blocks new payment when the gateway already flagged a refund', () => {
    const p = derivePaymentPresentation({
      fetch: ready(VANCOUVER_OPTIONS),
      escrowStatus: 'PENDING_PAYMENT',
      paymentStatus: 'REFUND_REQUIRED',
    })
    expect(p.canShowActions).toBe(false)
  })

  it('blocks new payment on chargeback', () => {
    const p = derivePaymentPresentation({
      fetch: ready(VANCOUVER_OPTIONS),
      escrowStatus: 'PENDING_PAYMENT',
      paymentStatus: 'CHARGEDBACK',
    })
    expect(p.canShowActions).toBe(false)
  })
})

describe('out-of-order responses', () => {
  it('rejects a response from a superseded load', () => {
    const guard = createStaleResponseGuard()
    const first = guard.begin()
    const second = guard.begin()
    expect(guard.isCurrent(second)).toBe(true)
    expect(guard.isCurrent(first)).toBe(false)
  })

  it('keeps only the newest token current across many loads', () => {
    const guard = createStaleResponseGuard()
    const tokens = [guard.begin(), guard.begin(), guard.begin()]
    expect(guard.isCurrent(tokens[2])).toBe(true)
    expect(guard.isCurrent(tokens[0])).toBe(false)
    expect(guard.isCurrent(tokens[1])).toBe(false)
  })

  it('protects a job switch: the previous job cannot re-enable payment', () => {
    const guard = createStaleResponseGuard()
    // Job A load starts.
    const jobA = guard.begin()
    // User navigates to job B and its load starts, then job A's slow response lands.
    const jobB = guard.begin()
    expect(guard.isCurrent(jobA)).toBe(false)
    // Job B's eligibility is what stands.
    expect(guard.isCurrent(jobB)).toBe(true)
  })

  it('never reports a stale token as current', () => {
    const guard = createStaleResponseGuard()
    const stale = guard.begin()
    for (let i = 0; i < 5; i++) guard.begin()
    expect(guard.isCurrent(stale)).toBe(false)
  })
})
