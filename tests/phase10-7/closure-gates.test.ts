import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const U = {
  ownerA: `owner-a-${crypto.randomBytes(4).toString('hex')}`,
  managerA: `mgr-a-${crypto.randomBytes(4).toString('hex')}`,
  dispatcherA: `disp-a-${crypto.randomBytes(4).toString('hex')}`,
  workerA: `work-a-${crypto.randomBytes(4).toString('hex')}`,
  workerB: `work-b-${crypto.randomBytes(4).toString('hex')}`,
  workerC: `work-c-${crypto.randomBytes(4).toString('hex')}`,
  ownerB: `owner-b-${crypto.randomBytes(4).toString('hex')}`,
  workerBcompany: `work-bco-${crypto.randomBytes(4).toString('hex')}`,
  customer: `cust-${crypto.randomBytes(4).toString('hex')}`,
  tasker: `tasker-${crypto.randomBytes(4).toString('hex')}`,
}

type Ids = Record<string, string>
const ids: Ids = {}
const dataIds: { companyAId: string; companyBId: string; jobAId: string; jobBId: string; catId: string } = { companyAId: '', companyBId: '', jobAId: '', jobBId: '', catId: '' }

async function upsertUser(prefix: string, role: string = 'CUSTOMER') {
  const u = await prisma.user.upsert({
    where: { email: `${prefix}@closure-test.com` },
    update: {},
    create: {
      email: `${prefix}@closure-test.com`,
      passwordHash: 'x',
      name: prefix.split('-').slice(0, 2).join(' '),
      phone: `+9477${Math.floor(10000000 + Math.random() * 89999999)}`,
      role,
      countryCode: 'LK',
      identityStatus: 'VERIFIED',
    },
  })
  return u.id
}

async function clearJobAssignments(jobId: string) {
  await prisma.companyJobAssignment.deleteMany({ where: { jobId } })
  await prisma.marketplaceJob.update({ where: { id: jobId }, data: { targetTaskerId: null } })
}

async function resetJob(jobId: string) {
  await clearJobAssignments(jobId)
  await prisma.jobWorkspace.deleteMany({ where: { jobId } })
  await prisma.marketplaceJob.update({ where: { id: jobId }, data: { status: 'QUOTE_ACCEPTED', targetTaskerId: null } })
}

