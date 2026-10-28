import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  jobsFindFirst: vi.fn(),
  jobsFindMany: vi.fn(),
  taskerFindUnique: vi.fn(),
  assignmentFindFirst: vi.fn(),
}))

vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({ authenticateRequest: mocks.auth }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    jobPosting: { findFirst: mocks.jobsFindFirst, findMany: mocks.jobsFindMany },
    taskerProfile: { findUnique: mocks.taskerFindUnique },
    assignment: { findFirst: mocks.assignmentFindFirst },
  },
}))

import { GET as getJob } from '@/app/api/mobile/jobs/[id]/route'
import { GET as listJobs } from '@/app/api/mobile/jobs/route'

const syntheticJob = {
  id: 'synthetic-job-a', customerId: 'synthetic-customer-a', title: 'Repair sink',
  description: 'Synthetic description', category: 'plumbing', budget: 100,
  location: '42 Synthetic Street, Vancouver', latitude: 49.2827, longitude: -123.1207,
  status: 'OPEN', scheduledDate: null, createdAt: new Date('2026-10-01T00:00:00Z'),
  customer: { id: 'synthetic-customer-a', name: 'Synthetic Customer A', phone: '+10000000000' },
  bids: [], assignments: [],
}

describe('legacy V1 customer address isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ id: 'synthetic-other-account', role: 'USER' })
    mocks.jobsFindFirst.mockResolvedValue(syntheticJob)
    mocks.jobsFindMany.mockResolvedValue([syntheticJob])
    mocks.taskerFindUnique.mockResolvedValue(null)
  })

  it('hides exact address and coordinates from an unrelated account', async () => {
    const response = await getJob(
      new NextRequest('https://maintainex.test/api/mobile/jobs/synthetic-job-a'),
      { params: Promise.resolve({ id: syntheticJob.id }) },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.location).toBe('')
    expect(body.latitude).toBeNull()
    expect(body.longitude).toBeNull()
  })

  it('hides exact address and coordinates through the open-job list', async () => {
    const response = await listJobs(new NextRequest('https://maintainex.test/api/mobile/jobs'))

    expect(response.status).toBe(200)
    const [job] = await response.json()
    expect(job.location).toBe('')
    expect(job.latitude).toBeNull()
    expect(job.longitude).toBeNull()
  })

  it('preserves exact location for the customer who owns the job', async () => {
    mocks.auth.mockResolvedValue({ id: 'synthetic-customer-a', role: 'CUSTOMER' })
    mocks.jobsFindFirst.mockResolvedValue(syntheticJob)

    const response = await getJob(
      new NextRequest('https://maintainex.test/api/mobile/jobs/synthetic-job-a'),
      { params: Promise.resolve({ id: syntheticJob.id }) },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.location).toBe('42 Synthetic Street, Vancouver')
    expect(body.latitude).toBe(49.2827)
    expect(body.longitude).toBe(-123.1207)
  })

  it('allows provider discovery but keeps an open-job address hidden before assignment', async () => {
    mocks.auth.mockResolvedValue({ id: 'synthetic-tasker-user', role: 'TASKER' })
    mocks.taskerFindUnique.mockResolvedValue({ id: 'synthetic-tasker-profile' })

    const response = await getJob(
      new NextRequest('https://maintainex.test/api/mobile/jobs/synthetic-job-a'),
      { params: Promise.resolve({ id: syntheticJob.id }) },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('OPEN')
    expect(body.location).toBe('')
    expect(body.latitude).toBeNull()
    expect(body.longitude).toBeNull()
  })

  it('preserves exact location for a tasker assigned to a historical job', async () => {
    mocks.auth.mockResolvedValue({ id: 'synthetic-tasker-user', role: 'TASKER' })
    mocks.taskerFindUnique.mockResolvedValue({ id: 'synthetic-tasker-profile' })
    mocks.jobsFindFirst.mockResolvedValue({
      ...syntheticJob,
      status: 'IN_PROGRESS',
      assignments: [{ taskerId: 'synthetic-tasker-profile', status: 'IN_PROGRESS', tasker: null }],
    })
    mocks.assignmentFindFirst.mockResolvedValue({ id: 'synthetic-assignment' })

    const response = await getJob(
      new NextRequest('https://maintainex.test/api/mobile/jobs/synthetic-job-a'),
      { params: Promise.resolve({ id: syntheticJob.id }) },
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.location).toBe('42 Synthetic Street, Vancouver')
    expect(body.latitude).toBe(49.2827)
    expect(body.longitude).toBe(-123.1207)
  })
})
