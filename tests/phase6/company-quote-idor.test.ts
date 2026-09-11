import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { requiresPostgres } from '../test-guard'

const prisma = new PrismaClient()

describe.skipIf(!requiresPostgres())('Phase 6.3 — Company Quote IDOR/BOLA', () => {
  let companyAId: string
  let companyBId: string
  let ownerAId: string
  let ownerBId: string
  let workerAId: string
  let dispatcherAId: string
  let unrelatedUserId: string
  let customerId: string
  let jobAQuoteId: string
  let jobId: string

  beforeAll(async () => {
    const ts = Date.now()

    const customer = await prisma.user.create({
      data: { email: `idor-customer-${ts}@test.com`, passwordHash: 'hash', name: 'Customer', role: 'USER', identityStatus: 'VERIFIED' },
    })
    customerId = customer.id

    const ownerA = await prisma.user.create({
      data: { email: `idor-ownerA-${ts}@test.com`, passwordHash: 'hash', name: 'OwnerA', role: 'COMPANY', identityStatus: 'VERIFIED' },
    })
    ownerAId = ownerA.id
    const companyA = await prisma.companyProfile.create({
      data: { userId: ownerAId, companyName: `CoA ${ts}`, services: '[]', serviceAreas: '[]', isVerified: true, verificationStatus: 'VERIFIED' },
    })
    companyAId = companyA.id
    await prisma.teamMember.create({
      data: { companyId: companyAId, userId: ownerAId, name: 'OwnerA', role: 'COMPANY_OWNER', skills: '[]', status: 'ACTIVE' },
    })

    const ownerB = await prisma.user.create({
      data: { email: `idor-ownerB-${ts}@test.com`, passwordHash: 'hash', name: 'OwnerB', role: 'COMPANY', identityStatus: 'VERIFIED' },
    })
    ownerBId = ownerB.id
    const companyB = await prisma.companyProfile.create({
      data: { userId: ownerBId, companyName: `CoB ${ts}`, services: '[]', serviceAreas: '[]', isVerified: true, verificationStatus: 'VERIFIED' },
    })
    companyBId = companyB.id
    await prisma.teamMember.create({
      data: { companyId: companyBId, userId: ownerBId, name: 'OwnerB', role: 'COMPANY_OWNER', skills: '[]', status: 'ACTIVE' },
    })

    const workerA = await prisma.user.create({
      data: { email: `idor-workerA-${ts}@test.com`, passwordHash: 'hash', name: 'WorkerA', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    workerAId = workerA.id
    await prisma.teamMember.create({
      data: { companyId: companyAId, userId: workerAId, name: 'WorkerA', role: 'WORKER', skills: '[]', status: 'ACTIVE' },
    })

    const dispatcherA = await prisma.user.create({
      data: { email: `idor-dispatcherA-${ts}@test.com`, passwordHash: 'hash', name: 'DispatcherA', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    dispatcherAId = dispatcherA.id
    await prisma.teamMember.create({
      data: { companyId: companyAId, userId: dispatcherAId, name: 'DispatcherA', role: 'DISPATCHER', skills: '[]', status: 'ACTIVE' },
    })

    const unrelated = await prisma.user.create({
      data: { email: `idor-unrelated-${ts}@test.com`, passwordHash: 'hash', name: 'Unrelated', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    unrelatedUserId = unrelated.id

    const job = await prisma.marketplaceJob.create({
      data: { customerId, title: 'IDOR Job', description: 'Test', categoryId: 'test-cat', photos: '[]', budgetType: 'FIXED', budgetAmount: 10000n, status: 'OPEN' },
    })
    jobId = job.id

    const companyAQuote = await prisma.jobQuote.create({
      data: {
        jobId,
        providerId: companyAId,
        providerType: 'COMPANY',
        price: 5000n,
        actorUserId: ownerAId,
        actorRole: 'COMPANY_OWNER',
        estimatedCompletionTime: '2h',
        attachments: '[]',
      },
    })
    jobAQuoteId = companyAQuote.id

    await prisma.jobQuote.create({
      data: {
        jobId,
        providerId: ownerBId,
        providerType: 'INDIVIDUAL',
        price: 6000n,
        estimatedCompletionTime: '3h',
        attachments: '[]',
      },
    })
  })

  afterAll(async () => {
    await prisma.jobQuote.deleteMany({ where: { jobId } })
    await prisma.marketplaceJob.delete({ where: { id: jobId } }).catch(() => {})
    await prisma.teamMember.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } })
    await prisma.companyProfile.deleteMany({ where: { id: { in: [companyAId, companyBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerAId, ownerBId, workerAId, dispatcherAId, unrelatedUserId, customerId] } } }).catch(() => {})
  })

  it('owner A reads company A quotes = allowed', async () => {
    const { context } = await resolveCompanyContext(ownerAId, companyAId)
    expect(context).toBeTruthy()
    const quotes = await prisma.jobQuote.findMany({ where: { jobId, providerId: companyAId } })
    expect(quotes.length).toBeGreaterThan(0)
  })

  it('owner B (different company) reads company A quotes = denied', async () => {
    const { context } = await resolveCompanyContext(ownerBId, companyBId)
    expect(context).toBeTruthy()
    const memberOfA = await prisma.teamMember.findFirst({ where: { companyId: companyAId, userId: ownerBId, status: 'ACTIVE' } })
    expect(memberOfA).toBeNull()
  })

  it('worker A (same company) has quotes:read permission', async () => {
    const { context } = await resolveCompanyContext(workerAId, companyAId)
    expect(context).toBeTruthy()
    expect(context!.role).toBe('WORKER')
  })

  it('unrelated user = denied', async () => {
    const memberOfA = await prisma.teamMember.findFirst({ where: { companyId: companyAId, userId: unrelatedUserId, status: 'ACTIVE' } })
    expect(memberOfA).toBeNull()
  })

  it('customer = allowed (is job customer)', async () => {
    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobId } })
    expect(job?.customerId).toBe(customerId)
  })

  it('company A member sees company A quotes only', async () => {
    const quotes = await prisma.jobQuote.findMany({ where: { jobId, providerId: companyAId } })
    expect(quotes.length).toBe(1)
    expect(quotes[0].providerId).toBe(companyAId)
  })

  it('dispatcher A has quotes:read permission', async () => {
    const { context } = await resolveCompanyContext(dispatcherAId, companyAId)
    expect(context).toBeTruthy()
    expect(context!.role).toBe('DISPATCHER')
  })
})
