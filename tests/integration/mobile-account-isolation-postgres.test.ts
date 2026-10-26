import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { assertNotProductionDb, requiresPostgres } from '@/tests/helpers/test-guard'

const { authenticateRequest } = vi.hoisted(() => ({ authenticateRequest: vi.fn() }))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest,
  assertNotSuspended: vi.fn(),
}))
vi.mock('@/lib/quality-engine', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/quality-engine')>()
  return { ...actual, calculateProviderQuality: vi.fn(actual.calculateProviderQuality) }
})
vi.mock('@/lib/locations', () => ({ getLocationName: vi.fn(() => null) }))
vi.mock('@/lib/phase6/company-job-read-access', () => ({
  getReadableCompanyIds: vi.fn(async () => []),
  getActiveAssignedCompanyId: vi.fn(async () => null),
}))

import { calculateProviderQuality } from '@/lib/quality-engine'
import { GET as getQuality } from '@/app/api/mobile/v2/quality/route'
import { GET as getJob } from '@/app/api/mobile/v2/jobs/[id]/route'

const databaseUrl = process.env.DATABASE_URL || ''
if (databaseUrl) assertNotProductionDb()
const enabled = requiresPostgres()
const prisma = new PrismaClient()
const prefix = `mobile-isolation-${randomUUID()}`
const customerA = `${prefix}-customer-a`
const customerB = `${prefix}-customer-b`
const taskerA = `${prefix}-tasker-a`
const taskerB = `${prefix}-tasker-b`
const jobId = `${prefix}-job`

function request(path: string) {
  return new NextRequest(`https://maintainex.test${path}`)
}

describe.skipIf(!enabled)('mobile account isolation PostgreSQL regressions', () => {
  beforeAll(async () => {
    await prisma.user.createMany({ data: [
      { id: customerA, email: `${customerA}@test.local`, passwordHash: 'synthetic-only', name: 'Private Customer A', role: 'CUSTOMER', countryCode: 'LK' },
      { id: customerB, email: `${customerB}@test.local`, passwordHash: 'synthetic-only', name: 'Private Customer B', role: 'CUSTOMER', countryCode: 'LK' },
      { id: taskerA, email: `${taskerA}@test.local`, passwordHash: 'synthetic-only', name: 'Synthetic Tasker A', role: 'TASKER', countryCode: 'LK' },
      { id: taskerB, email: `${taskerB}@test.local`, passwordHash: 'synthetic-only', name: 'Synthetic Tasker B', role: 'TASKER', countryCode: 'LK' },
    ] })
    await prisma.qualityMetric.create({ data: {
      providerId: taskerB,
      providerType: 'INDIVIDUAL',
      qualityScore: 23,
      avgReviewRating: 1.2,
      jobCompletionRate: 40,
      onTimeRate: 50,
      disputeRate: 25,
      totalJobs: 5,
      completedJobs: 2,
      disputedJobs: 2,
      totalReviews: 3,
      isFlagged: true,
    } })
    await prisma.marketplaceJob.create({ data: {
      id: jobId,
      customerId: customerA,
      title: 'Synthetic private job',
      description: 'Synthetic private work description',
      categoryId: 'synthetic-category',
      photos: '[]',
      budgetType: 'FIXED',
      budgetAmount: 12500n,
      addressStreet: 'Synthetic private address',
      status: 'OPEN',
    } })
  })

  beforeEach(() => {
    vi.mocked(calculateProviderQuality).mockClear()
  })

  afterAll(async () => {
    await prisma.qualityMetric.deleteMany({ where: { providerId: { in: [taskerA, taskerB] } } })
    await prisma.marketplaceJob.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { id: { in: [customerA, customerB, taskerA, taskerB] } } })
    await prisma.$disconnect()
  })

  it('writes only the authenticated tasker quality cache and rejects another provider without changing it', async () => {
    authenticateRequest.mockResolvedValue({ id: taskerA, role: 'TASKER' })

    const ownResponse = await getQuality(request('/api/mobile/v2/quality'))
    expect(ownResponse.status).toBe(200)
    expect(await prisma.qualityMetric.findUnique({ where: { providerId: taskerA } })).toBeTruthy()

    const before = await prisma.qualityMetric.findUniqueOrThrow({ where: { providerId: taskerB } })
    vi.mocked(calculateProviderQuality).mockClear()
    const crossResponse = await getQuality(request(`/api/mobile/v2/quality?providerId=${taskerB}`))

    expect(crossResponse.status).toBe(403)
    expect(calculateProviderQuality).not.toHaveBeenCalled()
    expect(await prisma.qualityMetric.findUniqueOrThrow({ where: { providerId: taskerB } })).toEqual(before)
  })

  it('denies a customer reading another customer’s open job without changing the job record', async () => {
    authenticateRequest.mockResolvedValue({ id: customerB, role: 'CUSTOMER' })
    const before = await prisma.marketplaceJob.findUniqueOrThrow({ where: { id: jobId } })

    const response = await getJob(request(`/api/mobile/v2/jobs/${jobId}`), {
      params: Promise.resolve({ id: jobId }),
    })

    expect(response.status).toBe(404)
    expect(JSON.stringify(await response.json())).not.toContain(customerA)
    expect(await prisma.marketplaceJob.findUniqueOrThrow({ where: { id: jobId } })).toEqual(before)
  })
})
