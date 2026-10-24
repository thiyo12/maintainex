/**
 * Phase 03: payment presentation rules for the booking confirmation screen.
 *
 * The server is the only authority on whether a job's market is payable. GET
 * /api/mobile/v2/jobs/[id]/payment returns `options: null` with an invalid-market
 * marker when the market cannot be confirmed, and POST refuses the same job.
 * This module turns that contract into what the screen is allowed to render, so
 * a failed or unknown request can never be mistaken for a payable market.
 */

export interface PaymentOptionsLike {
  cash: { available: boolean; reason: string | null }
  online: { available: boolean; reason: string | null }
}

export type PaymentFetchState =
  /** No answer yet, or the job changed and we are re-fetching. */
  | { kind: 'unknown' }
  /** The status request failed. Never treat this as a valid market. */
  | { kind: 'failed' }
  /** The server confirmed the market cannot be used for payment. */
  | { kind: 'invalidMarket'; code: string; error: string }
  /** The server returned a usable set of payment options. */
  | { kind: 'ready'; options: PaymentOptionsLike }

export type PaymentNotice =
  | 'INVALID_MARKET'
  | 'UNAVAILABLE'
  | 'ONLINE_UNAVAILABLE'
  | 'NO_METHODS'
  | null

export interface PaymentPresentation {
  /** Whether the payment action block may render at all. */
  canShowActions: boolean
  canPayOnline: boolean
  canPayCash: boolean
  notice: PaymentNotice
  /** The invalid-market detail to surface, when there is one. */
  marketError: string | null
}

const NON_ACTIONABLE_STATUSES = ['REFUND_REQUIRED', 'CHARGEDBACK']

export function derivePaymentPresentation(input: {
  fetch: PaymentFetchState
  escrowStatus: string | null | undefined
  paymentStatus: string | null | undefined
}): PaymentPresentation {
  const hidden = (notice: PaymentNotice = null, marketError: string | null = null): PaymentPresentation => ({
    canShowActions: false,
    canPayOnline: false,
    canPayCash: false,
    notice,
    marketError,
  })

  // A request that failed, has not completed, or was refused must never expose
  // payment actions. Historical status is rendered separately and is unaffected.
  if (input.fetch.kind === 'failed') {
    return hidden('UNAVAILABLE')
  }
  if (input.fetch.kind === 'unknown') {
    return hidden('UNAVAILABLE')
  }
  if (input.fetch.kind === 'invalidMarket') {
    return hidden('INVALID_MARKET', input.fetch.error)
  }

  // Options exist, but only an escrow awaiting payment can take new payment.
  if (input.escrowStatus !== 'PENDING_PAYMENT') {
    return hidden()
  }
  if (NON_ACTIONABLE_STATUSES.includes(input.paymentStatus || '')) {
    return hidden()
  }

  const { options } = input.fetch
  const canPayOnline = options.online.available === true
  const canPayCash = options.cash.available === true

  if (!canPayOnline && !canPayCash) {
    return { ...hidden('NO_METHODS'), canShowActions: true }
  }

  return {
    canShowActions: true,
    canPayOnline,
    canPayCash,
    notice: canPayOnline ? null : 'ONLINE_UNAVAILABLE',
    marketError: null,
  }
}

/**
 * Guards the action handlers themselves. Disabled UI is not an authorization
 * boundary; the backend remains authoritative, but a stale render must not be
 * able to fire a payment for a market that is no longer valid.
 */
export function canSubmitPayment(
  presentation: PaymentPresentation,
  method: 'online' | 'cash',
): boolean {
  if (!presentation.canShowActions) return false
  return method === 'online' ? presentation.canPayOnline : presentation.canPayCash
}

/**
 * Guards against out-of-order responses. This screen can start a load from three
 * places at once (job id change, the 3s poll, and app resume), so a slower earlier
 * response must never overwrite the current job's payment eligibility.
 */
export function createStaleResponseGuard() {
  let latest = 0
  return {
    /** Start a load and receive the token that identifies it. */
    begin(): number {
      latest += 1
      return latest
    },
    /** True only for the most recently started load. */
    isCurrent(token: number): boolean {
      return token === latest
    },
  }
}

/**
 * Phase 03: never hardcode LKR. Falls back through the recorded currencies and
 * returns null when the currency is genuinely unknown, so a Vancouver booking is
 * never silently labelled LKR.
 */
export function resolveDisplayCurrency(input: {
  escrowCurrency?: string | null
  quoteCurrency?: string | null
}): string | null {
  const escrow = (input.escrowCurrency || '').trim().toUpperCase()
  if (escrow) return escrow
  const quote = (input.quoteCurrency || '').trim().toUpperCase()
  if (quote) return quote
  return null
}
