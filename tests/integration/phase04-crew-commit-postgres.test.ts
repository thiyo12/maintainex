import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Prisma, PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { checkCrewRosterAtCommit, stageCrewReservationInsideTransaction } from '@/lib/domain/company-crew-commit-gate'
import { acceptStagedCrewMemberInsideTransaction, rejectStagedCrewMemberInsideTransaction, cancelStagedCrewInsideTransaction } from '@/lib/domain/company-crew-lifecycle'
import { lockAndAssertWorkerScheduleAvailable } from '@/lib/domain/company-job-assignment'
import { assertStagedCrewIdentityEvidenceInsideTransaction } from '@/lib/domain/company-crew-barrier'
import { blockWorkerFormingCrewsInsideTransaction } from '@/lib/domain/company-crew-workforce'
import { deriveCrewPinDigest } from '@/lib/domain/company-crew-pin-epoch'
import { consumeStagedCrewMemberPinInsideTransaction } from '@/lib/domain/company-crew-pin-consume'
import { issueStagedCrewArrivalPinsInsideTransaction } from '@/lib/domain/company-crew-pin-issue'
import { assertAllCrewPinClaimsInsideTransaction } from '@/lib/domain/company-crew-pin-claims'
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


  it('isolated PostgreSQL PIN ledger separates crew members and rejects duplicate epochs without enabling work', async () => {
    const slots = await db!.companyJobAssignment.findMany({
      where: { crewDispatchId: crewId },
      orderBy: { crewSlot: 'asc' },
    })
    expect(slots).toHaveLength(2)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
    const secret = Buffer.alloc(32, 0x41) // Deterministic test-only HMAC key
    try {
      const created = await db!.companyCrewPinChallenge.createMany({
        data: slots.map(slot => ({
          crewDispatchId: crewId, assignmentId: slot.id, jobId,
          crewVersion: 1, purpose: 'ARRIVAL', challengeVersion: 1,
          pinDigest: deriveCrewPinDigest('123456', {
            crewDispatchId: crewId, assignmentId: slot.id,
            jobId, crewVersion: 1,
            workerUserId: slot.workerUserId, purpose: 'ARRIVAL',
          }, secret),
          issuedByCustomerUserId: ownerId, expiresAt,
        })),
      })
      expect(created.count).toBe(2)
      const persisted = await db!.companyCrewPinChallenge.findMany({
        where: { crewDispatchId: crewId },
      })
      expect(persisted).toHaveLength(2)
      expect(persisted[0].pinDigest).not.toBe(persisted[1].pinDigest)
      expect(persisted.every(row => row.consumedAt === null &&
        row.failedAttempts === 0 && row.revokedAt === null)).toBe(true)

      await expect(db!.companyCrewPinChallenge.create({
        data: {
          crewDispatchId: crewId, assignmentId: slots[0].id, jobId,
          crewVersion: 1, purpose: 'ARRIVAL', challengeVersion: 1,
          pinDigest: persisted[0].pinDigest,
          issuedByCustomerUserId: ownerId, expiresAt,
        },
      })).rejects.toThrow()
      // A different version still cannot create two simultaneously live
      // challenges for the same worker/purpose in a crew epoch.
      await expect(db!.companyCrewPinChallenge.create({
        data: {
          crewDispatchId: crewId, assignmentId: slots[0].id, jobId,
          crewVersion: 1, purpose: 'ARRIVAL', challengeVersion: 2,
          pinDigest: persisted[0].pinDigest,
          issuedByCustomerUserId: ownerId, expiresAt,
        },
      })).rejects.toThrow()
      await expect(db!.companyCrewPinChallenge.create({
        data: {
          crewDispatchId: crewId, assignmentId: slots[0].id, jobId,
          crewVersion: 1, purpose: 'INVALID', challengeVersion: 2,
          pinDigest: persisted[0].pinDigest,
          issuedByCustomerUserId: ownerId, expiresAt,
        },
      })).rejects.toThrow()
      expect((await db!.companyCrewDispatch.findUniqueOrThrow({ where: { id: crewId } })).status)
        .toBe('FORMING')
      expect(await db!.jobVerificationPin.count({ where: { jobId } })).toBe(0)
      expect(slots.every(slot => slot.crewArrivedAt === null && slot.startedAt === null)).toBe(true)
    } finally {
      await db!.companyCrewPinChallenge.deleteMany({ where: { crewDispatchId: crewId } })
    }
  })

  it('isolated PostgreSQL: PIN is consumed once for one worker but never unlocks crew arrival/start', async () => {
    const photoRows = await db!.providerIdentity.findMany({
      where: { currentUserId: { in: workerIds },
        identityType: 'COMPANY_WORKER', kycStatus: 'VERIFIED',
        verifiedPhotoUrl: { not: null } },
      select: { id: true, currentUserId: true, verifiedPhotoUrl: true },
    })
    expect(photoRows).toHaveLength(2)
    const accepted = await db!.companyJobAssignment.findMany({
      where: { crewDispatchId: crewId, status: 'CREW_ACCEPTED' },
    })
    expect(accepted).toHaveLength(2)
    const approvedAt = new Date(Date.now() + 1000)
    const signingKey = Buffer.alloc(32, 0x37) // CI-only, never deployed.
    try {
      for (const photo of photoRows) {
        await db!.jobWorkerIdentityCheck.create({
          data: {
            jobId, customerId: ownerId, providerIdentityId: photo.id,
            assignedWorkerUserId: photo.currentUserId,
            displayNameSnapshot: 'CI worker', photoSnapshotUrl: photo.verifiedPhotoUrl,
            status: 'MATCHED', confirmedAt: approvedAt,
          },
        })
      }
      await db!.companyJobAssignment.updateMany({
        where: { crewDispatchId: crewId, status: 'CREW_ACCEPTED' },
        data: { crewIdentityConfirmedAt: approvedAt },
      })
      const own = accepted[0]
      const pin = '123456'
      await db!.companyCrewPinChallenge.create({
        data: {
          crewDispatchId: crewId, jobId, crewVersion: 1,
          assignmentId: own.id, purpose: 'ARRIVAL', challengeVersion: 1,
          issuedByCustomerUserId: ownerId,
          pinDigest: deriveCrewPinDigest(pin, {
            crewDispatchId: crewId, jobId, crewVersion: 1,
            assignmentId: own.id, workerUserId: own.workerUserId, purpose: 'ARRIVAL',
          }, signingKey),
          expiresAt: new Date(Date.now() + 300000),
        },
      })
      const req = {
        crewDispatchId: crewId, expectedVersion: 1,
        authenticatedWorkerUserId: own.workerUserId, purpose: 'ARRIVAL' as const,
        pin, signingKey,
      }
      // Two workers/requests may race to use the same digest. Exactly one
      // SERIALIZABLE transaction is allowed to consume it, never both.
      const attempts = await Promise.allSettled([
        db!.$transaction(
          tx => consumeStagedCrewMemberPinInsideTransaction(tx, req),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 15000, maxWait: 15000 },
        ),
        db!.$transaction(
          tx => consumeStagedCrewMemberPinInsideTransaction(tx, req),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 15000, maxWait: 15000 },
        ),
      ])
      expect(attempts.filter(r => r.status === 'fulfilled')).toHaveLength(1)
      expect(attempts.filter(r => r.status === 'rejected')).toHaveLength(1)
      expect(attempts.find(r => r.status === 'fulfilled')).toMatchObject({
        value: {
          pinVerified: true, attemptsRemaining: 0,
          arrivalEnabled: false, workStartEnabled: false,
        },
      })
      const consumed = await db!.companyCrewPinChallenge.findMany({
        where: { crewDispatchId: crewId },
      })
      expect(consumed).toHaveLength(1)
      expect(consumed[0].consumedAt).not.toBeNull()
      await expect(db!.$transaction(
        tx => consumeStagedCrewMemberPinInsideTransaction(tx, req),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )).rejects.toThrow('unavailable or locked')
      await expect(db!.$transaction(
        tx => consumeStagedCrewMemberPinInsideTransaction(tx, {
          ...req, authenticatedWorkerUserId: accepted[1].workerUserId,
        }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )).rejects.toThrow('unavailable or locked')
      expect((await db!.marketplaceJob.findUniqueOrThrow({ where: { id: jobId } })).status)
        .toBe('QUOTE_ACCEPTED')
      expect((await db!.companyCrewDispatch.findUniqueOrThrow({ where: { id: crewId } })).status)
        .toBe('FORMING')
      const current = await db!.companyJobAssignment.findMany({ where: { crewDispatchId: crewId } })
      expect(current.every(row => row.crewArrivedAt === null && row.startedAt === null)).toBe(true)
      expect(await db!.jobVerificationPin.count({ where: { jobId } })).toBe(0)
    } finally {
      await db!.companyCrewPinChallenge.deleteMany({ where: { crewDispatchId: crewId } })
      await db!.jobWorkerIdentityCheck.deleteMany({ where: { jobId } })
      await db!.companyJobAssignment.updateMany({
        where: { crewDispatchId: crewId }, data: { crewIdentityConfirmedAt: null },
      })
    }
  })

  it('isolated PostgreSQL: customer-issued PINs are all-worker atomic, owner-bound, and non-activating', async () => {
    const photoRows = await db!.providerIdentity.findMany({
      where: {
        currentUserId: { in: workerIds }, identityType: 'COMPANY_WORKER',
        kycStatus: 'VERIFIED', verifiedPhotoUrl: { not: null },
      },
      select: { id: true, currentUserId: true, verifiedPhotoUrl: true },
    })
    expect(photoRows).toHaveLength(2)
    const approvedAt = new Date(Date.now() + 1000)
    try {
      for (const photo of photoRows) {
        await db!.jobWorkerIdentityCheck.create({
          data: {
            jobId, customerId: ownerId, providerIdentityId: photo.id,
            assignedWorkerUserId: photo.currentUserId,
            displayNameSnapshot: 'CI worker', photoSnapshotUrl: photo.verifiedPhotoUrl,
            status: 'MATCHED', confirmedAt: approvedAt,
          },
        })
      }
      await db!.companyJobAssignment.updateMany({
        where: { crewDispatchId: crewId, status: 'CREW_ACCEPTED' },
        data: { crewIdentityConfirmedAt: approvedAt },
      })
      const baseInput = {
        crewDispatchId: crewId, expectedVersion: 1,
        authenticatedCustomerUserId: ownerId, signingKey: Buffer.alloc(32, 0x57),
      }
      const result = await db!.$transaction(
        tx => issueStagedCrewArrivalPinsInsideTransaction(tx, baseInput),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      expect(result.crewVersion).toBe(1)
      expect(result.arrivalEnabled).toBe(false)
      expect(result.workStartEnabled).toBe(false)
      expect(result.memberCodes).toHaveLength(2)
      const created = await db!.companyCrewPinChallenge.findMany({
        where: { crewDispatchId: crewId, crewVersion: 1, purpose: 'ARRIVAL' },
      })
      expect(created).toHaveLength(2)
      expect(new Set(created.map(row => row.assignmentId)).size).toBe(2)
      expect(created.every(row => row.issuedByCustomerUserId === ownerId &&
        /^[a-f0-9]{64}$/.test(row.pinDigest) &&
        row.consumedAt === null && row.revokedAt === null)).toBe(true)
      expect(created.every(row =>
        result.memberCodes.every(x => x.pin !== row.pinDigest))).toBe(true)
      await expect(db!.$transaction(
        tx => issueStagedCrewArrivalPinsInsideTransaction(tx, baseInput),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )).rejects.toThrow('cannot be issued again')
      await expect(db!.$transaction(
        tx => issueStagedCrewArrivalPinsInsideTransaction(tx, {
          ...baseInput, authenticatedCustomerUserId: workerIds[0],
        }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )).rejects.toThrow('Crew booking not found')
      expect((await db!.marketplaceJob.findUniqueOrThrow({ where: { id: jobId } })).status)
        .toBe('QUOTE_ACCEPTED')
      expect((await db!.companyCrewDispatch.findUniqueOrThrow({ where: { id: crewId } })).status)
        .toBe('FORMING')
      expect(await db!.jobVerificationPin.count({ where: { jobId } })).toBe(0)
      const slots = await db!.companyJobAssignment.findMany({ where: { crewDispatchId: crewId } })
      expect(slots.every(row => row.crewArrivedAt === null && row.startedAt === null)).toBe(true)
    } finally {
      await db!.companyCrewPinChallenge.deleteMany({ where: { crewDispatchId: crewId } })
      await db!.jobWorkerIdentityCheck.deleteMany({ where: { jobId } })
      await db!.companyJobAssignment.updateMany({
        where: { crewDispatchId: crewId }, data: { crewIdentityConfirmedAt: null },
      })
    }
  })

  it('isolated PostgreSQL: two consumed worker claims never grant physical arrival or work authority', async () => {
    const photos = await db!.providerIdentity.findMany({
      where: {
        currentUserId: { in: workerIds }, identityType: 'COMPANY_WORKER',
        kycStatus: 'VERIFIED', verifiedPhotoUrl: { not: null },
      },
      select: { id: true, currentUserId: true, verifiedPhotoUrl: true },
    })
    expect(photos).toHaveLength(2)
    const matchedAt = new Date()
    try {
      for (const photo of photos) {
        await db!.jobWorkerIdentityCheck.create({
          data: {
            jobId, customerId: ownerId, providerIdentityId: photo.id,
            assignedWorkerUserId: photo.currentUserId,
            displayNameSnapshot: 'CI worker', photoSnapshotUrl: photo.verifiedPhotoUrl,
            status: 'MATCHED', confirmedAt: matchedAt,
          },
        })
      }
      await db!.companyJobAssignment.updateMany({
        where: { crewDispatchId: crewId, status: 'CREW_ACCEPTED' },
        data: { crewIdentityConfirmedAt: matchedAt },
      })
      const assignments = await db!.companyJobAssignment.findMany({
        where: { crewDispatchId: crewId },
      })
      expect(assignments).toHaveLength(2)
      const consumedAt = new Date()
      await db!.companyCrewPinChallenge.createMany({
        data: assignments.map(assignment => ({
          crewDispatchId: crewId, jobId, crewVersion: 1,
          assignmentId: assignment.id, purpose: 'ARRIVAL',
          challengeVersion: 1, issuedByCustomerUserId: ownerId,
          pinDigest: deriveCrewPinDigest('123456', {
            crewDispatchId: crewId, jobId, crewVersion: 1,
            assignmentId: assignment.id, workerUserId: assignment.workerUserId,
            purpose: 'ARRIVAL',
          }, Buffer.alloc(32, 0x29)),
          createdAt: new Date(consumedAt.getTime() - 2000),
          consumedAt,
          expiresAt: new Date(consumedAt.getTime() + 300000),
        })),
      })
      const request = {
        crewDispatchId: crewId, expectedVersion: 1,
        actorUserId: ownerId, actorRole: 'COMPANY_OWNER',
      }
      const complete = await db!.$transaction(
        tx => assertAllCrewPinClaimsInsideTransaction(tx, request),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      expect(complete).toEqual({
        crewDispatchId: crewId, crewVersion: 1,
        memberClaimsComplete: true, physicalPresenceVerified: false,
        arrivalEnabled: false, workStartEnabled: false,
      })
      expect((await db!.companyCrewDispatch.findUniqueOrThrow({ where: { id: crewId } })).status)
        .toBe('FORMING')
      expect(await db!.jobVerificationPin.count({ where: { jobId } })).toBe(0)
      expect((await db!.marketplaceJob.findUniqueOrThrow({ where: { id: jobId } })).status)
        .toBe('QUOTE_ACCEPTED')
      expect((await db!.companyJobAssignment.findMany({ where: { crewDispatchId: crewId } }))
        .every(row => row.crewArrivedAt === null && row.startedAt === null)).toBe(true)
      await db!.companyCrewPinChallenge.updateMany({
        where: { crewDispatchId: crewId, assignmentId: assignments[1].id },
        data: { revokedAt: new Date(), consumedAt: null },
      })
      await expect(db!.$transaction(
        tx => assertAllCrewPinClaimsInsideTransaction(tx, request),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )).rejects.toThrow('independently consumed')
    } finally {
      await db!.companyCrewPinChallenge.deleteMany({ where: { crewDispatchId: crewId } })
      await db!.jobWorkerIdentityCheck.deleteMany({ where: { jobId } })
      await db!.companyJobAssignment.updateMany({
        where: { crewDispatchId: crewId }, data: { crewIdentityConfirmedAt: null },
      })
    }
  })

  it('requires all-worker fresh verified photo evidence in isolated PostgreSQL', async () => {
    const photoRows = await db!.providerIdentity.findMany({
      where: {
        currentUserId: { in: workerIds },
        identityType: 'COMPANY_WORKER',
        kycStatus: 'VERIFIED',
        verifiedPhotoUrl: { not: null },
      },
      select: { id: true, currentUserId: true, verifiedPhotoUrl: true },
    })
    expect(photoRows).toHaveLength(2)
    const version = 1
    const request = {
      crewDispatchId: crewId, expectedVersion: version,
      actorUserId: ownerId, actorRole: 'COMPANY_OWNER',
    }
    // A worker who has merely accepted has NOT been approved by the customer.
    await expect(db!.$transaction(
      tx => assertStagedCrewIdentityEvidenceInsideTransaction(tx, request),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )).rejects.toThrow('current photo confirmation')

    const confirmedAt = new Date()
    try {
      for (const profile of photoRows) {
        await db!.jobWorkerIdentityCheck.create({
          data: {
            jobId, customerId: ownerId,
            providerIdentityId: profile.id,
            assignedWorkerUserId: profile.currentUserId,
            displayNameSnapshot: 'Isolated worker',
            photoSnapshotUrl: profile.verifiedPhotoUrl,
            status: 'MATCHED', confirmedAt,
          },
        })
      }
      await db!.companyJobAssignment.updateMany({
        where: { crewDispatchId: crewId, status: 'CREW_ACCEPTED' },
        data: { crewIdentityConfirmedAt: confirmedAt },
      })
      const ready = await db!.$transaction(
        tx => assertStagedCrewIdentityEvidenceInsideTransaction(tx, request),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      expect(ready.memberEvidenceComplete).toBe(true)
      expect(ready.dispatchEnabled).toBe(false)
      expect(ready.arrivalEnabled).toBe(false)
      expect(ready.workStartEnabled).toBe(false)
      expect((await db!.companyCrewDispatch.findUniqueOrThrow({ where: { id: crewId } })).status)
        .toBe('FORMING')
      expect(await db!.jobVerificationPin.count({ where: { jobId } })).toBe(0)

      // Photo changed after customer approval => prior confirmation must fail.
      await db!.providerIdentity.update({
        where: { id: photoRows[0].id },
        data: { verifiedPhotoUrl: '/ci/new-photo-that-customer-did-not-confirm' },
      })
      await expect(db!.$transaction(
        tx => assertStagedCrewIdentityEvidenceInsideTransaction(tx, request),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )).rejects.toThrow('missing or stale')
      await db!.providerIdentity.update({
        where: { id: photoRows[0].id },
        data: { verifiedPhotoUrl: photoRows[0].verifiedPhotoUrl },
      })
    } finally {
      await db!.jobWorkerIdentityCheck.deleteMany({
        where: { jobId, providerIdentityId: { in: photoRows.map(p => p.id) } },
      })
      await db!.companyJobAssignment.updateMany({
        where: { crewDispatchId: crewId },
        data: { crewIdentityConfirmedAt: null },
      })
      await db!.providerIdentity.update({
        where: { id: photoRows[0].id },
        data: { verifiedPhotoUrl: photoRows[0].verifiedPhotoUrl },
      })
    }
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

  it('isolated PostgreSQL: a consumed worker PIN prevents silent cancellation and workforce removal', async () => {
    const job = await db!.marketplaceJob.create({
      data: {
        customerId: ownerId, title: 'Crew consumed claim cancellation fixture',
        description: 'Phase04 crew claim must survive attempted workforce changes',
        categoryId, photos: '[]', budgetType: 'FIXED',
        countryCode: 'LK', workersCount: 2, status: 'QUOTE_ACCEPTED',
      },
    })
    try {
      await db!.jobQuote.create({
        data: {
          jobId: job.id, providerId: companyId, providerType: 'COMPANY',
          price: 10000n, estimatedCompletionTime: '2 hours',
          attachments: '[]', status: 'ACCEPTED',
        },
      })
      const staged = await db!.$transaction(
        tx => stageCrewReservationInsideTransaction(tx, {
          ...input(), jobId: job.id, leadWorkerUserId: workerIds[0],
        }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      for (const workerUserId of workerIds) {
        await db!.$transaction(
          tx => acceptStagedCrewMemberInsideTransaction(tx, {
            crewDispatchId: staged.crewDispatchId, workerUserId, expectedVersion: 1,
          }),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        )
      }
      const slots = await db!.companyJobAssignment.findMany({
        where: { crewDispatchId: staged.crewDispatchId },
      })
      const consumed = new Date()
      await db!.companyCrewPinChallenge.create({
        data: {
          crewDispatchId: staged.crewDispatchId, jobId: job.id,
          assignmentId: slots[0].id, crewVersion: 1, purpose: 'ARRIVAL',
          challengeVersion: 1, pinDigest: 'a'.repeat(64),
          issuedByCustomerUserId: ownerId,
          createdAt: new Date(consumed.getTime() - 1000),
          consumedAt: consumed,
          expiresAt: new Date(consumed.getTime() + 300000),
        },
      })
      await expect(db!.$transaction(
        tx => cancelStagedCrewInsideTransaction(tx, {
          crewDispatchId: staged.crewDispatchId, companyId,
          actorUserId: ownerId, actorRole: 'COMPANY_OWNER',
          expectedVersion: 1, reason: 'Try cancelling after PIN was consumed',
        }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )).rejects.toThrow('support review')
      await expect(db!.$transaction(async tx => {
        await tx.$queryRaw`
          SELECT id FROM "TeamMember"
          WHERE "companyId" = ${companyId} AND "userId" = ${workerIds[0]} FOR UPDATE
        `
        await blockWorkerFormingCrewsInsideTransaction(tx, {
          companyId, workerUserId: workerIds[0],
          actorUserId: ownerId, actorRole: 'COMPANY_OWNER', reason: 'REMOVED',
        })
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }))
        .rejects.toThrow('CREW_WORKFORCE_STATE_CONFLICT')
      const persisted = await db!.companyCrewPinChallenge.findFirstOrThrow({
        where: { crewDispatchId: staged.crewDispatchId },
      })
      expect(persisted.consumedAt).not.toBeNull()
      expect(persisted.revokedAt).toBeNull()
      const crew = await db!.companyCrewDispatch.findUniqueOrThrow({
        where: { id: staged.crewDispatchId },
      })
      expect(crew.status).toBe('FORMING')
      expect(crew.version).toBe(1)
      const unchanged = await db!.companyJobAssignment.findMany({
        where: { crewDispatchId: staged.crewDispatchId },
      })
      expect(unchanged).toHaveLength(2)
      expect(unchanged.every(s => s.status === 'CREW_ACCEPTED' && s.revokedAt === null))
        .toBe(true)
      expect(await db!.jobVerificationPin.count({ where: { jobId: job.id } })).toBe(0)
    } finally {
      await db!.companyCrewPinChallenge.deleteMany({ where: { jobId: job.id } })
      await db!.companyJobAssignment.deleteMany({ where: { jobId: job.id } })
      await db!.companyCrewDispatch.deleteMany({ where: { jobId: job.id } })
      await db!.jobQuote.deleteMany({ where: { jobId: job.id } })
      await db!.marketplaceJob.delete({ where: { id: job.id } })
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
      // A previously issued but unconsumed per-worker challenge is revoked
      // in the SAME transaction as the whole-crew cancellation.
      const stagedSlots = await db!.companyJobAssignment.findMany({
        where: { crewDispatchId: staged.crewDispatchId },
      })
      await db!.companyCrewPinChallenge.createMany({
        data: stagedSlots.map(slot => ({
          crewDispatchId: staged.crewDispatchId, assignmentId: slot.id,
          jobId: cancellationJob.id, crewVersion: 1, purpose: 'ARRIVAL',
          challengeVersion: 1, pinDigest: 'a'.repeat(64),
          issuedByCustomerUserId: ownerId,
          expiresAt: new Date(Date.now() + 300000),
        })),
      })
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
      const withdrawnCodes = await db!.companyCrewPinChallenge.findMany({
        where: { crewDispatchId: staged.crewDispatchId },
      })
      expect(withdrawnCodes).toHaveLength(2)
      expect(withdrawnCodes.every(pin => pin.revokedAt !== null && pin.consumedAt === null))
        .toBe(true)
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
      await db!.companyCrewPinChallenge.deleteMany({ where: { jobId: cancellationJob.id } })
      await db!.companyJobAssignment.deleteMany({ where: { jobId: cancellationJob.id } })
      await db!.companyCrewDispatch.deleteMany({ where: { jobId: cancellationJob.id } })
      await db!.jobQuote.deleteMany({ where: { jobId: cancellationJob.id } })
      await db!.marketplaceJob.delete({ where: { id: cancellationJob.id } })
    }
  })


  it('atomically invalidates a two-member accepted crew on a suspended workforce member', async () => {
    const booking = await db!.marketplaceJob.create({
      data: {
        customerId: ownerId, title: 'Crew workforce suspension fixture',
        description: 'Phase 04 role/status mutation must revoke all staged holds',
        categoryId, photos: '[]', budgetType: 'FIXED',
        countryCode: 'LK', workersCount: 2, status: 'QUOTE_ACCEPTED',
      },
    })
    try {
      await db!.jobQuote.create({
        data: {
          jobId: booking.id, providerId: companyId, providerType: 'COMPANY',
          price: 10000n, estimatedCompletionTime: '2 hours',
          attachments: '[]', status: 'ACCEPTED',
        },
      })
      const staged = await db!.$transaction(tx => stageCrewReservationInsideTransaction(tx, {
        ...input(), jobId: booking.id, leadWorkerUserId: workerIds[0],
      }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      await db!.$transaction(tx => acceptStagedCrewMemberInsideTransaction(tx, {
        crewDispatchId: staged.crewDispatchId,
        workerUserId: workerIds[1], expectedVersion: 1,
      }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

      const result = await db!.$transaction(async tx => {
        await tx.$queryRaw`
          SELECT id FROM "TeamMember"
          WHERE "companyId" = ${companyId} AND "userId" = ${workerIds[0]} FOR UPDATE
        `
        const invalidated = await blockWorkerFormingCrewsInsideTransaction(tx, {
          companyId, workerUserId: workerIds[0], actorUserId: ownerId,
          actorRole: 'COMPANY_OWNER', reason: 'SUSPENDED',
        })
        await tx.teamMember.update({
          where: { companyId_userId: { companyId, userId: workerIds[0] } },
          data: { status: 'SUSPENDED' },
        })
        return invalidated
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      expect(result).toEqual({ blockedCrewsCount: 1, revokedCrewSlotsCount: 2 })
      const crew = await db!.companyCrewDispatch.findUniqueOrThrow({
        where: { id: staged.crewDispatchId },
      })
      expect(crew.status).toBe('BLOCKED')
      expect(crew.version).toBe(2)
      const slots = await db!.companyJobAssignment.findMany({
        where: { crewDispatchId: staged.crewDispatchId },
      })
      expect(slots).toHaveLength(2)
      expect(slots.every(slot => slot.status === 'REVOKED' &&
        slot.revokedAt !== null && slot.startedAt === null)).toBe(true)
      expect(await db!.jobVerificationPin.count({ where: { jobId: booking.id } })).toBe(0)
      await expect(db!.$transaction(tx => acceptStagedCrewMemberInsideTransaction(tx, {
        crewDispatchId: staged.crewDispatchId,
        workerUserId: workerIds[0], expectedVersion: 1,
      }))).rejects.toThrow('Crew version')
      await expect(db!.$transaction(tx => stageCrewReservationInsideTransaction(tx, {
        ...input(), jobId: booking.id, leadWorkerUserId: workerIds[0],
      }))).rejects.toThrow('existing dispatch')
    } finally {
      await db!.teamMember.update({
        where: { companyId_userId: { companyId, userId: workerIds[0] } },
        data: { status: 'ACTIVE' },
      })
      await db!.companyJobAssignment.deleteMany({ where: { jobId: booking.id } })
      await db!.companyCrewDispatch.deleteMany({ where: { jobId: booking.id } })
      await db!.jobQuote.deleteMany({ where: { jobId: booking.id } })
      await db!.marketplaceJob.delete({ where: { id: booking.id } })
    }
  })


  it('isolated PostgreSQL race: acceptance versus member suspension never strands a partial crew', async () => {
    const booking = await db!.marketplaceJob.create({
      data: {
        customerId: ownerId, title: 'Concurrent crew workforce fixture',
        description: 'Phase 04 worker acceptance versus workforce suspension',
        categoryId, photos: '[]', budgetType: 'FIXED',
        countryCode: 'LK', workersCount: 2, status: 'QUOTE_ACCEPTED',
      },
    })
    try {
      await db!.jobQuote.create({
        data: {
          jobId: booking.id, providerId: companyId, providerType: 'COMPANY',
          price: 10000n, estimatedCompletionTime: '2 hours',
          attachments: '[]', status: 'ACCEPTED',
        },
      })
      const staged = await db!.$transaction(tx => stageCrewReservationInsideTransaction(tx, {
        ...input(), jobId: booking.id, leadWorkerUserId: workerIds[0],
      }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      const attempts = await Promise.allSettled([
        db!.$transaction(tx => acceptStagedCrewMemberInsideTransaction(tx, {
          crewDispatchId: staged.crewDispatchId,
          workerUserId: workerIds[1], expectedVersion: 1,
        }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000, timeout: 10000 }),
        db!.$transaction(async tx => {
          await tx.$queryRaw`
            SELECT id FROM "TeamMember"
            WHERE "companyId" = ${companyId} AND "userId" = ${workerIds[0]} FOR UPDATE
          `
          await blockWorkerFormingCrewsInsideTransaction(tx, {
            companyId, workerUserId: workerIds[0], actorUserId: ownerId,
            actorRole: 'COMPANY_OWNER', reason: 'SUSPENDED',
          })
          await tx.teamMember.update({
            where: { companyId_userId: { companyId, userId: workerIds[0] } },
            data: { status: 'SUSPENDED' },
          })
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000, timeout: 10000 }),
      ])
      const member = await db!.teamMember.findUniqueOrThrow({
        where: { companyId_userId: { companyId, userId: workerIds[0] } },
      })
      const crew = await db!.companyCrewDispatch.findUniqueOrThrow({
        where: { id: staged.crewDispatchId },
      })
      const slots = await db!.companyJobAssignment.findMany({
        where: { crewDispatchId: staged.crewDispatchId },
      })
      expect(slots).toHaveLength(2)
      if (member.status === 'SUSPENDED') {
        expect(attempts[1].status).toBe('fulfilled')
        expect(crew.status).toBe('BLOCKED')
        expect(crew.version).toBe(2)
        expect(slots.every(slot => slot.status === 'REVOKED')).toBe(true)
      } else {
        // Serializable lock/deadlock loser rolls back its entire transaction.
        expect(member.status).toBe('ACTIVE')
        expect(attempts[1].status).toBe('rejected')
        expect(crew.status).toBe('FORMING')
        expect(crew.version).toBe(1)
        expect(slots.every(slot =>
          ['CREW_RESERVED', 'CREW_ACCEPTED'].includes(slot.status))).toBe(true)
      }
      expect(await db!.jobVerificationPin.count({ where: { jobId: booking.id } })).toBe(0)
    } finally {
      await db!.teamMember.update({
        where: { companyId_userId: { companyId, userId: workerIds[0] } },
        data: { status: 'ACTIVE' },
      })
      await db!.companyJobAssignment.deleteMany({ where: { jobId: booking.id } })
      await db!.companyCrewDispatch.deleteMany({ where: { jobId: booking.id } })
      await db!.jobQuote.deleteMany({ where: { jobId: booking.id } })
      await db!.marketplaceJob.delete({ where: { id: booking.id } })
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
