import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { postLedgerTransaction, type LedgerEntry } from '@/lib/ledger'
import { assertNotProductionDb, isPostgres } from '../test-guard'

assertNotProductionDb()

const SKIP = !isPostgres

const TEST_USER_ID = `test-underflow-${Date.now()}`
const TEST_WALLET_ID = `wallet-underflow-${Date.now()}`

const describePG = SKIP ? describe.skip : describe

describePG('Phase 5E.2 — Balance Underflow / Double-Spend Guard (PostgreSQL)', () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "User" ("id", "email", "passwordHash", "name", "phone", "role", "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, 'test-hash', 'Test Underflow User', '+10000000000', 'CUSTOMER', false, now(), now())
       ON CONFLICT ("id") DO NOTHING`,
      TEST_USER_ID, `${TEST_USER_ID}@test.com`
    )
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CustomerWallet" ("id", "userId", "balance", "createdAt", "updatedAt")
       VALUES ($1, $2, 0, now(), now())
       ON CONFLICT ("userId") DO NOTHING`,
      TEST_WALLET_ID, TEST_USER_ID
    )
    await prisma.$executeRawUnsafe(
      `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
       VALUES ($1, $2, 'CUSTOMER', 0, 0, 0, 1, now(), now())
       ON CONFLICT ("walletType", "walletId") DO NOTHING`,
      `wb-${TEST_WALLET_ID}`, TEST_WALLET_ID
    )
  })

  afterAll(async () => {
    if (SKIP) return
    await prisma.$executeRawUnsafe(`DELETE FROM "IdempotencyRecord" WHERE "idempotencyKey" LIKE $1`, `underflow:${TEST_USER_ID}:%`)
    await prisma.$executeRawUnsafe(`DELETE FROM "FinancialLedger" WHERE "accountId" = $1`, `customer:${TEST_WALLET_ID}`)
    await prisma.$executeRawUnsafe(`DELETE FROM "FinancialLedger" WHERE "accountId" = 'platform' AND "referenceType" LIKE 'TEST_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "WalletBalance" WHERE "walletId" = $1`, TEST_WALLET_ID)
    await prisma.$executeRawUnsafe(`DELETE FROM "CustomerWallet" WHERE "userId" = $1`, TEST_USER_ID)
    await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "id" = $1`, TEST_USER_ID)
  })

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM "IdempotencyRecord" WHERE "idempotencyKey" LIKE $1`, `underflow:${TEST_USER_ID}:%`)
    await prisma.$executeRawUnsafe(`DELETE FROM "FinancialLedger" WHERE "accountId" = $1`, `customer:${TEST_WALLET_ID}`)
    await prisma.$executeRawUnsafe(`DELETE FROM "FinancialLedger" WHERE "accountId" = 'platform' AND "referenceType" LIKE 'TEST_%'`)
  })

  async function setBalance(amount: number) {
    await prisma.$executeRawUnsafe(
      `UPDATE "WalletBalance" SET "balance" = $1, "availableBalance" = $1, "version" = 1, "updatedAt" = now()
       WHERE "walletId" = $2 AND "walletType" = 'CUSTOMER'`,
      amount, TEST_WALLET_ID
    )
    await prisma.$executeRawUnsafe(
      `UPDATE "CustomerWallet" SET "balance" = $1, "updatedAt" = now() WHERE "userId" = $2`,
      amount, TEST_USER_ID
    )
  }

  async function getWalletBalance(): Promise<number> {
    const rows = await prisma.$queryRawUnsafe<Array<{ balance: number }>>(
      `SELECT "balance" FROM "WalletBalance" WHERE "walletId" = $1 AND "walletType" = 'CUSTOMER'`,
      TEST_WALLET_ID
    )
    return rows.length > 0 ? Number(rows[0].balance) : 0
  }

  async function getLedgerDebitTotal(): Promise<number> {
    const rows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COALESCE(SUM("amount"), 0) as total FROM "FinancialLedger"
       WHERE "accountId" = $1 AND "accountType" = 'CUSTOMER_WALLET' AND "entryType" = 'DEBIT'`,
      `customer:${TEST_WALLET_ID}`
    )
    return Number(rows[0].total)
  }

  function makeDebitEntries(amount: number): LedgerEntry[] {
    return [
      { accountId: `customer:${TEST_WALLET_ID}`, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: BigInt(amount) },
      { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: BigInt(amount) },
    ]
  }

  function uniqueKey(prefix: string): string {
    return `underflow:${TEST_USER_ID}:${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  }

  it('2-way concurrent debit of 8000 from 10000 permits exactly 1', async () => {
    await setBalance(10000)

    const results = await Promise.allSettled([
      postLedgerTransaction({
        entries: makeDebitEntries(8000),
        referenceType: 'TEST_2WAY',
        referenceId: `2way-${Date.now()}-a`,
        idempotencyKey: uniqueKey('2way-a'),
        createdBy: 'test',
      }),
      postLedgerTransaction({
        entries: makeDebitEntries(8000),
        referenceType: 'TEST_2WAY',
        referenceId: `2way-${Date.now()}-b`,
        idempotencyKey: uniqueKey('2way-b'),
        createdBy: 'test',
      }),
    ])

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    expect(succeeded).toBe(1)

    const finalBalance = await getWalletBalance()
    expect(finalBalance).toBe(2000)

    const ledgerDebitTotal = await getLedgerDebitTotal()
    expect(ledgerDebitTotal).toBe(8000)
  })

  it('5-way concurrent debit of 3000 from 10000 permits max 3', async () => {
    await setBalance(10000)

    const results = await Promise.allSettled([
      postLedgerTransaction({
        entries: makeDebitEntries(3000),
        referenceType: 'TEST_5WAY',
        referenceId: `5way-${Date.now()}-a`,
        idempotencyKey: uniqueKey('5way-a'),
        createdBy: 'test',
      }),
      postLedgerTransaction({
        entries: makeDebitEntries(3000),
        referenceType: 'TEST_5WAY',
        referenceId: `5way-${Date.now()}-b`,
        idempotencyKey: uniqueKey('5way-b'),
        createdBy: 'test',
      }),
      postLedgerTransaction({
        entries: makeDebitEntries(3000),
        referenceType: 'TEST_5WAY',
        referenceId: `5way-${Date.now()}-c`,
        idempotencyKey: uniqueKey('5way-c'),
        createdBy: 'test',
      }),
      postLedgerTransaction({
        entries: makeDebitEntries(3000),
        referenceType: 'TEST_5WAY',
        referenceId: `5way-${Date.now()}-d`,
        idempotencyKey: uniqueKey('5way-d'),
        createdBy: 'test',
      }),
      postLedgerTransaction({
        entries: makeDebitEntries(3000),
        referenceType: 'TEST_5WAY',
        referenceId: `5way-${Date.now()}-e`,
        idempotencyKey: uniqueKey('5way-e'),
        createdBy: 'test',
      }),
    ])

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    expect(succeeded).toBeLessThanOrEqual(3)

    const finalBalance = await getWalletBalance()
    expect(finalBalance).toBeGreaterThanOrEqual(0)
    expect(finalBalance).toBe(10000 - succeeded * 3000)

    const ledgerDebitTotal = await getLedgerDebitTotal()
    expect(ledgerDebitTotal).toBe(succeeded * 3000)
  })

  it('exact-balance debit succeeds with final balance 0', async () => {
    await setBalance(5000)

    const result = await postLedgerTransaction({
      entries: makeDebitEntries(5000),
      referenceType: 'TEST_EXACT',
      referenceId: `exact-${Date.now()}`,
      idempotencyKey: uniqueKey('exact'),
      createdBy: 'test',
    })

    expect(result).toBeDefined()
    expect(result.entries.length).toBe(2)

    const finalBalance = await getWalletBalance()
    expect(finalBalance).toBe(0)
  })

  it('insufficient-balance single debit throws INSUFFICIENT_FUNDS', async () => {
    await setBalance(4999)

    await expect(
      postLedgerTransaction({
        entries: makeDebitEntries(5000),
        referenceType: 'TEST_INSUFF',
        referenceId: `insuff-${Date.now()}`,
        idempotencyKey: uniqueKey('insuff'),
        createdBy: 'test',
      })
    ).rejects.toThrow('INSUFFICIENT_FUNDS')

    const finalBalance = await getWalletBalance()
    expect(finalBalance).toBe(4999)

    const ledgerDebitTotal = await getLedgerDebitTotal()
    expect(ledgerDebitTotal).toBe(0)
  })

  it('failed debit creates no ledger movement', async () => {
    await setBalance(100)

    await expect(
      postLedgerTransaction({
        entries: makeDebitEntries(5000),
        referenceType: 'TEST_NOLEDGER',
        referenceId: `noledger-${Date.now()}`,
        idempotencyKey: uniqueKey('noledger'),
        createdBy: 'test',
      })
    ).rejects.toThrow()

    const ledgerCount = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*) as count FROM "FinancialLedger" WHERE "accountId" = $1`,
      `customer:${TEST_WALLET_ID}`
    )
    expect(Number(ledgerCount[0].count)).toBe(0)

    const finalBalance = await getWalletBalance()
    expect(finalBalance).toBe(100)
  })

  it('ledger reconstruction matches WalletBalance after debits', async () => {
    await setBalance(10000)

    let successCount = 0
    for (let i = 0; i < 4; i++) {
      try {
        await postLedgerTransaction({
          entries: makeDebitEntries(3000),
          referenceType: 'TEST_RECON',
          referenceId: `recon-${Date.now()}-${i}`,
          idempotencyKey: uniqueKey(`recon-${i}`),
          createdBy: 'test',
        })
        successCount++
      } catch {
        break
      }
    }

    const finalBalance = await getWalletBalance()
    const ledgerDebitTotal = await getLedgerDebitTotal()

    const expectedBalance = 10000 - successCount * 3000
    expect(finalBalance).toBe(expectedBalance)
    expect(ledgerDebitTotal).toBe(successCount * 3000)
  })

  it('concurrent debit cannot go negative under any circumstance', async () => {
    await setBalance(100)

    const results = await Promise.allSettled([
      postLedgerTransaction({
        entries: makeDebitEntries(80),
        referenceType: 'TEST_NEG',
        referenceId: `neg-${Date.now()}-a`,
        idempotencyKey: uniqueKey('neg-a'),
        createdBy: 'test',
      }),
      postLedgerTransaction({
        entries: makeDebitEntries(80),
        referenceType: 'TEST_NEG',
        referenceId: `neg-${Date.now()}-b`,
        idempotencyKey: uniqueKey('neg-b'),
        createdBy: 'test',
      }),
      postLedgerTransaction({
        entries: makeDebitEntries(80),
        referenceType: 'TEST_NEG',
        referenceId: `neg-${Date.now()}-c`,
        idempotencyKey: uniqueKey('neg-c'),
        createdBy: 'test',
      }),
    ])

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    expect(succeeded).toBeLessThanOrEqual(1)

    const finalBalance = await getWalletBalance()
    expect(finalBalance).toBeGreaterThanOrEqual(0)
    expect(finalBalance).toBe(100 - succeeded * 80)
  })

  it('WalletBalance failure rolls back entire transaction — no partial FinancialLedger', async () => {
    await setBalance(50)

    const ledgerBefore = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*) as count FROM "FinancialLedger" WHERE "accountId" = $1`,
      `customer:${TEST_WALLET_ID}`
    )
    const countBefore = Number(ledgerBefore[0].count)

    try {
      await postLedgerTransaction({
        entries: makeDebitEntries(500),
        referenceType: 'TEST_FAILCLOSED',
        referenceId: `failclosed-${Date.now()}`,
        idempotencyKey: uniqueKey('failclosed'),
        createdBy: 'test',
      })
      throw new Error('Expected INSUFFICIENT_FUNDS')
    } catch (e: any) {
      expect(e.message).toBe('INSUFFICIENT_FUNDS')
    }

    const ledgerAfter = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*) as count FROM "FinancialLedger" WHERE "accountId" = $1`,
      `customer:${TEST_WALLET_ID}`
    )
    const countAfter = Number(ledgerAfter[0].count)

    expect(countAfter).toBe(countBefore)

    const balanceAfter = await getWalletBalance()
    expect(balanceAfter).toBe(50)
  })
})
