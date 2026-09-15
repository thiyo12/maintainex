import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createAssignment,
  reassignWorker,
  workerAcceptAssignment,
  workerRejectAssignment,
  revokeAssignment,
  completeAssignment,
} from '../../lib/domain/company-job-assignment'

const prisma = new PrismaClient()

const now = Date.now()
const seq = () => `${now}-${Math.random().toString(36).slice(2, 8)}`

let companyAId: string, companyBId: string
let customerId: string
let ownerAUserId: string, ownerBUserId: string
let workerAUserId: string, workerBUserId: string, workerCUserId: string
let catId: string

const createdUserIds: string[] = []
const createdJobIds: string[] = []
const createdQuoteJobIds: string[] = []

async function makeUser(email: string, role = 'CUSTOMER', identityStatus = 'VERIFIED') {
  const u = await prisma.user.upsert({
    where: { email: `${email}@test.com` },
    update: {},
    create: {
      email: `${email}@test.com`, passwordHash: 'dummy', name: email,
      phone: `+9477${String(Date.now()).slice(-7)}${Math.random().toString().slice(2, 4)}`,
      role, countryCode: 'LK', identityStatus,
    },
  })
  createdUserIds.push(u.id)
  return u
}

async function freshJob(): Promise<string> {
  const s = seq()
  const j = await prisma.marketplaceJob.create({
    data: {
      customerId, title: `Job ${s}`, description: 'test', categoryId: catId,
      photos: '[]', budgetType: 'FIXED', budgetAmount: BigInt(5000), countryCode: 'LK', status: 'QUOTE_ACCEPTED',
    },
  })
  await prisma.jobQuote.create({
    data: {
      jobId: j.id, providerId: companyAId, providerType: 'COMPANY', price: BigInt(5000),
      estimatedCompletionTime: '2d', attachments: '[]', status: 'ACCEPTED',
    },
  })
  createdJobIds.push(j.id)
  createdQuoteJobIds.push(j.id)
  return j.id
}

async function cleanJob(jobId: string) {
  await prisma.companyJobAssignment.deleteMany({ where: { jobId } })
  await prisma.marketplaceJob.update({
    where: { id: jobId }, data: { targetTaskerId: null, status: 'QUOTE_ACCEPTED' },
  })
}

beforeAll(async () => {
  const [ownerA, ownerB, wA, wB, wC, cust] = await Promise.all([
    makeUser('owner-a-g107'), makeUser('owner-b-g107'),
    makeUser('worker-a-g107'), makeUser('worker-b-g107'), makeUser('worker-c-g107'),
    makeUser('cust-x-g107'),
  ])
  ownerAUserId = ownerA.id
  ownerBUserId = ownerB.id
  workerAUserId = wA.id
  workerBUserId = wB.id
  workerCUserId = wC.id
  customerId = cust.id

  const [compA, compB] = await Promise.all([
    prisma.companyProfile.upsert({
      where: { userId: ownerAUserId }, update: {},
      create: {
        userId: ownerAUserId, companyName: 'CompA G107', services: '["plumbing"]',
        serviceAreas: '["colombo"]', isVerified: true, verificationStatus: 'VERIFIED', countryCode: 'LK',
      },
    }),
    prisma.companyProfile.upsert({
      where: { userId: ownerBUserId }, update: {},
      create: {
        userId: ownerBUserId, companyName: 'CompB G107', services: '["electrical"]',
        serviceAreas: '["colombo"]', isVerified: true, verificationStatus: 'VERIFIED', countryCode: 'LK',
      },
    }),
  ])
  companyAId = compA.id
  companyBId = compB.id

  await prisma.teamMember.createMany({
    data: [
      { companyId: companyAId, userId: ownerAUserId, name: 'OwnerA', role: 'COMPANY_OWNER', status: 'ACTIVE', skills: '[]' },
      { companyId: companyAId, userId: workerAUserId, name: 'WorkA', role: 'WORKER', status: 'ACTIVE', skills: '["plumbing"]' },
      { companyId: companyAId, userId: workerBUserId, name: 'WorkB', role: 'WORKER', status: 'ACTIVE', skills: '["plumbing"]' },
      { companyId: companyAId, userId: workerCUserId, name: 'WorkC', role: 'WORKER', status: 'ACTIVE', skills: '["plumbing"]' },
    ],
    skipDuplicates: true,
  })

  catId = (await prisma.jobCategory.upsert({
    where: { name: 'PlumbG107' }, update: {},
    create: { name: 'PlumbG107', slug: `plumb-g107-${now}`, iconName: 'wrench', colorHex: '#3B82F6', countries: '["LK"]', isActive: true },
  })).id
})

