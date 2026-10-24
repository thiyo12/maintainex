import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { acceptJobQuote } from '@/lib/domain/job-lifecycle'
import { requiresPostgres } from '../helpers/test-guard'

describe.skipIf(!requiresPostgres())('quote acceptance exact-service authority (PostgreSQL)', () => {
  const db = new PrismaClient()
  const prefix = `accept-exact-${randomUUID()}`
  const customer = `${prefix}-customer`, provider = `${prefix}-provider`, owner = `${prefix}-owner`
  const category = `${prefix}-category`, selected = `${prefix}-selected`, sibling = `${prefix}-sibling`
  const company = `${prefix}-company`
  const jobs: string[] = []

  beforeAll(async () => {
    await db.user.createMany({ data: [customer, provider, owner].map(id => ({
      id, email: `${id}@example.invalid`, name: 'Isolated service fixture', passwordHash: 'test-only',
      role: id === customer ? 'CUSTOMER' : id === owner ? 'COMPANY' : 'TASKER',
      countryCode: 'LK', identityStatus: 'VERIFIED',
    })) })
    await db.jobCategory.create({ data: {
      id: category, name: category, slug: category, iconName: 'wrench', colorHex: '#123456', countries: '["LK"]',
    } })
    await db.templateJob.createMany({ data: [selected, sibling].map(id => ({
      id, categoryId: category, name: id, description: 'Isolated exact-service test',
      whatIsIncluded: '[]', typicalDurationMinutes: 60, priceMin: 100, priceMax: 100,
      countries: '["LK"]', currency: 'LKR',
    })) })
    await db.serviceTemplate.create({ data: {
      id: `${prefix}-linked`, jobCategoryId: category, templateJobId: sibling,
      name: 'Linked sibling service', slug: `${prefix}-linked`, description: 'Isolated linked fixture',
      questionsJson: '[]', defaultDurationMinutes: 60, priceMin: 100, priceMax: 100,
      countryCode: 'LK', currency: 'LKR',
    } })
    const profile = await db.taskerProfile.create({ data: {
      userId: provider, skills: '[]', verificationStatus: 'VERIFIED', isVerified: true,
    } })
    await db.taskerSkill.create({ data: { taskerId: profile.id, jobId: selected } })
    await db.companyProfile.create({ data: {
      id: company, userId: owner, companyName: company, services: '[]', serviceAreas: '[]',
      verificationStatus: 'VERIFIED', isVerified: true,
    } })
    await db.teamMember.create({ data: {
      companyId: company, userId: owner, name: 'Fixture owner', role: 'COMPANY_OWNER', skills: '[]',
    } })
    await db.companySpecialty.create({ data: { companyId: company, jobId: selected } })
  })

  afterAll(async () => {
    try {
      const where = { jobId: { in: jobs } }
      await db.jobEscrow.deleteMany({ where })
      await db.jobWorkspace.deleteMany({ where })
      await db.jobLifecycleEvent.deleteMany({ where })
      await db.jobQuote.deleteMany({ where })
      await db.marketplaceJob.deleteMany({ where: { id: { in: jobs } } })
      await db.companySpecialty.deleteMany({ where: { companyId: company } })
      await db.teamMember.deleteMany({ where: { companyId: company } })
      await db.companyProfile.deleteMany({ where: { id: company } })
      await db.taskerSkill.deleteMany({ where: { jobId: selected } })
      await db.taskerProfile.deleteMany({ where: { userId: provider } })
      await db.serviceTemplate.deleteMany({ where: { id: `${prefix}-linked` } })
      await db.templateJob.deleteMany({ where: { id: { in: [selected, sibling] } } })
      await db.jobCategory.deleteMany({ where: { id: category } })
      await db.user.deleteMany({ where: { id: { in: [customer, provider, owner] } } })
    } finally { await db.$disconnect() }
  })

  it.each([
    ['INDIVIDUAL', false], ['COMPANY', false],
    ['INDIVIDUAL', true], ['COMPANY', true],
  ] as const)('%s cannot accept a sibling service (linked template: %s)', async (providerType, linked) => {
    const job = await db.marketplaceJob.create({ data: {
      customerId: customer, title: 'Sibling service', description: 'Isolated fixture', categoryId: category,
      templateJobId: linked ? null : sibling, serviceTemplateId: linked ? `${prefix}-linked` : null,
      countryCode: 'LK', photos: '[]', budgetType: 'REQUEST_QUOTES', status: 'OPEN',
    } })
    jobs.push(job.id)
    const quote = await db.jobQuote.create({ data: {
      jobId: job.id, providerId: providerType === 'COMPANY' ? company : provider, providerType,
      price: 10000n, currency: 'LKR', estimatedCompletionTime: '1h', attachments: '[]', status: 'PENDING',
    } })
    await expect(acceptJobQuote({ jobId: job.id, actorId: customer, actorType: 'CUSTOMER' }, quote.id))
      .rejects.toThrow('Quote provider is no longer available')
    expect((await db.marketplaceJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('OPEN')
    expect((await db.jobQuote.findUniqueOrThrow({ where: { id: quote.id } })).status).toBe('PENDING')
    expect(await db.jobEscrow.count({ where: { jobId: job.id } })).toBe(0)
  })

  it.each(['INDIVIDUAL', 'COMPANY'] as const)('retains %s acceptance for the exact selected service', async providerType => {
    const job = await db.marketplaceJob.create({ data: {
      customerId: customer, title: 'Exact selected service', description: 'Isolated fixture', categoryId: category,
      templateJobId: selected, countryCode: 'LK', photos: '[]', budgetType: 'REQUEST_QUOTES', status: 'OPEN',
    } })
    jobs.push(job.id)
    const quote = await db.jobQuote.create({ data: {
      jobId: job.id, providerId: providerType === 'COMPANY' ? company : provider, providerType,
      price: 10000n, currency: 'LKR', estimatedCompletionTime: '1h', attachments: '[]', status: 'PENDING',
    } })
    const result = await acceptJobQuote({ jobId: job.id, actorId: customer, actorType: 'CUSTOMER' }, quote.id)
    expect(result.job.status).toBe('QUOTE_ACCEPTED')
    expect(result.quote.status).toBe('ACCEPTED')
    expect(await db.jobEscrow.count({ where: { jobId: job.id, status: 'PENDING_PAYMENT' } })).toBe(1)
  })
})
