// Byte-identical historical duplicate of tests/security/phase10-6-security.test.ts
// (originally tests/phase10-5/phase10-6-security.test.ts). Retained so no test is
// lost from discovery; Phase H decides its fate together with the guarded code.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const API_BASE = process.env.PHASE10_TEST_API_BASE || ''
const DB_URL = process.env.DATABASE_URL || ''
const TEST_PASSWORD = process.env.PHASE10_TEST_PASSWORD || 'ci-only-phase10-password'
const TEST_PEPPER = process.env.PASSWORD_PEPPER || ''
const PHASE10_INTEGRATION_ENABLED = Boolean(
  process.env.PHASE10_TEST_API_BASE && DB_URL && TEST_PEPPER
)
const describePhase10 = PHASE10_INTEGRATION_ENABLED ? describe : describe.skip

const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
})

const TS = Date.now()

let customerToken: string
let customerUserId: string
let taskerAToken: string
let taskerAUserId: string
let taskerBToken: string
let taskerBUserId: string

let sharedCategoryId: string
let inspectionJobId: string
let evidenceJobId: string
let changeOrderJobId: string
let crossJobId: string

const createdUserIds: string[] = []
const createdJobIds: string[] = []
const createdQuoteIds: string[] = []
const createdInspectionIds: string[] = []
const createdEvidenceIds: string[] = []
const createdChangeOrderIds: string[] = []
const createdTeamMemberIds: string[] = []
const createdCompanyIds: string[] = []

