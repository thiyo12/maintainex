import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { acceptJobQuote } from '@/lib/domain/job-lifecycle'
import { fundEscrow, refundEscrow, releaseEscrow } from '@/lib/finance/escrow/escrow-service'
import { bigIntToSafeNumber, type Currency } from '@/lib/shared/money/money'

const TEST_DB_URL = process.env.DATABASE_URL
const isDB = TEST_DB_URL && (TEST_DB_URL.includes('maintainex_test') || TEST_DB_URL.includes('_ci'))

let prisma: PrismaClient

describe.skipIf(!isDB)('Phase 8 — Canonical Financial Flow Integration', () => {
  const PREFIX = `p8flow-${Date.now()}`

  const lkCustomerId = `${PREFIX}-lk-cust`
  const caCustomerId = `${PREFIX}-ca-cust`
  const lkProviderId = `${PREFIX}-lk-prov`
  const caProviderId = `${PREFIX}-ca-prov`
  const lkCustomerWalletId = `${PREFIX}-lk-cust-wallet`
  const caCustomerWalletId = `${PREFIX}-ca-cust-wallet`
  const lkProviderWalletId = `${PREFIX}-lk-prov-wallet`
  const caProviderWalletId = `${PREFIX}-ca-prov-wallet`

  let lkJobId: string
  let caJobId: string
  let lkQuoteId: string
  let caQuoteId: string
  let lkEscrowId: string
  let caEscrowId: string
  const lkCategoryId = `${PREFIX}-lk-category`
  const caCategoryId = `${PREFIX}-ca-category`
  const lkTemplateJobId = `${PREFIX}-lk-template`
  const caTemplateJobId = `${PREFIX}-ca-template`

  async function createEligibleProviderFixture(
    userId: string,
    countryCode = 'LK',
    templateJobId = lkTemplateJobId,
    currency = 'LKR',
  ) {
    const profile = await prisma.taskerProfile.create({
      data: {
        userId,
        isOnline: true,
        isVerified: true,
        verificationStatus: 'VERIFIED',
        countryCode,
      },
    })
    await prisma.taskerSkill.create({
      data: {
        taskerId: profile.id,
        jobId: templateJobId,
        countryCode,
        currency,
      },
    })
    return profile
  }

  beforeAll(async () => {
    prisma = new PrismaClient()
    await prisma.$connect()

    await prisma.user.createMany({
      data: [
        { id: lkCustomerId, email: `${PREFIX}-lk-c@test.com`, passwordHash: 'h', name: 'LK Cust', role: 'CUSTOMER', countryCode: 'LK', isActive: true, updatedAt: new Date() },
        { id: caCustomerId, email: `${PREFIX}-ca-c@test.com`, passwordHash: 'h', name: 'CA Cust', role: 'CUSTOMER', countryCode: 'CA', isActive: true, updatedAt: new Date() },
        { id: lkProviderId, email: `${PREFIX}-lk-p@test.com`, passwordHash: 'h', name: 'LK Prov', role: 'TASKER', countryCode: 'LK', identityStatus: 'VERIFIED', isActive: true, updatedAt: new Date() },
        { id: caProviderId, email: `${PREFIX}-ca-p@test.com`, passwordHash: 'h', name: 'CA Prov', role: 'TASKER', countryCode: 'CA', identityStatus: 'VERIFIED', isActive: true, updatedAt: new Date() },
      ],
    })

    await prisma.taskerProfile.createMany({
      data: [
        { userId: lkProviderId, isOnline: true, isVerified: true, verificationStatus: 'VERIFIED', countryCode: 'LK' },
        { userId: caProviderId, isOnline: true, isVerified: true, verificationStatus: 'VERIFIED', countryCode: 'CA' },
      ],
    })

    await prisma.jobCategory.createMany({
      data: [
        { id: lkCategoryId, name: `${PREFIX} LK Plumbing`, slug: `${PREFIX}-lk-plumbing`, iconName: 'wrench', colorHex: '#3B82F6', countries: '["LK"]', isActive: true },
        { id: caCategoryId, name: `${PREFIX} CA Electrical`, slug: `${PREFIX}-ca-electrical`, iconName: 'bolt', colorHex: '#3B82F6', countries: '["CA"]', isActive: true },
      ],
    })
    await prisma.templateJob.createMany({
      data: [
        { id: lkTemplateJobId, categoryId: lkCategoryId, name: `${PREFIX} LK Service`, description: 'Finance integration LK', whatIsIncluded: 'Test', typicalDurationMinutes: 60, priceMin: 10, priceMax: 1000, currency: 'LKR', countries: '["LK"]' },
        { id: caTemplateJobId, categoryId: caCategoryId, name: `${PREFIX} CA Service`, description: 'Finance integration CA', whatIsIncluded: 'Test', typicalDurationMinutes: 60, priceMin: 10, priceMax: 1000, currency: 'CAD', countries: '["CA"]' },
      ],
    })
    const providerProfiles = await prisma.taskerProfile.findMany({
      where: { userId: { in: [lkProviderId, caProviderId] } },
      select: { id: true, userId: true },
    })
    const lkProfile = providerProfiles.find(profile => profile.userId === lkProviderId)!
    const caProfile = providerProfiles.find(profile => profile.userId === caProviderId)!
    await prisma.taskerSkill.createMany({
      data: [
        { taskerId: lkProfile.id, jobId: lkTemplateJobId, countryCode: 'LK', currency: 'LKR' },
        { taskerId: caProfile.id, jobId: caTemplateJobId, countryCode: 'CA', currency: 'CAD' },
      ],
    })

    await prisma.marketConfig.upsert({
      where: { countryCode: 'LK' },
      create: { countryCode: 'LK', defaultCurrency: 'LKR', commissionRateBps: 1000, pricingVersion: 'v1' },
      update: { defaultCurrency: 'LKR' },
    })
    await prisma.marketConfig.upsert({
      where: { countryCode: 'CA' },
      create: { countryCode: 'CA', defaultCurrency: 'CAD', commissionRateBps: 1500, pricingVersion: 'v1' },
      update: { defaultCurrency: 'CAD' },
    })

    await prisma.customerWallet.create({ data: { id: lkCustomerWalletId, userId: lkCustomerId } })
    await prisma.customerWallet.create({ data: { id: caCustomerWalletId, userId: caCustomerId } })
    await prisma.providerWallet.create({ data: { id: lkProviderWalletId, userId: lkProviderId } })
    await prisma.providerWallet.create({ data: { id: caProviderWalletId, userId: caProviderId } })

    await prisma.walletBalance.createMany({
      data: [
        { walletId: lkCustomerWalletId, walletType: 'CUSTOMER', balance: 5000000n, availableBalance: 5000000n, pendingBalance: 0n, currency: 'LKR' },
        { walletId: caCustomerWalletId, walletType: 'CUSTOMER', balance: 500000n, availableBalance: 500000n, pendingBalance: 0n, currency: 'CAD' },
        { walletId: lkProviderWalletId, walletType: 'PROVIDER', balance: 0n, availableBalance: 0n, pendingBalance: 0n, currency: 'LKR' },
        { walletId: caProviderWalletId, walletType: 'PROVIDER', balance: 0n, availableBalance: 0n, pendingBalance: 0n, currency: 'CAD' },
      ],
    })

    const lkJob = await prisma.marketplaceJob.create({
      data: {
        id: `${PREFIX}-lk-job`, customerId: lkCustomerId, title: 'LK Plumber', description: 'Fix leak',
        categoryId: lkCategoryId, photos: '[]', budgetType: 'FIXED', budgetAmount: 500000n,
        status: 'OPEN', urgency: 'normal', workersCount: 1,
        materialHandling: 'tasker_brings', countryCode: 'LK',
      },
    })
    lkJobId = lkJob.id

    const caJob = await prisma.marketplaceJob.create({
      data: {
        id: `${PREFIX}-ca-job`, customerId: caCustomerId, title: 'CA Electrician', description: 'Wiring',
        categoryId: caCategoryId, photos: '[]', budgetType: 'FIXED', budgetAmount: 200000n,
        status: 'OPEN', urgency: 'normal', workersCount: 1,
        materialHandling: 'tasker_brings', countryCode: 'CA',
      },
    })
    caJobId = caJob.id

    const lkQuote = await prisma.jobQuote.create({
      data: { id: `${PREFIX}-lk-quote`, jobId: lkJobId, providerId: lkProviderId, providerType: 'INDIVIDUAL', price: 500000n, currency: 'LKR', message: 'I can fix', estimatedCompletionTime: '2h', attachments: '[]', status: 'PENDING' },
    })
    lkQuoteId = lkQuote.id

    const caQuote = await prisma.jobQuote.create({
      data: { id: `${PREFIX}-ca-quote`, jobId: caJobId, providerId: caProviderId, providerType: 'INDIVIDUAL', price: 200000n, currency: 'CAD', message: 'I can wire', estimatedCompletionTime: '3h', attachments: '[]', status: 'PENDING' },
    })
    caQuoteId = caQuote.id
  })

  afterAll(async () => {
    if (lkEscrowId) await prisma.financialLedger.deleteMany({ where: { referenceId: lkEscrowId } }).catch(() => {})
    if (caEscrowId) await prisma.financialLedger.deleteMany({ where: { referenceId: caEscrowId } }).catch(() => {})
    if (lkEscrowId) await prisma.commissionSettlement.deleteMany({ where: { escrowId: lkEscrowId } }).catch(() => {})
    if (caEscrowId) await prisma.commissionSettlement.deleteMany({ where: { escrowId: caEscrowId } }).catch(() => {})
    await prisma.weeklySettlement.deleteMany({ where: { providerId: { in: [lkProviderId, caProviderId] } } }).catch(() => {})
    await prisma.jobEscrow.deleteMany({ where: { jobId: { in: [lkJobId, caJobId] } } }).catch(() => {})
    await prisma.jobWorkspace.deleteMany({ where: { jobId: { in: [lkJobId, caJobId] } } }).catch(() => {})
    await prisma.jobQuote.deleteMany({ where: { jobId: { in: [lkJobId, caJobId] } } }).catch(() => {})
    await prisma.marketplaceJob.deleteMany({ where: { id: { in: [lkJobId, caJobId] } } }).catch(() => {})
    await prisma.walletTransaction.deleteMany({ where: { userId: { in: [lkCustomerId, caCustomerId, lkProviderId, caProviderId] } } }).catch(() => {})
    await prisma.walletBalance.deleteMany({ where: { walletId: { in: [lkCustomerWalletId, caCustomerWalletId, lkProviderWalletId, caProviderWalletId] } } }).catch(() => {})
    await prisma.customerWallet.deleteMany({ where: { id: { in: [lkCustomerWalletId, caCustomerWalletId] } } }).catch(() => {})
    await prisma.providerWallet.deleteMany({ where: { id: { in: [lkProviderWalletId, caProviderWalletId] } } }).catch(() => {})
    await prisma.taskerSkill.deleteMany({ where: { jobId: { in: [lkTemplateJobId, caTemplateJobId] } } }).catch(() => {})
    await prisma.taskerProfile.deleteMany({ where: { userId: { in: [lkProviderId, caProviderId] } } }).catch(() => {})
    await prisma.templateJob.deleteMany({ where: { id: { in: [lkTemplateJobId, caTemplateJobId] } } }).catch(() => {})
    await prisma.jobCategory.deleteMany({ where: { id: { in: [lkCategoryId, caCategoryId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [lkCustomerId, caCustomerId, lkProviderId, caProviderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  describe('Test A: acceptJobQuote snapshots correct currency', () => {
    it('LK job gets LKR escrow currency', async () => {
      const ctx = { jobId: lkJobId, actorId: lkCustomerId, actorType: 'CUSTOMER' as const }
      await acceptJobQuote(ctx, lkQuoteId)

      const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: lkJobId } })
      expect(escrow).not.toBeNull()
      expect(escrow!.currency).toBe('LKR')
      expect(escrow!.status).toBe('PENDING_PAYMENT')
      lkEscrowId = escrow!.id
    })

    it('CA job gets CAD escrow currency', async () => {
      const ctx = { jobId: caJobId, actorId: caCustomerId, actorType: 'CUSTOMER' as const }
      await acceptJobQuote(ctx, caQuoteId)

      const escrow = await prisma.jobEscrow.findFirst({ where: { jobId: caJobId } })
      expect(escrow).not.toBeNull()
      expect(escrow!.currency).toBe('CAD')
      expect(escrow!.status).toBe('PENDING_PAYMENT')
      caEscrowId = escrow!.id
    })

    it('job status transitions to QUOTE_ACCEPTED', async () => {
      const lkJob = await prisma.marketplaceJob.findUnique({ where: { id: lkJobId }, select: { status: true } })
      const caJob = await prisma.marketplaceJob.findUnique({ where: { id: caJobId }, select: { status: true } })
      expect(lkJob!.status).toBe('QUOTE_ACCEPTED')
      expect(caJob!.status).toBe('QUOTE_ACCEPTED')
    })
  })

  describe('Test B: fundEscrow debits canonical WalletBalance', () => {
    it('LK: canonical LKR WalletBalance debited, legacy float updated', async () => {
      const ctx = { jobId: lkJobId, actorId: lkCustomerId, actorType: 'CUSTOMER' as const }
      await fundEscrow(ctx, lkJobId)

      const canonical = await prisma.walletBalance.findFirst({
        where: { walletId: lkCustomerWalletId, walletType: 'CUSTOMER', currency: 'LKR' },
      })
      expect(canonical).not.toBeNull()
      expect(canonical!.balance).toBeLessThan(5000000n)

      const legacy = await prisma.customerWallet.findUnique({ where: { userId: lkCustomerId }, select: { balance: true } })
      expect(legacy).not.toBeNull()
      expect(legacy!.balance).toBeLessThan(500)

      const escrow = await prisma.jobEscrow.findUnique({ where: { id: lkEscrowId } })
      expect(escrow!.status).toBe('PROTECTED')

      const ledgerEntries = await prisma.financialLedger.findMany({ where: { referenceId: lkEscrowId, referenceType: 'ESCROW_DEPOSIT' } })
      expect(ledgerEntries.length).toBeGreaterThanOrEqual(1)
      for (const entry of ledgerEntries) {
        expect(entry.currency).toBe('LKR')
      }
    })

    it('CA: canonical CAD WalletBalance debited, legacy float NOT touched', async () => {
      const legacyBefore = await prisma.customerWallet.findUnique({ where: { userId: caCustomerId }, select: { balance: true } })

      const ctx = { jobId: caJobId, actorId: caCustomerId, actorType: 'CUSTOMER' as const }
      await fundEscrow(ctx, caJobId)

      const canonical = await prisma.walletBalance.findFirst({
        where: { walletId: caCustomerWalletId, walletType: 'CUSTOMER', currency: 'CAD' },
      })
      expect(canonical).not.toBeNull()
      expect(canonical!.balance).toBeLessThan(500000n)

      const legacyAfter = await prisma.customerWallet.findUnique({ where: { userId: caCustomerId }, select: { balance: true } })
      expect(legacyAfter!.balance).toBe(legacyBefore!.balance)

      const ledgerEntries = await prisma.financialLedger.findMany({ where: { referenceId: caEscrowId, referenceType: 'ESCROW_DEPOSIT' } })
      expect(ledgerEntries.length).toBeGreaterThanOrEqual(1)
      for (const entry of ledgerEntries) {
        expect(entry.currency).toBe('CAD')
      }
    })

    it('fails if canonical WalletBalance missing for escrow currency', async () => {
      const newPrefix = `${PREFIX}-no-wallet`
      const custId = `${newPrefix}-cust`
      const provId = `${newPrefix}-prov`
      const jobId = `${newPrefix}-job`

      await prisma.user.createMany({
        data: [
          { id: custId, email: `${newPrefix}@test.com`, passwordHash: 'h', name: 'No Wallet', role: 'CUSTOMER', countryCode: 'LK', isActive: true, updatedAt: new Date() },
          { id: provId, email: `${newPrefix}-p@test.com`, passwordHash: 'h', name: 'No Wallet P', role: 'TASKER', countryCode: 'LK', identityStatus: 'VERIFIED', isActive: true, updatedAt: new Date() },
        ],
      })
      const noWalletProfile = await prisma.taskerProfile.create({ data: { userId: provId, isOnline: true, isVerified: true, verificationStatus: 'VERIFIED', countryCode: 'LK' } })
      await prisma.taskerSkill.create({ data: { taskerId: noWalletProfile.id, jobId: lkTemplateJobId, countryCode: 'LK', currency: 'LKR' } })
      await prisma.customerWallet.create({ data: { id: `${newPrefix}-cw`, userId: custId } })

      const job = await prisma.marketplaceJob.create({
        data: {
          id: jobId, customerId: custId, title: 'No Wallet Job', description: 'x',
          categoryId: lkCategoryId, photos: '[]', budgetType: 'FIXED', budgetAmount: 10000n,
          status: 'OPEN', urgency: 'normal', workersCount: 1, materialHandling: 'tasker_brings', countryCode: 'LK',
        },
      })
      const quote = await prisma.jobQuote.create({
        data: { id: `${newPrefix}-q`, jobId, providerId: provId, providerType: 'INDIVIDUAL', price: 10000n, currency: 'LKR', message: 'x', estimatedCompletionTime: '1h', attachments: '[]', status: 'PENDING' },
      })

      const ctx = { jobId, actorId: custId, actorType: 'CUSTOMER' as const }
      await acceptJobQuote(ctx, quote.id)

      await expect(fundEscrow(ctx, jobId)).rejects.toThrow('WALLET_CURRENCY_NOT_FOUND')

      await prisma.financialLedger.deleteMany({ where: { referenceId: { contains: newPrefix } } }).catch(() => {})
      await prisma.jobEscrow.deleteMany({ where: { jobId } }).catch(() => {})
      await prisma.jobWorkspace.deleteMany({ where: { jobId } }).catch(() => {})
      await prisma.jobQuote.deleteMany({ where: { jobId } }).catch(() => {})
      await prisma.marketplaceJob.deleteMany({ where: { id: jobId } }).catch(() => {})
      await prisma.customerWallet.deleteMany({ where: { id: `${newPrefix}-cw` } }).catch(() => {})
      await prisma.taskerProfile.deleteMany({ where: { userId: provId } }).catch(() => {})
      await prisma.user.deleteMany({ where: { id: { in: [custId, provId] } } }).catch(() => {})
    })
  })

  describe('Test C: releaseEscrow credits canonical WalletBalance', () => {
    it('LK: provider canonical LKR balance credited, legacy float updated, CommissionSettlement has currency+countryCode', async () => {
      const providerWallet = await prisma.providerWallet.findUnique({ where: { userId: lkProviderId }, select: { id: true } })
      const ctx = { jobId: lkJobId, actorId: lkCustomerId, actorType: 'CUSTOMER' as const }
      await releaseEscrow(ctx, lkJobId)

      const canonical = await prisma.walletBalance.findFirst({
        where: { walletId: providerWallet!.id, walletType: 'PROVIDER', currency: 'LKR' },
      })
      expect(canonical).not.toBeNull()
      expect(canonical!.availableBalance).toBeGreaterThan(0n)

      const legacy = await prisma.providerWallet.findUnique({ where: { userId: lkProviderId }, select: { availableBalance: true } })
      expect(legacy!.availableBalance).toBeGreaterThan(0)

      const settlement = await prisma.commissionSettlement.findFirst({ where: { escrowId: lkEscrowId } })
      expect(settlement).not.toBeNull()
      expect(settlement!.currency).toBe('LKR')
      expect(settlement!.countryCode).toBe('LK')

      const ledgerEntries = await prisma.financialLedger.findMany({ where: { referenceId: lkEscrowId, referenceType: 'ESCROW_RELEASE' } })
      expect(ledgerEntries.length).toBeGreaterThanOrEqual(1)
      for (const entry of ledgerEntries) {
        expect(entry.currency).toBe('LKR')
      }
    })

    it('CA: provider canonical CAD balance credited, legacy float NOT touched', async () => {
      const legacyBefore = await prisma.providerWallet.findUnique({ where: { userId: caProviderId }, select: { availableBalance: true } })
      const providerWallet = await prisma.providerWallet.findUnique({ where: { userId: caProviderId }, select: { id: true } })

      const ctx = { jobId: caJobId, actorId: caCustomerId, actorType: 'CUSTOMER' as const }
      await releaseEscrow(ctx, caJobId)

      const canonical = await prisma.walletBalance.findFirst({
        where: { walletId: providerWallet!.id, walletType: 'PROVIDER', currency: 'CAD' },
      })
      expect(canonical).not.toBeNull()
      expect(canonical!.availableBalance).toBeGreaterThan(0n)

      const legacyAfter = await prisma.providerWallet.findUnique({ where: { userId: caProviderId }, select: { availableBalance: true } })
      expect(legacyAfter!.availableBalance).toBe(legacyBefore!.availableBalance)

      const settlement = await prisma.commissionSettlement.findFirst({ where: { escrowId: caEscrowId } })
      expect(settlement).not.toBeNull()
      expect(settlement!.currency).toBe('CAD')
      expect(settlement!.countryCode).toBe('CA')

      const ledgerEntries = await prisma.financialLedger.findMany({ where: { referenceId: caEscrowId, referenceType: 'ESCROW_RELEASE' } })
      expect(ledgerEntries.length).toBeGreaterThanOrEqual(1)
      for (const entry of ledgerEntries) {
        expect(entry.currency).toBe('CAD')
      }
    })

    it('escrow status transitions to RELEASED', async () => {
      const lkEscrow = await prisma.jobEscrow.findUnique({ where: { id: lkEscrowId } })
      const caEscrow = await prisma.jobEscrow.findUnique({ where: { id: caEscrowId } })
      expect(lkEscrow!.status).toBe('RELEASED')
      expect(caEscrow!.status).toBe('RELEASED')
    })
  })

  describe('Test D: zero-commission company gets full job amount', () => {
    it('company commissionRate=0 receives the full authorized job amount while service fee remains platform revenue', async () => {
      const newPrefix = `${PREFIX}-zero`
      const custId = `${newPrefix}-cust`
      const ownerId = `${newPrefix}-owner`
      const jobId = `${newPrefix}-job`

      await prisma.user.createMany({
        data: [
          { id: custId, email: `${newPrefix}@test.com`, passwordHash: 'h', name: 'Zero Comm Cust', role: 'CUSTOMER', countryCode: 'LK', isActive: true, updatedAt: new Date() },
          { id: ownerId, email: `${newPrefix}-owner@test.com`, passwordHash: 'h', name: 'Zero Comm Owner', role: 'COMPANY', countryCode: 'LK', isActive: true, updatedAt: new Date() },
        ],
      })

      const company = await prisma.companyProfile.create({
        data: {
          userId: ownerId,
          companyName: `Zero Commission Company ${newPrefix}`,
          services: '["plumbing"]',
          serviceAreas: '[]',
          countryCode: 'LK',
          verificationStatus: 'VERIFIED',
          isVerified: true,
          subscriptionStatus: 'ACTIVE',
          commissionRate: 0,
        },
      })
      await prisma.teamMember.create({
        data: {
          companyId: company.id,
          userId: ownerId,
          name: 'Zero Comm Owner',
          role: 'COMPANY_OWNER',
          status: 'ACTIVE',
          skills: '[]',
        },
      })
      await prisma.companySpecialty.create({
        data: { companyId: company.id, categoryId: lkCategoryId },
      })

      const custWalletId = `${newPrefix}-cw`
      const provWalletId = `${newPrefix}-pw`
      await prisma.customerWallet.create({ data: { id: custWalletId, userId: custId } })
      await prisma.providerWallet.create({ data: { id: provWalletId, userId: ownerId } })
      await prisma.walletBalance.create({ data: { walletId: custWalletId, walletType: 'CUSTOMER', balance: 1000000n, availableBalance: 1000000n, pendingBalance: 0n, currency: 'LKR' } })
      await prisma.walletBalance.create({ data: { walletId: provWalletId, walletType: 'PROVIDER', balance: 0n, availableBalance: 0n, pendingBalance: 0n, currency: 'LKR' } })

      await prisma.marketplaceJob.create({
        data: {
          id: jobId, customerId: custId, title: 'Zero Commission Job', description: 'x',
          categoryId: lkCategoryId, photos: '[]', budgetType: 'FIXED', budgetAmount: 100000n,
          status: 'OPEN', urgency: 'normal', workersCount: 1, materialHandling: 'tasker_brings', countryCode: 'LK',
        },
      })
      const quote = await prisma.jobQuote.create({
        data: { id: `${newPrefix}-q`, jobId, providerId: company.id, providerType: 'COMPANY', price: 100000n, currency: 'LKR', message: 'x', estimatedCompletionTime: '1h', attachments: '[]', status: 'PENDING' },
      })

      const ctx = { jobId, actorId: custId, actorType: 'CUSTOMER' as const }
      await acceptJobQuote(ctx, quote.id)
      await fundEscrow(ctx, jobId)
      await releaseEscrow(ctx, jobId)

      const canonical = await prisma.walletBalance.findFirst({
        where: { walletId: provWalletId, walletType: 'PROVIDER', currency: 'LKR' },
      })
      expect(canonical).not.toBeNull()
      expect(canonical!.availableBalance).toBe(100000n)

      const settlement = await prisma.commissionSettlement.findFirst({ where: { jobId } })
      expect(settlement).toBeNull()

      const weekly = await prisma.weeklySettlement.findFirst({ where: { providerId: ownerId } })
      expect(weekly).toBeNull()

      await prisma.financialLedger.deleteMany({ where: { referenceId: { contains: newPrefix } } }).catch(() => {})
      await prisma.jobEscrow.deleteMany({ where: { jobId } }).catch(() => {})
      await prisma.jobWorkspace.deleteMany({ where: { jobId } }).catch(() => {})
      await prisma.jobQuote.deleteMany({ where: { jobId } }).catch(() => {})
      await prisma.marketplaceJob.deleteMany({ where: { id: jobId } }).catch(() => {})
      await prisma.walletBalance.deleteMany({ where: { walletId: { in: [custWalletId, provWalletId] } } }).catch(() => {})
      await prisma.customerWallet.deleteMany({ where: { id: custWalletId } }).catch(() => {})
      await prisma.providerWallet.deleteMany({ where: { id: provWalletId } }).catch(() => {})
      await prisma.companySpecialty.deleteMany({ where: { companyId: company.id } }).catch(() => {})
      await prisma.teamMember.deleteMany({ where: { companyId: company.id } }).catch(() => {})
      await prisma.companyProfile.deleteMany({ where: { id: company.id } }).catch(() => {})
      await prisma.user.deleteMany({ where: { id: { in: [custId, ownerId] } } }).catch(() => {})
    })
  })

  describe('Test E: double-fund is idempotent', () => {
    it('calling fundEscrow twice on same job throws on second attempt', async () => {
      const newPrefix = `${PREFIX}-double`
      const custId = `${newPrefix}-cust`
      const provId = `${newPrefix}-prov`
      const jobId = `${newPrefix}-job`

      await prisma.user.createMany({
        data: [
          { id: custId, email: `${newPrefix}@test.com`, passwordHash: 'h', name: 'Double Cust', role: 'CUSTOMER', countryCode: 'LK', isActive: true, updatedAt: new Date() },
          { id: provId, email: `${newPrefix}-p@test.com`, passwordHash: 'h', name: 'Double Prov', role: 'TASKER', countryCode: 'LK', identityStatus: 'VERIFIED', isActive: true, updatedAt: new Date() },
        ],
      })
      await createEligibleProviderFixture(provId)

      const custWalletId = `${newPrefix}-cw`
      const provWalletId = `${newPrefix}-pw`
      await prisma.customerWallet.create({ data: { id: custWalletId, userId: custId } })
      await prisma.providerWallet.create({ data: { id: provWalletId, userId: provId } })
      await prisma.walletBalance.create({ data: { walletId: custWalletId, walletType: 'CUSTOMER', balance: 1000000n, availableBalance: 1000000n, pendingBalance: 0n, currency: 'LKR' } })

      const job = await prisma.marketplaceJob.create({
        data: {
          id: jobId, customerId: custId, title: 'Double Fund Job', description: 'x',
          categoryId: lkCategoryId, photos: '[]', budgetType: 'FIXED', budgetAmount: 100000n,
          status: 'OPEN', urgency: 'normal', workersCount: 1, materialHandling: 'tasker_brings', countryCode: 'LK',
        },
      })
      const quote = await prisma.jobQuote.create({
        data: { id: `${newPrefix}-q`, jobId, providerId: provId, providerType: 'INDIVIDUAL', price: 100000n, currency: 'LKR', message: 'x', estimatedCompletionTime: '1h', attachments: '[]', status: 'PENDING' },
      })

      const ctx = { jobId, actorId: custId, actorType: 'CUSTOMER' as const }
      await acceptJobQuote(ctx, quote.id)
      await fundEscrow(ctx, jobId)

      await expect(fundEscrow(ctx, jobId)).rejects.toThrow()

      await prisma.financialLedger.deleteMany({ where: { referenceId: { contains: newPrefix } } }).catch(() => {})
      await prisma.jobEscrow.deleteMany({ where: { jobId } }).catch(() => {})
      await prisma.jobWorkspace.deleteMany({ where: { jobId } }).catch(() => {})
      await prisma.jobQuote.deleteMany({ where: { jobId } }).catch(() => {})
      await prisma.marketplaceJob.deleteMany({ where: { id: jobId } } as any).catch(() => {})
      await prisma.walletBalance.deleteMany({ where: { walletId: { in: [custWalletId, provWalletId] } } }).catch(() => {})
      await prisma.customerWallet.deleteMany({ where: { id: custWalletId } }).catch(() => {})
      await prisma.providerWallet.deleteMany({ where: { id: provWalletId } }).catch(() => {})
      await prisma.taskerProfile.deleteMany({ where: { userId: provId } }).catch(() => {})
      await prisma.user.deleteMany({ where: { id: { in: [custId, provId] } } }).catch(() => {})
    })
  })

  describe('Test F: cannot release unfunded escrow', () => {
    it('releaseEscrow on PENDING_PAYMENT escrow throws', async () => {
      const newPrefix = `${PREFIX}-unfunded`
      const custId = `${newPrefix}-cust`
      const provId = `${newPrefix}-prov`
      const jobId = `${newPrefix}-job`

      await prisma.user.createMany({
        data: [
          { id: custId, email: `${newPrefix}@test.com`, passwordHash: 'h', name: 'Unfunded Cust', role: 'CUSTOMER', countryCode: 'LK', isActive: true, updatedAt: new Date() },
          { id: provId, email: `${newPrefix}-p@test.com`, passwordHash: 'h', name: 'Unfunded Prov', role: 'TASKER', countryCode: 'LK', identityStatus: 'VERIFIED', isActive: true, updatedAt: new Date() },
        ],
      })
      await createEligibleProviderFixture(provId)

      const custWalletId = `${newPrefix}-cw`
      await prisma.customerWallet.create({ data: { id: custWalletId, userId: custId } })

      const job = await prisma.marketplaceJob.create({
        data: {
          id: jobId, customerId: custId, title: 'Unfunded Job', description: 'x',
          categoryId: lkCategoryId, photos: '[]', budgetType: 'FIXED', budgetAmount: 100000n,
          status: 'OPEN', urgency: 'normal', workersCount: 1, materialHandling: 'tasker_brings', countryCode: 'LK',
        },
      })
      const quote = await prisma.jobQuote.create({
        data: { id: `${newPrefix}-q`, jobId, providerId: provId, providerType: 'INDIVIDUAL', price: 100000n, currency: 'LKR', message: 'x', estimatedCompletionTime: '1h', attachments: '[]', status: 'PENDING' },
      })

      const ctx = { jobId, actorId: custId, actorType: 'CUSTOMER' as const }
      await acceptJobQuote(ctx, quote.id)

      await expect(releaseEscrow(ctx, jobId)).rejects.toThrow('No releasable escrow found')

      await prisma.financialLedger.deleteMany({ where: { referenceId: { contains: newPrefix } } }).catch(() => {})
      await prisma.jobEscrow.deleteMany({ where: { jobId } }).catch(() => {})
      await prisma.jobWorkspace.deleteMany({ where: { jobId } }).catch(() => {})
      await prisma.jobQuote.deleteMany({ where: { jobId } }).catch(() => {})
      await prisma.marketplaceJob.deleteMany({ where: { id: jobId } }).catch(() => {})
      await prisma.customerWallet.deleteMany({ where: { id: custWalletId } }).catch(() => {})
      await prisma.taskerProfile.deleteMany({ where: { userId: provId } }).catch(() => {})
      await prisma.user.deleteMany({ where: { id: { in: [custId, provId] } } }).catch(() => {})
    })
  })

  describe('Test G: financial isolation between LK and CA', () => {
    it('LK escrow release does not affect CA canonical wallet balances', async () => {
      const caProvWallet = await prisma.providerWallet.findUnique({ where: { userId: caProviderId }, select: { id: true } })
      const caProvBalanceBefore = await prisma.walletBalance.findFirst({
        where: { walletId: caProvWallet!.id, walletType: 'PROVIDER', currency: 'CAD' },
      })

      const lkProvWallet = await prisma.providerWallet.findUnique({ where: { userId: lkProviderId }, select: { id: true } })
      const lkProvBalanceBefore = await prisma.walletBalance.findFirst({
        where: { walletId: lkProvWallet!.id, walletType: 'PROVIDER', currency: 'LKR' },
      })

      const caProvBalanceCAD = caProvBalanceBefore?.availableBalance ?? 0n
      const lkProvBalanceLKR = lkProvBalanceBefore?.availableBalance ?? 0n

      const caProvBalanceLKR = await prisma.walletBalance.findFirst({
        where: { walletId: caProvWallet!.id, walletType: 'PROVIDER', currency: 'LKR' },
      })

      expect(caProvBalanceLKR).toBeNull()
      expect(caProvBalanceCAD).toBeGreaterThan(0n)
      expect(lkProvBalanceLKR).toBeGreaterThan(0n)
    })

    it('all ledger entries for LK escrow use LKR, all for CA escrow use CAD', async () => {
      const lkLedger = await prisma.financialLedger.findMany({ where: { referenceId: lkEscrowId } })
      for (const entry of lkLedger) {
        expect(entry.currency).toBe('LKR')
      }

      const caLedger = await prisma.financialLedger.findMany({ where: { referenceId: caEscrowId } })
      for (const entry of caLedger) {
        expect(entry.currency).toBe('CAD')
      }
    })
  })

  describe('Test H: payout idempotency includes currency', () => {
    it('Payout record stores currency and countryCode', async () => {
      const lkPayout = await prisma.payout.create({
        data: { userId: lkProviderId, amount: 50000n, source: 'WITHDRAWAL', method: 'bank', currency: 'LKR', countryCode: 'LK', status: 'RESERVED' },
      })
      expect(lkPayout.currency).toBe('LKR')
      expect(lkPayout.countryCode).toBe('LK')

      const caPayout = await prisma.payout.create({
        data: { userId: caProviderId, amount: 50000n, source: 'WITHDRAWAL', method: 'bank', currency: 'CAD', countryCode: 'CA', status: 'RESERVED' },
      })
      expect(caPayout.currency).toBe('CAD')
      expect(caPayout.countryCode).toBe('CA')

      await prisma.payout.deleteMany({ where: { id: { in: [lkPayout.id, caPayout.id] } } })
    })
  })

  describe('Test I: canonical refund closes the funded booking', () => {
    it('refundEscrow restores the customer balance and closes the job without reusable funded state', async () => {
      const newPrefix = `${PREFIX}-refund`
      const custId = `${newPrefix}-cust`
      const provId = `${newPrefix}-prov`
      const jobId = `${newPrefix}-job`

      await prisma.user.createMany({
        data: [
          { id: custId, email: `${newPrefix}@test.com`, passwordHash: 'h', name: 'Refund Cust', role: 'CUSTOMER', countryCode: 'LK', isActive: true, updatedAt: new Date() },
          { id: provId, email: `${newPrefix}-p@test.com`, passwordHash: 'h', name: 'Refund Prov', role: 'TASKER', countryCode: 'LK', identityStatus: 'VERIFIED', isActive: true, updatedAt: new Date() },
        ],
      })
      await createEligibleProviderFixture(provId)

      const custWalletId = `${newPrefix}-cw`
      await prisma.customerWallet.create({ data: { id: custWalletId, userId: custId } })
      await prisma.walletBalance.create({ data: { walletId: custWalletId, walletType: 'CUSTOMER', balance: 5000000n, availableBalance: 5000000n, pendingBalance: 0n, currency: 'LKR' } })

      await prisma.marketplaceJob.create({
        data: {
          id: jobId, customerId: custId, title: 'Refund Job', description: 'x',
          categoryId: lkCategoryId, photos: '[]', budgetType: 'FIXED', budgetAmount: 100000n,
          status: 'OPEN', urgency: 'normal', workersCount: 1, materialHandling: 'tasker_brings', countryCode: 'LK',
        },
      })
      const quote = await prisma.jobQuote.create({
        data: { id: `${newPrefix}-q`, jobId, providerId: provId, providerType: 'INDIVIDUAL', price: 100000n, currency: 'LKR', message: 'x', estimatedCompletionTime: '1h', attachments: '[]', status: 'PENDING' },
      })

      const ctx = { jobId, actorId: custId, actorType: 'CUSTOMER' as const }
      await acceptJobQuote(ctx, quote.id)
      await fundEscrow(ctx, jobId)

      const funded = await prisma.jobEscrow.findFirst({ where: { jobId } })
      expect(funded?.status).toBe('PROTECTED')

      const refund = await refundEscrow(ctx, jobId)
      expect(refund.refundPendingExternal).toBe(false)

      const [refundedEscrow, closedJob, canonicalAfter] = await Promise.all([
        prisma.jobEscrow.findUnique({ where: { id: funded!.id } }),
        prisma.marketplaceJob.findUnique({ where: { id: jobId } }),
        prisma.walletBalance.findFirst({
          where: { walletId: custWalletId, walletType: 'CUSTOMER', currency: 'LKR' },
        }),
      ])
      expect(refundedEscrow?.status).toBe('REFUNDED')
      expect(closedJob?.status).toBe('CANCELLED')
      expect(canonicalAfter?.balance).toBe(5000000n)
      expect(canonicalAfter?.availableBalance).toBe(5000000n)

      await prisma.financialLedger.deleteMany({ where: { referenceId: { contains: newPrefix } } }).catch(() => {})
      await prisma.jobEscrow.deleteMany({ where: { jobId } }).catch(() => {})
      await prisma.jobWorkspace.deleteMany({ where: { jobId } }).catch(() => {})
      await prisma.jobQuote.deleteMany({ where: { jobId } }).catch(() => {})
      await prisma.marketplaceJob.deleteMany({ where: { id: jobId } }).catch(() => {})
      await prisma.walletBalance.deleteMany({ where: { walletId: custWalletId } }).catch(() => {})
      await prisma.customerWallet.deleteMany({ where: { id: custWalletId } }).catch(() => {})
      await prisma.taskerProfile.deleteMany({ where: { userId: provId } }).catch(() => {})
      await prisma.user.deleteMany({ where: { id: { in: [custId, provId] } } }).catch(() => {})
    })
  })
})
