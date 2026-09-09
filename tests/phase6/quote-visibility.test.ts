import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { resolveQuoteVisibility } from '@/lib/phase6/quote-visibility'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { hasCompanyPermission } from '@/lib/phase6/rbac'

const prisma = new PrismaClient()

describe('Phase 6.5 — Quote Visibility Service (Canonical)', () => {
  let companyAId: string
  let companyBId: string
  let ownerAId: string
  let ownerBId: string
  let managerAId: string
  let dispatcherAId: string
  let workerAId: string
  let multiCompanyUserId: string
  let unrelatedUserId: string
  let customerId: string
  let individualProviderId: string
  let jobId: string

  beforeAll(async () => {
    const ts = Date.now()

    const customer = await prisma.user.create({
      data: { email: `qv-customer-${ts}@test.com`, passwordHash: 'hash', name: 'Customer', role: 'USER', identityStatus: 'VERIFIED' },
    })
    customerId = customer.id

    const ownerA = await prisma.user.create({
      data: { email: `qv-ownerA-${ts}@test.com`, passwordHash: 'hash', name: 'OwnerA', role: 'COMPANY', identityStatus: 'VERIFIED' },
    })
    ownerAId = ownerA.id
    const companyA = await prisma.companyProfile.create({
      data: { userId: ownerAId, companyName: `QVA ${ts}`, services: '[]', serviceAreas: '[]', isVerified: true, verificationStatus: 'VERIFIED' },
    })
    companyAId = companyA.id
    await prisma.teamMember.create({
      data: { companyId: companyAId, userId: ownerAId, name: 'OwnerA', role: 'COMPANY_OWNER', skills: '[]', status: 'ACTIVE' },
    })

    const ownerB = await prisma.user.create({
      data: { email: `qv-ownerB-${ts}@test.com`, passwordHash: 'hash', name: 'OwnerB', role: 'COMPANY', identityStatus: 'VERIFIED' },
    })
    ownerBId = ownerB.id
    const companyB = await prisma.companyProfile.create({
      data: { userId: ownerBId, companyName: `QVB ${ts}`, services: '[]', serviceAreas: '[]', isVerified: true, verificationStatus: 'VERIFIED' },
    })
    companyBId = companyB.id
    await prisma.teamMember.create({
      data: { companyId: companyBId, userId: ownerBId, name: 'OwnerB', role: 'COMPANY_OWNER', skills: '[]', status: 'ACTIVE' },
    })

    const managerA = await prisma.user.create({
      data: { email: `qv-managerA-${ts}@test.com`, passwordHash: 'hash', name: 'ManagerA', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    managerAId = managerA.id
    await prisma.teamMember.create({
      data: { companyId: companyAId, userId: managerAId, name: 'ManagerA', role: 'MANAGER', skills: '[]', status: 'ACTIVE' },
    })

    const dispatcherA = await prisma.user.create({
      data: { email: `qv-dispatcherA-${ts}@test.com`, passwordHash: 'hash', name: 'DispatcherA', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    dispatcherAId = dispatcherA.id
    await prisma.teamMember.create({
      data: { companyId: companyAId, userId: dispatcherAId, name: 'DispatcherA', role: 'DISPATCHER', skills: '[]', status: 'ACTIVE' },
    })

    const workerA = await prisma.user.create({
      data: { email: `qv-workerA-${ts}@test.com`, passwordHash: 'hash', name: 'WorkerA', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    workerAId = workerA.id
    await prisma.teamMember.create({
      data: { companyId: companyAId, userId: workerAId, name: 'WorkerA', role: 'WORKER', skills: '[]', status: 'ACTIVE' },
    })

    const multiUser = await prisma.user.create({
      data: { email: `qv-multi-${ts}@test.com`, passwordHash: 'hash', name: 'MultiCompany', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    multiCompanyUserId = multiUser.id
    await prisma.teamMember.create({
      data: { companyId: companyAId, userId: multiCompanyUserId, name: 'MultiA', role: 'DISPATCHER', skills: '[]', status: 'ACTIVE' },
    })
    await prisma.teamMember.create({
      data: { companyId: companyBId, userId: multiCompanyUserId, name: 'MultiB', role: 'WORKER', skills: '[]', status: 'ACTIVE' },
    })

    const unrelated = await prisma.user.create({
      data: { email: `qv-unrelated-${ts}@test.com`, passwordHash: 'hash', name: 'Unrelated', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    unrelatedUserId = unrelated.id

    const indivProvider = await prisma.user.create({
      data: { email: `qv-indiv-${ts}@test.com`, passwordHash: 'hash', name: 'IndivProvider', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    individualProviderId = indivProvider.id

    const job = await prisma.marketplaceJob.create({
      data: { customerId, title: 'QV Job', description: 'Test', categoryId: 'test-cat', photos: '[]', budgetType: 'FIXED', budgetAmount: 10000n, status: 'OPEN' },
    })
    jobId = job.id

    await prisma.jobQuote.create({
      data: { jobId, providerId: companyAId, providerType: 'COMPANY', price: 5000n, actorUserId: ownerAId, actorRole: 'COMPANY_OWNER', estimatedCompletionTime: '2h', attachments: '[]' },
    })
    await prisma.jobQuote.create({
      data: { jobId, providerId: companyBId, providerType: 'COMPANY', price: 6000n, actorUserId: ownerBId, actorRole: 'COMPANY_OWNER', estimatedCompletionTime: '3h', attachments: '[]' },
    })
    await prisma.jobQuote.create({
      data: { jobId, providerId: individualProviderId, providerType: 'INDIVIDUAL', price: 4000n, estimatedCompletionTime: '1h', attachments: '[]' },
    })
  })

  afterAll(async () => {
    await prisma.jobQuote.deleteMany({ where: { jobId } })
    await prisma.marketplaceJob.delete({ where: { id: jobId } }).catch(() => {})
    await prisma.teamMember.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } })
    await prisma.taskerProfile.deleteMany({ where: { userId: individualProviderId } })
    await prisma.companyProfile.deleteMany({ where: { id: { in: [companyAId, companyBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerAId, ownerBId, managerAId, dispatcherAId, workerAId, multiCompanyUserId, unrelatedUserId, customerId, individualProviderId] } } }).catch(() => {})
  })

  it('customer sees all quotes (empty allowedQuoteIds + isCustomer=true)', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: customerId, jobId })
    expect(result.isCustomer).toBe(true)
  })

  it('individual provider sees own quote only', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: individualProviderId, jobId })
    expect(result.isCustomer).toBe(false)
    expect(result.allowedQuoteIds.length).toBe(1)

    const quote = await prisma.jobQuote.findUnique({ where: { id: result.allowedQuoteIds[0] } })
    expect(quote?.providerId).toBe(individualProviderId)
    expect(quote?.providerType).toBe('INDIVIDUAL')
  })

  it('company A OWNER with companyId=A sees A quote only', async () => {
    const { context } = await resolveCompanyContext(ownerAId, companyAId, 'quotes:read')
    expect(context).toBeTruthy()

    const result = await resolveQuoteVisibility(prisma, { userId: ownerAId, jobId, companyId: companyAId })
    expect(result.isCustomer).toBe(false)
    expect(result.allowedQuoteIds.length).toBe(1)

    const quote = await prisma.jobQuote.findUnique({ where: { id: result.allowedQuoteIds[0] } })
    expect(quote?.providerId).toBe(companyAId)
  })

  it('company A MANAGER with companyId=A sees A quote only', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: managerAId, jobId, companyId: companyAId })
    expect(result.allowedQuoteIds.length).toBe(1)

    const quote = await prisma.jobQuote.findUnique({ where: { id: result.allowedQuoteIds[0] } })
    expect(quote?.providerId).toBe(companyAId)
  })

  it('company A DISPATCHER with companyId=A sees A quote only', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: dispatcherAId, jobId, companyId: companyAId })
    expect(result.allowedQuoteIds.length).toBe(1)

    const quote = await prisma.jobQuote.findUnique({ where: { id: result.allowedQuoteIds[0] } })
    expect(quote?.providerId).toBe(companyAId)
  })

  it('company A WORKER with companyId=A has quotes:read', async () => {
    const { context } = await resolveCompanyContext(workerAId, companyAId, 'quotes:read')
    expect(context).toBeTruthy()
    expect(hasCompanyPermission(context!.role, 'quotes:read')).toBe(true)

    const result = await resolveQuoteVisibility(prisma, { userId: workerAId, jobId, companyId: companyAId })
    expect(result.allowedQuoteIds.length).toBe(1)
  })

  it('company A CANNOT see company B quote', async () => {
    const resultA = await resolveQuoteVisibility(prisma, { userId: ownerAId, jobId, companyId: companyAId })
    for (const qid of resultA.allowedQuoteIds) {
      const quote = await prisma.jobQuote.findUnique({ where: { id: qid } })
      expect(quote?.providerId).not.toBe(companyBId)
    }
  })

  it('company B CANNOT see company A quote', async () => {
    const resultB = await resolveQuoteVisibility(prisma, { userId: ownerBId, jobId, companyId: companyBId })
    for (const qid of resultB.allowedQuoteIds) {
      const quote = await prisma.jobQuote.findUnique({ where: { id: qid } })
      expect(quote?.providerId).not.toBe(companyAId)
    }
  })

  it('multi-company user: companyId=A sees A only', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: multiCompanyUserId, jobId, companyId: companyAId })
    expect(result.allowedQuoteIds.length).toBe(1)

    const quote = await prisma.jobQuote.findUnique({ where: { id: result.allowedQuoteIds[0] } })
    expect(quote?.providerId).toBe(companyAId)
  })

  it('multi-company user: companyId=B sees B only', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: multiCompanyUserId, jobId, companyId: companyBId })
    expect(result.allowedQuoteIds.length).toBe(1)

    const quote = await prisma.jobQuote.findUnique({ where: { id: result.allowedQuoteIds[0] } })
    expect(quote?.providerId).toBe(companyBId)
  })

  it('multi-company user without companyId: sees nothing (no company context)', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: multiCompanyUserId, jobId })
    expect(result.isCustomer).toBe(false)
    expect(result.allowedQuoteIds.length).toBe(0)
  })

  it('unrelated user without companyId: 403 equivalent (empty allowed)', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: unrelatedUserId, jobId })
    expect(result.isCustomer).toBe(false)
    expect(result.allowedQuoteIds.length).toBe(0)
  })

  it('no companyId param for company member: no company quotes returned', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: ownerAId, jobId })
    expect(result.isCustomer).toBe(false)
    const companyQuotes = result.allowedQuoteIds.filter(async (id) => {
      const q = await prisma.jobQuote.findUnique({ where: { id } })
      return q?.providerType === 'COMPANY'
    })
    expect(result.allowedQuoteIds.length).toBe(0)
  })
})
