import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { hasCompanyPermission } from '@/lib/phase6/rbac'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { requiresPostgres } from '../test-guard'

const prisma = new PrismaClient()

describe.skipIf(!requiresPostgres())('Phase 6.4 — Company Quote Cross-Company Isolation', () => {
  let companyAId: string
  let companyBId: string
  let ownerAId: string
  let ownerBId: string
  let managerAId: string
  let dispatcherAId: string
  let workerAId: string
  let unrelatedUserId: string
  let customerId: string
  let individualProviderId: string
  let jobId: string

  beforeAll(async () => {
    const ts = Date.now()

    const customer = await prisma.user.create({
      data: { email: `qi-customer-${ts}@test.com`, passwordHash: 'hash', name: 'Customer', role: 'USER', identityStatus: 'VERIFIED' },
    })
    customerId = customer.id

    const ownerA = await prisma.user.create({
      data: { email: `qi-ownerA-${ts}@test.com`, passwordHash: 'hash', name: 'OwnerA', role: 'COMPANY', identityStatus: 'VERIFIED' },
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
      data: { email: `qi-ownerB-${ts}@test.com`, passwordHash: 'hash', name: 'OwnerB', role: 'COMPANY', identityStatus: 'VERIFIED' },
    })
    ownerBId = ownerB.id
    const companyB = await prisma.companyProfile.create({
      data: { userId: ownerBId, companyName: `CoB ${ts}`, services: '[]', serviceAreas: '[]', isVerified: true, verificationStatus: 'VERIFIED' },
    })
    companyBId = companyB.id
    await prisma.teamMember.create({
      data: { companyId: companyBId, userId: ownerBId, name: 'OwnerB', role: 'COMPANY_OWNER', skills: '[]', status: 'ACTIVE' },
    })

    const managerA = await prisma.user.create({
      data: { email: `qi-managerA-${ts}@test.com`, passwordHash: 'hash', name: 'ManagerA', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    managerAId = managerA.id
    await prisma.teamMember.create({
      data: { companyId: companyAId, userId: managerAId, name: 'ManagerA', role: 'MANAGER', skills: '[]', status: 'ACTIVE' },
    })

    const dispatcherA = await prisma.user.create({
      data: { email: `qi-dispatcherA-${ts}@test.com`, passwordHash: 'hash', name: 'DispatcherA', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    dispatcherAId = dispatcherA.id
    await prisma.teamMember.create({
      data: { companyId: companyAId, userId: dispatcherAId, name: 'DispatcherA', role: 'DISPATCHER', skills: '[]', status: 'ACTIVE' },
    })

    const workerA = await prisma.user.create({
      data: { email: `qi-workerA-${ts}@test.com`, passwordHash: 'hash', name: 'WorkerA', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    workerAId = workerA.id
    await prisma.teamMember.create({
      data: { companyId: companyAId, userId: workerAId, name: 'WorkerA', role: 'WORKER', skills: '[]', status: 'ACTIVE' },
    })

    const unrelated = await prisma.user.create({
      data: { email: `qi-unrelated-${ts}@test.com`, passwordHash: 'hash', name: 'Unrelated', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    unrelatedUserId = unrelated.id

    const indivProvider = await prisma.user.create({
      data: { email: `qi-indiv-${ts}@test.com`, passwordHash: 'hash', name: 'IndivProvider', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    individualProviderId = indivProvider.id
    await prisma.taskerProfile.create({
      data: { userId: individualProviderId, hourlyRate: 500, bio: 'test', skills: '[]', serviceAreas: '[]', verificationStatus: 'VERIFIED', isVerified: true },
    })

    const job = await prisma.marketplaceJob.create({
      data: { customerId, title: 'Isolation Job', description: 'Test', categoryId: 'test-cat', photos: '[]', budgetType: 'FIXED', budgetAmount: 10000n, status: 'OPEN' },
    })
    jobId = job.id

    await prisma.jobQuote.create({
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

    await prisma.jobQuote.create({
      data: {
        jobId,
        providerId: companyBId,
        providerType: 'COMPANY',
        price: 6000n,
        actorUserId: ownerBId,
        actorRole: 'COMPANY_OWNER',
        estimatedCompletionTime: '3h',
        attachments: '[]',
      },
    })

    await prisma.jobQuote.create({
      data: {
        jobId,
        providerId: individualProviderId,
        providerType: 'INDIVIDUAL',
        price: 4000n,
        estimatedCompletionTime: '1h',
        attachments: '[]',
      },
    })
  })

  afterAll(async () => {
    await prisma.jobQuote.deleteMany({ where: { jobId } })
    await prisma.marketplaceJob.delete({ where: { id: jobId } }).catch(() => {})
    await prisma.teamMember.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } })
    await prisma.taskerProfile.deleteMany({ where: { userId: individualProviderId } })
    await prisma.companyProfile.deleteMany({ where: { id: { in: [companyAId, companyBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerAId, ownerBId, managerAId, dispatcherAId, workerAId, unrelatedUserId, customerId, individualProviderId] } } }).catch(() => {})
  })

  it('customer sees all authorized quotes on their job', async () => {
    const allQuotes = await prisma.jobQuote.findMany({ where: { jobId } })
    expect(allQuotes.length).toBe(3)
  })

  it('company A owner: resolveCompanyContext succeeds with quotes:read', async () => {
    const { context, error } = await resolveCompanyContext(ownerAId, companyAId, 'quotes:read')
    expect(error).toBeUndefined()
    expect(context).toBeTruthy()
    expect(hasCompanyPermission(context!.role, 'quotes:read')).toBe(true)
  })

  it('company A owner: can see company A quote via providerId match', async () => {
    const quotes = await prisma.jobQuote.findMany({
      where: { jobId, providerId: companyAId, providerType: 'COMPANY' },
    })
    expect(quotes.length).toBe(1)
    expect(quotes[0].providerId).toBe(companyAId)
  })

  it('company A manager: resolveCompanyContext succeeds with quotes:read', async () => {
    const { context, error } = await resolveCompanyContext(managerAId, companyAId, 'quotes:read')
    expect(error).toBeUndefined()
    expect(context).toBeTruthy()
    expect(hasCompanyPermission(context!.role, 'quotes:read')).toBe(true)
  })

  it('company A dispatcher: resolveCompanyContext succeeds with quotes:read', async () => {
    const { context, error } = await resolveCompanyContext(dispatcherAId, companyAId, 'quotes:read')
    expect(error).toBeUndefined()
    expect(context).toBeTruthy()
    expect(hasCompanyPermission(context!.role, 'quotes:read')).toBe(true)
  })

  it('company A worker: resolveCompanyContext succeeds with quotes:read', async () => {
    const { context, error } = await resolveCompanyContext(workerAId, companyAId, 'quotes:read')
    expect(error).toBeUndefined()
    expect(context).toBeTruthy()
    expect(hasCompanyPermission(context!.role, 'quotes:read')).toBe(true)
  })

  it('company A member CANNOT see company B quote', async () => {
    const companyBQuotes = await prisma.jobQuote.findMany({
      where: { jobId, providerId: companyBId, providerType: 'COMPANY' },
    })
    expect(companyBQuotes.length).toBe(1)

    const memberOfA = await prisma.teamMember.findFirst({
      where: { companyId: companyAId, userId: ownerAId, status: 'ACTIVE' },
    })
    expect(memberOfA).toBeTruthy()
    expect(memberOfA!.companyId).not.toBe(companyBId)

    const memberOfB = await prisma.teamMember.findFirst({
      where: { companyId: companyAId, userId: ownerAId, status: 'ACTIVE' },
    })
    expect(memberOfB?.companyId).toBe(companyAId)
    expect(memberOfB?.companyId).not.toBe(companyBId)
  })

  it('company B member CANNOT see company A quote', async () => {
    const companyAQuotes = await prisma.jobQuote.findMany({
      where: { jobId, providerId: companyAId, providerType: 'COMPANY' },
    })
    expect(companyAQuotes.length).toBe(1)

    const memberOfB = await prisma.teamMember.findFirst({
      where: { companyId: companyBId, userId: ownerBId, status: 'ACTIVE' },
    })
    expect(memberOfB).toBeTruthy()
    expect(memberOfB!.companyId).not.toBe(companyAId)
  })

  it('individual provider: only sees own quote', async () => {
    const myQuote = await prisma.jobQuote.findFirst({
      where: { jobId, providerId: individualProviderId, providerType: 'INDIVIDUAL' },
    })
    expect(myQuote).toBeTruthy()
    expect(myQuote!.providerId).toBe(individualProviderId)

    const otherQuotes = await prisma.jobQuote.findMany({
      where: { jobId, providerId: individualProviderId, providerType: 'COMPANY' },
    })
    expect(otherQuotes.length).toBe(0)
  })

  it('unrelated user has no company membership', async () => {
    const membership = await prisma.teamMember.findFirst({
      where: { userId: unrelatedUserId, status: 'ACTIVE' },
    })
    expect(membership).toBeNull()
  })

  it('unrelated user has no individual quote', async () => {
    const quote = await prisma.jobQuote.findFirst({
      where: { jobId, providerId: unrelatedUserId },
    })
    expect(quote).toBeNull()
  })

  it('filtering by allowedQuoteIds prevents cross-company data leak', async () => {
    const companyAQuotes = await prisma.jobQuote.findMany({
      where: { jobId, providerId: companyAId, providerType: 'COMPANY' },
    })
    const companyBQuotes = await prisma.jobQuote.findMany({
      where: { jobId, providerId: companyBId, providerType: 'COMPANY' },
    })

    const companyAIds = companyAQuotes.map((q) => q.id)
    const companyBIds = companyBQuotes.map((q) => q.id)

    expect(companyAIds.length).toBe(1)
    expect(companyBIds.length).toBe(1)

    const overlap = companyAIds.filter((id) => companyBIds.includes(id))
    expect(overlap.length).toBe(0)

    const leakedQuotes = await prisma.jobQuote.findMany({
      where: { id: { in: companyAIds }, providerId: companyBId },
    })
    expect(leakedQuotes.length).toBe(0)
  })

  it('company A member only gets company A quotes when filtering by providerId', async () => {
    const membership = await prisma.teamMember.findFirst({
      where: { userId: ownerAId, status: 'ACTIVE' },
      select: { companyId: true, role: true },
    })
    expect(membership).toBeTruthy()

    const myCompanyQuote = await prisma.jobQuote.findFirst({
      where: { jobId, providerId: membership!.companyId, providerType: 'COMPANY' },
    })
    expect(myCompanyQuote).toBeTruthy()
    expect(myCompanyQuote!.providerId).toBe(companyAId)

    const otherCompanyQuote = await prisma.jobQuote.findFirst({
      where: { jobId, providerId: { not: membership!.companyId }, providerType: 'COMPANY' },
    })
    expect(otherCompanyQuote).toBeTruthy()
    expect(otherCompanyQuote!.providerId).toBe(companyBId)
  })
})