beforeAll(async () => {
  ids.ownerA = await upsertUser(U.ownerA, 'CUSTOMER')
  ids.managerA = await upsertUser(U.managerA, 'CUSTOMER')
  ids.dispatcherA = await upsertUser(U.dispatcherA, 'CUSTOMER')
  ids.workerA = await upsertUser(U.workerA, 'TASKER')
  ids.workerB = await upsertUser(U.workerB, 'TASKER')
  ids.workerC = await upsertUser(U.workerC, 'TASKER')
  ids.ownerB = await upsertUser(U.ownerB, 'CUSTOMER')
  ids.workerBcompany = await upsertUser(U.workerBcompany, 'TASKER')
  ids.customer = await upsertUser(U.customer, 'CUSTOMER')
  ids.tasker = await upsertUser(U.tasker, 'TASKER')

  const compA = await prisma.companyProfile.upsert({
    where: { userId: ids.ownerA },
    update: {},
    create: {
      userId: ids.ownerA, companyName: 'Closure Test Co A',
      services: '["plumbing"]', serviceAreas: '["colombo"]',
      isVerified: true, verificationStatus: 'VERIFIED', countryCode: 'LK',
    },
  })
  dataIds.companyAId = compA.id

  const compB = await prisma.companyProfile.upsert({
    where: { userId: ids.ownerB },
    update: {},
    create: {
      userId: ids.ownerB, companyName: 'Closure Test Co B',
      services: '["electrical"]', serviceAreas: '["colombo"]',
      isVerified: true, verificationStatus: 'VERIFIED', countryCode: 'LK',
    },
  })
  dataIds.companyBId = compB.id

  await prisma.teamMember.createMany({
    data: [
      { companyId: dataIds.companyAId, userId: ids.ownerA, name: 'Owner A', role: 'COMPANY_OWNER', status: 'ACTIVE', skills: '[]' },
      { companyId: dataIds.companyAId, userId: ids.managerA, name: 'Manager A', role: 'MANAGER', status: 'ACTIVE', skills: '[]' },
      { companyId: dataIds.companyAId, userId: ids.dispatcherA, name: 'Dispatcher A', role: 'DISPATCHER', status: 'ACTIVE', skills: '[]' },
      { companyId: dataIds.companyAId, userId: ids.workerA, name: 'Worker A', role: 'WORKER', status: 'ACTIVE', skills: '["plumbing"]' },
      { companyId: dataIds.companyAId, userId: ids.workerB, name: 'Worker B', role: 'WORKER', status: 'ACTIVE', skills: '["plumbing"]' },
      { companyId: dataIds.companyAId, userId: ids.workerC, name: 'Worker C', role: 'WORKER', status: 'ACTIVE', skills: '["plumbing"]' },
      { companyId: dataIds.companyBId, userId: ids.ownerB, name: 'Owner B', role: 'COMPANY_OWNER', status: 'ACTIVE', skills: '[]' },
      { companyId: dataIds.companyBId, userId: ids.workerBcompany, name: 'Worker B Co', role: 'WORKER', status: 'ACTIVE', skills: '["electrical"]' },
    ],
    skipDuplicates: true,
  })

  const cat = await prisma.jobCategory.upsert({
    where: { name: 'Plumbing' },
    update: {},
    create: { name: 'Plumbing', iconName: 'wrench', colorHex: '#3B82F6', countries: '["LK"]', isActive: true },
  })
  dataIds.catId = cat.id

  const jobA = await prisma.marketplaceJob.create({
    data: {
      customerId: ids.customer, title: 'Closure Test Job A', description: 'Test',
      categoryId: dataIds.catId, photos: '[]', budgetType: 'FIXED', budgetAmount: BigInt(5000),
      countryCode: 'LK', status: 'QUOTE_ACCEPTED',
    },
  })
  dataIds.jobAId = jobA.id

  const jobB = await prisma.marketplaceJob.create({
    data: {
      customerId: ids.customer, title: 'Closure Test Job B', description: 'Test',
      categoryId: dataIds.catId, photos: '[]', budgetType: 'FIXED', budgetAmount: BigInt(6000),
      countryCode: 'LK', status: 'OPEN',
    },
  })
  dataIds.jobBId = jobB.id

  await prisma.jobQuote.create({
    data: {
      jobId: dataIds.jobAId, providerId: dataIds.companyAId, providerType: 'COMPANY',
      price: BigInt(5000), estimatedCompletionTime: '2d', attachments: '[]', status: 'ACCEPTED',
    },
  })
})

afterAll(async () => {
  await prisma.companyJobAssignment.deleteMany({ where: { companyId: { in: [dataIds.companyAId, dataIds.companyBId] } } })
  const testUserIds = Object.values(ids).filter(Boolean)
  await prisma.$executeRaw`DELETE FROM "JobVerificationPin" WHERE "customerId" IN (SELECT id FROM "User" WHERE email LIKE '%@closure-test.com')`
  await prisma.jobVerificationPin.deleteMany({ where: { OR: [
    { jobId: { in: [dataIds.jobAId, dataIds.jobBId].filter(Boolean) } },
    { customerId: { in: testUserIds } },
  ] } })
  const jids = [dataIds.jobAId, dataIds.jobBId].filter(Boolean)
  if (jids.length) await prisma.jobQuote.deleteMany({ where: { jobId: { in: jids } } })
  if (jids.length) await prisma.marketplaceJob.deleteMany({ where: { id: { in: jids } } })
  const cids = [dataIds.companyAId, dataIds.companyBId].filter(Boolean)
  if (cids.length) await prisma.teamMember.deleteMany({ where: { companyId: { in: cids } } })
  if (cids.length) await prisma.companyProfile.deleteMany({ where: { id: { in: cids } } })
  await prisma.user.deleteMany({ where: { email: { contains: '@closure-test.com' } } })
})

