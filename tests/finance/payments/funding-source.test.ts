import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ledger: vi.fn(),
  intent: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    financialLedger: { findFirst: mocks.ledger },
    paymentIntent: { findFirst: mocks.intent },
  },
}))

describe('historical escrow funding source', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ledger.mockResolvedValue(null)
    mocks.intent.mockResolvedValue(null)
  })

  it('uses the gateway recorded on the captured intent instead of assuming PayHere', async () => {
    mocks.intent.mockResolvedValue({ id: 'pi-paypal', gateway: 'PAYPAL' })
    const { resolveEscrowFundingSource } = await import('@/lib/finance/payments/funding-source')

    await expect(resolveEscrowFundingSource({ financialLedger: { findFirst: mocks.ledger }, paymentIntent: { findFirst: mocks.intent } } as never, 'escrow-1')).resolves.toBe('PAYPAL')
  })

  it('does not infer PayHere from a generic external payout account type', async () => {
    mocks.ledger.mockResolvedValue({ accountId: 'external:unknown-provider', accountType: 'EXTERNAL_PAYOUT' })
    mocks.intent.mockResolvedValue({ id: 'pi-unknown', gateway: 'NEW_PROVIDER' })
    const { resolveEscrowFundingSource } = await import('@/lib/finance/payments/funding-source')

    await expect(resolveEscrowFundingSource({ financialLedger: { findFirst: mocks.ledger }, paymentIntent: { findFirst: mocks.intent } } as never, 'escrow-1')).resolves.toBe('UNKNOWN')
  })

  it('continues to identify legacy PayHere and wallet funding from explicit ledger accounts', async () => {
    const { resolveEscrowFundingSource } = await import('@/lib/finance/payments/funding-source')
    mocks.ledger.mockResolvedValue({ accountId: 'external:payhere', accountType: 'EXTERNAL_PAYOUT' })
    const client = { financialLedger: { findFirst: mocks.ledger }, paymentIntent: { findFirst: mocks.intent } } as never
    await expect(resolveEscrowFundingSource(client, 'escrow-1')).resolves.toBe('PAYHERE')

    mocks.ledger.mockResolvedValue({ accountId: 'wallet-1', accountType: 'CUSTOMER_WALLET' })
    await expect(resolveEscrowFundingSource(client, 'escrow-2')).resolves.toBe('WALLET')
  })
})