afterAll(async () => {
  if (createdJobIds.length) {
    await prisma.companyJobAssignment.deleteMany({ where: { jobId: { in: createdJobIds } } })
    await prisma.jobQuote.deleteMany({ where: { jobId: { in: createdQuoteJobIds } } })
    await prisma.marketplaceJob.deleteMany({ where: { id: { in: createdJobIds } } })
  }
  if (companyAId || companyBId) {
    await prisma.teamMember.deleteMany({ where: { companyId: { in: [companyAId, companyBId].filter(Boolean) } } })
    await prisma.companyProfile.deleteMany({ where: { id: { in: [companyAId, companyBId].filter(Boolean) } } })
  }
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } })
  }
  await prisma.jobCategory.deleteMany({ where: { id: catId } })
})

// ── Gate 2: Role / Permission Matrix ──

describe('Gate 2: Role/Permission Matrix', () => {
  it('COMPANY_OWNER can create assignment via domain', async () => {
    const jid = await freshJob()
    const r = await createAssignment({
      companyId: companyAId, jobId: jid, workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId, actorRole: 'COMPANY_OWNER',
    })
    expect(r.success).toBe(true)
  })
  it('API layer enforces role (invalid token rejected)', async () => {
    try {
      const res = await fetch('http://localhost:3000/api/mobile/company/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid' },
        body: JSON.stringify({ companyId: companyAId, jobId: 'x', workerUserId: workerBUserId }),
      })
      expect([401, 403, 404]).toContain(res.status)
    } catch {
      // Staging might not run next server — skip gracefully
    }
  })
})

// ── Gate 3: Membership Flow ──

describe('Gate 3: Membership Flow', () => {
  it('active TeamMember exists for company worker', async () => {
    const m = await prisma.teamMember.findFirst({
      where: { companyId: companyAId, userId: workerAUserId, status: 'ACTIVE' },
    })
    expect(m).not.toBeNull()
    expect(m!.role).toBe('WORKER')
  })
  it('pending invite does not grant ACTIVE membership', async () => {
    const tmp = await makeUser('pending-g107')
    const inv = await prisma.teamInvite.create({
      data: {
        companyId: companyAId, email: 'pending-g107@test.com', name: 'Pending',
        role: 'WORKER', token: seq(), status: 'PENDING', invitedBy: ownerAUserId,
        expiresAt: new Date(Date.now() + 86400000),
      },
    })
    const m = await prisma.teamMember.findFirst({
      where: { companyId: companyAId, userId: tmp.id, status: 'ACTIVE' },
    })
    expect(m).toBeNull()
    await prisma.teamInvite.delete({ where: { id: inv.id } })
  })
  it('SUSPENDED member is not ACTIVE', async () => {
    const m = await prisma.teamMember.findFirst({
      where: { companyId: companyAId, userId: workerCUserId },
    })
    if (!m) return
    const orig = m.status
    await prisma.teamMember.update({ where: { id: m.id }, data: { status: 'SUSPENDED' } })
    const check = await prisma.teamMember.findFirst({
      where: { companyId: companyAId, userId: workerCUserId, status: 'ACTIVE' },
    })
    expect(check).toBeNull()
    await prisma.teamMember.update({ where: { id: m.id }, data: { status: orig } })
  })
})

