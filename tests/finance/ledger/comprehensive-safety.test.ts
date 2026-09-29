import { describe, it, expect, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { postLedgerTransaction, getLedgerBalance } from '@/lib/finance/ledger/ledger-service'
import { isPostgres, requiresPostgres } from '../../helpers/test-guard'

const prisma = new PrismaClient()
const PREFIX = `phase5c-${Date.now()}`

async function ensureWalletBalance(walletId: string, walletType: 'CUSTOMER' | 'PROVIDER', majorBalance: number) {
  if (!isPostgres) return
  const minorBalance = BigInt(majorBalance) * 100n
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $4, 0, 1, now(), now())
     ON CONFLICT ("walletType", "walletId")
     DO UPDATE SET "balance" = $4, "availableBalance" = $4, "pendingBalance" = 0, "updatedAt" = now()`,
    `wb-${walletId}`, walletId, walletType, minorBalance
  )
}

function totals(entries: Array<{ entryType: string; amount: bigint }>) {
  const credits = entries.filter(e => e.entryType === 'CREDIT').reduce((s, e) => s + BigInt(e.amount), 0n)
  const debits = entries.filter(e => e.entryType === 'DEBIT').reduce((s, e) => s + BigInt(e.amount), 0n)
  return { credits, debits }
}

describe.skipIf(!requiresPostgres())('Phase 5C.1 — Comprehensive Ledger Safety Tests', () => {
  const customerA = `${PREFIX}-customer-a`
  const customerB = `${PREFIX}-customer-b`
  const providerA = `${PREFIX}-provider-a`

  beforeAll(async () => {
    if (!isPostgres) return
    await ensureWalletBalance(customerA, 'CUSTOMER', 10000)
    await ensureWalletBalance(customerB, 'CUSTOMER', 10000)
    await ensureWalletBalance(providerA, 'PROVIDER', 1000)
  })

  it('2-way posting is balanced', async () => {
    const result = await postLedgerTransaction({
      entries: [
        { accountId: customerA, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 75000n },
        { accountId: `${PREFIX}-escrow-a`, accountType: 'ESCROW', entryType: 'CREDIT', amount: 75000n },
      ],
      referenceType: 'TEST_5C_2WAY', referenceId: `${PREFIX}-2way`, idempotencyKey: `${PREFIX}-2way`, createdBy: PREFIX,
    })
    const { credits, debits } = totals(result.entries)
    expect(credits).toBe(debits)
    expect(credits).toBe(75000n)
  })

  it('5-way escrow release with commission is balanced', async () => {
    const amount = 200000n
    const commission = 20000n
    const net = amount - commission
    const escrow = `${PREFIX}-escrow-b`
    const result = await postLedgerTransaction({
      entries: [
        { accountId: customerB, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount },
        { accountId: escrow, accountType: 'ESCROW', entryType: 'CREDIT', amount },
        { accountId: escrow, accountType: 'ESCROW', entryType: 'DEBIT', amount },
        { accountId: providerA, accountType: 'PROVIDER_WALLET', entryType: 'CREDIT', amount: net },
        { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: commission },
      ],
      referenceType: 'TEST_5C_5WAY', referenceId: `${PREFIX}-5way`, idempotencyKey: `${PREFIX}-5way`, createdBy: PREFIX,
    })
    const { credits, debits } = totals(result.entries)
    expect(credits).toBe(debits)
    expect(credits).toBe(amount * 2n)
  })

  it('unbalanced posting is rejected before any write', async () => {
    await expect(postLedgerTransaction({
      entries: [
        { accountId: customerA, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 10000n },
        { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: 9999n },
      ],
      referenceType: 'TEST_5C_BAD', referenceId: `${PREFIX}-bad`, idempotencyKey: `${PREFIX}-bad`, createdBy: PREFIX,
    })).rejects.toThrow('Unbalanced ledger')
  })

  it('zero and negative amounts are rejected', async () => {
    await expect(postLedgerTransaction({
      entries: [
        { accountId: customerA, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 0n },
        { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: 0n },
      ],
      referenceType: 'TEST_5C_ZERO', referenceId: `${PREFIX}-zero`, idempotencyKey: `${PREFIX}-zero`, createdBy: PREFIX,
    })).rejects.toThrow()

    await expect(postLedgerTransaction({
      entries: [
        { accountId: customerA, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 100n },
        { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: -100n },
      ],
      referenceType: 'TEST_5C_NEG', referenceId: `${PREFIX}-neg`, idempotencyKey: `${PREFIX}-neg`, createdBy: PREFIX,
    })).rejects.toThrow()
  })

  it('caller transaction rollback removes ledger and idempotency writes', async () => {
    const referenceId = `${PREFIX}-rollback`
    const key = `${PREFIX}-rollback-key`
    await expect(prisma.$transaction(async tx => {
      await postLedgerTransaction({
        entries: [
          { accountId: customerA, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 1000n },
          { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: 1000n },
        ],
        referenceType: 'TEST_5C_ROLLBACK', referenceId, idempotencyKey: key, createdBy: PREFIX,
      }, tx)
      throw new Error('forced_rollback')
    })).rejects.toThrow('forced_rollback')

    expect(await prisma.financialLedger.count({ where: { referenceId } })).toBe(0)
    expect(await prisma.idempotencyRecord.findFirst({ where: { idempotencyKey: key } })).toBeNull()
  })

  it('escrow row and ledger commit atomically in one transaction', async () => {
    const escrowId = `${PREFIX}-atomic-escrow`
    const jobId = `${PREFIX}-atomic-job`
    await prisma.$transaction(async tx => {
      await tx.jobEscrow.create({
        data: {
          id: escrowId, jobId, quoteId: `${PREFIX}-quote`, customerId: `${PREFIX}-customer-user`, providerId: `${PREFIX}-provider-user`,
          amount: 100000n, serviceFee: 0n, totalAmount: 100000n, status: 'PROTECTED',
        },
      })
      await postLedgerTransaction({
        entries: [
          { accountId: customerA, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 100000n },
          { accountId: `escrow:${escrowId}`, accountType: 'ESCROW', entryType: 'CREDIT', amount: 100000n },
        ],
        referenceType: 'TEST_5C_ATOMIC', referenceId: escrowId, idempotencyKey: `${PREFIX}-atomic`, createdBy: PREFIX,
      }, tx)
    })
    expect(await prisma.jobEscrow.findUnique({ where: { id: escrowId } })).not.toBeNull()
    expect(await prisma.financialLedger.count({ where: { referenceId: escrowId } })).toBe(2)
  })

  it('forced rollback after escrow write leaves no escrow row', async () => {
    const jobId = `${PREFIX}-rollback-escrow-job`
    await expect(prisma.$transaction(async tx => {
      await tx.jobEscrow.create({
        data: { jobId, quoteId: `${PREFIX}-rollback-quote`, customerId: `${PREFIX}-c`, providerId: `${PREFIX}-p`, amount: 50000n, serviceFee: 0n, totalAmount: 50000n, status: 'ON_HOLD' },
      })
      throw new Error('forced_rollback_after_escrow')
    })).rejects.toThrow('forced_rollback_after_escrow')
    expect(await prisma.jobEscrow.count({ where: { jobId } })).toBe(0)
  })

  it('deposit then release leaves escrow ledger balance zero', async () => {
    const escrow = `${PREFIX}-recon-release`
    await postLedgerTransaction({
      entries: [
        { accountId: customerA, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 100000n },
        { accountId: escrow, accountType: 'ESCROW', entryType: 'CREDIT', amount: 100000n },
      ],
      referenceType: 'TEST_5C_DEPOSIT', referenceId: `${PREFIX}-dep`, idempotencyKey: `${PREFIX}-dep`, createdBy: PREFIX,
    })
    await postLedgerTransaction({
      entries: [
        { accountId: escrow, accountType: 'ESCROW', entryType: 'DEBIT', amount: 100000n },
        { accountId: providerA, accountType: 'PROVIDER_WALLET', entryType: 'CREDIT', amount: 90000n },
        { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: 10000n },
      ],
      referenceType: 'TEST_5C_RELEASE', referenceId: `${PREFIX}-rel`, idempotencyKey: `${PREFIX}-rel`, createdBy: PREFIX,
    })
    expect((await getLedgerBalance(escrow, 'ESCROW')).balance).toBe(0n)
  })

  it('deposit then refund restores customer ledger net and clears escrow', async () => {
    const wallet = `${PREFIX}-refund-wallet`
    const escrow = `${PREFIX}-recon-refund`
    await ensureWalletBalance(wallet, 'CUSTOMER', 1000)
    await postLedgerTransaction({
      entries: [
        { accountId: wallet, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 50000n },
        { accountId: escrow, accountType: 'ESCROW', entryType: 'CREDIT', amount: 50000n },
      ],
      referenceType: 'TEST_5C_REFUND_DEP', referenceId: `${PREFIX}-rdep`, idempotencyKey: `${PREFIX}-rdep`, createdBy: PREFIX,
    })
    await postLedgerTransaction({
      entries: [
        { accountId: escrow, accountType: 'ESCROW', entryType: 'DEBIT', amount: 50000n },
        { accountId: wallet, accountType: 'CUSTOMER_WALLET', entryType: 'CREDIT', amount: 50000n },
      ],
      referenceType: 'TEST_5C_REFUND', referenceId: `${PREFIX}-refund`, idempotencyKey: `${PREFIX}-refund`, createdBy: PREFIX,
    })
    expect((await getLedgerBalance(escrow, 'ESCROW')).balance).toBe(0n)
    expect((await getLedgerBalance(wallet, 'CUSTOMER_WALLET')).balance).toBe(0n)
  })

  it('idempotent retry does not duplicate movement', async () => {
    const key = `${PREFIX}-idem`
    const referenceId = `${PREFIX}-idem-ref`
    const input = {
      entries: [
        { accountId: customerA, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT' as const, amount: 1000n },
        { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT' as const, amount: 1000n },
      ],
      referenceType: 'TEST_5C_IDEM', referenceId, idempotencyKey: key, createdBy: PREFIX,
    }
    const first = await postLedgerTransaction(input)
    const second = await postLedgerTransaction(input)
    expect(second.id).toBe(first.id)
    expect(await prisma.financialLedger.count({ where: { referenceId } })).toBe(2)
  })

  it('concurrent overspend cannot make WalletBalance negative', async () => {
    const wallet = `${PREFIX}-underflow`
    await ensureWalletBalance(wallet, 'CUSTOMER', 100)
    const attempts = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => postLedgerTransaction({
      entries: [
        { accountId: wallet, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: 3000n },
        { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: 3000n },
      ],
      referenceType: 'TEST_5C_CONC', referenceId: `${PREFIX}-conc-${i}`, idempotencyKey: `${PREFIX}-conc-${i}`, createdBy: PREFIX,
    })))
    const success = attempts.filter(r => r.status === 'fulfilled').length
    expect(success).toBeLessThanOrEqual(3)
    const rows = await prisma.$queryRawUnsafe<Array<{ balance: number }>>(`SELECT balance FROM "WalletBalance" WHERE "walletId" = $1 AND "walletType" = 'CUSTOMER'`, wallet)
    expect(Number(rows[0].balance)).toBeGreaterThanOrEqual(0)
  })
})
