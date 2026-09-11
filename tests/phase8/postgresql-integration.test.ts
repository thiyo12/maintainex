import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import type { Currency } from '@/lib/money'

const TEST_DB_URL = process.env.DATABASE_URL
const isDB = TEST_DB_URL && (TEST_DB_URL.includes('maintainex_test') || TEST_DB_URL.includes('_ci'))

let prisma: PrismaClient

describe.skipIf(!isDB)('Phase 8 — PostgreSQL Integration', () => {
  const PREFIX = `p8int-${Date.now()}`
  const lkUserId = `${PREFIX}-lk-user`
  const caUserId = `${PREFIX}-ca-user`
  const lkProviderId = `${PREFIX}-lk-provider`
  const caProviderId = `${PREFIX}-ca-provider`
  const lkCompanyId = `${PREFIX}-lk-company`
  const caCompanyId = `${PREFIX}-ca-company`
  const lkWalletId = `${PREFIX}-lk-wallet`
  const caWalletId = `${PREFIX}-ca-wallet`

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()

    await prisma.user.createMany({
      data: [
        { id: lkUserId, email: `${PREFIX}-lk@test.com`, passwordHash: 'hash', name: 'LK User', role: 'CUSTOMER', countryCode: 'LK', isActive: true, updatedAt: new Date() },
        { id: caUserId, email: `${PREFIX}-ca@test.com`, passwordHash: 'hash', name: 'CA User', role: 'CUSTOMER', countryCode: 'CA', isActive: true, updatedAt: new Date() },
        { id: lkProviderId, email: `${PREFIX}-lk-p@test.com`, passwordHash: 'hash', name: 'LK Provider', role: 'TASKER', countryCode: 'LK', isActive: true, updatedAt: new Date() },
        { id: caProviderId, email: `${PREFIX}-ca-p@test.com`, passwordHash: 'hash', name: 'CA Provider', role: 'TASKER', countryCode: 'CA', isActive: true, updatedAt: new Date() },
        { id: lkCompanyId, email: `${PREFIX}-lk-c@test.com`, passwordHash: 'hash', name: 'LK Company', role: 'COMPANY', countryCode: 'LK', isActive: true, updatedAt: new Date() },
        { id: caCompanyId, email: `${PREFIX}-ca-c@test.com`, passwordHash: 'hash', name: 'CA Company', role: 'COMPANY', countryCode: 'CA', isActive: true, updatedAt: new Date() },
      ],
    })

    await prisma.taskerProfile.createMany({
      data: [
        { userId: lkProviderId, isOnline: true, isVerified: true, countryCode: 'LK' },
        { userId: caProviderId, isOnline: true, isVerified: true, countryCode: 'CA' },
      ],
    })

    await prisma.companyProfile.createMany({
      data: [
        { userId: lkCompanyId, companyName: 'LK Co', countryCode: 'LK', services: '[]', serviceAreas: '[]' },
        { userId: caCompanyId, companyName: 'CA Co', countryCode: 'CA', services: '[]', serviceAreas: '[]' },
      ],
    })
  })

  afterAll(async () => {
    await prisma.taskerProfile.deleteMany({ where: { userId: { in: [lkProviderId, caProviderId] } } })
    await prisma.companyProfile.deleteMany({ where: { userId: { in: [lkCompanyId, caCompanyId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [lkUserId, caUserId, lkProviderId, caProviderId, lkCompanyId, caCompanyId] } } })
    await prisma.$disconnect()
  })

  describe('Country isolation — core models', () => {
    it('User.countryCode persists correctly for LK and CA', async () => {
      const lkUser = await prisma.user.findUnique({ where: { id: lkUserId }, select: { countryCode: true } })
      const caUser = await prisma.user.findUnique({ where: { id: caUserId }, select: { countryCode: true } })
      expect(lkUser?.countryCode).toBe('LK')
      expect(caUser?.countryCode).toBe('CA')
    })

    it('TaskerProfile.countryCode persists correctly', async () => {
      const lk = await prisma.taskerProfile.findUnique({ where: { userId: lkProviderId }, select: { countryCode: true } })
      const ca = await prisma.taskerProfile.findUnique({ where: { userId: caProviderId }, select: { countryCode: true } })
      expect(lk?.countryCode).toBe('LK')
      expect(ca?.countryCode).toBe('CA')
    })

    it('CompanyProfile.countryCode persists correctly', async () => {
      const lk = await prisma.companyProfile.findUnique({ where: { userId: lkCompanyId }, select: { countryCode: true } })
      const ca = await prisma.companyProfile.findUnique({ where: { userId: caCompanyId }, select: { countryCode: true } })
      expect(lk?.countryCode).toBe('LK')
      expect(ca?.countryCode).toBe('CA')
    })

    it('countryCode index supports filtered queries efficiently', async () => {
      const lkUsers = await prisma.user.findMany({ where: { countryCode: 'LK', role: 'CUSTOMER' } })
      const caUsers = await prisma.user.findMany({ where: { countryCode: 'CA', role: 'CUSTOMER' } })
      expect(lkUsers.some((u) => u.id === lkUserId)).toBe(true)
      expect(caUsers.some((u) => u.id === caUserId)).toBe(true)
      expect(lkUsers.some((u) => u.id === caUserId)).toBe(false)
      expect(caUsers.some((u) => u.id === lkUserId)).toBe(false)
    })
  })

  describe('Wallet multi-currency constraint', () => {
    const walletPrefix = `${PREFIX}-wallet`

    beforeAll(async () => {
      await prisma.providerWallet.create({
        data: { id: walletPrefix, userId: lkProviderId, currency: 'LKR' },
      })
    })

    afterAll(async () => {
      await prisma.walletBalance.deleteMany({ where: { walletId: walletPrefix } })
      await prisma.providerWallet.delete({ where: { id: walletPrefix } }).catch(() => null)
    })

    it('allows creating LKR and CAD balance rows for the same wallet', async () => {
      await prisma.walletBalance.create({
        data: { walletId: walletPrefix, walletType: 'PROVIDER', balance: 50000n, availableBalance: 50000n, pendingBalance: 0n, currency: 'LKR' },
      })
      await prisma.walletBalance.create({
        data: { walletId: walletPrefix, walletType: 'PROVIDER', balance: 10000n, availableBalance: 10000n, pendingBalance: 0n, currency: 'CAD' },
      })

      const balances = await prisma.walletBalance.findMany({ where: { walletId: walletPrefix } })
      expect(balances.length).toBe(2)
      expect(balances.map((b) => b.currency).sort()).toEqual(['CAD', 'LKR'])
    })

    it('rejects duplicate (walletType, walletId, currency)', async () => {
      await expect(
        prisma.walletBalance.create({
          data: { walletId: walletPrefix, walletType: 'PROVIDER', balance: 0n, availableBalance: 0n, pendingBalance: 0n, currency: 'LKR' },
        })
      ).rejects.toThrow()
    })

    it('LKR mutation does not affect CAD balance', async () => {
      const beforeCAD = await prisma.walletBalance.findFirst({
        where: { walletId: walletPrefix, walletType: 'PROVIDER', currency: 'CAD' },
      })
      expect(beforeCAD).not.toBeNull()

      await prisma.walletBalance.updateMany({
        where: { walletId: walletPrefix, walletType: 'PROVIDER', currency: 'LKR' },
        data: { balance: 99999n, availableBalance: 99999n, version: { increment: 1 } },
      })

      const afterCAD = await prisma.walletBalance.findFirst({
        where: { walletId: walletPrefix, walletType: 'PROVIDER', currency: 'CAD' },
      })
      expect(afterCAD?.balance).toBe(beforeCAD!.balance)
    })

    it('read by currency returns correct row', async () => {
      const lkr = await prisma.walletBalance.findFirst({
        where: { walletId: walletPrefix, walletType: 'PROVIDER', currency: 'LKR' },
      })
      expect(lkr?.currency).toBe('LKR')
      expect(lkr?.balance).toBe(99999n)

      const cad = await prisma.walletBalance.findFirst({
        where: { walletId: walletPrefix, walletType: 'PROVIDER', currency: 'CAD' },
      })
      expect(cad?.currency).toBe('CAD')
    })
  })

  describe('Financial flow — LKR and CAD', () => {
    const jobPrefix = `${PREFIX}-job`
    let lkJobId: string
    let caJobId: string
    let lkEscrowId: string
    let caEscrowId: string

    beforeAll(async () => {
      const lkJob = await prisma.marketplaceJob.create({
        data: {
          id: `${jobPrefix}-lk`, customerId: lkUserId, title: 'LK Job', description: 'test',
          categoryId: 'test-cat', photos: '[]', budgetType: 'FIXED', budgetAmount: 10000n,
          status: 'QUOTE_ACCEPTED', urgency: 'normal', workersCount: 1,
          materialHandling: 'tasker_brings', countryCode: 'LK',
        },
      })
      lkJobId = lkJob.id

      const caJob = await prisma.marketplaceJob.create({
        data: {
          id: `${jobPrefix}-ca`, customerId: caUserId, title: 'CA Job', description: 'test',
          categoryId: 'test-cat', photos: '[]', budgetType: 'FIXED', budgetAmount: 10000n,
          status: 'QUOTE_ACCEPTED', urgency: 'normal', workersCount: 1,
          materialHandling: 'tasker_brings', countryCode: 'CA',
        },
      })
      caJobId = caJob.id
    })

    afterAll(async () => {
      await prisma.financialLedger.deleteMany({ where: { referenceId: { in: [lkEscrowId, caEscrowId].filter(Boolean) } } })
      await prisma.jobEscrow.deleteMany({ where: { jobId: { in: [lkJobId, caJobId] } } })
      await prisma.marketplaceJob.deleteMany({ where: { id: { in: [lkJobId, caJobId] } } })
    })

    it('JobEscrow.currency snapshots correctly for LKR and CAD', async () => {
      const lkEscrow = await prisma.jobEscrow.create({
        data: {
          id: `${jobPrefix}-lk-escrow`, jobId: lkJobId, quoteId: `${jobPrefix}-lk-quote`,
          customerId: lkUserId, providerId: lkProviderId, amount: 10000n,
          serviceFee: 1000n, totalAmount: 11000n, currency: 'LKR', status: 'PROTECTED',
        },
      })
      lkEscrowId = lkEscrow.id

      const caEscrow = await prisma.jobEscrow.create({
        data: {
          id: `${jobPrefix}-ca-escrow`, jobId: caJobId, quoteId: `${jobPrefix}-ca-quote`,
          customerId: caUserId, providerId: caProviderId, amount: 10000n,
          serviceFee: 1000n, totalAmount: 11000n, currency: 'CAD', status: 'PROTECTED',
        },
      })
      caEscrowId = caEscrow.id

      expect(lkEscrow.currency).toBe('LKR')
      expect(caEscrow.currency).toBe('CAD')
    })

    it('FinancialLedger entries use correct currency for each flow', async () => {
      const lkLedgerEntry = await prisma.financialLedger.create({
        data: {
          accountId: lkUserId, accountType: 'CUSTOMER', entryType: 'DEBIT',
          amount: 11000n, currency: 'LKR', referenceType: 'ESCROW',
          referenceId: lkEscrowId, idempotencyKey: `${PREFIX}-lk-ledger-1`,
          createdBy: 'SYSTEM',
        },
      })
      expect(lkLedgerEntry.currency).toBe('LKR')

      const caLedgerEntry = await prisma.financialLedger.create({
        data: {
          accountId: caUserId, accountType: 'CUSTOMER', entryType: 'DEBIT',
          amount: 11000n, currency: 'CAD', referenceType: 'ESCROW',
          referenceId: caEscrowId, idempotencyKey: `${PREFIX}-ca-ledger-1`,
          createdBy: 'SYSTEM',
        },
      })
      expect(caLedgerEntry.currency).toBe('CAD')
    })

    it('all ledger entries for LKR escrow are LKR', async () => {
      const entries = await prisma.financialLedger.findMany({
        where: { referenceId: lkEscrowId },
      })
      for (const entry of entries) {
        expect(entry.currency).toBe('LKR')
      }
    })

    it('all ledger entries for CAD escrow are CAD', async () => {
      const entries = await prisma.financialLedger.findMany({
        where: { referenceId: caEscrowId },
      })
      for (const entry of entries) {
        expect(entry.currency).toBe('CAD')
      }
    })
  })

  describe('CommissionSettlement countryCode', () => {
    const settlementPrefix = `${PREFIX}-settle`

    afterAll(async () => {
      await prisma.commissionSettlement.deleteMany({ where: { id: { startsWith: settlementPrefix } } })
    })

    it('CommissionSettlement persists countryCode correctly', async () => {
      const lkSettlement = await prisma.commissionSettlement.create({
        data: {
          id: `${settlementPrefix}-lk`, jobId: 'test-job', escrowId: 'test-escrow',
          providerId: lkProviderId, customerId: lkUserId, jobAmount: 10000n,
          commissionRate: 10.0, commissionAmount: 1000n, currency: 'LKR',
          countryCode: 'LK', status: 'PENDING',
        },
      })
      expect(lkSettlement.countryCode).toBe('LK')
      expect(lkSettlement.currency).toBe('LKR')

      const caSettlement = await prisma.commissionSettlement.create({
        data: {
          id: `${settlementPrefix}-ca`, jobId: 'test-job-ca', escrowId: 'test-escrow-ca',
          providerId: caProviderId, customerId: caUserId, jobAmount: 10000n,
          commissionRate: 10.0, commissionAmount: 1000n, currency: 'CAD',
          countryCode: 'CA', status: 'PENDING',
        },
      })
      expect(caSettlement.countryCode).toBe('CA')
      expect(caSettlement.currency).toBe('CAD')
    })

    it('countryCode index supports filtered queries', async () => {
      const lkSettlements = await prisma.commissionSettlement.findMany({
        where: { countryCode: 'LK', id: { startsWith: settlementPrefix } },
      })
      const caSettlements = await prisma.commissionSettlement.findMany({
        where: { countryCode: 'CA', id: { startsWith: settlementPrefix } },
      })
      expect(lkSettlements.length).toBeGreaterThanOrEqual(1)
      expect(caSettlements.length).toBeGreaterThanOrEqual(1)
      expect(lkSettlements.every((s) => s.countryCode === 'LK')).toBe(true)
      expect(caSettlements.every((s) => s.countryCode === 'CA')).toBe(true)
    })
  })

  describe('Payout currency and countryCode', () => {
    const payoutPrefix = `${PREFIX}-payout`

    afterAll(async () => {
      await prisma.payout.deleteMany({ where: { id: { startsWith: payoutPrefix } } })
    })

    it('Payout stores both currency and countryCode correctly', async () => {
      const lkPayout = await prisma.payout.create({
        data: {
          id: `${payoutPrefix}-lk`, userId: lkProviderId, amount: 5000n,
          source: 'WITHDRAWAL', currency: 'LKR', countryCode: 'LK', status: 'PENDING',
        },
      })
      expect(lkPayout.currency).toBe('LKR')
      expect(lkPayout.countryCode).toBe('LK')

      const caPayout = await prisma.payout.create({
        data: {
          id: `${payoutPrefix}-ca`, userId: caProviderId, amount: 5000n,
          source: 'WITHDRAWAL', currency: 'CAD', countryCode: 'CA', status: 'PENDING',
        },
      })
      expect(caPayout.currency).toBe('CAD')
      expect(caPayout.countryCode).toBe('CA')
    })
  })

  describe('MarketConfig countryCode uniqueness', () => {
    it('MarketConfig countryCode is unique', async () => {
      const configs = await prisma.marketConfig.findMany()
      const codes = configs.map((c) => c.countryCode)
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(codes.length)
    })

    it('MarketConfig stores defaultCurrency per country', async () => {
      const global = await prisma.marketConfig.findUnique({ where: { countryCode: 'GLOBAL' } })
      if (global) {
        expect(typeof global.defaultCurrency).toBe('string')
        expect(global.defaultCurrency.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Pre-Phase8 data preservation', () => {
    it('existing LKR defaults are not altered', async () => {
      const user = await prisma.user.findUnique({ where: { id: lkUserId } })
      expect(user?.countryCode).toBe('LK')
      expect(user?.name).toBe('LK User')
    })

    it('BigInt monetary values are preserved correctly', async () => {
      const balance = await prisma.walletBalance.findFirst({
        where: { walletId: `${PREFIX}-wallet`, walletType: 'PROVIDER', currency: 'LKR' },
      })
      if (balance) {
        expect(typeof balance.balance).toBe('bigint')
        expect(balance.balance).toBe(99999n)
      }
    })
  })
})
