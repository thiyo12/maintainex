import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  requestPayout,
  markProcessing,
  markSucceeded,
  markFailed,
  cancelPayout,
  isValidTransition,
} from '@/lib/finance/payouts/payout-engine'
import { assertNotProductionDb } from '../../helpers/test-guard'

assertNotProductionDb()

const prisma = new PrismaClient()
const USER_ID = 'test-5f-user-001'
const WALLET_ID = 'test-5f-wallet-001'
const OPENING_CENTS = 1_000_000n // LKR 10,000.00

async function cleanup() {
  await prisma.$executeRawUnsafe(`DELETE FROM "FinancialLedger" WHERE "createdBy" = 'test-5f'`)
  await prisma.$executeRawUnsafe(`DELETE FROM "IdempotencyRecord" WHERE "idempotencyKey" LIKE '%test-5f-%'`)
  await prisma.$executeRawUnsafe(`DELETE FROM "Payout" WHERE "userId" = $1`, USER_ID)
  await prisma.$executeRawUnsafe(`DELETE FROM "WalletBalance" WHERE "walletId" = $1`, WALLET_ID)
  await prisma.$executeRawUnsafe(`DELETE FROM "ProviderWallet" WHERE "userId" = $1`, USER_ID)
  await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id = $1`, USER_ID)
}

async function setupWallet() {
  await cleanup()
  await prisma.$executeRawUnsafe(
    `INSERT INTO "User" (id, email, name, role, phone, "passwordHash", "createdAt", "updatedAt")
     VALUES ($1, 'test-5f@test.com', 'Phase 5F Provider', 'TASKER', '+94770000001', 'test-hash', NOW(), NOW())`,
    USER_ID,
  )
  await prisma.providerWallet.create({
    data: { id: WALLET_ID, userId: USER_ID, availableBalance: 0, pendingBalance: 0, isFrozen: false },
  })
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WalletBalance"
       (id, "walletId", "walletType", balance, "availableBalance", "pendingBalance", version, "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'PROVIDER', $2, $2, 0, 1, NOW(), NOW())`,
    WALLET_ID,
    OPENING_CENTS,
  )
}

async function balanceMajor() {
  const rows = await prisma.$queryRawUnsafe<Array<{ balance: bigint; available: bigint }>>(
    `SELECT balance, "availableBalance" AS available
     FROM "WalletBalance" WHERE "walletId" = $1 AND "walletType" = 'PROVIDER'`,
    WALLET_ID,
  )
  return { balance: Number(rows[0].balance) / 100, available: Number(rows[0].available) / 100 }
}

async function ledgerFor(payoutId: string) {
  return prisma.financialLedger.findMany({
    where: { referenceId: payoutId, createdBy: 'test-5f' },
    orderBy: { createdAt: 'asc' },
  })
}

