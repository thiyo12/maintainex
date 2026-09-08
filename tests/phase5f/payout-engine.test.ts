import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  requestPayout,
  markProcessing,
  markSucceeded,
  markFailed,
  cancelPayout,
  isValidTransition,
  isTestLedgerEntry,
  type PayoutStatus,
} from '../../lib/payout-engine'
import { assertNotProductionDb } from '../test-guard'

assertNotProductionDb()

const prisma = new PrismaClient()
const TEST_PROVIDER_USER_ID = 'test-5f-user-001'
const TEST_WALLET_ID = 'test-5f-wallet-001'
const TEST_BALANCE_CENTS = 1000000

async function setupTestWallet() {
  await prisma.$executeRawUnsafe(`DELETE FROM "FinancialLedger" WHERE "createdBy" = 'test-5f'`)
  await prisma.$executeRawUnsafe(`DELETE FROM "IdempotencyRecord" WHERE "idempotencyKey" LIKE 'test-5f-%'`)
  await prisma.$executeRawUnsafe(`DELETE FROM "Payout" WHERE "userId" = $1`, TEST_PROVIDER_USER_ID)
  await prisma.$executeRawUnsafe(`DELETE FROM "WalletBalance" WHERE "walletId" = $1`, TEST_WALLET_ID)
  await prisma.$executeRawUnsafe(`DELETE FROM "ProviderWallet" WHERE "userId" = $1`, TEST_PROVIDER_USER_ID)
  await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id = $1`, TEST_PROVIDER_USER_ID)

  await prisma.$executeRawUnsafe(
    `INSERT INTO "User" (id, email, name, role, phone, "passwordHash", "createdAt", "updatedAt")
     VALUES ($1, 'test-5f@test.com', 'Test 5F Provider', 'TASKER', '+94770000001', 'test-hash', NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    TEST_PROVIDER_USER_ID
  )

  await prisma.providerWallet.create({
    data: { id: TEST_WALLET_ID, userId: TEST_PROVIDER_USER_ID, availableBalance: 0, pendingBalance: 0, isFrozen: false }
  })

  await prisma.$executeRawUnsafe(
    `INSERT INTO "WalletBalance" (id, "walletId", "walletType", balance, "availableBalance", "pendingBalance", version, "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'PROVIDER', $2, $2, 0, 1, NOW(), NOW())
     ON CONFLICT ("walletType", "walletId") DO UPDATE SET balance = EXCLUDED.balance, "availableBalance" = EXCLUDED."availableBalance", "pendingBalance" = 0, version = "WalletBalance".version + 1, "updatedAt" = NOW()`,
    TEST_WALLET_ID, Number(TEST_BALANCE_CENTS) / 100
  )
}

async function getWalletBalance() {
  const rows = await prisma.$queryRawUnsafe<Array<{ balance: number; available: number }>>(
    `SELECT balance, "availableBalance" as available FROM "WalletBalance" WHERE "walletId" = $1 AND "walletType" = 'PROVIDER'`,
    TEST_WALLET_ID
  )
  return rows[0]
}

async function getTestLedgerEntries() {
  return prisma.$queryRawUnsafe<Array<{ accountId: string; entryType: string; amount: number; referenceType: string; createdBy: string }>>(
    `SELECT "accountId", "entryType", amount, "referenceType", "createdBy" FROM "FinancialLedger"
     WHERE "createdBy" = 'test-5f' OR ("referenceId" IN (SELECT id FROM "Payout" WHERE "userId" = $1) AND "createdBy" != 'test' AND "createdBy" != 'test-5c1' AND "createdBy" != 'test-phase5c')
     ORDER BY "createdAt"`,
    TEST_PROVIDER_USER_ID
  )
}

async function getPayouts() {
  return prisma.payout.findMany({ where: { userId: TEST_PROVIDER_USER_ID }, orderBy: { createdAt: 'asc' } })
}

