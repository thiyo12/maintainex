import { describe, it, expect, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { postLedgerTransaction, reverseLedgerTransaction } from '../../lib/ledger'

const prisma = new PrismaClient()

describe('Phase 5C — Financial Writer Integration', () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM "FinancialLedger" WHERE "createdBy" = 'test-phase5c'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "IdempotencyRecord" WHERE "operation" LIKE 'ESCROW_TEST_%'`)
  })

  it('ledger postLedgerTransaction works inside $transaction', async () => {
    const result = await prisma.$transaction(async (tx) => {
      return postLedgerTransaction({
        entries: [
          { accountId: 'test:wallet-a', accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 50000n },
          { accountId: 'test:escrow-x', accountType: 'ESCROW', entryType: 'CREDIT', amount: 50000n },
        ],
        referenceType: 'ESCROW_TEST_DEPOSIT',
        referenceId: 'test-escrow-001',
        idempotencyKey: 'test-5c-deposit-001',
        description: 'Test deposit',
        createdBy: 'test-phase5c',
      }, tx)
    })

    expect(result.entries).toHaveLength(2)
    expect(result.entries[0].amount).toBe(50000n)
    expect(result.entries[1].amount).toBe(50000n)

    const ledgerEntries = await prisma.financialLedger.findMany({
      where: { referenceId: 'test-escrow-001' },
    })
    expect(ledgerEntries).toHaveLength(2)
  })

  it('idempotency prevents duplicate writes', async () => {
    const result1 = await prisma.$transaction(async (tx) => {
      return postLedgerTransaction({
        entries: [
          { accountId: 'test:wallet-b', accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 30000n },
          { accountId: 'test:escrow-y', accountType: 'ESCROW', entryType: 'CREDIT', amount: 30000n },
        ],
        referenceType: 'ESCROW_TEST_IDEMPOTENCY',
        referenceId: 'test-escrow-002',
        idempotencyKey: 'test-5c-idempotent-001',
        description: 'Test idempotent',
        createdBy: 'test-phase5c',
      }, tx)
    })

    const result2 = await prisma.$transaction(async (tx) => {
      return postLedgerTransaction({
        entries: [
          { accountId: 'test:wallet-b', accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 30000n },
          { accountId: 'test:escrow-y', accountType: 'ESCROW', entryType: 'CREDIT', amount: 30000n },
        ],
        referenceType: 'ESCROW_TEST_IDEMPOTENCY',
        referenceId: 'test-escrow-002',
        idempotencyKey: 'test-5c-idempotent-001',
        description: 'Test idempotent',
        createdBy: 'test-phase5c',
      }, tx)
    })

    expect(result1.id).toBe(result2.id)
    expect(result1.entries).toHaveLength(2)
    expect(result2.entries).toHaveLength(2)

    const entries = await prisma.financialLedger.findMany({
      where: { referenceId: 'test-escrow-002' },
    })
    expect(entries).toHaveLength(2)
  })

  it('conflicting payload throws error', async () => {
    await prisma.$transaction(async (tx) => {
      return postLedgerTransaction({
        entries: [
          { accountId: 'test:wallet-c', accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 20000n },
          { accountId: 'test:escrow-z', accountType: 'ESCROW', entryType: 'CREDIT', amount: 20000n },
        ],
        referenceType: 'ESCROW_TEST_CONFLICT',
        referenceId: 'test-escrow-003',
        idempotencyKey: 'test-5c-conflict-001',
        description: 'Test conflict',
        createdBy: 'test-phase5c',
      }, tx)
    })

    await expect(
      prisma.$transaction(async (tx) => {
        return postLedgerTransaction({
          entries: [
            { accountId: 'test:wallet-d', accountType: 'PROVIDER_WALLET', entryType: 'CREDIT', amount: 25000n },
            { accountId: 'test:escrow-z2', accountType: 'ESCROW', entryType: 'DEBIT', amount: 25000n },
          ],
          referenceType: 'ESCROW_TEST_CONFLICT',
          referenceId: 'test-escrow-004',
          idempotencyKey: 'test-5c-conflict-001',
          description: 'Test conflict different',
          createdBy: 'test-phase5c',
        }, tx)
      })
    ).rejects.toThrow('IDEMPOTENCY_CONFLICT')
  })

  it('three-way ledger balance matches', async () => {
    await prisma.$transaction(async (tx) => {
      return postLedgerTransaction({
        entries: [
          { accountId: 'test:escrow-3way', accountType: 'ESCROW', entryType: 'DEBIT', amount: 100000n },
          { accountId: 'test:provider-3way', accountType: 'PROVIDER_WALLET', entryType: 'CREDIT', amount: 85000n },
          { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: 15000n },
        ],
        referenceType: 'ESCROW_TEST_RELEASE',
        referenceId: 'test-escrow-release-001',
        idempotencyKey: 'test-5c-release-001',
        description: 'Test release 3-way',
        createdBy: 'test-phase5c',
      }, tx)
    })

    const entries = await prisma.financialLedger.findMany({
      where: { referenceId: 'test-escrow-release-001' },
    })
    expect(entries).toHaveLength(3)

    const debits = entries.filter((e) => e.entryType === 'DEBIT')
    const credits = entries.filter((e) => e.entryType === 'CREDIT')
    const totalDebits = debits.reduce((s, e) => s + e.amount, 0n)
    const totalCredits = credits.reduce((s, e) => s + e.amount, 0n)
    expect(totalDebits).toBe(totalCredits)
    expect(totalDebits).toBe(100000n)
  })

  it('reversal creates mirror transaction', async () => {
    const original = await prisma.$transaction(async (tx) => {
      return postLedgerTransaction({
        entries: [
          { accountId: 'test:wallet-rev', accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 40000n },
          { accountId: 'test:escrow-rev', accountType: 'ESCROW', entryType: 'CREDIT', amount: 40000n },
        ],
        referenceType: 'ESCROW_TEST_REFUND',
        referenceId: 'test-escrow-rev-001',
        idempotencyKey: 'test-5c-reversal-001',
        description: 'Test reversal',
        createdBy: 'test-phase5c',
      }, tx)
    })

    const reversal = await reverseLedgerTransaction(
      'test-escrow-rev-001',
      'test-5c-reversal-reverse-001',
      'test-phase5c'
    )

    expect(reversal.entries).toHaveLength(2)
    const reversalDebit = reversal.entries.find((e) => e.entryType === 'DEBIT')
    const reversalCredit = reversal.entries.find((e) => e.entryType === 'CREDIT')
    expect(reversalDebit?.amount).toBe(40000n)
    expect(reversalCredit?.amount).toBe(40000n)
    expect(reversalDebit?.accountId).toBe('test:escrow-rev')
    expect(reversalCredit?.accountId).toBe('test:wallet-rev')
  })
})
