import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { postLedgerTransaction, type LedgerEntry } from '@/lib/finance/ledger/ledger-service'
import { requiresPostgres } from '../../helpers/test-guard'

const SKIP = !requiresPostgres()
const TEST_USER_ID = `test-underflow-${Date.now()}`
const TEST_WALLET_ID = `wallet-underflow-${Date.now()}`
const describePG = SKIP ? describe.skip : describe

describePG('Phase 5E.2 — Balance Underflow / Double-Spend Guard (PostgreSQL)', () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "User" ("id", "email", "passwordHash", "name", "phone", "role", "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, 'test-hash', 'Test Underflow User', '+10000000000', 'CUSTOMER', false, now(), now())
       ON CONFLICT ("id") DO NOTHING`, TEST_USER_ID, `${TEST_USER_ID}@test.com`
    )
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CustomerWallet" ("id", "userId", "balance", "createdAt", "updatedAt")
       VALUES ($1, $2, 0, now(), now()) ON CONFLICT ("userId") DO NOTHING`, TEST_WALLET_ID, TEST_USER_ID
    )
    await prisma.$executeRawUnsafe(
      `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
       VALUES ($1, $2, 'CUSTOMER', 0, 0, 0, 1, now(), now())
       ON CONFLICT ("walletType", "walletId", "currency") DO NOTHING`, `wb-${TEST_WALLET_ID}`, TEST_WALLET_ID
    )
  })

  afterAll(async () => {
    if (SKIP) return
    await prisma.$executeRawUnsafe(`DELETE FROM "IdempotencyRecord" WHERE "idempotencyKey" LIKE $1`, `underflow:${TEST_USER_ID}:%`)
    await prisma.$executeRawUnsafe(`DELETE FROM "FinancialLedger" WHERE "accountId" = $1`, TEST_WALLET_ID)
    await prisma.$executeRawUnsafe(`DELETE FROM "FinancialLedger" WHERE "accountId" = 'platform' AND "referenceType" LIKE 'TEST_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "WalletBalance" WHERE "walletId" = $1`, TEST_WALLET_ID)
    await prisma.$executeRawUnsafe(`DELETE FROM "CustomerWallet" WHERE "userId" = $1`, TEST_USER_ID)
    await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "id" = $1`, TEST_USER_ID)
  })

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM "IdempotencyRecord" WHERE "idempotencyKey" LIKE $1`, `underflow:${TEST_USER_ID}:%`)
    await prisma.$executeRawUnsafe(`DELETE FROM "FinancialLedger" WHERE "accountId" = $1`, TEST_WALLET_ID)
    await prisma.$executeRawUnsafe(`DELETE FROM "FinancialLedger" WHERE "accountId" = 'platform' AND "referenceType" LIKE 'TEST_%'`)
  })

  async function setBalanceMajor(amount: number) {
    const minorUnits = BigInt(Math.round(amount * 100))
    await prisma.$executeRawUnsafe(
      `UPDATE "WalletBalance" SET "balance" = $1, "availableBalance" = $1, "version" = 1, "updatedAt" = now()
       WHERE "walletId" = $2 AND "walletType" = 'CUSTOMER'`, minorUnits, TEST_WALLET_ID
    )
    await prisma.$executeRawUnsafe(`UPDATE "CustomerWallet" SET "balance" = $1, "updatedAt" = now() WHERE "userId" = $2`, amount, TEST_USER_ID)
  }

  async function getWalletBalanceMajor(): Promise<number> {
    const rows = await prisma.$queryRawUnsafe<Array<{ balance: bigint }>>(
      `SELECT "balance" FROM "WalletBalance" WHERE "walletId" = $1 AND "walletType" = 'CUSTOMER'`, TEST_WALLET_ID
    )
    return rows.length > 0 ? Number(rows[0].balance) / 100 : 0
  }

  async function getLedgerDebitMinor(): Promise<number> {
    const rows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COALESCE(SUM("amount"), 0) as total FROM "FinancialLedger"
       WHERE "accountId" = $1 AND "accountType" = 'CUSTOMER_WALLET' AND "entryType" = 'DEBIT'`, TEST_WALLET_ID
    )
    return Number(rows[0].total)
  }

  function makeDebitEntries(amountMinor: number): LedgerEntry[] {
    return [
      { accountId: TEST_WALLET_ID, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: BigInt(amountMinor) },
      { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: BigInt(amountMinor) },
    ]
  }

  function uniqueKey(prefix: string): string {
    return `underflow:${TEST_USER_ID}:${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  }

  it('2-way concurrent debit of 8000 minor units from 100 major permits exactly 1', async () => {
    await setBalanceMajor(100)
    const results = await Promise.allSettled([
      postLedgerTransaction({ entries: makeDebitEntries(8000), referenceType: 'TEST_2WAY', referenceId: `2way-${Date.now()}-a`, idempotencyKey: uniqueKey('2way-a'), createdBy: 'test' }),
      postLedgerTransaction({ entries: makeDebitEntries(8000), referenceType: 'TEST_2WAY', referenceId: `2way-${Date.now()}-b`, idempotencyKey: uniqueKey('2way-b'), createdBy: 'test' }),
    ])
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    expect(succeeded).toBe(1)
    expect(await getWalletBalanceMajor()).toBe(20)
    expect(await getLedgerDebitMinor()).toBe(8000)
  })

  it('5-way concurrent debit of 3000 minor units from 100 major permits max 3', async () => {
    await setBalanceMajor(100)
    const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) =>
      postLedgerTransaction({ entries: makeDebitEntries(3000), referenceType: 'TEST_5WAY', referenceId: `5way-${Date.now()}-${i}`, idempotencyKey: uniqueKey(`5way-${i}`), createdBy: 'test' })
    ))
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    expect(succeeded).toBeLessThanOrEqual(3)
    expect(await getWalletBalanceMajor()).toBe(100 - succeeded * 30)
    expect(await getLedgerDebitMinor()).toBe(succeeded * 3000)
  })

  it('exact-balance debit succeeds with final balance 0', async () => {
    await setBalanceMajor(50)
    const result = await postLedgerTransaction({ entries: makeDebitEntries(5000), referenceType: 'TEST_EXACT', referenceId: `exact-${Date.now()}`, idempotencyKey: uniqueKey('exact'), createdBy: 'test' })
    expect(result.entries).toHaveLength(2)
    expect(await getWalletBalanceMajor()).toBe(0)
  })

  it('insufficient-balance single debit throws INSUFFICIENT_FUNDS', async () => {
    await setBalanceMajor(49.99)
    await expect(postLedgerTransaction({ entries: makeDebitEntries(5000), referenceType: 'TEST_INSUFF', referenceId: `insuff-${Date.now()}`, idempotencyKey: uniqueKey('insuff'), createdBy: 'test' })).rejects.toThrow('INSUFFICIENT_FUNDS')
    expect(await getWalletBalanceMajor()).toBeCloseTo(49.99, 2)
    expect(await getLedgerDebitMinor()).toBe(0)
  })

  it('failed debit creates no ledger movement', async () => {
    await setBalanceMajor(1)
    await expect(postLedgerTransaction({ entries: makeDebitEntries(5000), referenceType: 'TEST_NOLEDGER', referenceId: `noledger-${Date.now()}`, idempotencyKey: uniqueKey('noledger'), createdBy: 'test' })).rejects.toThrow()
    expect(await getLedgerDebitMinor()).toBe(0)
    expect(await getWalletBalanceMajor()).toBe(1)
  })

  it('ledger reconstruction matches WalletBalance after debits', async () => {
    await setBalanceMajor(100)
    let successCount = 0
    for (let i = 0; i < 4; i++) {
      try {
        await postLedgerTransaction({ entries: makeDebitEntries(3000), referenceType: 'TEST_RECON', referenceId: `recon-${Date.now()}-${i}`, idempotencyKey: uniqueKey(`recon-${i}`), createdBy: 'test' })
        successCount++
      } catch { break }
    }
    expect(await getWalletBalanceMajor()).toBe(100 - successCount * 30)
    expect(await getLedgerDebitMinor()).toBe(successCount * 3000)
  })

  it('concurrent debit cannot go negative under any circumstance', async () => {
    await setBalanceMajor(1)
    const results = await Promise.allSettled(Array.from({ length: 3 }, (_, i) =>
      postLedgerTransaction({ entries: makeDebitEntries(80), referenceType: 'TEST_NEG', referenceId: `neg-${Date.now()}-${i}`, idempotencyKey: uniqueKey(`neg-${i}`), createdBy: 'test' })
    ))
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    expect(succeeded).toBeLessThanOrEqual(1)
    expect(await getWalletBalanceMajor()).toBeCloseTo(1 - succeeded * 0.8, 6)
  })

  it('WalletBalance failure rolls back entire transaction — no partial FinancialLedger', async () => {
    await setBalanceMajor(0.5)
    const before = await getLedgerDebitMinor()
    await expect(postLedgerTransaction({ entries: makeDebitEntries(500), referenceType: 'TEST_FAILCLOSED', referenceId: `failclosed-${Date.now()}`, idempotencyKey: uniqueKey('failclosed'), createdBy: 'test' })).rejects.toThrow('INSUFFICIENT_FUNDS')
    expect(await getLedgerDebitMinor()).toBe(before)
    expect(await getWalletBalanceMajor()).toBeCloseTo(0.5, 6)
  })
})
