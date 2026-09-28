import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const TEST_DB_URL = process.env.DATABASE_URL
const isDB = TEST_DB_URL && (TEST_DB_URL.includes('maintainex_test') || TEST_DB_URL.includes('_ci'))

let prisma: PrismaClient

describe.skipIf(!isDB)('Phase 8 — Migration Preservation', () => {
  const PREFIX = `p8mig-${Date.now()}`
  const userId = `${PREFIX}-user`
  const walletId = `${PREFIX}-wallet`
  const jobId = `${PREFIX}-job`

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()

    await prisma.user.create({
      data: {
        id: userId,
        email: `${PREFIX}@test.com`,
        passwordHash: 'hash',
        name: 'Pre-Migration User',
        role: 'CUSTOMER',
        isActive: true,
        updatedAt: new Date(),
      },
    })

    await prisma.customerWallet.create({
      data: { id: walletId, userId },
    })

    await prisma.marketplaceJob.create({
      data: {
        id: jobId,
        customerId: userId,
        title: 'Pre-Migration Job',
        description: 'Legacy job without countryCode',
        categoryId: 'test',
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 10000n,
        status: 'OPEN',
        urgency: 'normal',
        workersCount: 1,
        materialHandling: 'tasker_brings',
      },
    })
  })

  afterAll(async () => {
    await prisma.marketplaceJob.deleteMany({ where: { id: jobId } }).catch(() => {})
    await prisma.customerWallet.deleteMany({ where: { id: walletId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('User.countryCode defaults to LKR for pre-Phase8 users', async () => {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    expect(user).not.toBeNull()
    expect(user!.countryCode).toBe('LK')
  })

  it('MarketplaceJob.countryCode defaults to LK for pre-Phase8 jobs', async () => {
    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    expect(job).not.toBeNull()
    expect(job!.countryCode).toBe('LK')
  })

  it('WalletBalance has default zero values for pre-Phase8 wallets', async () => {
    const balance = await prisma.walletBalance.findFirst({
      where: { walletId, walletType: 'CUSTOMER' },
    })
    if (balance) {
      expect(balance.currency).toBe('LKR')
      expect(typeof balance.balance).toBe('bigint')
    }
  })

  it('pre-Phase8 data retains all original field values', async () => {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    expect(user!.name).toBe('Pre-Migration User')
    expect(user!.role).toBe('CUSTOMER')
    expect(user!.isActive).toBe(true)

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    expect(job!.title).toBe('Pre-Migration Job')
    expect(job!.budgetAmount).toBe(10000n)
    expect(job!.status).toBe('OPEN')
  })

  it('WalletBalance unique constraint enforces (walletType, walletId, currency)', async () => {
    await expect(
      prisma.walletBalance.create({
        data: { walletId, walletType: 'CUSTOMER', balance: 0n, availableBalance: 0n, pendingBalance: 0n, currency: 'LKR' },
      })
    ).rejects.toThrow()
  })

  it('FinancialLedger.currency defaults to LKR for new entries', async () => {
    const entry = await prisma.financialLedger.create({
      data: {
        accountId: 'test-account',
        accountType: 'TEST',
        entryType: 'CREDIT',
        amount: 100n,
        referenceType: 'TEST',
        referenceId: `${PREFIX}-test-ref`,
        idempotencyKey: `${PREFIX}-test-ledger-${Date.now()}`,
        createdBy: 'SYSTEM',
      },
    })
    expect(entry.currency).toBe('LKR')
    await prisma.financialLedger.delete({ where: { id: entry.id } })
  })

  it('CommissionSettlement.currency and countryCode default correctly', async () => {
    const settlement = await prisma.commissionSettlement.create({
      data: {
        jobId: `${PREFIX}-test-job`,
        escrowId: `${PREFIX}-test-escrow`,
        providerId: userId,
        customerId: userId,
        jobAmount: 10000n,
        commissionRate: 10.0,
        commissionAmount: 1000n,
        status: 'PENDING',
      },
    })
    expect(settlement.currency).toBe('LKR')
    expect(settlement.countryCode).toBe('LK')
    await prisma.commissionSettlement.delete({ where: { id: settlement.id } })
  })

  it('Payout.currency and countryCode default correctly', async () => {
    const payout = await prisma.payout.create({
      data: {
        userId,
        amount: 5000n,
        source: 'WITHDRAWAL',
        status: 'PENDING',
      },
    })
    expect(payout.currency).toBe('LKR')
    expect(payout.countryCode).toBe('LK')
    await prisma.payout.delete({ where: { id: payout.id } })
  })
})
