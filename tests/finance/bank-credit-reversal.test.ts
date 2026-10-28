import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx: any = {
    commissionBankReversal: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    commissionBankTransaction: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    providerCommissionRecovery: { findUnique: vi.fn() },
    providerIdentity: { findUnique: vi.fn() },
    $queryRawUnsafe: vi.fn(),
  }
  return { tx, transaction: vi.fn(async (work: (transaction: any) => Promise<unknown>) => work(tx)) }
})

vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.transaction } }))

function bankStatement() {
  return {
    provenanceStatus: 'VERIFIED', provenanceType: 'SIMULATED', sourceSystem: 'synthetic-bank',
    verificationSource: 'synthetic-bank', verificationRef: 'fixture-proof-1', verifiedAt: new Date(),
  }
}

function allocation(id: string, amountMinor: bigint, createdAt = new Date(0)) {
  return { id, receivableId: `receivable-${id}`, amountMinor, createdAt, receivable: { id: `receivable-${id}` } }
}

function resetFixtures() {
  vi.clearAllMocks()
  const originalAllocations = [allocation('alloc-a', 5_000n), allocation('alloc-b', 5_000n, new Date(1))]
  mocks.tx.commissionBankReversal.findUnique.mockResolvedValue(null)
  mocks.tx.commissionBankReversal.findMany.mockResolvedValue([])
  mocks.tx.commissionBankReversal.create.mockImplementation(({ data }: any) => ({ id: 'reversal-1', ...data, allocations: data.allocations.create }))
  mocks.tx.commissionBankTransaction.findUnique.mockResolvedValue({
    id: 'debit-1', direction: 'DEBIT', reversalOfTransactionId: 'credit-txn', amountMinor: 3_000n,
    currency: 'LKR', countryCode: 'LK', bankAccountRef: 'LK-ACCOUNT-1', sourceSystem: 'synthetic-bank',
    status: 'UNREVIEWED', transactionId: 'debit-txn', statementImport: bankStatement(),
  })
  mocks.tx.commissionBankTransaction.findFirst.mockResolvedValue({
    id: 'credit-1', direction: 'CREDIT', transactionId: 'credit-txn', amountMinor: 10_000n,
    currency: 'LKR', countryCode: 'LK', bankAccountRef: 'LK-ACCOUNT-1', sourceSystem: 'synthetic-bank',
    statementImport: bankStatement(),
    reconciliation: {
      id: 'reconciliation-1', status: 'POSTED', bankTransactionId: 'credit-1', providerIdentityId: 'identity-1',
      countryCode: 'LK', currency: 'LKR', totalAmountMinor: 10_000n, allocations: originalAllocations,
    },
  })
  mocks.tx.providerCommissionRecovery.findUnique.mockImplementation(({ where }: any) => ({
    id: `recovery:${where.idempotencyKey}`, providerIdentityId: 'identity-1', currency: 'LKR',
    amount: where.idempotencyKey.endsWith('receivable-alloc-a') ? 5_000n : 5_000n,
  }))
  mocks.tx.providerIdentity.findUnique.mockResolvedValue({ id: 'identity-1', identityType: 'TASKER', countryCode: 'LK' })
  mocks.tx.commissionBankTransaction.updateMany.mockResolvedValue({ count: 1 })
}

describe('commission bank reversal preparation', () => {
  beforeEach(resetFixtures)

  it('allocates partial reversals to exact original settlement allocations', async () => {
    const { prepareCommissionBankReversal } = await import('@/lib/finance/commissions/bank-credit-reversal')
    const reversal = await prepareCommissionBankReversal({ bankTransactionId: 'debit-1', actorAdminId: 'finance-maker' }) as unknown as { allocations: Array<Record<string, unknown>> }

    expect(reversal.allocations).toEqual([
      expect.objectContaining({ originalAllocationId: 'alloc-a', amountMinor: 3_000n, recoveryId: 'recovery:bank-credit:credit-1:receivable-alloc-a' }),
    ])
    expect(mocks.tx.commissionBankTransaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'debit-1', status: { in: ['UNREVIEWED', 'MATCHED'] } },
    }))
  })

  it('rejects a reversal whose original credit is from another market', async () => {
    mocks.tx.commissionBankTransaction.findFirst.mockImplementation(async () => {
      const original = await Promise.resolve({
        id: 'credit-1', direction: 'CREDIT', transactionId: 'credit-txn', amountMinor: 10_000n,
        currency: 'CAD', countryCode: 'CA', bankAccountRef: 'LK-ACCOUNT-1', sourceSystem: 'synthetic-bank',
        statementImport: bankStatement(), reconciliation: null,
      })
      return original
    })
    const { prepareCommissionBankReversal } = await import('@/lib/finance/commissions/bank-credit-reversal')
    await expect(prepareCommissionBankReversal({ bankTransactionId: 'debit-1', actorAdminId: 'finance-maker' }))
      .rejects.toThrow('BANK_REVERSAL_ORIGINAL_MISMATCH')
    expect(mocks.tx.commissionBankReversal.create).not.toHaveBeenCalled()
  })

  it('rejects debit events that arrive before their original credit is posted', async () => {
    mocks.tx.commissionBankTransaction.findFirst.mockResolvedValue({
      id: 'credit-1', direction: 'CREDIT', transactionId: 'credit-txn', amountMinor: 10_000n,
      currency: 'LKR', countryCode: 'LK', bankAccountRef: 'LK-ACCOUNT-1', sourceSystem: 'synthetic-bank',
      statementImport: bankStatement(), reconciliation: { id: 'reconciliation-1', status: 'PENDING_REVIEW' },
    })
    const { prepareCommissionBankReversal } = await import('@/lib/finance/commissions/bank-credit-reversal')
    await expect(prepareCommissionBankReversal({ bankTransactionId: 'debit-1', actorAdminId: 'finance-maker' }))
      .rejects.toThrow('BANK_REVERSAL_ORIGINAL_NOT_POSTED')
  })

  it('replays an existing reversal record without creating a duplicate', async () => {
    const existing = { id: 'existing-reversal', status: 'PENDING_REVIEW', allocations: [] }
    mocks.tx.commissionBankReversal.findUnique.mockResolvedValue(existing)
    const { prepareCommissionBankReversal } = await import('@/lib/finance/commissions/bank-credit-reversal')
    await expect(prepareCommissionBankReversal({ bankTransactionId: 'debit-1', actorAdminId: 'finance-maker' }))
      .resolves.toEqual(existing)
    expect(mocks.tx.commissionBankReversal.create).not.toHaveBeenCalled()
  })
})
