import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { assertNotProductionDb, requiresPostgres } from '@/tests/helpers/test-guard'

const { authenticateRequest } = vi.hoisted(() => ({ authenticateRequest: vi.fn() }))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({ authenticateRequest }))
vi.mock('@/lib/trust-engine', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/trust-engine')>()
  return {
    ...actual,
    calculateCustomerTrust: vi.fn(actual.calculateCustomerTrust),
  }
})

import { calculateCustomerTrust } from '@/lib/trust-engine'
import { GET } from '@/app/api/mobile/v2/trust/route'

const databaseUrl = process.env.DATABASE_URL || ''
if (databaseUrl) assertNotProductionDb()
const enabled = requiresPostgres()
const prisma = new PrismaClient()
const prefix = `trust-profile-${randomUUID()}`
const customerA = `${prefix}-a`
const customerB = `${prefix}-b`

function request(query = '') {
  return new NextRequest(`https://maintainex.test/api/mobile/v2/trust${query}`)
}

describe.skipIf(!enabled)('mobile trust profile PostgreSQL authorization', () => {
  beforeAll(async () => {
    await prisma.user.createMany({ data: [customerA, customerB].map((id, index) => ({
      id,
      email: `${id}@test.local`,
      passwordHash: 'synthetic-test-only',
      name: `Synthetic Customer ${index + 1}`,
      role: 'CUSTOMER',
      countryCode: 'LK',
      isActive: true,
      updatedAt: new Date(),
    })) })
    await prisma.customerTrustScore.create({ data: {
      customerId: customerB,
      trustScore: 0.42,
      totalJobsPosted: 4,
      completedJobs: 1,
      cancelledJobs: 3,
      avgProviderRating: 4,
      positiveReviews: 2,
    } })
  })

  beforeEach(() => {
    vi.mocked(calculateCustomerTrust).mockClear()
    authenticateRequest.mockResolvedValue({ id: customerA, role: 'CUSTOMER' })
  })

  afterAll(async () => {
    await prisma.customerTrustScore.deleteMany({ where: { customerId: { in: [customerA, customerB] } } })
    await prisma.user.deleteMany({ where: { id: { in: [customerA, customerB] } } })
    await prisma.$disconnect()
  })

  it('allows a customer to calculate only their canonical self profile', async () => {
    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.customerId).toBe(customerA)
    expect(calculateCustomerTrust).toHaveBeenCalledExactlyOnceWith(customerA)
    expect(await prisma.customerTrustScore.findUnique({ where: { customerId: customerA } })).toBeTruthy()
  })

  it('rejects a cross-customer request before calculation and leaves persisted trust data unchanged', async () => {
    const before = await prisma.customerTrustScore.findUniqueOrThrow({ where: { customerId: customerB } })

    const response = await GET(request(`?customerId=${encodeURIComponent(customerB)}`))

    expect(response.status).toBe(403)
    expect(calculateCustomerTrust).not.toHaveBeenCalled()
    const after = await prisma.customerTrustScore.findUniqueOrThrow({ where: { customerId: customerB } })
    expect(after).toEqual(before)
  })
})
