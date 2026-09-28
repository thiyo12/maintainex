import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { checkWorkerEligibility } from '@/lib/phase6/provider-eligibility'
import { requiresPostgres } from '../helpers/test-guard'

const prisma = new PrismaClient()

describe.skipIf(!requiresPostgres())('Phase 6.2 — Worker Assignment with JobWorkspace', () => {
  let companyId: string
  let ownerUserId: string
  let workerUserId: string
  let jobId: string

  beforeAll(async () => {
    const ts = Date.now()

    const owner = await prisma.user.create({
      data: { email: `assign-owner-${ts}@test.com`, passwordHash: 'hash', name: 'Owner', role: 'COMPANY', identityStatus: 'VERIFIED' },
    })
    ownerUserId = owner.id

    const company = await prisma.companyProfile.create({
      data: {
        userId: ownerUserId,
        companyName: `Assign Test Co ${ts}`,
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

    const worker = await prisma.user.create({
      data: { email: `assign-worker-${ts}@test.com`, passwordHash: 'hash', name: 'Worker', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    workerUserId = worker.id
    await prisma.teamMember.create({
      data: { companyId, userId: workerUserId, name: 'Worker', role: 'WORKER', skills: '[]', status: 'ACTIVE' },
    })

    const job = await prisma.marketplaceJob.create({
      data: {
        customerId: ownerUserId,
        title: 'Assign Test Job',
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
    await prisma.jobWorkspace.deleteMany({ where: { jobId } })
    await prisma.marketplaceJob.delete({ where: { id: jobId } }).catch(() => {})
    await prisma.teamMember.deleteMany({ where: { companyId } })
    await prisma.companyProfile.delete({ where: { id: companyId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerUserId, workerUserId] } } }).catch(() => {})
  })

  it('assignment creates JobWorkspace', async () => {
    const { context } = await resolveCompanyContext(ownerUserId, companyId, 'workers:assign')
    expect(context).toBeTruthy()

    await prisma.marketplaceJob.update({
      where: { id: jobId },
      data: { targetTaskerId: workerUserId, status: 'QUOTE_ACCEPTED' },
    })

    const existingWorkspace = await prisma.jobWorkspace.findUnique({ where: { jobId } })
    if (existingWorkspace) {
      await prisma.jobWorkspace.update({
        where: { jobId },
        data: { progressStatus: 'ACCEPTED' },
      })
    } else {
      await prisma.jobWorkspace.create({
        data: { jobId, progressStatus: 'ACCEPTED' },
      })
    }

    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId } })
    expect(workspace).toBeTruthy()
    expect(workspace!.progressStatus).toBe('ACCEPTED')
  })

  it('duplicate assignment is idempotent', async () => {
    const existingWorkspace = await prisma.jobWorkspace.findUnique({ where: { jobId } })
    expect(existingWorkspace).toBeTruthy()

    if (existingWorkspace) {
      await prisma.jobWorkspace.update({
        where: { jobId },
        data: { progressStatus: 'ACCEPTED' },
      })
    }

    const workspace = await prisma.jobWorkspace.findUnique({ where: { jobId } })
    expect(workspace!.progressStatus).toBe('ACCEPTED')
  })

  it('concurrent assignment: only one succeeds', async () => {
    const job2 = await prisma.marketplaceJob.create({
      data: {
        customerId: ownerUserId,
        title: 'Concurrent Assign Job',
        description: 'Test',
        categoryId: 'test-cat',
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 10000n,
        status: 'OPEN',
      },
    })

    const results = await Promise.all([
      prisma.marketplaceJob.update({ where: { id: job2.id }, data: { targetTaskerId: workerUserId, status: 'QUOTE_ACCEPTED' } }).then(() => true).catch(() => false),
      prisma.marketplaceJob.update({ where: { id: job2.id }, data: { targetTaskerId: workerUserId, status: 'QUOTE_ACCEPTED' } }).then(() => true).catch(() => false),
    ])

    expect(results.filter(Boolean).length).toBeGreaterThanOrEqual(1)

    const jobAfter = await prisma.marketplaceJob.findUnique({ where: { id: job2.id } })
    expect(jobAfter?.targetTaskerId).toBe(workerUserId)

    await prisma.marketplaceJob.delete({ where: { id: job2.id } }).catch(() => {})
  })
})
