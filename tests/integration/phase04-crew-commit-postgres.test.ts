import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { checkCrewRosterAtCommit } from '@/lib/domain/company-crew-commit-gate'

// Absolutely no fixture creation outside the dedicated CI/test database.
// All generated IDs are scoped to this suite and deleted in dependency order.
const url = process.env.DATABASE_URL ?? ''
const isolated = /^postgres(?:ql)?:\/\//.test(url) &&
  (url.includes('maintainex_test') || url.includes('_ci'))
const fixture = randomUUID().replaceAll('-', '')
let db: PrismaClient | undefined
let ownerId = ''
let companyId = ''
let jobId = ''
let crewId = ''
const workerIds: string[] = []
const categoryId = 'phase04-crew-ci-' + fixture
const input = () => ({
  companyId, jobId, actorUserId: ownerId,
  actorRole: 'COMPANY_OWNER', workerUserIds: [...workerIds].reverse(),
})

describe.skipIf(!isolated)('Phase 04 — isolated PostgreSQL crew commit and schema races', () => {
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } })
    const owner = await db.user.create({
      data: {
        email: `phase04-crew-owner-${fixture}@example.invalid`,
        passwordHash: 'test-only', name: 'Crew CI owner',
        role: 'COMPANY', countryCode: 'LK',
        identityStatus: 'VERIFIED',
      },
    })
    ownerId = owner.id
    const company = await db.companyProfile.create({
      data: {
        userId: ownerId, companyName: 'Phase 04 fixture only',
        services: '["manual"]', serviceAreas: '[]', countryCode: 'LK',
        verificationStatus: 'VERIFIED', isVerified: true,
      },
    })
    companyId = company.id
    await db.teamMember.create({
      data: {
        companyId, userId: ownerId, name: 'Crew CI owner',
        role: 'COMPANY_OWNER', status: 'ACTIVE', skills: '[]',
      },
    })
    for (const number of [1, 2]) {
      const user = await db.user.create({
        data: {
          email: `phase04-crew-worker-${number}-${fixture}@example.invalid`,
          passwordHash: 'test-only', name: `Crew CI worker ${number}`,
          role: 'TASKER', identityStatus: 'VERIFIED', countryCode: 'LK',
        },
      })
      workerIds.push(user.id)
      const member = await db.teamMember.create({
        data: {
          companyId, userId: user.id, name: user.name,
          role: 'WORKER', status: 'ACTIVE',
          skills: JSON.stringify([categoryId]),
        },
      })
      await db.providerIdentity.create({
        data: {
          identityType: 'COMPANY_WORKER', subjectId: member.id,
          currentUserId: user.id, countryCode: 'LK',
          kycStatus: 'VERIFIED', verifiedPhotoUrl: '/ci/verified-photo',
        },
      })
    }
    const job = await db.marketplaceJob.create({
      data: {
        customerId: ownerId, title: 'Isolated crew booking',
        description: 'Phase 04 transaction concurrency fixture',
        categoryId, photos: '[]', budgetType: 'FIXED',
        countryCode: 'LK', workersCount: 2, status: 'QUOTE_ACCEPTED',
      },
    })
    jobId = job.id
    await db.jobQuote.create({
      data: {
        jobId, providerId: companyId, providerType: 'COMPANY',
        price: 10000n, estimatedCompletionTime: '2 hours',
        attachments: '[]', status: 'ACCEPTED',
      },
    })
  })

  afterAll(async () => {
    if (!db) return
    try {
      if (jobId) {
        await db.companyJobAssignment.deleteMany({ where: { jobId } })
        await db.companyCrewDispatch.deleteMany({ where: { jobId } })
        await db.jobQuote.deleteMany({ where: { jobId } })
        await db.marketplaceJob.deleteMany({ where: { id: jobId } })
      }
      if (workerIds.length) {
        await db.providerIdentity.deleteMany({
          where: { currentUserId: { in: workerIds }, subjectId: { not: '' } },
        })
      }
      if (companyId) {
        await db.teamMember.deleteMany({ where: { companyId } })
        await db.companyProfile.deleteMany({ where: { id: companyId } })
      }
      if (ownerId || workerIds.length) {
        await db.user.deleteMany({ where: { id: { in: [ownerId, ...workerIds].filter(Boolean) } } })
      }
    } finally {
      await db.$disconnect()
    }
  })

  it('performs the full, non-mutating crew gate with real SERIALIZABLE row locks', async () => {
    const result = await checkCrewRosterAtCommit(input())
    expect(result.readyForFutureReservation).toBe(true)
    expect(result.dispatchEnabled).toBe(false)
    expect(result.workerUserIds).toEqual([...workerIds].sort())
    expect(await db!.companyCrewDispatch.count({ where: { jobId } })).toBe(0)
    expect(await db!.companyJobAssignment.count({ where: { jobId } })).toBe(0)
  })

  it('refuses an account suspended after an earlier successful preflight', async () => {
    await db!.user.update({ where: { id: workerIds[0] }, data: { isSuspended: true } })
    try {
      await expect(checkCrewRosterAtCommit(input())).rejects.toThrow('Worker identity or account status changed')
    } finally {
      await db!.user.update({ where: { id: workerIds[0] }, data: { isSuspended: false } })
    }
  })

  it('refuses an exact-job capability revoked after an earlier successful preflight', async () => {
    await db!.teamMember.update({
      where: { companyId_userId: { companyId, userId: workerIds[0] } },
      data: { skills: '[]' },
    })
    try {
      await expect(checkCrewRosterAtCommit(input())).rejects.toThrow('no longer satisfies service')
    } finally {
      await db!.teamMember.update({
        where: { companyId_userId: { companyId, userId: workerIds[0] } },
        data: { skills: JSON.stringify([categoryId]) },
      })
    }
  })

  it('permits only one competing versioned crew record for a given job', async () => {
    const attempts = await Promise.allSettled(
      Array.from({ length: 4 }, () => db!.companyCrewDispatch.create({
        data: { companyId, jobId, requiredWorkersCount: 2, status: 'FORMING', version: 1 },
      })),
    )
    const successful = attempts.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof db.companyCrewDispatch.create>>> =>
        result.status === 'fulfilled',
    )
    expect(successful).toHaveLength(1)
    crewId = successful[0].value.id
    expect(await db!.companyCrewDispatch.count({ where: { jobId } })).toBe(1)
    // This is only a data model race test, NOT enabled crew dispatch.
  })

  it('enforces distinct crew slots while retaining the original single-worker index', async () => {
    expect(crewId).toBeTruthy()
    await db!.companyJobAssignment.createMany({
      data: workerIds.map((workerUserId, index) => ({
        companyId, jobId, workerUserId, assignedBy: ownerId,
        status: 'CREW_RESERVED', crewDispatchId: crewId,
        crewSlot: index + 1, crewRole: index === 0 ? 'LEAD' : 'MEMBER',
      })),
    })
    expect(await db!.companyJobAssignment.count({
      where: { jobId, status: 'CREW_RESERVED' },
    })).toBe(2)
    await expect(db!.companyJobAssignment.create({
      data: {
        companyId, jobId, workerUserId: ownerId, assignedBy: ownerId,
        status: 'CREW_RESERVED', crewDispatchId: crewId,
        crewSlot: 1, crewRole: 'MEMBER',
      },
    })).rejects.toThrow()
    const indexes = await db!.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'CompanyJobAssignment'
        AND indexname = 'CompanyJobAssignment_active_per_job_idx'
    `
    expect(indexes).toHaveLength(1)
  })
})