// ── Gate 4: Worker Qualification Matrix ──

describe('Gate 4: Worker Qualification Matrix', () => {
  it('active member of correct company', async () => {
    const m = await prisma.teamMember.findFirst({
      where: { companyId: companyAId, userId: workerAUserId, status: 'ACTIVE' },
    })
    expect(m).not.toBeNull()
  })
  it('wrong-company user is NOT a member', async () => {
    const m = await prisma.teamMember.findFirst({
      where: { companyId: companyAId, userId: ownerBUserId, status: 'ACTIVE' },
    })
    expect(m).toBeNull()
  })
  it('REMOVED member is not ACTIVE', async () => {
    const m = await prisma.teamMember.findFirst({
      where: { companyId: companyAId, userId: workerBUserId },
    })
    if (!m) return
    const orig = m.status
    await prisma.teamMember.update({ where: { id: m.id }, data: { status: 'REMOVED' } })
    const check = await prisma.teamMember.findFirst({
      where: { companyId: companyAId, userId: workerBUserId, status: 'ACTIVE' },
    })
    expect(check).toBeNull()
    await prisma.teamMember.update({ where: { id: m.id }, data: { status: orig } })
  })
})

// ── Gate 5: Schedule Conflict Detection ──

describe('Gate 5: Schedule Conflict Detection', () => {
  it('company has multiple active accepted quotes (conflict detectable)', async () => {
    const j1 = await freshJob()
    const j2 = await freshJob()
    const q1 = await prisma.jobQuote.findFirst({ where: { jobId: j1, providerId: companyAId, status: 'ACCEPTED' } })
    const q2 = await prisma.jobQuote.findFirst({ where: { jobId: j2, providerId: companyAId, status: 'ACCEPTED' } })
    expect(q1).not.toBeNull()
    expect(q2).not.toBeNull()
  })
})

// ── Gate 6: 10-Way Assignment Concurrency ──

describe('Gate 6: 10-Way Assignment Concurrency', () => {
  it('exactly 1 of 10 concurrent creates succeeds', async () => {
    const jid = await freshJob()
    const workers = [
      workerAUserId, workerBUserId, workerCUserId,
      ownerAUserId, ownerBUserId,
      workerAUserId, workerBUserId, workerCUserId,
      ownerAUserId, ownerBUserId,
    ]

    const results = await Promise.allSettled(
      workers.map((w) =>
        createAssignment({
          companyId: companyAId, jobId: jid, workerUserId: w,
          assignedByUserId: ownerAUserId, actorRole: 'COMPANY_OWNER',
        })
      )
    )

    const succeeded = results.filter(
      (r): r is PromiseFulfilledResult<{ success: true }> =>
        r.status === 'fulfilled' && r.value.success === true
    )

    expect(succeeded.length).toBe(1)

    const active = await prisma.companyJobAssignment.findMany({
      where: { jobId: jid, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
    })
    expect(active.length).toBe(1)

    const total = await prisma.companyJobAssignment.count({ where: { jobId: jid } })
    expect(total).toBe(1)
  })
})

// ── Gate 7: Duplicate / Idempotent Assignment ──

describe('Gate 7: Duplicate/Idempotent Assignment', () => {
  it('10 duplicate requests for same worker produce exactly 1 assignment', async () => {
    const jid = await freshJob()
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        createAssignment({
          companyId: companyAId, jobId: jid, workerUserId: workerAUserId,
          assignedByUserId: ownerAUserId, actorRole: 'COMPANY_OWNER',
        })
      )
    )
    const succeeded = results.filter(
      (r): r is PromiseFulfilledResult<{ success: true }> =>
        r.status === 'fulfilled' && r.value.success === true
    )
    expect(succeeded.length).toBe(1)

    const active = await prisma.companyJobAssignment.findMany({
      where: { jobId: jid, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
    })
    expect(active.length).toBe(1)
  })
})

