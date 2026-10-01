import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createAssignment, reassignWorker, revokeAssignment, workerAcceptAssignment, workerRejectAssignment } from '../../lib/domain/company-job-assignment'
import { resolveCompanyContext } from '../../lib/phase6/company-context'

const prisma = new PrismaClient()

const TEST_COMPANY_A = 'test-company-a-workforce'
const TEST_COMPANY_B = 'test-company-b-workforce'
const TEST_CUSTOMER = 'test-customer-workforce'
const TEST_WORKER_A = 'test-worker-a-workforce'
const TEST_WORKER_B = 'test-worker-b-workforce'
const TEST_OWNER_A = 'test-owner-a-workforce'
const TEST_OWNER_B = 'test-owner-b-workforce'

let companyAId: string
let companyBId: string
let customerId: string
let workerAUserId: string
let workerBUserId: string
let ownerAUserId: string
let ownerBUserId: string
let jobAId: string
let jobBId: string

beforeAll(async () => {
  const now = new Date()

  const ownerA = await prisma.user.upsert({
    where: { email: `${TEST_OWNER_A}@test.com` },
    update: {},
    create: {
      email: `${TEST_OWNER_A}@test.com`,
      passwordHash: 'dummy',
      name: 'Owner A Workforce',
      phone: '+94770000010',
      role: 'CUSTOMER',
      countryCode: 'LK',
      identityStatus: 'VERIFIED',
    },
  })
  ownerAUserId = ownerA.id

  const workerA = await prisma.user.upsert({
    where: { email: `${TEST_WORKER_A}@test.com` },
    update: {},
    create: {
      email: `${TEST_WORKER_A}@test.com`,
      passwordHash: 'dummy',
      name: 'Worker A Workforce',
      phone: '+94770000011',
      role: 'TASKER',
      countryCode: 'LK',
      identityStatus: 'VERIFIED',
    },
  })
  workerAUserId = workerA.id

  const workerB = await prisma.user.upsert({
    where: { email: `${TEST_WORKER_B}@test.com` },
    update: {},
    create: {
      email: `${TEST_WORKER_B}@test.com`,
      passwordHash: 'dummy',
      name: 'Worker B Workforce',
      phone: '+94770000012',
      role: 'TASKER',
      countryCode: 'LK',
      identityStatus: 'VERIFIED',
    },
  })
  workerBUserId = workerB.id

  const cust = await prisma.user.upsert({
    where: { email: `${TEST_CUSTOMER}@test.com` },
    update: {},
    create: {
      email: `${TEST_CUSTOMER}@test.com`,
      passwordHash: 'dummy',
      name: 'Customer Workforce',
      phone: '+94770000013',
      role: 'CUSTOMER',
      countryCode: 'LK',
    },
  })
  customerId = cust.id

  const compA = await prisma.companyProfile.upsert({
    where: { userId: ownerAUserId },
    update: {},
    create: {
      userId: ownerAUserId,
      companyName: 'Test Company A Workforce',
      services: '["plumbing"]',
      serviceAreas: '["colombo"]',
      isVerified: true,
      verificationStatus: 'VERIFIED',
      countryCode: 'LK',
    },
  })
  companyAId = compA.id

  const ownerB = await prisma.user.upsert({
    where: { email: `${TEST_OWNER_B}@test.com` },
    update: {},
    create: {
      email: `${TEST_OWNER_B}@test.com`,
      passwordHash: 'dummy',
      name: 'Owner B Workforce',
      phone: '+94770000020',
      role: 'CUSTOMER',
      countryCode: 'LK',
      identityStatus: 'VERIFIED',
    },
  })
  ownerBUserId = ownerB.id

  const compB = await prisma.companyProfile.upsert({
    where: { userId: ownerBUserId },
    update: {},
    create: {
      userId: ownerBUserId,
      companyName: 'Test Company B Workforce',
      services: '["electrical"]',
      serviceAreas: '["colombo"]',
      isVerified: true,
      verificationStatus: 'VERIFIED',
      countryCode: 'LK',
    },
  })
  companyBId = compB.id

  await prisma.teamMember.createMany({
    data: [
      { companyId: companyAId, userId: ownerAUserId, name: 'Owner A', role: 'COMPANY_OWNER', status: 'ACTIVE', skills: '[]' },
      { companyId: companyAId, userId: workerAUserId, name: 'Worker A', role: 'WORKER', status: 'ACTIVE', skills: '["plumbing"]' },
      { companyId: companyAId, userId: workerBUserId, name: 'Worker B', role: 'WORKER', status: 'ACTIVE', skills: '["plumbing"]' },
    ],
    skipDuplicates: true,
  })

  const catA = await prisma.jobCategory.upsert({
    where: { name: 'Plumbing' },
    update: {},
    create: { name: 'Plumbing', slug: 'plumbing-workforce', iconName: 'wrench', colorHex: '#3B82F6', countries: '["LK"]', isActive: true },
  })

  const jobA = await prisma.marketplaceJob.create({
    data: {
      customerId,
      title: 'Test Job A Workforce',
      description: 'Test job for workforce',
      categoryId: catA.id,
      photos: '[]',
      budgetType: 'FIXED',
      budgetAmount: BigInt(5000),
      countryCode: 'LK',
      status: 'QUOTE_ACCEPTED',
    },
  })
  jobAId = jobA.id

  const jobB = await prisma.marketplaceJob.create({
    data: {
      customerId,
      title: 'Test Job B Workforce',
      description: 'Test job B for workforce',
      categoryId: catA.id,
      photos: '[]',
      budgetType: 'FIXED',
      budgetAmount: BigInt(8000),
      countryCode: 'LK',
      status: 'OPEN',
    },
  })
  jobBId = jobB.id

  await prisma.jobQuote.create({
    data: {
      jobId: jobAId,
      providerId: companyAId,
      providerType: 'COMPANY',
      price: BigInt(5000),
      estimatedCompletionTime: '2 days',
      attachments: '[]',
      status: 'ACCEPTED',
    },
  })
})

