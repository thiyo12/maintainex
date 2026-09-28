import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../../../lib/prisma'
import { postLedgerTransaction, getLedgerBalance } from '@/lib/finance/ledger/ledger-service'
import { readCanonicalCustomerBalance } from '../../../lib/financial-read'
import { randomUUID } from 'crypto'
import { requiresPostgres } from '../../helpers/test-guard'

const PREFIX = `lmoney-${randomUUID().slice(0, 8)}`
const userId = `${PREFIX}-user`
const walletId = `${PREFIX}-wallet`

const LARGE_AMOUNT = 9_007_199_254_740_993n // > Number.MAX_SAFE_INTEGER, < PG BIGINT max

describe.skipIf(!requiresPostgres())('WalletBalance BigInt precision >MAX_SAFE_INTEGER', () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@test.com`,
        passwordHash: 'h',
        name: 'Large Money Tester',
        role: 'CUSTOMER',
        isActive: true,
        updatedAt: new Date(),
        identityStatus: 'VERIFIED',
      },
    })
    const cw = await prisma.customerWallet.create({
      data: { userId, balance: 0 },
    })
    await prisma.$executeRawUnsafe(
      `INSERT INTO "WalletBalance" ("id", "walletId", "walletType", "balance", "availableBalance", "pendingBalance", "version", "createdAt", "updatedAt")
       VALUES ($1, $1, 'CUSTOMER', 0, 0, 0, 1, NOW(), NOW())
       ON CONFLICT ("walletType", "walletId") DO NOTHING`,
      cw.id
    )
  })

  afterAll(async () => {
    await prisma.financialLedger.deleteMany({ where: { accountId: walletId, accountType: 'CUSTOMER_WALLET' } })
    await prisma.financialLedger.deleteMany({ where: { accountId: { contains: PREFIX } } })
    await prisma.walletBalance.deleteMany({ where: { walletId } })
    await prisma.customerWallet.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('postLedgerTransaction preserves >MAX_SAFE_INTEGER through ledger + WalletBalance', async () => {
    const cw = await prisma.customerWallet.findUnique({ where: { userId } })
    const actualWalletId = cw!.id

    await postLedgerTransaction({
      entries: [
        { accountId: actualWalletId, accountType: 'CUSTOMER_WALLET', entryType: 'CREDIT', amount: LARGE_AMOUNT },
        { accountId: `${PREFIX}-platform`, accountType: 'PLATFORM', entryType: 'DEBIT', amount: LARGE_AMOUNT },
      ],
      referenceType: 'LARGE_PRECISION',
      referenceId: randomUUID(),
      idempotencyKey: `large-precision-${randomUUID()}`,
      createdBy: 'test',
    })

    const ledgerBalance = await getLedgerBalance(actualWalletId, 'CUSTOMER_WALLET')
    expect(ledgerBalance.balance).toBe(LARGE_AMOUNT)
    expect(typeof ledgerBalance.balance).toBe('bigint')

    const walletRow = await prisma.$queryRawUnsafe<Array<{ balance: bigint }>>(
      `SELECT balance FROM "WalletBalance" WHERE "walletId" = $1 AND "walletType" = 'CUSTOMER'`,
      actualWalletId
    )
    expect(walletRow[0].balance).toBe(LARGE_AMOUNT)
    expect(typeof walletRow[0].balance).toBe('bigint')
  })

  it('readCanonicalCustomerBalance returns exact >MAX_SAFE_INTEGER BigInt', async () => {
    const canonical = await readCanonicalCustomerBalance(userId)
    expect(canonical).not.toBeNull()
    expect(canonical!.balance).toBe(LARGE_AMOUNT)
    expect(typeof canonical!.balance).toBe('bigint')
    expect(canonical!.availableBalance).toBe(LARGE_AMOUNT)
    expect(typeof canonical!.availableBalance).toBe('bigint')
  })

  it('API serialization boundary: String(BigInt) produces exact digit string', async () => {
    const canonical = await readCanonicalCustomerBalance(userId)
    expect(canonical).not.toBeNull()

    const serialized = String(canonical!.balance)
    expect(serialized).toBe('9007199254740993')

    const parsed = BigInt(serialized)
    expect(parsed).toBe(LARGE_AMOUNT)
  })

  it('handles sub-cent precision (odd cents) correctly', async () => {
    const cw = await prisma.customerWallet.findUnique({ where: { userId } })
    const actualWalletId = cw!.id

    const oddAmount = 123_45n
    await postLedgerTransaction({
      entries: [
        { accountId: actualWalletId, accountType: 'CUSTOMER_WALLET', entryType: 'CREDIT', amount: oddAmount },
        { accountId: `${PREFIX}-platform`, accountType: 'PLATFORM', entryType: 'DEBIT', amount: oddAmount },
      ],
      referenceType: 'ODD_CENT_TEST',
      referenceId: randomUUID(),
      idempotencyKey: `odd-cent-${randomUUID()}`,
      createdBy: 'test',
    })

    const balance = await getLedgerBalance(actualWalletId, 'CUSTOMER_WALLET')
    expect(balance.balance).toBe(LARGE_AMOUNT + oddAmount)
  })

  it('rejects debit that exceeds available balance', async () => {
    const cw = await prisma.customerWallet.findUnique({ where: { userId } })
    const actualWalletId = cw!.id

    const tooMuch = 9_007_199_254_740_993_000n
    await expect(
      postLedgerTransaction({
        entries: [
          { accountId: actualWalletId, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: tooMuch },
          { accountId: `${PREFIX}-platform`, accountType: 'PLATFORM', entryType: 'CREDIT', amount: tooMuch },
        ],
        referenceType: 'UNDERFLOW_TEST',
        referenceId: randomUUID(),
        idempotencyKey: `underflow-${randomUUID()}`,
        createdBy: 'test',
      })
    ).rejects.toThrow('INSUFFICIENT_FUNDS')
  })

  it('WalletBalance stores BigInt natively (no Float roundtrip)', async () => {
    const cw = await prisma.customerWallet.findUnique({ where: { userId } })
    const actualWalletId = cw!.id

    const walletRow = await prisma.$queryRawUnsafe<Array<{ balance: bigint; available_balance: bigint }>>(
      `SELECT balance, "availableBalance" as available_balance FROM "WalletBalance" WHERE "walletId" = $1 AND "walletType" = 'CUSTOMER'`,
      actualWalletId
    )
    expect(typeof walletRow[0].balance).toBe('bigint')
    expect(typeof walletRow[0].available_balance).toBe('bigint')
    expect(walletRow[0].balance).toBeGreaterThanOrEqual(LARGE_AMOUNT)
  })
})