describe('Phase 5F — canonical payout engine', () => {
  beforeEach(setupWallet)
  afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
  })

  it('enforces the payout state machine', () => {
    expect(isValidTransition('REQUESTED', 'RESERVED')).toBe(true)
    expect(isValidTransition('RESERVED', 'PROCESSING')).toBe(true)
    expect(isValidTransition('PROCESSING', 'SUCCEEDED')).toBe(true)
    expect(isValidTransition('PROCESSING', 'FAILED')).toBe(true)
    expect(isValidTransition('PROCESSING', 'CANCELLED')).toBe(true)
    expect(isValidTransition('SUCCEEDED', 'FAILED')).toBe(false)
    expect(isValidTransition('FAILED', 'SUCCEEDED')).toBe(false)
  })

  it('atomically reserves funds into payout clearing', async () => {
    const result = await requestPayout(USER_ID, 300_000n, 'bank', null, 'test-5f-reserve', 'test-5f')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const balance = await balanceMajor()
    expect(balance.balance).toBe(7000)
    expect(balance.available).toBe(7000)

    const entries = await ledgerFor(result.payoutId)
    const debit = entries.find(e => e.accountId === WALLET_ID && e.entryType === 'DEBIT')
    const clearing = entries.find(e => e.accountId === `payout:${result.payoutId}` && e.accountType === 'PAYOUT_CLEARING' && e.entryType === 'CREDIT')
    expect(debit?.amount).toBe(300_000n)
    expect(clearing?.amount).toBe(300_000n)
  })

  it('5 concurrent LKR 3,000 withdrawals on LKR 10,000 allow exactly 3', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        requestPayout(USER_ID, 300_000n, 'bank', null, `test-5f-five-${i}`, 'test-5f')
      ),
    )

    const succeeded = results.filter(r => r.ok)
    const failed = results.filter(r => !r.ok)
    expect(succeeded).toHaveLength(3)
    expect(failed).toHaveLength(2)
    for (const result of failed) {
      if (!result.ok) expect(result.code).toBe('INSUFFICIENT_FUNDS')
    }

    const balance = await balanceMajor()
    expect(balance.balance).toBe(1000)
    expect(balance.available).toBe(1000)
  })

  it('two concurrent LKR 8,000 withdrawals allow only one', async () => {
    const results = await Promise.all([
      requestPayout(USER_ID, 800_000n, 'bank', null, 'test-5f-eight-a', 'test-5f'),
      requestPayout(USER_ID, 800_000n, 'bank', null, 'test-5f-eight-b', 'test-5f'),
    ])
    expect(results.filter(r => r.ok)).toHaveLength(1)
    expect((await balanceMajor()).balance).toBe(2000)
  })

  it('same idempotency key and payload returns the same payout without double debit', async () => {
    const first = await requestPayout(USER_ID, 100_000n, 'bank', null, 'test-5f-idem', 'test-5f')
    const second = await requestPayout(USER_ID, 100_000n, 'bank', null, 'test-5f-idem', 'test-5f')
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (first.ok && second.ok) expect(second.payoutId).toBe(first.payoutId)
    expect((await balanceMajor()).balance).toBe(9000)
  })

  it('same idempotency key with different amount is rejected', async () => {
    expect((await requestPayout(USER_ID, 100_000n, 'bank', null, 'test-5f-conflict', 'test-5f')).ok).toBe(true)
    const conflict = await requestPayout(USER_ID, 200_000n, 'bank', null, 'test-5f-conflict', 'test-5f')
    expect(conflict.ok).toBe(false)
    if (!conflict.ok) expect(conflict.code).toBe('IDEMPOTENCY_CONFLICT')
  })

  it('successful payout clears the reservation to an external payout account exactly once', async () => {
    const requested = await requestPayout(USER_ID, 125_000n, 'bank', null, 'test-5f-success-request', 'test-5f')
    expect(requested.ok).toBe(true)
    if (!requested.ok) return

    expect((await markProcessing(requested.payoutId, 'admin-test', 'test-5f-success-processing')).ok).toBe(true)
    expect((await markSucceeded(requested.payoutId, 'BANK-123', 'test-5f-success-callback', 'test-5f')).ok).toBe(true)
    expect((await markSucceeded(requested.payoutId, 'BANK-123', 'test-5f-success-duplicate', 'test-5f')).ok).toBe(true)

    const payout = await prisma.payout.findUniqueOrThrow({ where: { id: requested.payoutId } })
    expect(payout.status).toBe('SUCCEEDED')
    expect(payout.clearedAt).not.toBeNull()

    const entries = await ledgerFor(requested.payoutId)
    const successEntries = entries.filter(e => e.referenceType === 'PAYOUT_SUCCEEDED')
    expect(successEntries).toHaveLength(2)
    expect(successEntries.find(e => e.accountId === `payout:${requested.payoutId}` && e.entryType === 'DEBIT')?.amount).toBe(125_000n)
    expect(successEntries.find(e => e.accountId === `external:payout:${requested.payoutId}` && e.entryType === 'CREDIT')?.amount).toBe(125_000n)
  })

  it('failed payout restores provider funds exactly once', async () => {
    const requested = await requestPayout(USER_ID, 200_000n, 'bank', null, 'test-5f-fail-request', 'test-5f')
    expect(requested.ok).toBe(true)
    if (!requested.ok) return

    expect((await markFailed(requested.payoutId, 'provider failure', 'test-5f-fail-callback', 'test-5f')).ok).toBe(true)
    expect((await markFailed(requested.payoutId, 'duplicate', 'test-5f-fail-duplicate', 'test-5f')).ok).toBe(true)
    expect((await balanceMajor()).balance).toBe(10000)

    const entries = (await ledgerFor(requested.payoutId)).filter(e => e.referenceType === 'WITHDRAWAL_RELEASED')
    expect(entries).toHaveLength(2)
    expect(entries.find(e => e.accountId === `payout:${requested.payoutId}` && e.entryType === 'DEBIT')?.amount).toBe(200_000n)
    expect(entries.find(e => e.accountId === WALLET_ID && e.entryType === 'CREDIT')?.amount).toBe(200_000n)
  })

  it('cancellation from processing restores funds', async () => {
    const requested = await requestPayout(USER_ID, 150_000n, 'bank', null, 'test-5f-cancel-request', 'test-5f')
    expect(requested.ok).toBe(true)
    if (!requested.ok) return
    await markProcessing(requested.payoutId, 'admin-test', 'test-5f-cancel-processing')
    const cancelled = await cancelPayout(requested.payoutId, 'customer cancel', 'test-5f-cancel-callback', 'test-5f')
    expect(cancelled.ok).toBe(true)
    expect((await balanceMajor()).balance).toBe(10000)
  })

  it('success/failure race produces one terminal outcome without wallet underflow', async () => {
    const requested = await requestPayout(USER_ID, 100_000n, 'bank', null, 'test-5f-race-request', 'test-5f')
    expect(requested.ok).toBe(true)
    if (!requested.ok) return
    await markProcessing(requested.payoutId, 'admin-test', 'test-5f-race-processing')

    await Promise.all([
      markSucceeded(requested.payoutId, 'BANK-RACE', 'test-5f-race-success', 'test-5f'),
      markFailed(requested.payoutId, 'timeout', 'test-5f-race-failure', 'test-5f'),
    ])

    const payout = await prisma.payout.findUniqueOrThrow({ where: { id: requested.payoutId } })
    expect(['SUCCEEDED', 'FAILED']).toContain(payout.status)
    const terminalEntries = (await ledgerFor(requested.payoutId)).filter(e =>
      e.referenceType === 'PAYOUT_SUCCEEDED' || e.referenceType === 'WITHDRAWAL_RELEASED'
    )
    expect(terminalEntries).toHaveLength(2)
    expect((await balanceMajor()).balance).toBeGreaterThanOrEqual(0)
  })

  it('rejects insufficient, below-minimum, zero and frozen withdrawals', async () => {
    const tooLarge = await requestPayout(USER_ID, 2_000_000n, 'bank', null, 'test-5f-too-large', 'test-5f')
    expect(tooLarge.ok).toBe(false)
    if (!tooLarge.ok) expect(tooLarge.code).toBe('INSUFFICIENT_FUNDS')

    const belowMinimum = await requestPayout(USER_ID, 10_000n, 'bank', null, 'test-5f-below-min', 'test-5f')
    expect(belowMinimum.ok).toBe(false)
    if (!belowMinimum.ok) expect(belowMinimum.code).toBe('BELOW_MINIMUM')

    expect((await requestPayout(USER_ID, 0n, 'bank', null, 'test-5f-zero', 'test-5f')).ok).toBe(false)

    await prisma.providerWallet.update({ where: { userId: USER_ID }, data: { isFrozen: true } })
    const frozen = await requestPayout(USER_ID, 100_000n, 'bank', null, 'test-5f-frozen', 'test-5f')
    expect(frozen.ok).toBe(false)
    if (!frozen.ok) expect(frozen.code).toBe('WALLET_FROZEN')
  })
})