async function countTerminalLedger(payoutId: string) {
  const succeeded = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*) as count FROM "FinancialLedger" WHERE "referenceType" = 'PAYOUT_SUCCEEDED' AND "referenceId" = $1`,
    payoutId
  )
  const released = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*) as count FROM "FinancialLedger" WHERE "referenceType" = 'WITHDRAWAL_RELEASED' AND "referenceId" = $1`,
    payoutId
  )
  return { succeeded: Number(succeeded[0].count), released: Number(released[0].count) }
}

describe('Phase 5F — Payout Engine', () => {
  beforeAll(async () => {
    await setupTestWallet()
  })

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM "FinancialLedger" WHERE "createdBy" = 'test-5f'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "IdempotencyRecord" WHERE "idempotencyKey" LIKE 'test-5f-%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "Payout" WHERE "userId" = $1`, TEST_PROVIDER_USER_ID)
    await prisma.$executeRawUnsafe(`DELETE FROM "WalletBalance" WHERE "walletId" = $1`, TEST_WALLET_ID)
    await prisma.$executeRawUnsafe(`DELETE FROM "ProviderWallet" WHERE "userId" = $1`, TEST_PROVIDER_USER_ID)
    await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id = $1`, TEST_PROVIDER_USER_ID)
    await prisma.$disconnect()
  })

  describe('State Machine', () => {
    it('valid transitions are accepted', () => {
      expect(isValidTransition('REQUESTED', 'RESERVED')).toBe(true)
      expect(isValidTransition('REQUESTED', 'CANCELLED')).toBe(true)
      expect(isValidTransition('REQUESTED', 'FAILED')).toBe(true)
      expect(isValidTransition('RESERVED', 'PROCESSING')).toBe(true)
      expect(isValidTransition('RESERVED', 'CANCELLED')).toBe(true)
      expect(isValidTransition('RESERVED', 'FAILED')).toBe(true)
      expect(isValidTransition('PROCESSING', 'SUCCEEDED')).toBe(true)
      expect(isValidTransition('PROCESSING', 'FAILED')).toBe(true)
      expect(isValidTransition('PROCESSING', 'CANCELLED')).toBe(true)
    })

    it('invalid transitions are rejected', () => {
      expect(isValidTransition('SUCCEEDED', 'FAILED')).toBe(false)
      expect(isValidTransition('SUCCEEDED', 'CANCELLED')).toBe(false)
      expect(isValidTransition('FAILED', 'SUCCEEDED')).toBe(false)
      expect(isValidTransition('CANCELLED', 'RESERVED')).toBe(false)
      expect(isValidTransition('REQUESTED', 'SUCCEEDED')).toBe(false)
    })

    it('terminal states have no transitions', () => {
      expect(isValidTransition('SUCCEEDED', 'REQUESTED')).toBe(false)
      expect(isValidTransition('FAILED', 'REQUESTED')).toBe(false)
      expect(isValidTransition('REVERSED', 'REQUESTED')).toBe(false)
      expect(isValidTransition('CANCELLED', 'REQUESTED')).toBe(false)
    })
  })

  describe('2-Way Withdrawal', () => {
    it('reserves funds atomically', async () => {
      await setupTestWallet()
      const before = await getWalletBalance()

      const result = await requestPayout(
        TEST_PROVIDER_USER_ID,
        BigInt(300000),
        'bank',
        JSON.stringify({ accountHolder: 'Test User', accountNumber: '123456' }),
        'test-5f-reserve-001',
        'test-5f'
      )
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok')

      const after = await getWalletBalance()
      expect(after.balance).toBe(before.balance - 3000)
      expect(after.available).toBe(before.available - 3000)
    })

    it('credits platform offset in ledger', async () => {
      const entries = await prisma.$queryRawUnsafe<Array<{ accountId: string; entryType: string; amount: number }>>(
        `SELECT "accountId", "entryType", amount FROM "FinancialLedger"
         WHERE "referenceType" = 'WITHDRAWAL_RESERVED' AND "createdBy" = 'test-5f'
         ORDER BY "entryType"`
      )
      const credit = entries.find(e => e.entryType === 'CREDIT' && e.accountId === 'platform')
      const debit = entries.find(e => e.entryType === 'DEBIT' && e.accountId !== 'platform')
      expect(credit).toBeDefined()
      expect(debit).toBeDefined()
      expect(credit!.amount).toBe(debit!.amount)
    })

    it('completes payout lifecycle', async () => {
      const payouts = await getPayouts()
      const payout = payouts[payouts.length - 1]

      const proc = await markProcessing(payout.id, 'admin-001', 'test-5f-proc-001')
      expect(proc.ok).toBe(true)

      const succ = await markSucceeded(payout.id, 'BANK-REF-123', 'test-5f-succ-001', 'test-5f')
      expect(succ.ok).toBe(true)

      const final = await prisma.payout.findUnique({ where: { id: payout.id } })
      expect(final!.status).toBe('SUCCEEDED')
      expect(final!.clearedAt).not.toBeNull()
    })
  })

  describe('Strict 5-Way Concurrent Withdrawal', () => {
    it('exactly 3 succeed, exactly 2 fail, balance = 1000, ledger matches', async () => {
      await setupTestWallet()

      const requests = Array.from({ length: 5 }, (_, i) =>
        requestPayout(
          TEST_PROVIDER_USER_ID,
          BigInt(300000),
          'bank',
          null,
          `test-5f-5way-${i}`,
          'test-5f'
        )
      )

      const results = await Promise.all(requests)
      const succeeded = results.filter(r => r.ok)
      const failed = results.filter(r => !r.ok)

      expect(succeeded.length).toBe(3)
      expect(failed.length).toBe(2)
      failed.forEach(f => {
        expect(f.ok).toBe(false)
        if (!f.ok) expect(f.code).toBe('INSUFFICIENT_FUNDS')
      })

      const balance = await getWalletBalance()
      expect(balance.balance).toBe(1000)
      expect(balance.available).toBe(1000)

      const payouts = await getPayouts()
      const testPayouts = payouts.filter(p =>
        succeeded.some(r => r.ok && r.payoutId === p.id)
      )
      expect(testPayouts.length).toBe(3)
      testPayouts.forEach(p => {
        expect(p.status).toBe('RESERVED')
        expect(Number(p.amount)).toBe(300000)
      })

      const ledgerAgg = await prisma.$queryRawUnsafe<Array<{ credits: number; debits: number }>>(
        `SELECT
          COALESCE(SUM(CASE WHEN "entryType" = 'CREDIT' THEN amount ELSE 0 END), 0) as credits,
          COALESCE(SUM(CASE WHEN "entryType" = 'DEBIT' THEN amount ELSE 0 END), 0) as debits
         FROM "FinancialLedger"
         WHERE "accountId" = $1 AND "createdBy" = 'test-5f'`,
        TEST_WALLET_ID
      )
      const ledgerCredits = Number(ledgerAgg[0].credits)
      const ledgerDebits = Number(ledgerAgg[0].debits)
      expect(ledgerDebits).toBe(900000)
      expect(ledgerCredits).toBe(0)
      expect(ledgerDebits - ledgerCredits).toBe(900000)

      const reconBalance = Number(TEST_BALANCE_CENTS) / 100 - (ledgerDebits - ledgerCredits) / 100
      expect(balance.balance).toBe(reconBalance)
    })
  })

  describe('Concurrent 8000+8000 on 10000 Balance', () => {
    it('exactly one reservation succeeds', async () => {
      await setupTestWallet()

      const [r1, r2] = await Promise.all([
        requestPayout(TEST_PROVIDER_USER_ID, BigInt(800000), 'bank', null, 'test-5f-concurrent-a', 'test-5f'),
        requestPayout(TEST_PROVIDER_USER_ID, BigInt(800000), 'bank', null, 'test-5f-concurrent-b', 'test-5f'),
      ])

      const successes = [r1, r2].filter(r => r.ok)
      expect(successes.length).toBe(1)

      const balance = await getWalletBalance()
      expect(balance.balance).toBe(2000)
      expect(balance.available).toBe(2000)
    })
  })

  describe('Exact Balance Reservation', () => {
    it('reserves the exact available balance', async () => {
      await setupTestWallet()

      const result = await requestPayout(TEST_PROVIDER_USER_ID, BigInt(1000000), 'bank', null, 'test-5f-exact', 'test-5f')
      expect(result.ok).toBe(true)

      const balance = await getWalletBalance()
      expect(balance.balance).toBe(0)
      expect(balance.available).toBe(0)
    })

    it('next reservation fails on zero balance', async () => {
      const result = await requestPayout(TEST_PROVIDER_USER_ID, BigInt(100000), 'bank', null, 'test-5f-exact-fail', 'test-5f')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('INSUFFICIENT_FUNDS')
    })
  })

  describe('Idempotency', () => {
    it('same key + same payload returns same result', async () => {
      await setupTestWallet()
      const r1 = await requestPayout(TEST_PROVIDER_USER_ID, BigInt(100000), 'bank', null, 'test-5f-idem-same', 'test-5f')
      const r2 = await requestPayout(TEST_PROVIDER_USER_ID, BigInt(100000), 'bank', null, 'test-5f-idem-same', 'test-5f')
      expect(r1.ok).toBe(true)
      expect(r2.ok).toBe(true)
      if (r1.ok && r2.ok) {
        expect(r1.payoutId).toBe(r2.payoutId)
      }
    })

    it('same key + different payload returns conflict', async () => {
      await setupTestWallet()
      const r1 = await requestPayout(TEST_PROVIDER_USER_ID, BigInt(100000), 'bank', null, 'test-5f-idem-diff', 'test-5f')
      expect(r1.ok).toBe(true)
      const r2 = await requestPayout(TEST_PROVIDER_USER_ID, BigInt(200000), 'bank', null, 'test-5f-idem-diff', 'test-5f')
      expect(r2.ok).toBe(false)
      if (!r2.ok) expect(r2.code).toBe('IDEMPOTENCY_CONFLICT')
    })

    it('different keys for same operation create separate records', async () => {
      await setupTestWallet()
      const r1 = await requestPayout(TEST_PROVIDER_USER_ID, BigInt(100000), 'bank', null, 'test-5f-idem-key1', 'test-5f')
      const r2 = await requestPayout(TEST_PROVIDER_USER_ID, BigInt(100000), 'bank', null, 'test-5f-idem-key2', 'test-5f')
      expect(r1.ok).toBe(true)
      expect(r2.ok).toBe(true)
      if (r1.ok && r2.ok) {
        expect(r1.payoutId).not.toBe(r2.payoutId)
      }
    })
  })

  describe('Duplicate Success Callback', () => {
    it('second success callback returns same state, creates no new ledger entries', async () => {
      await setupTestWallet()
      const res = await requestPayout(TEST_PROVIDER_USER_ID, BigInt(100000), 'bank', null, 'test-5f-dup-success', 'test-5f')
      expect(res.ok).toBe(true)
      if (!res.ok) throw new Error('Expected ok')

      await markProcessing(res.payoutId, 'admin-001', 'test-5f-dup-proc')
      const s1 = await markSucceeded(res.payoutId, 'REF-001', 'test-5f-dup-succ1', 'test-5f')
      expect(s1.ok).toBe(true)
      if (s1.ok) expect(s1.status).toBe('SUCCEEDED')

      const s2 = await markSucceeded(res.payoutId, 'REF-001', 'test-5f-dup-succ2', 'test-5f')
      expect(s2.ok).toBe(true)
      if (s2.ok) expect(s2.status).toBe('SUCCEEDED')

      const { succeeded: succLedgerCount } = await countTerminalLedger(res.payoutId)
      expect(succLedgerCount).toBe(1)

      const afterBalance = await getWalletBalance()
      expect(afterBalance.balance).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Failure / Reversal', () => {
    it('failure restores funds exactly once', async () => {
      await setupTestWallet()
      const before = await getWalletBalance()

      const res = await requestPayout(TEST_PROVIDER_USER_ID, BigInt(200000), 'bank', null, 'test-5f-fail', 'test-5f')
      expect(res.ok).toBe(true)
      if (!res.ok) throw new Error('Expected ok')

      const afterReserve = await getWalletBalance()
      expect(afterReserve.balance).toBe(before.balance - 2000)

      const fail = await markFailed(res.payoutId, 'Provider rejected', 'test-5f-fail-mark', 'test-5f')
      expect(fail.ok).toBe(true)

      const afterFail = await getWalletBalance()
      expect(afterFail.balance).toBe(before.balance)
      expect(afterFail.available).toBe(before.available)

      const fail2 = await markFailed(res.payoutId, 'Duplicate failure', 'test-5f-fail-dup', 'test-5f')
      expect(fail2.ok).toBe(true)

      const afterFail2 = await getWalletBalance()
      expect(afterFail2.balance).toBe(before.balance)

      const { released } = await countTerminalLedger(res.payoutId)
      expect(released).toBe(2)
    })
  })

  describe('Success vs Failure Race', () => {
    it('exactly one terminal state, exactly one set of ledger entries', async () => {
      await setupTestWallet()

      const res = await requestPayout(TEST_PROVIDER_USER_ID, BigInt(100000), 'bank', null, 'test-5f-race', 'test-5f')
      expect(res.ok).toBe(true)
      if (!res.ok) throw new Error('Expected ok')

      await markProcessing(res.payoutId, 'admin-001', 'test-5f-race-proc')

      const [s1, s2] = await Promise.all([
        markSucceeded(res.payoutId, 'REF', 'test-5f-race-succ', 'test-5f'),
        markFailed(res.payoutId, 'Timeout', 'test-5f-race-fail', 'test-5f'),
      ])

      expect(s1.ok).toBe(true)
      expect(s2.ok).toBe(true)

      const final = await prisma.payout.findUnique({ where: { id: res.payoutId } })
      expect(['SUCCEEDED', 'FAILED']).toContain(final!.status)

      const { succeeded, released } = await countTerminalLedger(res.payoutId)
      expect(succeeded + released).toBe(1)
    })
  })

  describe('Cancel vs Processing Race', () => {
    it('cancellation during processing restores funds', async () => {
      await setupTestWallet()
      const before = await getWalletBalance()

      const res = await requestPayout(TEST_PROVIDER_USER_ID, BigInt(150000), 'bank', null, 'test-5f-cancel', 'test-5f')
      expect(res.ok).toBe(true)
      if (!res.ok) throw new Error('Expected ok')

      await markProcessing(res.payoutId, 'admin-001', 'test-5f-cancel-proc')

      const cancel = await cancelPayout(res.payoutId, 'User requested cancel', 'test-5f-cancel-mark', 'test-5f')
      expect(cancel.ok).toBe(true)

      const after = await getWalletBalance()
      expect(after.balance).toBe(before.balance)
      expect(after.available).toBe(before.available)

      const final = await prisma.payout.findUnique({ where: { id: res.payoutId } })
      expect(final!.status).toBe('CANCELLED')
    })
  })

  describe('Fund Sufficiency', () => {
    it('rejects withdrawal exceeding balance', async () => {
      await setupTestWallet()
      const result = await requestPayout(TEST_PROVIDER_USER_ID, BigInt(20000000), 'bank', null, 'test-5f-exceed', 'test-5f')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('INSUFFICIENT_FUNDS')
    })

    it('rejects zero amount', async () => {
      await setupTestWallet()
      const result = await requestPayout(TEST_PROVIDER_USER_ID, BigInt(0), 'bank', null, 'test-5f-zero', 'test-5f')
      expect(result.ok).toBe(false)
    })

    it('rejects frozen wallet', async () => {
      await setupTestWallet()
      await prisma.providerWallet.update({ where: { userId: TEST_PROVIDER_USER_ID }, data: { isFrozen: true } })
      const result = await requestPayout(TEST_PROVIDER_USER_ID, BigInt(100000), 'bank', null, 'test-5f-frozen', 'test-5f')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('WALLET_FROZEN')
      await prisma.providerWallet.update({ where: { userId: TEST_PROVIDER_USER_ID }, data: { isFrozen: false } })
    })
  })

  describe('Minimum Withdrawal', () => {
    it('rejects below minimum', async () => {
      await setupTestWallet()
      const result = await requestPayout(TEST_PROVIDER_USER_ID, BigInt(10000), 'bank', null, 'test-5f-minimum', 'test-5f')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('BELOW_MINIMUM')
    })
  })

  describe('Test Pollution Exclusion', () => {
    it('isTestLedgerEntry correctly identifies test entries', () => {
      expect(isTestLedgerEntry({ accountId: 'test-user-1', createdBy: 'system', referenceType: 'ESCROW_DEPOSIT' })).toBe(true)
      expect(isTestLedgerEntry({ accountId: 'customer:test-customer-1', createdBy: 'system', referenceType: 'ESCROW_DEPOSIT' })).toBe(true)
      expect(isTestLedgerEntry({ accountId: 'cmo0a7i1f0000k471zjsr5txl', createdBy: 'test', referenceType: 'TEST' })).toBe(true)
      expect(isTestLedgerEntry({ accountId: 'cmo0a7i1f0000k471zjsr5txl', createdBy: 'test-5c1', referenceType: 'TEST_5C1' })).toBe(true)
      expect(isTestLedgerEntry({ accountId: 'cmo0a7i1f0000k471zjsr5txl', createdBy: 'test-phase5c', referenceType: 'ESCROW_TEST' })).toBe(true)
    })

    it('isTestLedgerEntry does not flag legitimate entries', () => {
      expect(isTestLedgerEntry({ accountId: 'cmo0a7i1f0000k471zjsr5txl', createdBy: 'system-backfill', referenceType: 'OPENING_BALANCE' })).toBe(false)
      expect(isTestLedgerEntry({ accountId: 'cmo0a7i1f0000k471zjsr5txl', createdBy: 'system', referenceType: 'ESCROW_RELEASE' })).toBe(false)
    })
  })

  describe('Ledger Reconciliation', () => {
    it('wallet balance reconstructs from ledger', async () => {
      await setupTestWallet()

      await requestPayout(TEST_PROVIDER_USER_ID, BigInt(100000), 'bank', null, 'test-5f-recon-1', 'test-5f')
      await requestPayout(TEST_PROVIDER_USER_ID, BigInt(200000), 'bank', null, 'test-5f-recon-2', 'test-5f')

      const balance = await getWalletBalance()
      const openingBalance = Number(TEST_BALANCE_CENTS) / 100

      const ledgerAgg = await prisma.$queryRawUnsafe<Array<{ credits: number; debits: number }>>(
        `SELECT
          COALESCE(SUM(CASE WHEN "entryType" = 'CREDIT' THEN amount ELSE 0 END), 0) as credits,
          COALESCE(SUM(CASE WHEN "entryType" = 'DEBIT' THEN amount ELSE 0 END), 0) as debits
         FROM "FinancialLedger"
         WHERE "accountId" = $1 AND "createdBy" = 'test-5f'`,
        TEST_WALLET_ID
      )

      const ledgerCredits = Number(ledgerAgg[0].credits)
      const ledgerDebits = Number(ledgerAgg[0].debits)
      const ledgerBalance = (ledgerCredits - ledgerDebits) / 100

      expect(balance.balance).toBe(openingBalance + ledgerBalance)
    })
  })
})