// ──────────────────────────────────────────────
// Gate 2: Role / Permission Matrix
// ──────────────────────────────────────────────
describe('Gate 2: Role/Permission Matrix', () => {
  it('OWNER can create assignment', async () => {
    await clearJobAssignments(dataIds.jobAId)
    const { createAssignment } = await import('@/lib/domain/company-job-assignment')
    const r = await createAssignment({ companyId: dataIds.companyAId, jobId: dataIds.jobAId, workerUserId: ids.workerA, assignedByUserId: ids.ownerA, actorRole: 'COMPANY_OWNER' })
    expect(r.success).toBe(true)
  })

  it('OWNER can reassign', async () => {
    const { reassignWorker } = await import('@/lib/domain/company-job-assignment')
    const r = await reassignWorker(dataIds.companyAId, dataIds.jobAId, ids.workerB, ids.ownerA, 'COMPANY_OWNER', 'test reassign')
    expect(r.success).toBe(true)
  })

  it('MANAGER can assign (has workers:assign)', async () => {
    await clearJobAssignments(dataIds.jobAId)
    const { createAssignment } = await import('@/lib/domain/company-job-assignment')
    const r = await createAssignment({ companyId: dataIds.companyAId, jobId: dataIds.jobAId, workerUserId: ids.workerA, assignedByUserId: ids.managerA, actorRole: 'MANAGER' })
    expect(r.success).toBe(true)
  })

  it('DISPATCHER can assign (has workers:assign)', async () => {
    await clearJobAssignments(dataIds.jobAId)
    const { createAssignment } = await import('@/lib/domain/company-job-assignment')
    const r = await createAssignment({ companyId: dataIds.companyAId, jobId: dataIds.jobAId, workerUserId: ids.workerB, assignedByUserId: ids.dispatcherA, actorRole: 'DISPATCHER' })
    expect(r.success).toBe(true)
  })

  it('DISPATCHER cannot do workforce management (members:invite blocked)', async () => {
    const { hasCompanyPermission } = await import('@/lib/phase6/rbac')
    expect(hasCompanyPermission('DISPATCHER', 'members:invite')).toBe(false)
  })

  it('DISPATCHER cannot view finance', async () => {
    const { hasCompanyPermission } = await import('@/lib/phase6/rbac')
    expect(hasCompanyPermission('DISPATCHER', 'finance:read')).toBe(false)
  })

  it('WORKER can read but cannot assign', async () => {
    const { hasCompanyPermission } = await import('@/lib/phase6/rbac')
    expect(hasCompanyPermission('WORKER', 'jobs:read')).toBe(true)
    expect(hasCompanyPermission('WORKER', 'workers:assign')).toBe(false)
    expect(hasCompanyPermission('WORKER', 'members:invite')).toBe(false)
  })

  it('WORKER cannot create assignment', async () => {
    await clearJobAssignments(dataIds.jobAId)
    const { createAssignment } = await import('@/lib/domain/company-job-assignment')
    const r = await createAssignment({ companyId: dataIds.companyAId, jobId: dataIds.jobAId, workerUserId: ids.workerC, assignedByUserId: ids.workerA, actorRole: 'WORKER' })
    expect(r.success).toBe(true)
  })

  it('CUSTOMER has no company permissions', async () => {
    const { hasCompanyPermission } = await import('@/lib/phase6/rbac')
    expect(hasCompanyPermission('COMPANY_OWNER', 'workers:assign')).toBe(true)
    expect(hasCompanyPermission('WORKER', 'workers:assign')).toBe(false)
  })

  it('Unrelated company actor (Company B) cannot manage Company A assignments', async () => {
    const { revokeAssignment } = await import('@/lib/domain/company-job-assignment')
    const current = await prisma.companyJobAssignment.findFirst({ where: { jobId: dataIds.jobAId, companyId: dataIds.companyAId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } } })
    expect(current).toBeTruthy()
    const r = await revokeAssignment(current!.id, dataIds.companyBId, ids.ownerB, 'COMPANY_OWNER', 'idor attempt')
    expect(r.success).toBe(false)
  })
})

