import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { assertNotProductionDb, requiresPostgres } from '@/tests/helpers/test-guard'

const { authenticateRequest } = vi.hoisted(() => ({ authenticateRequest: vi.fn() }))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({ authenticateRequest }))

import { GET as getJob } from '@/app/api/mobile/jobs/[id]/route'
import { GET as listJobs } from '@/app/api/mobile/jobs/route'

const databaseUrl = process.env.DATABASE_URL || ''
if (databaseUrl) assertNotProductionDb()
const enabled = requiresPostgres()
const prisma = new PrismaClient()
const prefix = `legacy-address-isolation-${randomUUID()}`
const customerId = `${prefix}-customer`
const viewerId = `${prefix}-viewer`
const jobId = `${prefix}-job`

describe.skipIf(!enabled)('legacy V1 customer address isolation (PostgreSQL)', () => {
  beforeAll(async () => {
    await prisma.user.createMany({ data: [
      { id: customerId, email: `${customerId}@test.local`, passwordHash: 'synthetic', name: 'Synthetic Owner', role: 'CUSTOMER', countryCode: 'CA' },
      { id: viewerId, email: `${viewerId}@test.local`, passwordHash: 'synthetic', name: 'Synthetic Viewer', role: 'USER', countryCode: 'CA' },
    ] })
    await prisma.jobPosting.create({ data: {
      id: jobId,
      customerId,
      title: 'Synthetic plumbing job',
      description: 'Synthetic test record',
      category: 'plumbing',
      budget: 100,
      location: '42 Synthetic Street, Vancouver',
      latitude: 49.2827,
      longitude: -123.1207,
      status: 'OPEN',
    } })
  })

  afterAll(async () => {
    await prisma.jobPosting.deleteMany({ where: { id: jobId } })
    await prisma.user.deleteMany({ where: { id: { in: [customerId, viewerId] } } })
    await prisma.$disconnect()
  })

  it('hides an open job address and exact coordinates from an unrelated authenticated account', async () => {
    authenticateRequest.mockResolvedValue({ id: viewerId, role: 'USER' })
    const response = await getJob(
      new NextRequest(`https://maintainex.test/api/mobile/jobs/${jobId}`),
      { params: Promise.resolve({ id: jobId }) },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.location).toBe('')
    expect(body.latitude).toBeNull()
    expect(body.longitude).toBeNull()
  })

  it('hides open job location in list responses while preserving owner access', async () => {
    authenticateRequest.mockResolvedValue({ id: viewerId, role: 'USER' })
    const discovery = await listJobs(new NextRequest('https://maintainex.test/api/mobile/jobs'))
    expect(discovery.status).toBe(200)
    const listed = (await discovery.json()).find((job: { id: string }) => job.id === jobId)
    expect(listed).toMatchObject({ location: '', latitude: null, longitude: null })

    authenticateRequest.mockResolvedValue({ id: customerId, role: 'CUSTOMER' })
    const owner = await getJob(
      new NextRequest(`https://maintainex.test/api/mobile/jobs/${jobId}`),
      { params: Promise.resolve({ id: jobId }) },
    )
    expect(owner.status).toBe(200)
    expect(await owner.json()).toMatchObject({
      location: '42 Synthetic Street, Vancouver', latitude: 49.2827, longitude: -123.1207,
    })
  })
})