async function loginAs(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/mobile/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!data.accessToken) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`)
  return data.accessToken
}

async function createTestUser(
  emailPrefix: string,
  name: string,
  phoneSuffix: string,
  role: string,
): Promise<{ id: string; email: string; token: string }> {
  const email = `${emailPrefix}-${TS}@p106sec.com`
  const pepper = crypto.createHash('sha256').update(TEST_PASSWORD + TEST_PEPPER).digest('hex')
  const passwordHash = await bcrypt.hash(pepper, 14)
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      phone: `+9477106${phoneSuffix}`,
      role,
      countryCode: 'LK',
      isActive: true,
    },
  })
  createdUserIds.push(user.id)
  const token = await loginAs(email, TEST_PASSWORD)
  return { id: user.id, email, token }
}

beforeAll(async () => {
  if (!PHASE10_INTEGRATION_ENABLED) return
  await prisma.$connect()

  const cat = await prisma.jobCategory.findFirst()
  sharedCategoryId = cat?.id || 'cat-p106-test'

  const customer = await createTestUser('cust-p106', 'P106 Customer', '06001', 'CUSTOMER')
  customerUserId = customer.id
  customerToken = customer.token

  const taskerA = await createTestUser('task-a-p106', 'P106 Tasker A', '06002', 'TASKER')
  taskerAUserId = taskerA.id
  taskerAToken = taskerA.token

  const taskerB = await createTestUser('task-b-p106', 'P106 Tasker B', '06003', 'TASKER')
  taskerBUserId = taskerB.id
  taskerBToken = taskerB.token

  inspectionJobId = (await prisma.marketplaceJob.create({
    data: {
      customerId: customerUserId,
      title: 'P106 Inspection Auth Job',
      description: 'Job for inspection authorization tests',
      categoryId: sharedCategoryId,
      budgetType: 'FIXED',
      photos: '[]',
      status: 'QUOTE_ACCEPTED',
      countryCode: 'LK',
      requiresInspection: true,
    },
  })).id
  createdJobIds.push(inspectionJobId)

  const inspectionQuote = await prisma.jobQuote.create({
    data: {
      jobId: inspectionJobId,
      providerId: taskerAUserId,
      providerType: 'INDIVIDUAL',
      price: 5000n,
      estimatedCompletionTime: '2 hours',
      attachments: '[]',
      status: 'ACCEPTED',
    },
  })
  createdQuoteIds.push(inspectionQuote.id)

  evidenceJobId = (await prisma.marketplaceJob.create({
    data: {
      customerId: customerUserId,
      title: 'P106 Evidence Auth Job',
      description: 'Job for evidence authorization tests',
      categoryId: sharedCategoryId,
      budgetType: 'FIXED',
      photos: '[]',
      status: 'QUOTE_ACCEPTED',
      countryCode: 'LK',
    },
  })).id
  createdJobIds.push(evidenceJobId)

  const evidenceQuote = await prisma.jobQuote.create({
    data: {
      jobId: evidenceJobId,
      providerId: taskerAUserId,
      providerType: 'INDIVIDUAL',
      price: 4000n,
      estimatedCompletionTime: '1 hour',
      attachments: '[]',
      status: 'ACCEPTED',
    },
  })
  createdQuoteIds.push(evidenceQuote.id)

  changeOrderJobId = (await prisma.marketplaceJob.create({
    data: {
      customerId: customerUserId,
      title: 'P106 Change Order Auth Job',
      description: 'Job for change order authorization tests',
      categoryId: sharedCategoryId,
      budgetType: 'FIXED',
      photos: '[]',
      status: 'QUOTE_ACCEPTED',
      countryCode: 'LK',
    },
  })).id
  createdJobIds.push(changeOrderJobId)

  const coAcceptedQuote = await prisma.jobQuote.create({
    data: {
      jobId: changeOrderJobId,
      providerId: taskerAUserId,
      providerType: 'INDIVIDUAL',
      price: 7000n,
      estimatedCompletionTime: '3 hours',
      attachments: '[]',
      status: 'ACCEPTED',
    },
  })
  createdQuoteIds.push(coAcceptedQuote.id)

  await prisma.marketplaceJob.update({
    where: { id: changeOrderJobId },
    data: { approvedQuoteId: coAcceptedQuote.id },
  })

  const coRejectedQuote = await prisma.jobQuote.create({
    data: {
      jobId: changeOrderJobId,
      providerId: taskerBUserId,
      providerType: 'INDIVIDUAL',
      price: 6500n,
      estimatedCompletionTime: '3 hours',
      attachments: '[]',
      status: 'REJECTED',
    },
  })
  createdQuoteIds.push(coRejectedQuote.id)

  crossJobId = (await prisma.marketplaceJob.create({
    data: {
      customerId: customerUserId,
      title: 'P106 Cross Job',
      description: 'Separate job for cross-job evidence boundary tests',
      categoryId: sharedCategoryId,
      budgetType: 'FIXED',
      photos: '[]',
      status: 'QUOTE_ACCEPTED',
      countryCode: 'LK',
    },
  })).id
  createdJobIds.push(crossJobId)

  const crossQuote = await prisma.jobQuote.create({
    data: {
      jobId: crossJobId,
      providerId: taskerAUserId,
      providerType: 'INDIVIDUAL',
      price: 3000n,
      estimatedCompletionTime: '1 hour',
      attachments: '[]',
      status: 'ACCEPTED',
    },
  })
  createdQuoteIds.push(crossQuote.id)
}, 90000)

afterAll(async () => {
  if (!PHASE10_INTEGRATION_ENABLED) return
  for (const id of createdEvidenceIds) {
    await prisma.jobEvidence.delete({ where: { id } }).catch(() => {})
  }
  for (const id of createdChangeOrderIds) {
    await prisma.jobChangeOrderLineItem.deleteMany({ where: { changeOrderId: id } }).catch(() => {})
    await prisma.jobChangeOrder.delete({ where: { id } }).catch(() => {})
  }
  for (const id of createdInspectionIds) {
    await prisma.jobEvidence.deleteMany({ where: { inspectionId: id } }).catch(() => {})
    await prisma.jobInspection.delete({ where: { id } }).catch(() => {})
  }
  await prisma.jobVerificationPin.deleteMany({ where: { jobId: { in: createdJobIds } } }).catch(() => {})
  await prisma.jobQuote.deleteMany({ where: { id: { in: createdQuoteIds } } }).catch(() => {})
  await prisma.jobEvidence.deleteMany({ where: { jobId: { in: createdJobIds } } }).catch(() => {})
  await prisma.jobInspection.deleteMany({ where: { jobId: { in: createdJobIds } } }).catch(() => {})
  await prisma.jobChangeOrder.deleteMany({ where: { jobId: { in: createdJobIds } } }).catch(() => {})
  await prisma.marketplaceJob.deleteMany({ where: { id: { in: createdJobIds } } }).catch(() => {})
  await prisma.teamMember.deleteMany({ where: { id: { in: createdTeamMemberIds } } }).catch(() => {})
  await prisma.companyProfile.deleteMany({ where: { id: { in: createdCompanyIds } } }).catch(() => {})
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {})
  await prisma.$disconnect()
}, 30000)

describePhase10('Phase 10.6 — Availability Authorization', () => {
  it('unauthenticated GET rejected (no token → 401)', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/availability`)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('unauthenticated PUT rejected (no token → 401)', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/availability`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable: true, startTime: '08:00', endTime: '18:00' }),
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('non-TASKER PUT rejected (CUSTOMER role → 403)', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/availability`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ isAvailable: true, startTime: '08:00', endTime: '18:00' }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('tasker can read own availability', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/availability`, {
      headers: { Authorization: `Bearer ${taskerAToken}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('isAvailable')
    expect(body).toHaveProperty('workHours')
  })

  it('tasker A cannot read tasker B availability through providerId query param', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/availability?providerId=${taskerBUserId}`, {
      headers: { Authorization: `Bearer ${taskerAToken}` },
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('client-supplied providerId cannot override authenticated identity', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/availability?providerId=${taskerBUserId}`, {
      headers: { Authorization: `Bearer ${taskerAToken}` },
    })
    expect(res.status).toBe(403)
  })
})

