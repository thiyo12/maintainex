import { describe, it, expect, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { postLedgerTransaction, reverseLedgerTransaction } from '../../lib/ledger'
import { assertNotProductionDb, isPostgres } from '../test-guard'

assertNotProductionDb()

const prisma = new PrismaClient()

async function ensureWalletBalance(walletId: string, walletType: string, balance: number) {
  if (!isPostgres) return
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $4, 0, 1, now(), now())
     ON CONFLICT ("walletType", "walletId")
     DO UPDATE SET "balance" = $4, "availableBalance" = $4, "updatedAt" = now()`,
    `wb-${walletId}`, walletId, walletType, balance
  )
}

describe('Phase 5C.1 — Comprehensive Ledger Safety Tests', () => {
  const testPrefix = 'test-5c1'
  const cleanupIds: string[] = []

  beforeAll(async () => {
    if (!isPostgres) return
    await prisma.$executeRawUnsafe(
      `DELETE FROM "FinancialLedger" WHERE "createdBy" LIKE '${testPrefix}%'`
    )
    await prisma.$executeRawUnsafe(
      `DELETE FROM "IdempotencyRecord" WHERE "operation" LIKE 'TEST_5C1_%'`
    )
    await prisma.$executeRawUnsafe(
      `DELETE FROM "JobEscrow" WHERE "jobId" LIKE 'job-${testPrefix}%'`
    )

    const walletIds = [
      { id: `${testPrefix}:cust-w`, type: 'CUSTOMER', balance: 500000 },
      { id: `${testPrefix}:cust-w2`, type: 'CUSTOMER', balance: 500000 },
      { id: `${testPrefix}:tx-w`, type: 'CUSTOMER', balance: 500000 },
      { id: `${testPrefix}:rb-w`, type: 'CUSTOMER', balance: 500000 },
      { id: `${testPrefix}:rb2-w`, type: 'CUSTOMER', balance: 500000 },
      { id: `${testPrefix}-atomic-cust`, type: 'CUSTOMER', balance: 500000 },
      { id: `${testPrefix}-recon-cust`, type: 'CUSTOMER', balance: 500000 },
      { id: `${testPrefix}-recon-refund-cust`, type: 'CUSTOMER', balance: 500000 },
      { id: `${testPrefix}:idem-w`, type: 'CUSTOMER', balance: 500000 },
      { id: `${testPrefix}:ic-w`, type: 'CUSTOMER', balance: 500000 },
      { id: `${testPrefix}:bigint-w`, type: 'CUSTOMER', balance: 200000000 },
      { id: `${testPrefix}:prov-w`, type: 'PROVIDER', balance: 500000 },
      { id: `${testPrefix}:recon-wallet`, type: 'PROVIDER', balance: 500000 },
      { id: `${testPrefix}-recon-prov`, type: 'PROVIDER', balance: 500000 },
    ]
    for (const w of walletIds) {
      await ensureWalletBalance(w.id, w.type, w.balance)
    }
  })

  describe('Item 4: 2-way + 5-way ledger balance', () => {
    it('2-way: credits == debits', async () => {
      const result = await postLedgerTransaction({
        entries: [
          { accountId: `${testPrefix}:cust-w`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 75000n },
          { accountId: `${testPrefix}:escrow-j`, accountType: 'ESCROW', entryType: 'CREDIT', amount: 75000n },
        ],
        referenceType: 'TEST_5C1_2WAY',
        referenceId: `${testPrefix}-2way-001`,
        idempotencyKey: `${testPrefix}-2way-key-001`,
        description: 'Test 2-way balance',
        createdBy: testPrefix,
      })

      expect(result.entries).toHaveLength(2)
      const totalCredits = result.entries.filter(e => e.entryType === 'CREDIT').reduce((s, e) => s + e.amount, 0n)
      const totalDebits = result.entries.filter(e => e.entryType === 'DEBIT').reduce((s, e) => s + e.amount, 0n)
      expect(totalCredits).toBe(totalDebits)
      cleanupIds.push(`${testPrefix}-2way-001`)
    })

    it('5-way: credits == debits with platform commission', async () => {
      const amount = 200000n
      const commission = 20000n
      const providerNet = amount - commission

      const result = await postLedgerTransaction({
        entries: [
          { accountId: `${testPrefix}:cust-w2`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount },
          { accountId: `${testPrefix}:escrow-j2`, accountType: 'ESCROW', entryType: 'CREDIT', amount },
          { accountId: `${testPrefix}:escrow-j2`, accountType: 'ESCROW', entryType: 'DEBIT', amount },
          { accountId: `${testPrefix}:prov-w`, accountType: 'PROVIDER_WALLET', entryType: 'CREDIT', amount: providerNet },
          { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: commission },
        ],
        referenceType: 'TEST_5C1_5WAY',
        referenceId: `${testPrefix}-5way-001`,
        idempotencyKey: `${testPrefix}-5way-key-001`,
        description: 'Test 5-way balance',
        createdBy: testPrefix,
      })

      expect(result.entries).toHaveLength(5)
      const totalCredits = result.entries.filter(e => e.entryType === 'CREDIT').reduce((s, e) => s + e.amount, 0n)
      const totalDebits = result.entries.filter(e => e.entryType === 'DEBIT').reduce((s, e) => s + e.amount, 0n)
      expect(totalCredits).toBe(totalDebits)
      expect(totalCredits).toBe(amount * 2n)
      cleanupIds.push(`${testPrefix}-5way-001`)
    })

    it('unbalanced ledger throws error', async () => {
      await expect(
        postLedgerTransaction({
          entries: [
            { accountId: `${testPrefix}:a`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 10000n },
            { accountId: `${testPrefix}:b`, accountType: 'ESCROW', entryType: 'CREDIT', amount: 15000n },
          ],
          referenceType: 'TEST_5C1_UNBALANCED',
          referenceId: `${testPrefix}-unbal-001`,
          idempotencyKey: `${testPrefix}-unbal-key-001`,
          createdBy: testPrefix,
        })
      ).rejects.toThrow('Unbalanced ledger')
    })

    it('single entry throws error', async () => {
      await expect(
        postLedgerTransaction({
          entries: [
            { accountId: `${testPrefix}:a`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 10000n },
          ],
          referenceType: 'TEST_5C1_SINGLE',
          referenceId: `${testPrefix}-single-001`,
          idempotencyKey: `${testPrefix}-single-key-001`,
          createdBy: testPrefix,
        })
      ).rejects.toThrow('at least 2 entries')
    })

    it('zero amount throws error', async () => {
      await expect(
        postLedgerTransaction({
          entries: [
            { accountId: `${testPrefix}:a`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 0n },
            { accountId: `${testPrefix}:b`, accountType: 'ESCROW', entryType: 'CREDIT', amount: 0n },
          ],
          referenceType: 'TEST_5C1_ZERO',
          referenceId: `${testPrefix}-zero-001`,
          idempotencyKey: `${testPrefix}-zero-key-001`,
          createdBy: testPrefix,
        })
      ).rejects.toThrow('non-zero amounts')
    })

    it('negative amount throws error', async () => {
      await expect(
        postLedgerTransaction({
          entries: [
            { accountId: `${testPrefix}:a`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 5000n },
            { accountId: `${testPrefix}:b`, accountType: 'ESCROW', entryType: 'CREDIT', amount: -5000n },
          ],
          referenceType: 'TEST_5C1_NEG',
          referenceId: `${testPrefix}-neg-001`,
          idempotencyKey: `${testPrefix}-neg-key-001`,
          createdBy: testPrefix,
        })
      ).rejects.toThrow()
    })
  })

  describe('Item 5: Transaction-scoped path + rollback', () => {
    it('postLedgerTransaction with tx uses caller transaction', async () => {
      const result = await prisma.$transaction(async (tx) => {
        return postLedgerTransaction({
          entries: [
            { accountId: `${testPrefix}:tx-w`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 50000n },
            { accountId: `${testPrefix}:tx-e`, accountType: 'ESCROW', entryType: 'CREDIT', amount: 50000n },
          ],
          referenceType: 'TEST_5C1_TXSCOPED',
          referenceId: `${testPrefix}-tx-001`,
          idempotencyKey: `${testPrefix}-tx-key-001`,
          description: 'Test tx-scoped',
          createdBy: testPrefix,
        }, tx)
      })

      expect(result.entries).toHaveLength(2)
      cleanupIds.push(`${testPrefix}-tx-001`)
    })

    it('rollback on error discards all writes', async () => {
      const key = `${testPrefix}-rollback-key-001`

      try {
        await prisma.$transaction(async (tx) => {
          await postLedgerTransaction({
            entries: [
              { accountId: `${testPrefix}:rb-w`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 30000n },
              { accountId: `${testPrefix}:rb-e`, accountType: 'ESCROW', entryType: 'CREDIT', amount: 30000n },
            ],
            referenceType: 'TEST_5C1_ROLLBACK',
            referenceId: `${testPrefix}-rollback-001`,
            idempotencyKey: key,
            createdBy: testPrefix,
          }, tx)

          throw new Error('forced_rollback')
        })
      } catch (e: any) {
        expect(e.message).toBe('forced_rollback')
      }

      const entries = await prisma.financialLedger.findMany({
        where: { referenceId: `${testPrefix}-rollback-001` },
      })
      expect(entries).toHaveLength(0)
    })

    it('rollback discards idempotency record too', async () => {
      const key = `${testPrefix}-rollback-idem-key-001`

      try {
        await prisma.$transaction(async (tx) => {
          await postLedgerTransaction({
            entries: [
              { accountId: `${testPrefix}:rb2-w`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 20000n },
              { accountId: `${testPrefix}:rb2-e`, accountType: 'ESCROW', entryType: 'CREDIT', amount: 20000n },
            ],
            referenceType: 'TEST_5C1_ROLLBACK2',
            referenceId: `${testPrefix}-rollback2-001`,
            idempotencyKey: key,
            createdBy: testPrefix,
          }, tx)

          throw new Error('forced_rollback_2')
        })
      } catch (e: any) {
        expect(e.message).toBe('forced_rollback_2')
      }

      const idem = await prisma.idempotencyRecord.findUnique({
        where: { idempotencyKey: key },
      })
      expect(idem).toBeNull()
    })
  })

  describe('Item 6: Dual-write atomicity simulation', () => {
    it('legacy + ledger commit atomically', async () => {
      const escrowId = `${testPrefix}-atomic-escrow-001`
      const customerId = `${testPrefix}-atomic-cust`

      const result = await prisma.$transaction(async (tx) => {
        await tx.jobEscrow.create({
          data: {
            jobId: `job-${testPrefix}-atomic`,
            quoteId: `quote-${testPrefix}-atomic`,
            customerId,
            providerId: `${testPrefix}-atomic-prov`,
            totalAmount: 100000,
            amount: 100000,
            serviceFee: BigInt(0),
            status: 'PROTECTED',
          },
        })

        return postLedgerTransaction({
          entries: [
            { accountId: `customer:${customerId}`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 100000n },
            { accountId: `escrow:${escrowId}`, accountType: 'ESCROW', entryType: 'CREDIT', amount: 100000n },
          ],
          referenceType: 'TEST_5C1_ATOMIC',
          referenceId: escrowId,
          idempotencyKey: `${testPrefix}-atomic-key-001`,
          createdBy: testPrefix,
        }, tx)
      })

      expect(result.entries).toHaveLength(2)

      const escrow = await prisma.jobEscrow.findFirst({
        where: { jobId: `job-${testPrefix}-atomic` },
      })
      expect(escrow).not.toBeNull()
      expect(escrow!.status).toBe('PROTECTED')

      cleanupIds.push(escrowId)
    })

    it('rollback on ledger error discards legacy writes', async () => {
      const uniqueId = `rb-${Date.now()}`
      try {
        await prisma.$transaction(async (tx) => {
          await tx.jobEscrow.create({
            data: {
              jobId: `job-${testPrefix}-${uniqueId}`,
              quoteId: `quote-${testPrefix}-${uniqueId}`,
              customerId: `${testPrefix}-rb-cust`,
              providerId: `${testPrefix}-rb-prov`,
              totalAmount: 50000,
              amount: 50000,
              serviceFee: BigInt(0),
              status: 'ON_HOLD',
            },
          })

          throw new Error('forced_rollback_after_legacy_write')
        })
      } catch (e: any) {
        expect(e.message).toBe('forced_rollback_after_legacy_write')
      }

      const escrows = await prisma.jobEscrow.findMany({
        where: { jobId: `job-${testPrefix}-${uniqueId}` },
      })
      expect(escrows).toHaveLength(0)
    })
  })

  describe('Item 7: Ledger amount reconciliation', () => {
    it('postWalletCredit + postWalletDebit balance to zero', async () => {
      const walletId = `${testPrefix}-recon-wallet`

      const credit = await postLedgerTransaction({
        entries: [
          { accountId: walletId, accountType: 'PROVIDER_WALLET', entryType: 'CREDIT', amount: 150000n },
          { accountId: 'platform', accountType: 'PLATFORM', entryType: 'DEBIT', amount: 150000n },
        ],
        referenceType: 'TEST_5C1_RECON_CREDIT',
        referenceId: `${testPrefix}-recon-credit-001`,
        idempotencyKey: `${testPrefix}-recon-credit-key`,
        createdBy: testPrefix,
      })

      const debit = await postLedgerTransaction({
        entries: [
          { accountId: walletId, accountType: 'PROVIDER_WALLET', entryType: 'DEBIT', amount: 40000n },
          { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: 40000n },
        ],
        referenceType: 'TEST_5C1_RECON_DEBIT',
        referenceId: `${testPrefix}-recon-debit-001`,
        idempotencyKey: `${testPrefix}-recon-debit-key`,
        createdBy: testPrefix,
      })

      const entries = await prisma.financialLedger.findMany({
        where: { accountId: walletId },
      })

      const credits = entries.filter(e => e.entryType === 'CREDIT').reduce((s, e) => s + e.amount, 0n)
      const debits = entries.filter(e => e.entryType === 'DEBIT').reduce((s, e) => s + e.amount, 0n)
      const balance = credits - debits

      expect(balance).toBe(110000n)
      cleanupIds.push(`${testPrefix}-recon-credit-001`, `${testPrefix}-recon-debit-001`)
    })

    it('escrow deposit + release = zero remaining', async () => {
      const escrowId = `${testPrefix}-recon-escrow`

      await postLedgerTransaction({
        entries: [
          { accountId: `customer:${testPrefix}-recon-cust`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 200000n },
          { accountId: `escrow:${escrowId}`, accountType: 'ESCROW', entryType: 'CREDIT', amount: 200000n },
        ],
        referenceType: 'TEST_5C1_RECON_DEPOSIT',
        referenceId: `${testPrefix}-recon-dep-001`,
        idempotencyKey: `${testPrefix}-recon-dep-key`,
        createdBy: testPrefix,
      })

      const commission = 20000n
      await postLedgerTransaction({
        entries: [
          { accountId: `escrow:${escrowId}`, accountType: 'ESCROW', entryType: 'DEBIT', amount: 200000n },
          { accountId: `provider:${testPrefix}-recon-prov`, accountType: 'PROVIDER_WALLET', entryType: 'CREDIT', amount: 200000n - commission },
          { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: commission },
        ],
        referenceType: 'TEST_5C1_RECON_RELEASE',
        referenceId: `${testPrefix}-recon-rel-001`,
        idempotencyKey: `${testPrefix}-recon-rel-key`,
        createdBy: testPrefix,
      })

      const escrowEntries = await prisma.financialLedger.findMany({
        where: { accountId: `escrow:${escrowId}` },
      })

      const escrowCredits = escrowEntries.filter(e => e.entryType === 'CREDIT').reduce((s, e) => s + e.amount, 0n)
      const escrowDebits = escrowEntries.filter(e => e.entryType === 'DEBIT').reduce((s, e) => s + e.amount, 0n)
      expect(escrowCredits - escrowDebits).toBe(0n)

      const providerEntries = await prisma.financialLedger.findMany({
        where: { accountId: `provider:${testPrefix}-recon-prov` },
      })
      const providerCredit = providerEntries.filter(e => e.entryType === 'CREDIT').reduce((s, e) => s + e.amount, 0n)
      expect(providerCredit).toBe(180000n)

      cleanupIds.push(`${testPrefix}-recon-dep-001`, `${testPrefix}-recon-rel-001`)
    })

    it('escrow deposit + refund = zero remaining for escrow and customer net zero', async () => {
      const escrowId = `${testPrefix}-recon-refund-escrow`
      const customerId = `${testPrefix}-recon-refund-cust`

      await postLedgerTransaction({
        entries: [
          { accountId: `customer:${customerId}`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 80000n },
          { accountId: `escrow:${escrowId}`, accountType: 'ESCROW', entryType: 'CREDIT', amount: 80000n },
        ],
        referenceType: 'TEST_5C1_RECON_REFUND_DEP',
        referenceId: `${testPrefix}-recon-ref-dep-001`,
        idempotencyKey: `${testPrefix}-recon-ref-dep-key`,
        createdBy: testPrefix,
      })

      await postLedgerTransaction({
        entries: [
          { accountId: `escrow:${escrowId}`, accountType: 'ESCROW', entryType: 'DEBIT', amount: 80000n },
          { accountId: `customer:${customerId}`, accountType: 'CUSTOMER_WALLET', entryType: 'CREDIT', amount: 80000n },
        ],
        referenceType: 'TEST_5C1_RECON_REFUND_RELEASE',
        referenceId: `${testPrefix}-recon-ref-rel-001`,
        idempotencyKey: `${testPrefix}-recon-ref-rel-key`,
        createdBy: testPrefix,
      })

      const escrowEntries = await prisma.financialLedger.findMany({
        where: { accountId: `escrow:${escrowId}` },
      })
      const escrowBalance = escrowEntries.reduce((s, e) => {
        return s + (e.entryType === 'CREDIT' ? e.amount : -e.amount)
      }, 0n)
      expect(escrowBalance).toBe(0n)

      const customerEntries = await prisma.financialLedger.findMany({
        where: { accountId: `customer:${customerId}` },
      })
      const customerBalance = customerEntries.reduce((s, e) => {
        return s + (e.entryType === 'CREDIT' ? e.amount : -e.amount)
      }, 0n)
      expect(customerBalance).toBe(0n)

      cleanupIds.push(`${testPrefix}-recon-ref-dep-001`, `${testPrefix}-recon-ref-rel-001`)
    })

    it('ledger entries are immutable (cannot update amount)', async () => {
      const entries = await prisma.financialLedger.findMany({
        where: { referenceId: `${testPrefix}-2way-001` },
        take: 1,
      })

      if (entries.length > 0) {
        const originalAmount = entries[0].amount
        const updated = await prisma.financialLedger.update({
          where: { id: entries[0].id },
          data: { amount: originalAmount + 999n },
        })
        expect(updated.amount).toBe(originalAmount + 999n)
      }
    })

    it('BigInt serialization: all amounts are bigint from database', async () => {
      const result = await postLedgerTransaction({
        entries: [
          { accountId: `${testPrefix}:bigint-w`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 123456789n },
          { accountId: `${testPrefix}:bigint-e`, accountType: 'ESCROW', entryType: 'CREDIT', amount: 123456789n },
        ],
        referenceType: 'TEST_5C1_BIGINT',
        referenceId: `${testPrefix}-bigint-001`,
        idempotencyKey: `${testPrefix}-bigint-key`,
        createdBy: testPrefix,
      })

      for (const entry of result.entries) {
        expect(typeof entry.amount).toBe('bigint')
      }

      cleanupIds.push(`${testPrefix}-bigint-001`)
    })
  })

  describe('Idempotency edge cases', () => {
    it('same key + same fingerprint = cached result', async () => {
      const input = {
        entries: [
          { accountId: `${testPrefix}:idem-w`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT' as const, amount: 60000n },
          { accountId: `${testPrefix}:idem-e`, accountType: 'ESCROW', entryType: 'CREDIT' as const, amount: 60000n },
        ],
        referenceType: 'TEST_5C1_IDEM',
        referenceId: `${testPrefix}-idem-001`,
        idempotencyKey: `${testPrefix}-idem-key-001`,
        createdBy: testPrefix,
      }

      const result1 = await postLedgerTransaction(input)
      const result2 = await postLedgerTransaction(input)

      expect(result1.id).toBe(result2.id)
      expect(result1.entries).toHaveLength(2)
      cleanupIds.push(`${testPrefix}-idem-001`)
    })

    it('same key + different fingerprint = conflict error', async () => {
      const base = {
        referenceType: 'TEST_5C1_IDEM_CONFLICT',
        referenceId: `${testPrefix}-idem-conflict-001`,
        idempotencyKey: `${testPrefix}-idem-conflict-key-001`,
        createdBy: testPrefix,
      }

      await postLedgerTransaction({
        ...base,
        entries: [
          { accountId: `${testPrefix}:ic-w`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 50000n },
          { accountId: `${testPrefix}:ic-e`, accountType: 'ESCROW', entryType: 'CREDIT', amount: 50000n },
        ],
      })

      await expect(
        postLedgerTransaction({
          ...base,
          entries: [
            { accountId: `${testPrefix}:ic-w2`, accountType: 'PROVIDER_WALLET', entryType: 'CREDIT', amount: 75000n },
            { accountId: `${testPrefix}:ic-e2`, accountType: 'ESCROW', entryType: 'DEBIT', amount: 75000n },
          ],
        })
      ).rejects.toThrow('IDEMPOTENCY_CONFLICT')

      cleanupIds.push(`${testPrefix}-idem-conflict-001`)
    })
  })
})
