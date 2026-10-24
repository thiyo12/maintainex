import { describe, expect, it } from 'vitest'
import { decideCashCollectionReport } from '@/lib/finance/payments/cash-collection-state'

const decide = (
  status: string,
  previousAmountMinor: bigint | null,
  reportedAmountMinor: bigint,
  sameReporter = false,
) => decideCashCollectionReport({ status, previousAmountMinor, reportedAmountMinor, sameReporter })

describe('cash collection reporting', () => {
  it('accepts an explicit zero collection for customer confirmation', () => {
    expect(decide('NOT_REPORTED', null, 0n)).toBe('ACCEPT')
  })

  it('accepts partial and full collection totals', () => {
    expect(decide('NOT_REPORTED', null, 4250n)).toBe('ACCEPT')
    expect(decide('NOT_REPORTED', null, 10000n)).toBe('ACCEPT')
  })

  it('allows a later collection only as an increased cumulative total after confirmation', () => {
    expect(decide('CUSTOMER_CONFIRMED', 4250n, 7000n)).toBe('ACCEPT')
    expect(decide('CUSTOMER_CONFIRMED', 4250n, 4250n)).toBe('REJECT')
    expect(decide('CUSTOMER_CONFIRMED', 4250n, 4000n)).toBe('REJECT')
  })

  it('allows a contested amount to be corrected, including to zero', () => {
    expect(decide('CONTESTED', 7000n, 5000n)).toBe('ACCEPT')
    expect(decide('CONTESTED', 7000n, 0n)).toBe('ACCEPT')
  })

  it('makes same-provider report retries idempotent before and after confirmation', () => {
    expect(decide('PROVIDER_REPORTED', 4250n, 4250n, true)).toBe('RETRY')
    expect(decide('CUSTOMER_CONFIRMED', 4250n, 4250n, true)).toBe('RETRY')
  })

  it('does not let another report overwrite an unconfirmed provider report', () => {
    expect(decide('PROVIDER_REPORTED', 4250n, 5000n)).toBe('REJECT')
  })
})