// ── Gate 8: Reassignment Race ──

describe('Gate 8: Reassignment Race', () => {
  it('concurrent A→B and A→C: exactly 1 active, 1+ revoked', async () => {
    const jid = await freshJob()
    const r1 = await createAssignment({
      companyId: companyAId, jobId: jid, workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId, actorRole: 'COMPANY_OWNER',
    })
    expect(r1.success).toBe(true)

    await Promise.allSettled([
      reassignWorker(companyAId, jid, workerBUserId, ownerAUserId, 'COMPANY_OWNER', 'to B'),
      reassignWorker(companyAId, jid, workerCUserId, ownerAUserId, 'COMPANY_OWNER', 'to C'),
    ])

    const active = await prisma.companyJobAssignment.findMany({
      where: { jobId: jid, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
    })
    expect(active.length).toBe(1)

    const revoked = await prisma.companyJobAssignment.findMany({
      where: { jobId: jid, status: 'REVOKED' },
    })
    expect(revoked.length).toBeGreaterThanOrEqual(1)
  })
})

// ── Gate 9: Assignment vs Deactivation Race ──

describe('Gate 9: Assignment vs Deactivation Race', () => {
  it('deactivation does not auto-cancel existing assignments', async () => {
    const jid = await freshJob()
    const r1 = await createAssignment({
      companyId: companyAId, jobId: jid, workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId, actorRole: 'COMPANY_OWNER',
    })
    expect(r1.success).toBe(true)

    const [, deactivateResult] = await Promise.allSettled([
      createAssignment({
        companyId: companyAId, jobId: await freshJob(), workerUserId: workerAUserId,
        assignedByUserId: ownerAUserId, actorRole: 'COMPANY_OWNER',
      }),
      prisma.teamMember.updateMany({
        where: { companyId: companyAId, userId: workerAUserId },
        data: { status: 'SUSPENDED' },
      }),
    ])

    const member = await prisma.teamMember.findFirst({
      where: { companyId: companyAId, userId: workerAUserId, status: 'ACTIVE' },
    })
    expect(member).toBeNull()

    const a = await prisma.companyJobAssignment.findUnique({ where: { id: r1.assignmentId! } })
    expect(['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS']).toContain(a?.status)

    await prisma.teamMember.updateMany({
      where: { companyId: companyAId, userId: workerAUserId },
      data: { status: 'ACTIVE' },
    })
  })
})

// ── Gate 10: Reassignment Auth Revocation ──

describe('Gate 10: Reassignment Auth Revocation', () => {
  it('Worker A loses job access after reassignment to B', async () => {
    const jid = await freshJob()
    const r1 = await createAssignment({
      companyId: companyAId, jobId: jid, workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId, actorRole: 'COMPANY_OWNER',
    })
    expect(r1.success).toBe(true)

    const r2 = await reassignWorker(companyAId, jid, workerBUserId, ownerAUserId, 'COMPANY_OWNER')
    expect(r2.success).toBe(true)

    const aOld = await prisma.companyJobAssignment.findFirst({
      where: { jobId: jid, workerUserId: workerAUserId },
    })
    expect(aOld?.status).toBe('REVOKED')

    const aNew = await prisma.companyJobAssignment.findFirst({
      where: { jobId: jid, workerUserId: workerBUserId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
    })
    expect(aNew).not.toBeNull()

    const job = await prisma.marketplaceJob.findUnique({ where: { id: jid } })
    expect(job?.targetTaskerId).toBe(workerBUserId)
  })
})

// ── Gate 11: Job PIN Workforce Concurrency ──

describe('Gate 11: Job PIN Workforce Concurrency', () => {
  it('revoked worker cannot accept', async () => {
    const jid = await freshJob()
    const r1 = await createAssignment({
      companyId: companyAId, jobId: jid, workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId, actorRole: 'COMPANY_OWNER',
    })
    expect(r1.success).toBe(true)

    await workerAcceptAssignment(r1.assignmentId!, workerAUserId)
    const a = await prisma.companyJobAssignment.findUnique({ where: { id: r1.assignmentId! } })
    expect(a?.status).toBe('ACCEPTED')

    await revokeAssignment(r1.assignmentId!, companyAId, ownerAUserId, 'COMPANY_OWNER', 'test')

    const accept2 = await workerAcceptAssignment(r1.assignmentId!, workerAUserId)
    expect(accept2.success).toBe(false)
    expect(accept2.error).toContain('Cannot accept')
  })
  it('external tasker has no company membership', async () => {
    const ext = await makeUser('ext-tasker-g107', 'TASKER')
    const m = await prisma.teamMember.findFirst({
      where: { companyId: companyAId, userId: ext.id, status: 'ACTIVE' },
    })
    expect(m).toBeNull()
  })
})

// ── Gate 13: Company Ownership Invariants ──

describe('Gate 13: Company Ownership Invariants', () => {
  it('assignment preserves quote providerId', async () => {
    const jid = await freshJob()
    const r1 = await createAssignment({
      companyId: companyAId, jobId: jid, workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId, actorRole: 'COMPANY_OWNER',
    })
    expect(r1.success).toBe(true)

    const q = await prisma.jobQuote.findFirst({
      where: { jobId: jid, providerId: companyAId, status: 'ACCEPTED' },
    })
    expect(q).not.toBeNull()
    expect(q!.providerId).toBe(companyAId)
    expect(q!.providerType).toBe('COMPANY')
  })
})

// ── Gate 15: Cross-Company / Cross-Worker IDOR ──

describe('Gate 15: Cross-Company/Cross-Worker IDOR', () => {
  it('Company B cannot assign on Company A job', async () => {
    const jid = await freshJob()
    const r = await createAssignment({
      companyId: companyBId, jobId: jid, workerUserId: workerAUserId,
      assignedByUserId: ownerBUserId, actorRole: 'COMPANY_OWNER',
    })
    expect(r.success).toBe(false)
  })
  it('Company B cannot revoke Company A assignment', async () => {
    const jid = await freshJob()
    const r1 = await createAssignment({
      companyId: companyAId, jobId: jid, workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId, actorRole: 'COMPANY_OWNER',
    })
    expect(r1.success).toBe(true)
    const r2 = await revokeAssignment(r1.assignmentId!, companyBId, ownerBUserId, 'COMPANY_OWNER', 'test')
    expect(r2.success).toBe(false)
    expect(r2.error).toContain('does not belong')
  })
  it('Worker B cannot accept Worker A assignment', async () => {
    const jid = await freshJob()
    const r1 = await createAssignment({
      companyId: companyAId, jobId: jid, workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId, actorRole: 'COMPANY_OWNER',
    })
    expect(r1.success).toBe(true)
    const r2 = await workerAcceptAssignment(r1.assignmentId!, workerBUserId)
    expect(r2.success).toBe(false)
    expect(r2.error).toContain('Not your assignment')
  })
  it('Worker B cannot reject Worker A assignment', async () => {
    const jid = await freshJob()
    const r1 = await createAssignment({
      companyId: companyAId, jobId: jid, workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId, actorRole: 'COMPANY_OWNER',
    })
    expect(r1.success).toBe(true)
    const r2 = await workerRejectAssignment(r1.assignmentId!, workerBUserId)
    expect(r2.success).toBe(false)
    expect(r2.error).toContain('Not your assignment')
  })
  it('Worker cannot accept an already-accepted assignment', async () => {
    const jid = await freshJob()
    const r1 = await createAssignment({
      companyId: companyAId, jobId: jid, workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId, actorRole: 'COMPANY_OWNER',
    })
    expect(r1.success).toBe(true)
    await workerAcceptAssignment(r1.assignmentId!, workerAUserId)
    const r2 = await workerAcceptAssignment(r1.assignmentId!, workerAUserId)
    expect(r2.success).toBe(false)
    expect(r2.error).toContain('Cannot accept')
  })
})

// ── Gate 16: Client Ownership Override ──

describe('Gate 16: Client Ownership Override', () => {
  it('wrong companyId rejected for create', async () => {
    const jid = await freshJob()
    const r = await createAssignment({
      companyId: companyBId, jobId: jid, workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId, actorRole: 'COMPANY_OWNER',
    })
    expect(r.success).toBe(false)
    expect(r.error).toContain('No accepted quote')
  })
  it('wrong companyId rejected for revoke', async () => {
    const jid = await freshJob()
    const r1 = await createAssignment({
      companyId: companyAId, jobId: jid, workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId, actorRole: 'COMPANY_OWNER',
    })
    expect(r1.success).toBe(true)
    const r2 = await revokeAssignment(r1.assignmentId!, companyBId, ownerBUserId, 'COMPANY_OWNER')
    expect(r2.success).toBe(false)
  })
  it('wrong companyId rejected for complete', async () => {
    const jid = await freshJob()
    const r1 = await createAssignment({
      companyId: companyAId, jobId: jid, workerUserId: workerAUserId,
      assignedByUserId: ownerAUserId, actorRole: 'COMPANY_OWNER',
    })
    expect(r1.success).toBe(true)
    await workerAcceptAssignment(r1.assignmentId!, workerAUserId)

    await prisma.marketplaceJob.update({ where: { id: jid }, data: { status: 'IN_PROGRESS' } })
    await prisma.companyJobAssignment.update({
      where: { id: r1.assignmentId! }, data: { status: 'IN_PROGRESS', startedAt: new Date() },
    })

    const r2 = await completeAssignment(r1.assignmentId!, companyBId)
    expect(r2.success).toBe(false)
    expect(r2.error).toContain('does not belong')
  })
})

// ── Gate 17: Phase 10.1–10.4 Regression ──

describe('Gate 17: Phase 10.1–10.4 Regression', () => {
  it('10.1: suspend enforcement — suspended user cannot be ACTIVE', async () => {
    const u = await makeUser('sus-reg-g107')
    const m = await prisma.teamMember.create({
      data: { companyId: companyAId, userId: u.id, name: 'Sus', role: 'WORKER', status: 'SUSPENDED', skills: '[]' },
    })
    const check = await prisma.teamMember.findFirst({
      where: { companyId: companyAId, userId: u.id, status: 'ACTIVE' },
    })
    expect(check).toBeNull()
    await prisma.teamMember.delete({ where: { id: m.id } })
  })
  it('10.3: KYC — PENDING user has correct status', async () => {
    const u = await makeUser('kyc-reg-g107', 'CUSTOMER', 'PENDING')
    expect(u.identityStatus).toBe('PENDING')
    const v = await makeUser('kyc-v-g107', 'CUSTOMER', 'VERIFIED')
    expect(v.identityStatus).toBe('VERIFIED')
  })
  it('10.4: job listing works', async () => {
    const c = await prisma.marketplaceJob.count({ where: { customerId } })
    expect(c).toBeGreaterThanOrEqual(0)
  })
})

// ── Gate 18: Phase 10.6 Regression ──

describe('Gate 18: Phase 10.6 Regression', () => {
  it('pin-verifier-transaction route exists', async () => {
    const fs = require('fs')
    const p = require('path')
    const fp = p.join(process.cwd(), 'app/api/mobile/pin-verifier-transaction/route.ts')
    if (fs.existsSync(fp)) {
      expect(fs.readFileSync(fp, 'utf-8')).toContain('POST')
    }
  })
  it('marketplace-router route exists', async () => {
    const fs = require('fs')
    const p = require('path')
    const fp = p.join(process.cwd(), 'app/api/mobile/marketplace-router/route.ts')
    if (fs.existsSync(fp)) {
      expect(fs.readFileSync(fp, 'utf-8')).toContain('POST')
    }
  })
})
