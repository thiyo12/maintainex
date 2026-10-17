import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const review = readFileSync(resolve(process.cwd(),
  'apps/mobile/features/payments/screens/customer/payment/escrow-confirm.tsx'), 'utf8')
const detail = readFileSync(resolve(process.cwd(),
  'apps/mobile/features/jobs/screens/customer/v2/[id].tsx'), 'utf8')
describe('Phase 06/10 — acceptance must not invent fees or initiate payment', () => {
  it('reads current quote and currency from server, not route parameters', () => {
    expect(review).toContain('v2Jobs.get(bookingId)')
    expect(review).toContain("item.id === quoteId && item.status === 'PENDING'")
    expect(review).toContain('quoteMatchesJobCurrency(job.countryCode, selected.currency)')
    expect(review).toContain('quoteMatchesJobCurrency(latest.job.countryCode, stillPending.currency)')
    expect(review).toContain('stillPending.price !== quote.price')
    expect(detail).not.toContain('quotedAmount: String(quote.price)')
    expect(review).not.toContain("currency = 'LKR'")
    expect(review).not.toContain('parseFloat(quotedAmount)')
  })
  it('leaves payment options to the canonical screen after acceptance', () => {
    const accept = review.indexOf('await v2JobActions.selectQuote(bookingId, quoteId)')
    const next = review.indexOf("router.replace('/(customer)/jobs/v2/confirm/' + bookingId)")
    expect(accept).toBeGreaterThan(0)
    expect(next).toBeGreaterThan(accept)
    expect(review).not.toContain('v2JobActions.depositEscrow(')
    expect(review).not.toContain('v2Payments.start(')
  })
  it('does not fabricate payment fees or misrepresent cash escrow', () => {
    expect(review).not.toContain('amount * 0.1')
    expect(review).not.toContain('Platform fee (10%)')
    expect(review).not.toContain('Your money is held safely until')
    expect(review).toContain('Cash is paid directly to the provider')
    expect(review).toContain('No funds are held at this stage.')
    expect(review).toContain('before any funding action.')
  })
  it('blocks stale, missing and cross-market quotes', () => {
    expect(review).toContain("const ready = readState === 'ready' && !!quote && !!currency")
    expect(review).toContain("disabled={loading}")
    expect(review).toContain('Quote unavailable, changed or in a different currency')
  })
})
