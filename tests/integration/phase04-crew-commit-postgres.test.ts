import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Prisma, PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { checkCrewRosterAtCommit, stageCrewReservationInsideTransaction } from '@/lib/domain/company-crew-commit-gate'
import { acceptStagedCrewMemberInsideTransaction, rejectStagedCrewMemberInsideTransaction, cancelStagedCrewInsideTransaction } from '@/lib/domain/company-crew-lifecycle'
import { lockAndAssertWorkerScheduleAvailable } from '@/lib/domain/company-job-assignment'
import { decideCrewWorkerIdentityInsideTransaction } from '@/lib/domain/company-crew-identity'

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

  it('serializes competing full-roster staging so exactly one atomic reservation survives', async () => {
    const attempts = await Promise.allSettled(
      Array.from({ length: 4 }, () => db!.$transaction(
        tx => stageCrewReservationInsideTransaction(tx, {
          ...input(), leadWorkerUserId: workerIds[0],
        }),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 15000, timeout: 15000,
        },
      )),
    )
    const successful = attempts.filter(result => result.status === 'fulfilled')
    expect(successful).toHaveLength(1)
    const onlyCrew = await db!.companyCrewDispatch.findUniqueOrThrow({
      where: { jobId }, select: { id: true, version: true, status: true },
    })
    crewId = onlyCrew.id
    expect(onlyCrew.status).toBe('FORMING')
    expect(onlyCrew.version).toBe(1)
    const slots = await db!.companyJobAssignment.findMany({
      where: { crewDispatchId: crewId },
      orderBy: { crewSlot: 'asc' },
    })
    expect(slots).toHaveLength(2)
    expect(slots.map(row => row.workerUserId).sort()).toEqual([...workerIds].sort())
    expect(slots.map(row => row.crewRole).sort()).toEqual(['LEAD', 'MEMBER'])
    expect(slots.every(row => row.status === 'CREW_RESERVED')).toBe(true)
    // No target worker rewrite, work-start, PIN or customer notification.
    expect((await db!.marketplaceJob.findUniqueOrThrow({ where: { id: jobId } })).status)
      .toBe('QUOTE_ACCEPTED')
  })

  it('makes staged crew capacity block subsequent single-worker allocations on other jobs', async () => {
    await expect(db!.$transaction(async tx => {
      await lockAndAssertWorkerScheduleAvailable(
        tx, workerIds[0], 'different-booking', null, null, companyId, false,
      )
    })).rejects.toThrow('scheduling conflict')
  })

  it('records each worker acceptance without granting READY, PIN or work-start authority', async () => {
    for (const workerUserId of workerIds) {
      const result = await db!.$transaction(
        tx => acceptStagedCrewMemberInsideTransaction(tx, {
          crewDispatchId: crewId, workerUserId, expectedVersion: 1,
        }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      expect(result.status).toBe('FORMING')
      expect(result.dispatchEnabled).toBe(false)
    }
    const accepted = await db!.companyJobAssignment.findMany({
      where: { crewDispatchId: crewId }, select: { status: true, acceptedAt: true },
    })
    expect(accepted).toHaveLength(2)
    expect(accepted.every(row => row.status === 'CREW_ACCEPTED' && row.acceptedAt !== null)).toBe(true)
    expect((await db!.companyCrewDispatch.findUniqueOrThrow({ where: { id: crewId } })).status)
      .toBe('FORMING')
    expect(await db!.jobVerificationPin.count({ where: { jobId } })).toBe(0)
    expect((await db!.marketplaceJob.findUniqueOrThrow({ where: { id: jobId } })).status)
      .toBe('QUOTE_ACCEPTED')
  })

  it('enforces distinct crew slots while retaining the original single-worker index', async () => {
    expect(crewId).toBeTruthy()
    expect(await db!.companyJobAssignment.count({
      where: { jobId, status: 'CREW_ACCEPTED' },
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

  it('atomically blocks crew and releases all capacity after an accepted member refuses', async () => {
    const result = await db!.$transaction(
      tx => rejectStagedCrewMemberInsideTransaction(tx, {
        crewDispatchId: crewId, workerUserId: workerIds[0],
        expectedVersion: 1, reason: 'Declined isolated test invitation',
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
    expect(result).toMatchObject({
      crewDispatchId: crewId, status: 'BLOCKED',
      version: 2, releasedWorkersCount: 2, dispatchEnabled: false,
    })
    const slots = await db!.companyJobAssignment.findMany({
      where: { crewDispatchId: crewId },
    })
    expect(slots.map(row => row.status).sort()).toEqual(['REJECTED', 'REVOKED'])
    expect(slots.find(row => row.workerUserId === workerIds[0])?.rejectReason)
      .toBe('Declined isolated test invitation')
    expect((await db!.companyCrewDispatch.findUniqueOrThrow({ where: { id: crewId } })).version)
      .toBe(2)
  })

  it('rejects stale accepted invitations and releases both workers scheduling holds', async () => {
    await expect(db!.$transaction(tx => acceptStagedCrewMemberInsideTransaction(tx, {
      crewDispatchId: crewId, workerUserId: workerIds[1], expectedVersion: 1,
    }))).rejects.toThrow('Crew version')
    for (const workerUserId of workerIds) {
      await expect(db!.$transaction(tx => lockAndAssertWorkerScheduleAvailable(
        tx, workerUserId, 'other-booking', null, null, companyId, false,
      ))).resolves.toBeUndefined()
    }
  })

  it('cancels an accepted two-worker roster atomically and preserves the terminal epoch', async () => {
    const cancellationJob = await db!.marketplaceJob.create({
      data: {
        customerId: ownerId, title: 'Isolated cancellation booking',
        description: 'Phase 04 cancel regression only',
        categoryId, photos: '[]', budgetType: 'FIXED',
        countryCode: 'LK', workersCount: 2, status: 'QUOTE_ACCEPTED',
      },
    })
    try {
      await db!.jobQuote.create({
        data: {
          jobId: cancellationJob.id, providerId: companyId, providerType: 'COMPANY',
          price: 10000n, estimatedCompletionTime: '3 hours',
          attachments: '[]', status: 'ACCEPTED',
        },
      })
      const staged = await db!.$transaction(
        tx => stageCrewReservationInsideTransaction(tx, {
          companyId, jobId: cancellationJob.id,
          actorUserId: ownerId, actorRole: 'COMPANY_OWNER',
          workerUserIds: [...workerIds], leadWorkerUserId: workerIds[0],
        }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      await db!.$transaction(
        tx => acceptStagedCrewMemberInsideTransaction(tx, {
          crewDispatchId: staged.crewDispatchId,
          workerUserId: workerIds[0], expectedVersion: 1,
        }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      const result = await db!.$transaction(
        tx => cancelStagedCrewInsideTransaction(tx, {
          companyId, crewDispatchId: staged.crewDispatchId,
          actorUserId: ownerId, actorRole: 'COMPANY_OWNER', expectedVersion: 1,
          reason: 'Full roster cancelled in isolated test',
        }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      expect(result).toMatchObject({
        crewDispatchId: staged.crewDispatchId, status: 'CANCELLED',
        version: 2, releasedWorkersCount: 2, dispatchEnabled: false,
      })
      const saved = await db!.companyCrewDispatch.findUniqueOrThrow({
        where: { id: staged.crewDispatchId },
      })
      expect(saved.status).toBe('CANCELLED')
      expect(saved.version).toBe(2)
      const cancelledSlots = await db!.companyJobAssignment.findMany({
        where: { crewDispatchId: staged.crewDispatchId },
      })
      expect(cancelledSlots).toHaveLength(2)
      expect(cancelledSlots.every(slot =>
        slot.status === 'REVOKED' && slot.revokedAt !== null &&
        slot.startedAt === null)).toBe(true)
      expect(await db!.jobVerificationPin.count({ where: { jobId: cancellationJob.id } })).toBe(0)
      await expect(db!.$transaction(tx => acceptStagedCrewMemberInsideTransaction(tx, {
        crewDispatchId: staged.crewDispatchId,
        workerUserId: workerIds[1], expectedVersion: 1,
      }))).rejects.toThrow('Crew version')
      for (const workerUserId of workerIds) {
        await expect(db!.$transaction(tx => lockAndAssertWorkerScheduleAvailable(
          tx, workerUserId, 'other-booking', null, null, companyId, false,
        ))).resolves.toBeUndefined()
      }
      // Historical crew record remains to prevent an unaudited re-stage.
      await expect(db!.$transaction(tx => stageCrewReservationInsideTransaction(tx, {
        companyId, jobId: cancellationJob.id,
        actorUserId: ownerId, actorRole: 'COMPANY_OWNER',
        workerUserIds: [...workerIds], leadWorkerUserId: workerIds[0],
      }))).rejects.toThrow('existing dispatch')
    } finally {
      await db!.companyJobAssignment.deleteMany({ where: { jobId: cancellationJob.id } })
      await db!.companyCrewDispatch.deleteMany({ where: { jobId: cancellationJob.id } })
      await db!.jobQuote.deleteMany({ where: { jobId: cancellationJob.id } })
      await db!.marketplaceJob.delete({ where: { id: cancellationJob.id } })
    }
  })


  it('persists per-member photos, blocks a mismatched crew, and retains safety evidence in PostgreSQL', async () => {
    const booking = await db!.marketplaceJob.create({
      data: {
        customerId: ownerId, title: 'Crew identity and safety fixture',
        description: 'Real postgres photo and safety hold regression only',
        categoryId, photos: '[]', budgetType: 'FIXED',
        countryCode: 'LK', workersCount: 2, status: 'QUOTE_ACCEPTED',
      },
    })
    try {
      await db!.jobQuote.create({
        data: {
          jobId: booking.id, providerId: companyId, providerType: 'COMPANY',
          price: 10000n, estimatedCompletionTime: '3 hours',
          attachments: '[]', status: 'ACCEPTED',
        },
      })
      const staged = await db!.$transaction(tx =>
        stageCrewReservationInsideTransaction(tx, {
          companyId, jobId: booking.id,
          actorUserId: ownerId, actorRole: 'COMPANY_OWNER',
          workerUserIds: [...workerIds], leadWorkerUserId: workerIds[0],
        }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      for (const workerUserId of workerIds) {
        await db!.$transaction(tx => acceptStagedCrewMemberInsideTransaction(tx, {
          crewDispatchId: staged.crewDispatchId, workerUserId, expectedVersion: 1,
        }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      }
      const saved = await db!.companyJobAssignment.findMany({
        where: { crewDispatchId: staged.crewDispatchId },
        orderBy: { crewSlot: 'asc' },
      })
      expect(saved).toHaveLength(2)

      for (const slot of saved) {
        const matched = await db!.$transaction(tx => decideCrewWorkerIdentityInsideTransaction(tx, {
          jobId: booking.id, crewDispatchId: staged.crewDispatchId,
          assignmentId: slot.id, customerUserId: ownerId,
          expectedVersion: 1, decision: 'MATCH',
        }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
        expect(matched).toMatchObject({ status: 'FORMING', customerConfirmed: true, dispatchEnabled: false })
      }
      const evidence = await db!.jobWorkerIdentityCheck.findMany({ where: { jobId: booking.id } })
      expect(evidence).toHaveLength(2)
      expect(evidence.every(row => row.status === 'MATCHED' &&
        row.confirmedAt !== null && row.assignedWorkerUserId !== null)).toBe(true)
      const confirmedSlots = await db!.companyJobAssignment.findMany({
        where: { crewDispatchId: staged.crewDispatchId },
      })
      expect(confirmedSlots.every(row => row.crewIdentityConfirmedAt !== null)).toBe(true)
      expect((await db!.companyCrewDispatch.findUniqueOrThrow({
        where: { id: staged.crewDispatchId },
      })).status).toBe('FORMING')
      expect(await db!.jobVerificationPin.count({ where: { jobId: booking.id } })).toBe(0)

      const mismatch = await db!.$transaction(tx =>
        decideCrewWorkerIdentityInsideTransaction(tx, {
          jobId: booking.id, crewDispatchId: staged.crewDispatchId,
          assignmentId: saved[0].id, customerUserId: ownerId,
          expectedVersion: 1, decision: 'MISMATCH', reason: 'Real-photo mismatch test',
        }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      expect(mismatch).toMatchObject({
        status: 'BLOCKED', version: 2,
        safetyReviewRequired: true, dispatchEnabled: false,
      })
      expect((await db!.companyCrewDispatch.findUniqueOrThrow({
        where: { id: staged.crewDispatchId },
      })).status).toBe('BLOCKED')
      expect(await db!.companyJobAssignment.count({
        where: { crewDispatchId: staged.crewDispatchId, status: 'REVOKED' },
      })).toBe(2)
      expect(await db!.providerIntegritySignal.count({
        where: { jobId: booking.id, severity: 'HIGH', status: 'OPEN' },
      })).toBe(1)
      expect(await db!.marketplaceRiskEvent.count({
        where: { jobId: booking.id, severity: 'HIGH' },
      })).toBe(1)
      await expect(db!.$transaction(tx => decideCrewWorkerIdentityInsideTransaction(tx, {
        jobId: booking.id, crewDispatchId: staged.crewDispatchId,
        assignmentId: saved[1].id, customerUserId: ownerId,
        expectedVersion: 1, decision: 'MATCH',
      }))).rejects.toThrow('version changed')
      for (const workerUserId of workerIds) {
        await expect(db!.$transaction(tx => lockAndAssertWorkerScheduleAvailable(
          tx, workerUserId, 'other-booking', null, null, companyId, false,
        ))).resolves.toBeUndefined()
      }
    } finally {
      await db!.marketplaceRiskEvent.deleteMany({ where: { jobId: booking.id } })
      await db!.providerIntegritySignal.deleteMany({ where: { jobId: booking.id } })
      await db!.jobWorkerIdentityCheck.deleteMany({ where: { jobId: booking.id } })
      await db!.companyJobAssignment.deleteMany({ where: { jobId: booking.id } })
      await db!.companyCrewDispatch.deleteMany({ where: { jobId: booking.id } })
      await db!.jobQuote.deleteMany({ where: { jobId: booking.id } })
      await db!.marketplaceJob.delete({ where: { id: booking.id } })
    }
  })

})
