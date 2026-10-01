import { describe, expect, it, vi } from 'vitest'
import { resolveEscrowFundingSource } from '@/lib/finance/payments/funding-source'

function client(options: {
  debit?: { accountId: string; accountType: string } | null
  captured?: { id: string } | null
}) {
  return {
    financialLedger: {
      findFirst: vi.fn().mockResolvedValue(options.debit ?? null),
    },
    paymentIntent: {
      findFirst: vi.fn().mockResolvedValue(options.captured ?? null),
    },
  } as any
}

describe('escrow funding source resolution', () => {
  it('recognizes PayHere ledger deposits', async () => {
    await expect(resolveEscrowFundingSource(client({
      debit: { accountId: 'external:payhere', accountType: 'EXTERNAL_PAYOUT' },
    }), 'esc-1')).resolves.toBe('PAYHERE')
  })

  it('recognizes customer wallet deposits', async () => {
    await expect(resolveEscrowFundingSource(client({
      debit: { accountId: 'wallet-1', accountType: 'CUSTOMER_WALLET' },
    }), 'esc-1')).resolves.toBe('WALLET')
  })

  it('falls back to captured payment intent for historical PayHere deposits', async () => {
    await expect(resolveEscrowFundingSource(client({
      debit: null,
      captured: { id: 'pi-1' },
    }), 'esc-1')).resolves.toBe('PAYHERE')
  })

  it('fails closed when funding source cannot be proven', async () => {
    await expect(resolveEscrowFundingSource(client({
      debit: null,
      captured: null,
    }), 'esc-1')).resolves.toBe('UNKNOWN')
  })
})
