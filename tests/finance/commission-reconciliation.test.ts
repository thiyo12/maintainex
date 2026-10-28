import { describe, expect, it } from 'vitest'
import { allocateCommissionRemittance } from '@/lib/finance/commissions/commission-reconciliation'

describe('commission remittance allocation', () => {
  it('allocates a partial credit oldest-first and leaves exact balances', () => {
    expect(allocateCommissionRemittance([
      { id: 'oldest', amountRemaining: 600n },
      { id: 'next', amountRemaining: 500n },
    ], 800n)).toEqual([
      { receivableId: 'oldest', amountMinor: 600n, remainingMinor: 0n },
      { receivableId: 'next', amountMinor: 200n, remainingMinor: 300n },
    ])
  })

  it('does not accept zero, negative or excess credits', () => {
    const receivables = [{ id: 'one', amountRemaining: 500n }]
    expect(() => allocateCommissionRemittance(receivables, 0n)).toThrow('COMMISSION_REMITTANCE_AMOUNT_INVALID')
    expect(() => allocateCommissionRemittance(receivables, -1n)).toThrow('COMMISSION_REMITTANCE_AMOUNT_INVALID')
    expect(() => allocateCommissionRemittance(receivables, 501n)).toThrow('COMMISSION_REMITTANCE_EXCEEDS_DUE')
  })

  it('treats no outstanding receivables as a mismatch instead of an unapplied payment', () => {
    expect(() => allocateCommissionRemittance([], 1n)).toThrow('COMMISSION_REMITTANCE_EXCEEDS_DUE')
  })
})
