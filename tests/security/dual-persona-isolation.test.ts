import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { resolveQuoteVisibility } from '@/lib/phase6/quote-visibility'
import { requiresPostgres } from '../helpers/test-guard'

const prisma = new PrismaClient()

describe.skipIf(!requiresPostgres())('Phase 6.6 — Strict Dual-Persona Quote Isolation', () => {
  let companyAId: string, companyBId: string
  let ownerAId: string, ownerBId: string
  let dualPersonaUserId: string
  let individualOnlyUserId: string
  let unrelatedUserId: string
  let customerId: string
  let jobId: string

  beforeAll(async () => {
    const ts = Date.now()

    const customer = await prisma.user.create({
      data: { email: `dp-customer-${ts}@test.com`, passwordHash: 'hash', name: 'Customer', role: 'USER', identityStatus: 'VERIFIED' },
    })
    customerId = customer.id

    const ownerA = await prisma.user.create({
      data: { email: `dp-ownerA-${ts}@test.com`, passwordHash: 'hash', name: 'OwnerA', role: 'COMPANY', identityStatus: 'VERIFIED' },
    })
    ownerAId = ownerA.id
    const companyA = await prisma.companyProfile.create({
      data: { userId: ownerAId, companyName: `DP CoA ${ts}`, services: '[]', serviceAreas: '[]', isVerified: true, verificationStatus: 'VERIFIED' },
    })
    companyAId = companyA.id
    await prisma.teamMember.create({
      data: { companyId: companyAId, userId: ownerAId, name: 'OwnerA', role: 'COMPANY_OWNER', skills: '[]', status: 'ACTIVE' },
    })

    const ownerB = await prisma.user.create({
      data: { email: `dp-ownerB-${ts}@test.com`, passwordHash: 'hash', name: 'OwnerB', role: 'COMPANY', identityStatus: 'VERIFIED' },
    })
    ownerBId = ownerB.id
    const companyB = await prisma.companyProfile.create({
      data: { userId: ownerBId, companyName: `DP CoB ${ts}`, services: '[]', serviceAreas: '[]', isVerified: true, verificationStatus: 'VERIFIED' },
    })
    companyBId = companyB.id
    await prisma.teamMember.create({
      data: { companyId: companyBId, userId: ownerBId, name: 'OwnerB', role: 'COMPANY_OWNER', skills: '[]', status: 'ACTIVE' },
    })

    const dualUser = await prisma.user.create({
      data: { email: `dp-dual-${ts}@test.com`, passwordHash: 'hash', name: 'DualPersona', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    dualPersonaUserId = dualUser.id
    await prisma.teamMember.create({
      data: { companyId: companyAId, userId: dualPersonaUserId, name: 'DualA', role: 'DISPATCHER', skills: '[]', status: 'ACTIVE' },
    })

    const indivOnly = await prisma.user.create({
      data: { email: `dp-indivonly-${ts}@test.com`, passwordHash: 'hash', name: 'IndivOnly', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    individualOnlyUserId = indivOnly.id

    const unrelated = await prisma.user.create({
      data: { email: `dp-unrelated-${ts}@test.com`, passwordHash: 'hash', name: 'Unrelated', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    unrelatedUserId = unrelated.id

    const job = await prisma.marketplaceJob.create({
      data: { customerId, title: 'DP Job', description: 'Test', categoryId: 'test-cat', photos: '[]', budgetType: 'FIXED', budgetAmount: 10000n, status: 'OPEN' },
    })
    jobId = job.id

    await prisma.jobQuote.create({
      data: { jobId, providerId: companyAId, providerType: 'COMPANY', price: 5000n, actorUserId: ownerAId, actorRole: 'COMPANY_OWNER', estimatedCompletionTime: '2h', attachments: '[]' },
    })
    await prisma.jobQuote.create({
      data: { jobId, providerId: companyBId, providerType: 'COMPANY', price: 6000n, actorUserId: ownerBId, actorRole: 'COMPANY_OWNER', estimatedCompletionTime: '3h', attachments: '[]' },
    })
    await prisma.jobQuote.create({
      data: { jobId, providerId: individualOnlyUserId, providerType: 'INDIVIDUAL', price: 4000n, estimatedCompletionTime: '1h', attachments: '[]' },
    })
    await prisma.jobQuote.create({
      data: { jobId, providerId: dualPersonaUserId, providerType: 'INDIVIDUAL', price: 3500n, estimatedCompletionTime: '1h', attachments: '[]' },
    })
  })

  afterAll(async () => {
    await prisma.jobQuote.deleteMany({ where: { jobId } })
    await prisma.marketplaceJob.delete({ where: { id: jobId } }).catch(() => {})
    await prisma.teamMember.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } })
    await prisma.companyProfile.deleteMany({ where: { id: { in: [companyAId, companyBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerAId, ownerBId, dualPersonaUserId, individualOnlyUserId, unrelatedUserId, customerId] } } }).catch(() => {})
  })

  it('individual-only user, no companyId → individual quote only', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: individualOnlyUserId, jobId })
    expect(result.isCustomer).toBe(false)
    expect(result.allowedQuoteIds.length).toBe(1)
    const quote = await prisma.jobQuote.findUnique({ where: { id: result.allowedQuoteIds[0] } })
    expect(quote?.providerType).toBe('INDIVIDUAL')
    expect(quote?.providerId).toBe(individualOnlyUserId)
  })

  it('company A member with companyId=A → A company quote only', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: ownerAId, jobId, companyId: companyAId })
    expect(result.isCustomer).toBe(false)
    expect(result.allowedQuoteIds.length).toBe(1)
    const quote = await prisma.jobQuote.findUnique({ where: { id: result.allowedQuoteIds[0] } })
    expect(quote?.providerId).toBe(companyAId)
    expect(quote?.providerType).toBe('COMPANY')
  })

  it('company A CANNOT see company B quote', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: ownerAId, jobId, companyId: companyAId })
    for (const qid of result.allowedQuoteIds) {
      const quote = await prisma.jobQuote.findUnique({ where: { id: qid } })
      expect(quote?.providerId).not.toBe(companyBId)
    }
  })

  it('company B CANNOT see company A quote', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: ownerBId, jobId, companyId: companyBId })
    for (const qid of result.allowedQuoteIds) {
      const quote = await prisma.jobQuote.findUnique({ where: { id: qid } })
      expect(quote?.providerId).not.toBe(companyAId)
    }
  })

  it('DUAL-PERSONA: companyId=A → Company A quote ONLY (no individual)', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: dualPersonaUserId, jobId, companyId: companyAId })
    expect(result.isCustomer).toBe(false)
    expect(result.allowedQuoteIds.length).toBe(1)
    const quote = await prisma.jobQuote.findUnique({ where: { id: result.allowedQuoteIds[0] } })
    expect(quote?.providerId).toBe(companyAId)
    expect(quote?.providerType).toBe('COMPANY')
  })

  it('DUAL-PERSONA: no companyId → individual quote ONLY (no company)', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: dualPersonaUserId, jobId })
    expect(result.isCustomer).toBe(false)
    expect(result.allowedQuoteIds.length).toBe(1)
    const quote = await prisma.jobQuote.findUnique({ where: { id: result.allowedQuoteIds[0] } })
    expect(quote?.providerId).toBe(dualPersonaUserId)
    expect(quote?.providerType).toBe('INDIVIDUAL')
  })

  it('unrelated user → 403 (empty allowed)', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: unrelatedUserId, jobId })
    expect(result.isCustomer).toBe(false)
    expect(result.allowedQuoteIds.length).toBe(0)
  })

  it('customer → sees all quotes', async () => {
    const result = await resolveQuoteVisibility(prisma, { userId: customerId, jobId })
    expect(result.isCustomer).toBe(true)
  })
})
