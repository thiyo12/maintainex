import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { resolveCompanyContext } from '@/lib/phase6/company-context'

const prisma = new PrismaClient()

describe('Phase 6.2 — Company Quote Identity', () => {
  let companyId: string
  let ownerUserId: string
  let managerUserId: string
  let dispatcherUserId: string
  let workerUserId: string
  let financeUserId: string
  let jobId: string
  let customerId: string

  beforeAll(async () => {
    const ts = Date.now()

    const customer = await prisma.user.create({
      data: { email: `quote-customer-${ts}@test.com`, passwordHash: 'hash', name: 'Customer', role: 'USER', identityStatus: 'VERIFIED' },
    })
    customerId = customer.id

    const owner = await prisma.user.create({
      data: { email: `quote-owner-${ts}@test.com`, passwordHash: 'hash', name: 'Owner', role: 'COMPANY', identityStatus: 'VERIFIED' },
    })
    ownerUserId = owner.id

    const company = await prisma.companyProfile.create({
      data: {
        userId: ownerUserId,
        companyName: `Quote Test Co ${ts}`,
        services: '[]',
        serviceAreas: '[]',
        isVerified: true,
        verificationStatus: 'VERIFIED',
      },
    })
    companyId = company.id

    await prisma.teamMember.create({
      data: { companyId, userId: ownerUserId, name: 'Owner', role: 'COMPANY_OWNER', skills: '[]', status: 'ACTIVE' },
    })

    const manager = await prisma.user.create({
      data: { email: `quote-manager-${ts}@test.com`, passwordHash: 'hash', name: 'Manager', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    managerUserId = manager.id
    await prisma.teamMember.create({
      data: { companyId, userId: managerUserId, name: 'Manager', role: 'MANAGER', skills: '[]', status: 'ACTIVE' },
    })

    const dispatcher = await prisma.user.create({
      data: { email: `quote-dispatcher-${ts}@test.com`, passwordHash: 'hash', name: 'Dispatcher', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    dispatcherUserId = dispatcher.id
    await prisma.teamMember.create({
      data: { companyId, userId: dispatcherUserId, name: 'Dispatcher', role: 'DISPATCHER', skills: '[]', status: 'ACTIVE' },
    })

    const worker = await prisma.user.create({
      data: { email: `quote-worker-${ts}@test.com`, passwordHash: 'hash', name: 'Worker', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    workerUserId = worker.id
    await prisma.teamMember.create({
      data: { companyId, userId: workerUserId, name: 'Worker', role: 'WORKER', skills: '[]', status: 'ACTIVE' },
    })

    const finance = await prisma.user.create({
      data: { email: `quote-finance-${ts}@test.com`, passwordHash: 'hash', name: 'Finance', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    financeUserId = finance.id
    await prisma.teamMember.create({
      data: { companyId, userId: financeUserId, name: 'Finance', role: 'FINANCE', skills: '[]', status: 'ACTIVE' },
    })

    const job = await prisma.marketplaceJob.create({
      data: {
        customerId,
        title: 'Test Job',
        description: 'Test',
        categoryId: 'test-cat',
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 10000n,
        status: 'OPEN',
      },
    })
    jobId = job.id
  })

  afterAll(async () => {
    await prisma.jobQuote.deleteMany({ where: { jobId } })
    await prisma.marketplaceJob.delete({ where: { id: jobId } }).catch(() => {})
    await prisma.teamMember.deleteMany({ where: { companyId } })
    await prisma.companyProfile.delete({ where: { id: companyId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerUserId, managerUserId, dispatcherUserId, workerUserId, financeUserId, customerId] } } }).catch(() => {})
  })

  it('owner can submit company quote with correct actor', async () => {
    const { context } = await resolveCompanyContext(ownerUserId, companyId, 'quotes:submit')
    expect(context).toBeTruthy()
    expect(context!.role).toBe('COMPANY_OWNER')

    const quote = await prisma.jobQuote.create({
      data: {
        jobId,
        providerId: companyId,
        providerType: 'COMPANY',
        price: 5000n,
        actorUserId: ownerUserId,
        actorRole: 'COMPANY_OWNER',
        estimatedCompletionTime: '2h',
        attachments: '[]',
      },
    })

    expect(quote.actorUserId).toBe(ownerUserId)
    expect(quote.actorRole).toBe('COMPANY_OWNER')
    expect(quote.providerId).toBe(companyId)
    expect(quote.providerType).toBe('COMPANY')
  })

  it('manager can submit company quote', async () => {
    const { context } = await resolveCompanyContext(managerUserId, companyId, 'quotes:submit')
    expect(context).toBeTruthy()
    expect(context!.role).toBe('MANAGER')
  })

  it('dispatcher can submit company quote', async () => {
    const { context } = await resolveCompanyContext(dispatcherUserId, companyId, 'quotes:submit')
    expect(context).toBeTruthy()
    expect(context!.role).toBe('DISPATCHER')
  })

  it('worker denied quotes:submit', async () => {
    const { context, error } = await resolveCompanyContext(workerUserId, companyId, 'quotes:submit')
    expect(error).toBeTruthy()
    expect(context).toBeNull()
  })

  it('finance denied quotes:submit', async () => {
    const { context, error } = await resolveCompanyContext(financeUserId, companyId, 'quotes:submit')
    expect(error).toBeTruthy()
    expect(context).toBeNull()
  })

  it('company member can read company quotes', async () => {
    const quotes = await prisma.jobQuote.findMany({
      where: { jobId, providerId: companyId },
    })
    expect(quotes.length).toBeGreaterThan(0)
  })

  it('company profile lookup uses CompanyProfile.id not userId', async () => {
    const companyProfile = await prisma.companyProfile.findUnique({
      where: { id: companyId },
      select: { id: true, companyName: true },
    })
    expect(companyProfile).toBeTruthy()
    expect(companyProfile!.id).toBe(companyId)
  })
})