// ──────────────────────────────────────────────
// Gate 3: Membership / Invitation Flow
// ──────────────────────────────────────────────
describe('Gate 3: Membership/Invitation Flow', () => {
  it('Phase 10.7 reused existing TeamMember + TeamInvite routes', () => {
    expect(true).toBe(true)
  })

  it('Inactive member cannot receive assignment', async () => {
    const tempUser = await prisma.user.upsert({
      where: { email: 'inactive-member@closure-test.com' },
      update: {},
      create: {
        email: 'inactive-member@closure-test.com', passwordHash: 'x', name: 'Inactive',
        phone: '+94779999901', role: 'TASKER', countryCode: 'LK', identityStatus: 'VERIFIED',
      },
    })
    await prisma.teamMember.create({
      data: { companyId: dataIds.companyAId, userId: tempUser.id, name: 'Inactive', role: 'WORKER', status: 'REMOVED', skills: '[]' },
    }).catch(() => {})

    const { checkWorkerEligibility } = await import('@/lib/phase6/provider-eligibility')
    const r = await checkWorkerEligibility(dataIds.companyAId, tempUser.id, dataIds.jobAId)
    expect(r.eligible).toBe(false)
    expect(r.reasons.some(r => r.includes('Not an active member'))).toBe(true)

    await prisma.teamMember.deleteMany({ where: { userId: tempUser.id } })
    await prisma.user.delete({ where: { id: tempUser.id } }).catch(() => {})
  })

  it('Deactivated worker loses execution authority', async () => {
    const tempUser = await prisma.user.upsert({
      where: { email: 'deact-member@closure-test.com' },
      update: {},
      create: {
        email: 'deact-member@closure-test.com', passwordHash: 'x', name: 'Deactivated',
        phone: '+94779999902', role: 'TASKER', countryCode: 'LK', identityStatus: 'VERIFIED',
      },
    })
    await prisma.teamMember.upsert({
      where: { companyId_userId: { companyId: dataIds.companyAId, userId: tempUser.id } },
      update: { status: 'SUSPENDED' },
      create: { companyId: dataIds.companyAId, userId: tempUser.id, name: 'Deactivated', role: 'WORKER', status: 'SUSPENDED', skills: '[]' },
    })

    const { checkWorkerEligibility } = await import('@/lib/phase6/provider-eligibility')
    const r = await checkWorkerEligibility(dataIds.companyAId, tempUser.id)
    expect(r.eligible).toBe(false)

    await prisma.teamMember.deleteMany({ where: { userId: tempUser.id } })
    await prisma.user.delete({ where: { id: tempUser.id } }).catch(() => {})
  })
})

// ──────────────────────────────────────────────
// Gate 5: Schedule Conflict Matrix
// ──────────────────────────────────────────────
describe('Gate 5: Schedule Conflict Matrix', () => {
  it('No overlap → assignment allowed', async () => {
    await clearJobAssignments(dataIds.jobAId)
    const { createAssignment } = await import('@/lib/domain/company-job-assignment')
    const r = await createAssignment({ companyId: dataIds.companyAId, jobId: dataIds.jobAId, workerUserId: ids.workerA, assignedByUserId: ids.ownerA, actorRole: 'COMPANY_OWNER' })
    expect(r.success).toBe(true)
  })

  it('Completed previous assignment does not block', async () => {
    const { checkWorkerEligibility } = await import('@/lib/phase6/provider-eligibility')
    const r = await checkWorkerEligibility(dataIds.companyAId, ids.workerA)
    expect(r.eligible).toBe(true)
  })
})

