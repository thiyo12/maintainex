import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  jobReviewFindMany: vi.fn(),
  providerJobResponseFindMany: vi.fn(),
  jobWorkspaceCount: vi.fn(),
  qualityMetricUpsert: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    jobReview: { findMany: mocks.jobReviewFindMany },
    providerJobResponse: { findMany: mocks.providerJobResponseFindMany },
    jobWorkspace: { count: mocks.jobWorkspaceCount },
    qualityMetric: { upsert: mocks.qualityMetricUpsert },
    taskerProfile: { findMany: vi.fn() },
  },
}))

describe('provider quality engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.jobReviewFindMany.mockResolvedValue([
      { quality: 5, communication: 5, timeliness: 5 },
    ])
    mocks.providerJobResponseFindMany.mockResolvedValue([
      { jobId: 'job-completed', completedAt: new Date('2026-09-01T00:00:00Z'), wasOnTime: true },
      { jobId: 'job-incomplete', completedAt: null, wasOnTime: null },
    ])
    mocks.jobWorkspaceCount.mockResolvedValue(1)
    mocks.qualityMetricUpsert.mockResolvedValue({ id: 'metric-1' })
  })

  it('uses all provider responses for completion rate and only DISPUTED workspaces for dispute rate', async () => {
    const { calculateProviderQuality } = await import('@/lib/quality-engine')

    const result = await calculateProviderQuality('provider-1')

    expect(mocks.providerJobResponseFindMany).toHaveBeenCalledWith({
      where: { providerId: 'provider-1' },
      select: { jobId: true, completedAt: true, wasOnTime: true },
    })
    expect(mocks.jobWorkspaceCount).toHaveBeenCalledWith({
      where: {
        jobId: { in: ['job-completed', 'job-incomplete'] },
        progressStatus: 'DISPUTED',
      },
    })
    expect(result.jobCompletionRate).toBe(50)
    expect(result.onTimeRate).toBe(100)
    expect(result.disputeRate).toBe(50)
    expect(result.totalJobs).toBe(2)
    expect(result.completedJobs).toBe(1)
  })

  it('uses neutral no-history rates instead of manufacturing failures', async () => {
    const { calculateProviderQuality } = await import('@/lib/quality-engine')
    mocks.jobReviewFindMany.mockResolvedValue([])
    mocks.providerJobResponseFindMany.mockResolvedValue([])
    mocks.jobWorkspaceCount.mockResolvedValue(0)

    const result = await calculateProviderQuality('new-provider')

    expect(result.jobCompletionRate).toBe(100)
    expect(result.onTimeRate).toBe(100)
    expect(result.disputeRate).toBe(0)
    expect(result.totalJobs).toBe(0)
    expect(result.completedJobs).toBe(0)
  })
})