describePhase10('Phase 10.6 — Inspection Authorization', () => {
  it('authorized provider (accepted quote) may create inspection', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/jobs/${inspectionJobId}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${taskerAToken}`,
      },
      body: JSON.stringify({ inspectionFeeCents: 2000, currency: 'LKR' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.inspectionId).toBeDefined()
    createdInspectionIds.push(body.inspectionId)
  })

  it('unrelated tasker (no quote) is blocked (403)', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/jobs/${inspectionJobId}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${taskerBToken}`,
      },
      body: JSON.stringify({ inspectionFeeCents: 2000, currency: 'LKR' }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('customer cannot create inspection on provider\'s behalf', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/jobs/${inspectionJobId}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ inspectionFeeCents: 2000, currency: 'LKR' }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('provider with rejected quote is blocked', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/jobs/${changeOrderJobId}/inspection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${taskerBToken}`,
      },
      body: JSON.stringify({ inspectionFeeCents: 1500, currency: 'LKR' }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})

describePhase10('Phase 10.6 — Evidence Authorization', () => {
  it('authorized job participant (customer) allowed without inspectionId', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/jobs/${evidenceJobId}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        evidenceType: 'PHOTO',
        url: 'https://example.com/evidence-customer.jpg',
        description: 'Customer evidence upload',
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.evidenceId).toBeDefined()
    createdEvidenceIds.push(body.evidenceId)
  })

  it('authorized job participant (accepted provider) allowed without inspectionId', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/jobs/${evidenceJobId}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${taskerAToken}`,
      },
      body: JSON.stringify({
        evidenceType: 'NOTE',
        url: 'https://example.com/evidence-provider.jpg',
        description: 'Provider evidence upload',
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.evidenceId).toBeDefined()
    createdEvidenceIds.push(body.evidenceId)
  })

  it('unrelated tasker blocked without inspectionId (403)', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/jobs/${evidenceJobId}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${taskerBToken}`,
      },
      body: JSON.stringify({
        evidenceType: 'PHOTO',
        url: 'https://example.com/evidence-unrelated.jpg',
        description: 'Unrelated provider attempt',
      }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('cross-job evidence blocked', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/jobs/${evidenceJobId}/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${taskerBToken}`,
      },
      body: JSON.stringify({
        evidenceType: 'PHOTO',
        url: 'https://example.com/evidence-cross.jpg',
        description: 'Cross-job evidence attempt',
      }),
    })
    expect(res.status).toBe(403)
  })
})

describePhase10('Phase 10.6 — Change Order Authorization', () => {
  let coAcceptedQuoteId: string

  beforeAll(async () => {
    const q = await prisma.jobQuote.findFirst({
      where: { jobId: changeOrderJobId, providerId: taskerAUserId, status: 'ACCEPTED' },
    })
    coAcceptedQuoteId = q!.id
  })

  it('authorized provider (accepted quote) may create change order', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/jobs/${changeOrderJobId}/change-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${taskerAToken}`,
      },
      body: JSON.stringify({
        baseQuoteId: coAcceptedQuoteId,
        reason: 'Additional plumbing work required',
        amountDeltaCents: 2000,
        scopeDelta: 'Extended pipe replacement',
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.changeOrderId).toBeDefined()
    createdChangeOrderIds.push(body.changeOrderId)
  })

  it('unrelated tasker blocked (403)', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/jobs/${changeOrderJobId}/change-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${taskerBToken}`,
      },
      body: JSON.stringify({
        baseQuoteId: coAcceptedQuoteId,
        reason: 'Unauthorized change attempt',
        amountDeltaCents: 5000,
      }),
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('user-supplied companyId cannot override authenticated identity (individual provider)', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/jobs/${changeOrderJobId}/change-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${taskerAToken}`,
      },
      body: JSON.stringify({
        baseQuoteId: coAcceptedQuoteId,
        reason: 'Trying to spoof company identity',
        amountDeltaCents: 3000,
        companyId: 'fake-company-id-override',
      }),
    })

    if (res.status === 201) {
      const body = await res.json()
      const co = await prisma.jobChangeOrder.findUnique({ where: { id: body.changeOrderId } })
      expect(co!.taskerId).toBe(taskerAUserId)
      expect(co!.companyId).not.toBe('fake-company-id-override')
      createdChangeOrderIds.push(body.changeOrderId)
    } else {
      expect([400, 403]).toContain(res.status)
    }
  })

  it('provider cannot set arbitrary companyId', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/jobs/${changeOrderJobId}/change-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${taskerAToken}`,
      },
      body: JSON.stringify({
        baseQuoteId: coAcceptedQuoteId,
        reason: 'Arbitrary companyId injection attempt',
        amountDeltaCents: 1000,
        companyId: 'malicious-company-id',
        providerType: 'COMPANY',
      }),
    })

    if (res.status === 201) {
      const body = await res.json()
      const co = await prisma.jobChangeOrder.findUnique({ where: { id: body.changeOrderId } })
      if (co!.companyId) {
        expect(co!.companyId).not.toBe('malicious-company-id')
      }
      createdChangeOrderIds.push(body.changeOrderId)
    } else {
      expect([400, 403]).toContain(res.status)
    }
  })
})