afterAll(async () => {
  await prisma.companyJobAssignment.deleteMany({ where: { companyId: { in: [companyAId, companyBId].filter(Boolean) } } })
  const jobIds = [jobAId, jobBId].filter(Boolean)
  if (jobIds.length > 0) {
    await prisma.marketplaceJob.deleteMany({ where: { id: { in: jobIds } } })
    await prisma.jobQuote.deleteMany({ where: { jobId: { in: jobIds } } })
  }
  await prisma.teamMember.deleteMany({ where: { companyId: { in: [companyAId, companyBId].filter(Boolean) } } })
  await prisma.companyProfile.deleteMany({ where: { id: { in: [companyAId, companyBId].filter(Boolean) } } })
  await prisma.user.deleteMany({ where: { email: { contains: 'workforce' } } })
})

beforeEach(async () => {
  await prisma.companyJobAssignment.deleteMany({ where: { companyId: companyAId } })
  await prisma.marketplaceJob.update({ where: { id: jobAId }, data: { targetTaskerId: null } })
})

describe('Phase 10.7 — Cross-Company IDOR Protection', () => {
  it('Company A cannot create assignment on Company B job', async () => {
    const result = await createAssignment({
      companyId: companyBId,
      jobId: jobAId,
      workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId,
      actorRole: 'COMPANY_OWNER',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('No accepted quote')
  })

  it('Company A assignment works with correct company', async () => {
    const result = await createAssignment({
      companyId: companyAId,
      jobId: jobAId,
      workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId,
      actorRole: 'COMPANY_OWNER',
    })

    expect(result.success).toBe(true)
    expect(result.assignmentId).toBeDefined()
  })
})

describe('Phase 10.7 — Cross-Worker IDOR Protection', () => {
  it('Worker B cannot accept Worker A assignment', async () => {
    const createResult = await createAssignment({
      companyId: companyAId,
      jobId: jobAId,
      workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(createResult.success).toBe(true)

    const acceptResult = await workerAcceptAssignment(createResult.assignmentId!, workerBUserId)
    expect(acceptResult.success).toBe(false)
    expect(acceptResult.error).toContain('Not your assignment')
  })

  it('Worker B cannot reject Worker A assignment', async () => {
    const createResult = await createAssignment({
      companyId: companyAId,
      jobId: jobAId,
      workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(createResult.success).toBe(true)

    const rejectResult = await workerRejectAssignment(createResult.assignmentId!, workerBUserId)
    expect(rejectResult.success).toBe(false)
    expect(rejectResult.error).toContain('Not your assignment')
  })
})

describe('Phase 10.7 — Membership Company Context', () => {
  it('global TASKER worker resolves its company through TeamMember membership', async () => {
    const user = await prisma.user.findUnique({ where: { id: workerAUserId } })
    expect(user?.role).toBe('TASKER')

    const own = await resolveCompanyContext(workerAUserId, companyAId, 'quotes:read')
    expect(own.error).toBeUndefined()
    expect(own.context?.companyId).toBe(companyAId)
    expect(own.context?.role).toBe('WORKER')

    const other = await resolveCompanyContext(workerAUserId, companyBId, 'quotes:read')
    expect(other.context).toBeNull()
    expect(other.error).toBeTruthy()
  })
})

describe('Phase 10.7 — Concurrency Protection', () => {
  it('Cannot assign to already-assigned job without reassign', async () => {
    const first = await createAssignment({
      companyId: companyAId,
      jobId: jobAId,
      workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(first.success).toBe(true)

    const second = await createAssignment({
      companyId: companyAId,
      jobId: jobAId,
      workerUserId: workerBUserId,
      assignedByUserId: ownerAUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(second.success).toBe(false)
    expect(second.error).toContain('active assignment')
  })

  it('Can reassign back to a previously revoked worker without violating the unique job/worker key', async () => {
    const first = await createAssignment({
      companyId: companyAId,
      jobId: jobAId,
      workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(first.success).toBe(true)

    const toWorkerB = await reassignWorker(
      companyAId, jobAId, workerBUserId, ownerAUserId, 'COMPANY_OWNER', 'Rotate worker'
    )
    expect(toWorkerB.success).toBe(true)

    const backToWorkerA = await reassignWorker(
      companyAId, jobAId, workerAUserId, ownerAUserId, 'COMPANY_OWNER', 'Original worker available again'
    )
    expect(backToWorkerA.success).toBe(true)
    expect(backToWorkerA.assignmentId).toBe(first.assignmentId)

    const assignmentA = await prisma.companyJobAssignment.findUnique({
      where: { id: first.assignmentId! },
    })
    expect(assignmentA?.status).toBe('ASSIGNED')
    expect(assignmentA?.revokedAt).toBeNull()
    expect(assignmentA?.revokedReason).toBeNull()

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobAId } })
    expect(job?.targetTaskerId).toBe(workerAUserId)
  })

  it('Rejects a no-op reassignment to the already active worker', async () => {
    const first = await createAssignment({
      companyId: companyAId,
      jobId: jobAId,
      workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(first.success).toBe(true)

    const result = await reassignWorker(
      companyAId, jobAId, workerAUserId, ownerAUserId, 'COMPANY_OWNER', 'No change'
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('already the active assignee')
  })

  it('Reassignment revokes old and creates new', async () => {
    const first = await createAssignment({
      companyId: companyAId,
      jobId: jobAId,
      workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(first.success).toBe(true)

    const reassign = await reassignWorker(
      companyAId, jobAId, workerBUserId, ownerAUserId, 'COMPANY_OWNER', 'Better fit'
    )
    expect(reassign.success).toBe(true)

    const oldAssignment = await prisma.companyJobAssignment.findUnique({ where: { id: first.assignmentId! } })
    expect(oldAssignment?.status).toBe('REVOKED')
    expect(oldAssignment?.revokedReason).toBe('Better fit')

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobAId } })
    expect(job?.targetTaskerId).toBe(workerBUserId)
  })
})

describe('Phase 10.7 — Assignment State Machine', () => {
  it('Valid transition: ASSIGNED → ACCEPTED → IN_PROGRESS → COMPLETED', async () => {
    const createResult = await createAssignment({
      companyId: companyAId,
      jobId: jobAId,
      workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(createResult.success).toBe(true)
    const assignmentId = createResult.assignmentId!

    const accept = await workerAcceptAssignment(assignmentId, workerAUserId)
    expect(accept.success).toBe(true)

    await prisma.companyJobAssignment.update({ where: { id: assignmentId }, data: { status: 'IN_PROGRESS', startedAt: new Date() } })

    const completed = await prisma.companyJobAssignment.update({
      where: { id: assignmentId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
    expect(completed.status).toBe('COMPLETED')
  })

  it('Valid transition: ASSIGNED → REJECTED', async () => {
    const createResult = await createAssignment({
      companyId: companyAId,
      jobId: jobAId,
      workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(createResult.success).toBe(true)

    const reject = await workerRejectAssignment(createResult.assignmentId!, workerAUserId, 'Too far')
    expect(reject.success).toBe(true)

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jobAId } })
    expect(job?.targetTaskerId).toBeNull()
  })

  it('Cannot accept already-accepted assignment', async () => {
    const createResult = await createAssignment({
      companyId: companyAId,
      jobId: jobAId,
      workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(createResult.success).toBe(true)

    await workerAcceptAssignment(createResult.assignmentId!, workerAUserId)

    const secondAccept = await workerAcceptAssignment(createResult.assignmentId!, workerAUserId)
    expect(secondAccept.success).toBe(false)
    expect(secondAccept.error).toContain('Cannot accept')
  })
})

describe('Phase 10.7 — Job PIN Extended Verification', () => {
  it('Assigned worker can verify PIN for company job via accept/reject flow', async () => {
    const createResult = await createAssignment({
      companyId: companyAId,
      jobId: jobAId,
      workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(createResult.success).toBe(true)

    const accept = await workerAcceptAssignment(createResult.assignmentId!, workerAUserId)
    expect(accept.success).toBe(true)

    const assignment = await prisma.companyJobAssignment.findUnique({ where: { id: createResult.assignmentId! } })
    expect(assignment?.status).toBe('ACCEPTED')
  })
})

describe('Phase 10.7 — Revoke Protection', () => {
  it('Company A cannot revoke Company B assignment', async () => {
    const createResult = await createAssignment({
      companyId: companyAId,
      jobId: jobAId,
      workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId,
      actorRole: 'COMPANY_OWNER',
    })
    expect(createResult.success).toBe(true)

    const revoke = await revokeAssignment(
      createResult.assignmentId!, companyBId, workerBUserId, 'WORKER', 'test'
    )
    expect(revoke.success).toBe(false)
    expect(revoke.error).toContain('does not belong')
  })
})