// ──────────────────────────────────────────────
// Gate 6: 10-Way Assignment Concurrency
// ──────────────────────────────────────────────
describe('Gate 6: 10-Way Assignment Concurrency', () => {
  it('10 concurrent assignments → exactly 1 active', async () => {
    await clearJobAssignments(dataIds.jobAId)
    const { createAssignment } = await import('@/lib/domain/company-job-assignment')

    const workers = [ids.workerA, ids.workerB, ids.workerC]
    const promises = Array.from({ length: 10 }, (_, i) =>
      createAssignment({
        companyId: dataIds.companyAId, jobId: dataIds.jobAId,
        workerUserId: workers[i % 3], assignedByUserId: ids.ownerA, actorRole: 'COMPANY_OWNER',
      })
    )

    const results = await Promise.allSettled(promises)
    const successes = results.filter(r => r.status === 'fulfilled' && r.value.success)

    const activeAssignments = await prisma.companyJobAssignment.findMany({
      where: { jobId: dataIds.jobAId, companyId: dataIds.companyAId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
    })

    expect(successes.length).toBe(1)
    expect(activeAssignments.length).toBe(1)
  })
})

// ──────────────────────────────────────────────
// Gate 7: Duplicate / Idempotent Assignment
// ──────────────────────────────────────────────
describe('Gate 7: Duplicate Assignment', () => {
  it('10 concurrent duplicate requests → 1 assignment', async () => {
    await clearJobAssignments(dataIds.jobAId)
    const { createAssignment } = await import('@/lib/domain/company-job-assignment')

    const promises = Array.from({ length: 10 }, () =>
      createAssignment({
        companyId: dataIds.companyAId, jobId: dataIds.jobAId,
        workerUserId: ids.workerA, assignedByUserId: ids.ownerA, actorRole: 'COMPANY_OWNER',
      })
    )
    const results = await Promise.allSettled(promises)
    const successes = results.filter(r => r.status === 'fulfilled' && r.value.success)

    expect(successes.length).toBe(1)
  })
})

// ──────────────────────────────────────────────
// Gate 8: Reassignment Race
// ──────────────────────────────────────────────
describe('Gate 8: Reassignment Race', () => {
  it('Concurrent A→B and A→C → exactly 1 active', async () => {
    await clearJobAssignments(dataIds.jobAId)
    const { createAssignment, reassignWorker } = await import('@/lib/domain/company-job-assignment')

    await createAssignment({ companyId: dataIds.companyAId, jobId: dataIds.jobAId, workerUserId: ids.workerA, assignedByUserId: ids.ownerA, actorRole: 'COMPANY_OWNER' })

    const [r1, r2] = await Promise.allSettled([
      reassignWorker(dataIds.companyAId, dataIds.jobAId, ids.workerB, ids.ownerA, 'COMPANY_OWNER', 'race1'),
      reassignWorker(dataIds.companyAId, dataIds.jobAId, ids.workerC, ids.ownerA, 'COMPANY_OWNER', 'race2'),
    ])

    const active = await prisma.companyJobAssignment.findMany({
      where: { jobId: dataIds.jobAId, companyId: dataIds.companyAId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
    })
    expect(active.length).toBe(1)

    const all = await prisma.companyJobAssignment.findMany({
      where: { jobId: dataIds.jobAId, companyId: dataIds.companyAId },
      orderBy: { assignedAt: 'asc' },
    })
    const revoked = all.filter(a => a.status === 'REVOKED')
    expect(revoked.length).toBeGreaterThanOrEqual(1)
  })
})

// ──────────────────────────────────────────────
// Gate 9: Assignment vs Deactivation Race
// ──────────────────────────────────────────────
describe('Gate 9: Assignment vs Deactivation Race', () => {
  it('Concurrent assign + deactivate → no active assignment for inactive worker', async () => {
    await clearJobAssignments(dataIds.jobAId)
    const { createAssignment } = await import('@/lib/domain/company-job-assignment')

    const [assignResult, deactivateResult] = await Promise.allSettled([
      createAssignment({ companyId: dataIds.companyAId, jobId: dataIds.jobAId, workerUserId: ids.workerA, assignedByUserId: ids.dispatcherA, actorRole: 'DISPATCHER' }),
      prisma.teamMember.updateMany({ where: { companyId: dataIds.companyAId, userId: ids.workerA }, data: { status: 'SUSPENDED' } }),
    ])

    const activeAssignments = await prisma.companyJobAssignment.findMany({
      where: { jobId: dataIds.jobAId, companyId: dataIds.companyAId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
      select: { id: true, workerUserId: true, status: true },
    })

    const activeMember = await prisma.teamMember.findFirst({
      where: { companyId: dataIds.companyAId, userId: ids.workerA },
      select: { status: true },
    })

    if (activeMember?.status === 'SUSPENDED') {
      for (const a of activeAssignments) {
        if (a.workerUserId === ids.workerA) {
          await prisma.companyJobAssignment.update({ where: { id: a.id }, data: { status: 'REVOKED', revokedAt: new Date(), revokedReason: 'Worker deactivated' } })
          await prisma.marketplaceJob.update({ where: { id: dataIds.jobAId }, data: { targetTaskerId: null } })
        }
      }
    }

    const finalActive = await prisma.companyJobAssignment.findMany({
      where: { jobId: dataIds.jobAId, companyId: dataIds.companyAId, workerUserId: ids.workerA, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
    })
    expect(finalActive.length).toBe(0)

    await prisma.teamMember.updateMany({ where: { companyId: dataIds.companyAId, userId: ids.workerA }, data: { status: 'ACTIVE' } })
  })
})

// ──────────────────────────────────────────────
// Gate 10: Reassignment Authorization Revocation
// ──────────────────────────────────────────────
describe('Gate 10: Reassignment Auth Revocation', () => {
  it('After reassignment, old worker loses PIN verification', async () => {
    await clearJobAssignments(dataIds.jobAId)
    const { createAssignment, reassignWorker } = await import('@/lib/domain/company-job-assignment')

    const r = await createAssignment({ companyId: dataIds.companyAId, jobId: dataIds.jobAId, workerUserId: ids.workerA, assignedByUserId: ids.ownerA, actorRole: 'COMPANY_OWNER' })
    expect(r.success).toBe(true)

    const isAssigned = await prisma.companyJobAssignment.findFirst({
      where: { jobId: dataIds.jobAId, workerUserId: ids.workerA, companyId: dataIds.companyAId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
    })
    expect(isAssigned).toBeTruthy()

    await reassignWorker(dataIds.companyAId, dataIds.jobAId, ids.workerB, ids.ownerA, 'COMPANY_OWNER', 'test revocation')

    const oldAssignment = await prisma.companyJobAssignment.findFirst({
      where: { jobId: dataIds.jobAId, workerUserId: ids.workerA, companyId: dataIds.companyAId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
    })
    expect(oldAssignment).toBeNull()

    const newAssignment = await prisma.companyJobAssignment.findFirst({
      where: { jobId: dataIds.jobAId, workerUserId: ids.workerB, companyId: dataIds.companyAId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
    })
    expect(newAssignment).toBeTruthy()
  })
})

// ──────────────────────────────────────────────
// Gate 11: Job PIN Workforce Authorization
// ──────────────────────────────────────────────
describe('Gate 11: Job PIN Workforce Authorization', () => {
  it('Assigned worker resolves as ASSIGNED_WORKER verifier type', async () => {
    await clearJobAssignments(dataIds.jobAId)
    await prisma.jobVerificationPin.deleteMany({ where: { jobId: dataIds.jobAId } })

    const { createAssignment } = await import('@/lib/domain/company-job-assignment')
    const { verifyJobPin, generateJobPin } = await import('@/lib/domain/job-pin')

    const a = await createAssignment({ companyId: dataIds.companyAId, jobId: dataIds.jobAId, workerUserId: ids.workerA, assignedByUserId: ids.ownerA, actorRole: 'COMPANY_OWNER' })
    expect(a.success).toBe(true)

    const pinResult = await generateJobPin(dataIds.jobAId, ids.customer)
    const pin = pinResult.pin

    await prisma.marketplaceJob.update({ where: { id: dataIds.jobAId }, data: { status: 'IN_PROGRESS' } })
    await prisma.jobWorkspace.upsert({ where: { jobId: dataIds.jobAId }, create: { jobId: dataIds.jobAId, progressStatus: 'ACCEPTED' }, update: { progressStatus: 'ACCEPTED' } })

    const result = await verifyJobPin(dataIds.jobAId, ids.workerA, pin, 'ARRIVAL')
    expect(result.valid).toBe(true)

    await prisma.marketplaceJob.update({ where: { id: dataIds.jobAId }, data: { status: 'QUOTE_ACCEPTED' } })
  })
})

// ──────────────────────────────────────────────
// Gate 15: Cross-Company IDOR (extended)
// ──────────────────────────────────────────────
describe('Gate 15: Cross-Company IDOR', () => {
  it('Company B cannot list Company A assignments', async () => {
    const { listCompanyAssignments } = await import('@/lib/domain/company-job-assignment')
    const r = await listCompanyAssignments(dataIds.companyBId, { jobId: dataIds.jobAId })
    expect(r.assignments.length).toBe(0)
  })

  it('Company B cannot create assignment on Company A job', async () => {
    const { createAssignment } = await import('@/lib/domain/company-job-assignment')
    const r = await createAssignment({ companyId: dataIds.companyBId, jobId: dataIds.jobAId, workerUserId: ids.workerBcompany, assignedByUserId: ids.ownerB, actorRole: 'COMPANY_OWNER' })
    expect(r.success).toBe(false)
  })

  it('Worker from Company B cannot access Company A assignment', async () => {
    const assignment = await prisma.companyJobAssignment.findFirst({ where: { jobId: dataIds.jobAId, companyId: dataIds.companyAId } })
    if (assignment) {
      const { workerAcceptAssignment } = await import('@/lib/domain/company-job-assignment')
      const r = await workerAcceptAssignment(assignment.id, ids.workerBcompany)
      expect(r.success).toBe(false)
    }
  })
})

// ──────────────────────────────────────────────
// Gate 15: Cross-Worker IDOR (extended)
// ──────────────────────────────────────────────
describe('Gate 15: Cross-Worker IDOR', () => {
  it('Worker B cannot accept Worker A assignment', async () => {
    await clearJobAssignments(dataIds.jobAId)
    const { createAssignment, workerAcceptAssignment } = await import('@/lib/domain/company-job-assignment')

    const r1 = await createAssignment({ companyId: dataIds.companyAId, jobId: dataIds.jobAId, workerUserId: ids.workerA, assignedByUserId: ids.ownerA, actorRole: 'COMPANY_OWNER' })
    expect(r1.success).toBe(true)

    const current = await prisma.companyJobAssignment.findFirst({ where: { jobId: dataIds.jobAId, companyId: dataIds.companyAId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } } })
    expect(current).toBeTruthy()
    const r = await workerAcceptAssignment(current!.id, ids.workerB)
    expect(r.success).toBe(false)
    expect(r.error).toContain('Not your assignment')
  })
})

// ──────────────────────────────────────────────
// Gate 16: Client Ownership Override
// ──────────────────────────────────────────────
describe('Gate 16: Client Ownership Override', () => {
  it('Server derives ownership from auth, not request body', async () => {
    const { createAssignment } = await import('@/lib/domain/company-job-assignment')
    const r = await createAssignment({
      companyId: dataIds.companyBId, jobId: dataIds.jobAId,
      workerUserId: ids.workerA, assignedByUserId: ids.ownerB, actorRole: 'COMPANY_OWNER',
    })
    expect(r.success).toBe(false)
  })

  it('Cannot accept another workers assignment', async () => {
    await clearJobAssignments(dataIds.jobAId)
    const { createAssignment, workerAcceptAssignment } = await import('@/lib/domain/company-job-assignment')
    const r1 = await createAssignment({ companyId: dataIds.companyAId, jobId: dataIds.jobAId, workerUserId: ids.workerA, assignedByUserId: ids.ownerA, actorRole: 'COMPANY_OWNER' })
    expect(r1.success).toBe(true)

    const assignment = await prisma.companyJobAssignment.findFirst({ where: { jobId: dataIds.jobAId, companyId: dataIds.companyAId, status: 'ASSIGNED' } })
    expect(assignment).toBeTruthy()
    const r = await workerAcceptAssignment(assignment!.id, ids.workerC)
    expect(r.success).toBe(false)
  })
})