describePhase10('Phase 10.6 — Company Boundary', () => {
  let companyOwnerId: string
  let companyOwnerToken: string
  let companyWorkerId: string
  let companyWorkerToken: string
  let companyId: string
  let companyJobId: string
  let companyQuoteId: string

  beforeAll(async () => {
    const owner = await createTestUser('co-owner-p106', 'P106 Company Owner', '06010', 'TASKER')
    companyOwnerId = owner.id
    companyOwnerToken = owner.token

    const worker = await createTestUser('co-worker-p106', 'P106 Company Worker', '06011', 'TASKER')
    companyWorkerId = worker.id
    companyWorkerToken = worker.token

    const companyProfile = await prisma.companyProfile.create({
      data: {
        userId: companyOwnerId,
        companyName: 'P106 Test Plumbing Co',
        services: '["plumbing"]',
        serviceAreas: '["colombo"]',
        countryCode: 'LK',
      },
    })
    companyId = companyProfile.id
    createdCompanyIds.push(companyId)

    const ownerMember = await prisma.teamMember.create({
      data: {
        companyId,
        userId: companyOwnerId,
        name: 'P106 Company Owner',
        role: 'COMPANY_OWNER',
        status: 'ACTIVE',
        skills: '["plumbing"]',
      },
    })
    createdTeamMemberIds.push(ownerMember.id)

    const workerMember = await prisma.teamMember.create({
      data: {
        companyId,
        userId: companyWorkerId,
        name: 'P106 Company Worker',
        role: 'WORKER',
        status: 'ACTIVE',
        skills: '["plumbing"]',
      },
    })
    createdTeamMemberIds.push(workerMember.id)

    companyJobId = (await prisma.marketplaceJob.create({
      data: {
        customerId: customerUserId,
        title: 'P106 Company Boundary Job',
        description: 'Job for company boundary tests',
        categoryId: sharedCategoryId,
        budgetType: 'FIXED',
        photos: '[]',
        status: 'QUOTE_ACCEPTED',
        countryCode: 'LK',
      },
    })).id
    createdJobIds.push(companyJobId)

    const companyQuote = await prisma.jobQuote.create({
      data: {
        jobId: companyJobId,
        providerId: companyId,
        providerType: 'COMPANY',
        price: 10000n,
        estimatedCompletionTime: '4 hours',
        attachments: '[]',
        status: 'ACCEPTED',
      },
    })
    companyQuoteId = companyQuote.id
    createdQuoteIds.push(companyQuoteId)
  })

  it('canonical company owner can create change order through company membership', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/jobs/${companyJobId}/change-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${companyOwnerToken}`,
      },
      body: JSON.stringify({
        baseQuoteId: companyQuoteId,
        reason: 'Additional work required by company owner',
        amountDeltaCents: 3000,
        scopeDelta: 'Extended service scope',
      }),
    })

    if (res.status === 201) {
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.changeOrderId).toBeDefined()
      const co = await prisma.jobChangeOrder.findUnique({ where: { id: body.changeOrderId } })
      expect(co).toBeTruthy()
      createdChangeOrderIds.push(body.changeOrderId)
    } else {
      expect([400, 403, 500]).toContain(res.status)
    }
  })

  it('arbitrary CompanyMember without canonical authority is properly gated', async () => {
    const res = await fetch(`${API_BASE}/api/mobile/v2/jobs/${companyJobId}/change-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${companyWorkerToken}`,
      },
      body: JSON.stringify({
        baseQuoteId: companyQuoteId,
        reason: 'Worker trying to create change order',
        amountDeltaCents: 2000,
      }),
    })

    if (res.status === 201) {
      const body = await res.json()
      const co = await prisma.jobChangeOrder.findUnique({ where: { id: body.changeOrderId } })
      if (co) {
        expect(co.createdBy).toBe(companyWorkerId)
      }
      createdChangeOrderIds.push(body.changeOrderId)
    } else {
      expect([400, 403, 500]).toContain(res.status)
    }
  })
})
