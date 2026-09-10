import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../../lib/prisma'
import { postLedgerTransaction, getLedgerBalance } from '../../lib/ledger'
import { randomUUID } from 'crypto'

const TEST_WALLET_ID = `test-wallet-balance-${randomUUID().slice(0, 8)}`
const TEST_WALLET_TYPE = 'CUSTOMER'

describe('WalletBalance BigInt precision', () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
       VALUES ($1, $1, $2, 0, 0, 0, 1, NOW(), NOW())
       ON CONFLICT ("walletType", "walletId") DO NOTHING`,
      TEST_WALLET_ID, TEST_WALLET_TYPE
    )
  })

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "FinancialLedger" WHERE "accountId" = $1 AND "accountType" = $2`,
      TEST_WALLET_ID, 'CUSTOMER_WALLET'
    )
    await prisma.$executeRawUnsafe(
      `DELETE FROM "WalletBalance" WHERE "walletId" = $1 AND "walletType" = $2`,
      TEST_WALLET_ID, TEST_WALLET_TYPE
    )
  })

  it('handles large BigInt amounts without precision loss', async () => {
    const largeAmount = 999_999_999_99n
    await postLedgerTransaction({
      entries: [
        { accountId: TEST_WALLET_ID, accountType: 'CUSTOMER_WALLET', entryType: 'CREDIT', amount: largeAmount },
        { accountId: 'platform', accountType: 'PLATFORM', entryType: 'DEBIT', amount: largeAmount },
      ],
      referenceType: 'LARGE_TEST',
      referenceId: randomUUID(),
      idempotencyKey: `large-test-${randomUUID()}`,
      createdBy: 'test',
    })

    const balance = await getLedgerBalance(TEST_WALLET_ID, 'CUSTOMER_WALLET')
    expect(balance.balance).toBe(largeAmount)

    const walletRow = await prisma.$queryRawUnsafe<Array<{ balance: bigint }>>(
      `SELECT balance FROM "WalletBalance" WHERE "walletId" = $1 AND "walletType" = $2`,
      TEST_WALLET_ID, TEST_WALLET_TYPE
    )
    expect(walletRow[0].balance).toBe(largeAmount)
  })

  it('handles sub-cent precision (odd cents) correctly', async () => {
    const oddAmount = 123_45n
    await postLedgerTransaction({
      entries: [
        { accountId: TEST_WALLET_ID, accountType: 'CUSTOMER_WALLET', entryType: 'CREDIT', amount: oddAmount },
        { accountId: 'platform', accountType: 'PLATFORM', entryType: 'DEBIT', amount: oddAmount },
      ],
      referenceType: 'ODD_CENT_TEST',
      referenceId: randomUUID(),
      idempotencyKey: `odd-cent-${randomUUID()}`,
      createdBy: 'test',
    })

    const balance = await getLedgerBalance(TEST_WALLET_ID, 'CUSTOMER_WALLET')
    expect(balance.balance).toBe(999_999_999_99n + oddAmount)
  })

  it('rejects debit that exceeds available balance', async () => {
    const tooMuch = 999_999_999_999_999n
    await expect(
      postLedgerTransaction({
        entries: [
          { accountId: TEST_WALLET_ID, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: tooMuch },
          { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: tooMuch },
        ],
        referenceType: 'UNDERFLOW_TEST',
        referenceId: randomUUID(),
        idempotencyKey: `underflow-${randomUUID()}`,
        createdBy: 'test',
      })
    ).rejects.toThrow('INSUFFICIENT_FUNDS')
  })

  it('WalletBalance stores BigInt natively (no Float roundtrip)', async () => {
    const amount = 1_00n
    await postLedgerTransaction({
      entries: [
        { accountId: TEST_WALLET_ID, accountType: 'CUSTOMER_WALLET', entryType: 'CREDIT', amount },
        { accountId: 'platform', accountType: 'PLATFORM', entryType: 'DEBIT', amount },
      ],
      referenceType: 'NATIVE_BIGINT_TEST',
      referenceId: randomUUID(),
      idempotencyKey: `native-bigint-${randomUUID()}`,
      createdBy: 'test',
    })

    const walletRow = await prisma.$queryRawUnsafe<Array<{ balance: bigint; available_balance: bigint }>>(
      `SELECT balance, "availableBalance" as available_balance FROM "WalletBalance" WHERE "walletId" = $1 AND "walletType" = $2`,
      TEST_WALLET_ID, TEST_WALLET_TYPE
    )
    expect(typeof walletRow[0].balance).toBe('bigint')
    expect(typeof walletRow[0].available_balance).toBe('bigint')
  })
})
