import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mock = vi.hoisted(() => ({
  viewer: { id: 'customer' } as { id: string } | null,
  jobs: [] as Array<{ id: string; customerId: string; countryCode: string; status: string }>,
  quotes: [] as Array<{ jobId: string }>,
  jobFind: vi.fn(), jobsFind: vi.fn(), quoteFind: vi.fn(), taskerUnique: vi.fn(),
  taskerFirst: vi.fn(), identity: vi.fn(),
}))
vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({ authenticateRequest: async () => mock.viewer }))
vi.mock('@/lib/prisma', () => ({ prisma: {
  marketplaceJob: { findUnique: mock.jobFind, findMany: mock.jobsFind },
  jobQuote: { findMany: mock.quoteFind },
  taskerProfile: { findUnique: mock.taskerUnique, findFirst: mock.taskerFirst },
  providerIdentity: { findUnique: mock.identity },
} }))
vi.mock('@/lib/geography/market-engine', () => ({
  requireJobMarket: (job: { countryCode: string }) =>
    ({ ok: true, countryCode: job.countryCode }),
  getMarketConfig: () => ({ label: 'Canada' }),
}))

const provider = {
  id: 'provider-profile', userId: 'provider-user', countryCode: 'CA',
  isVerified: true, verificationStatus: 'VERIFIED', isOnline: true,
  bio: 'Plumbing', rating: 4.8, completedJobs: 9, skills: '[]',
  reviews: [], serviceAreas: ['Vancouver'], hourlyRate: 60, profileImage: null,
  user: {
    id: 'provider-user', name: 'Provider', nickname: 'Pro', countryCode: 'CA',
    isActive: true, isSuspended: false, suspendedUntil: null, isBanned: false,
  },
}
async function readProfile(endpoint: 'taskers' | 'find-tasker', jobId?: string) {
  const path = endpoint === 'taskers'
    ? '/api/mobile/taskers/provider-profile'
    : '/api/mobile/find-tasker/provider-profile'
  const url = 'http://localhost' + path + (jobId ? '?jobId=' + jobId : '')
  const { GET } = endpoint === 'taskers'
    ? await import('@/app/api/mobile/taskers/[id]/route')
    : await import('@/app/api/mobile/find-tasker/[id]/route')
  const response = await GET(new NextRequest(url), {
    params: Promise.resolve({ id: 'provider-profile' }),
  })
  return { status: response.status, body: await response.json() }
}
function job(id: string, customerId = 'customer') {
  return { id, customerId, status: 'IN_PROGRESS', countryCode: 'CA' }
}

describe.each(['taskers', 'find-tasker'] as const)(
  'Phase 03 provider profile %s — viewer-owned service context only',
  endpoint => {
    beforeEach(() => {
      vi.clearAllMocks()
      mock.viewer = { id: 'customer' }
      mock.jobs = []
      mock.quotes = []
      mock.taskerUnique.mockResolvedValue(provider)
      mock.taskerFirst.mockResolvedValue(provider)
      mock.identity.mockResolvedValue({ kycStatus: 'VERIFIED', verifiedPhotoUrl: null, photoLocked: false })
      mock.quoteFind.mockImplementation(async () => mock.quotes)
      mock.jobFind.mockImplementation(async ({ where }) =>
        mock.jobs.find(j => j.id === where.id) ?? null)
      mock.jobsFind.mockImplementation(async ({ where }) =>
        mock.jobs.filter(j => {
          if (where.customerId) return j.customerId === where.customerId
          if (where.OR) return where.OR.some((cond: any) =>
            cond.customerId === j.customerId || cond.id?.in?.includes(j.id))
          return false
        }))
    })

    it('does not grant profile access through quotes on somebody else\'s job', async () => {
      mock.jobs = [job('other-job', 'other-customer')]
      mock.quotes = [{ jobId: 'other-job' }]
      const result = await readProfile(endpoint)
      expect(result.status).toBe(200)
      expect(result.body.visibility).toBe('REDUCED')
      expect(result.body).not.toHaveProperty('hourlyRate')
      expect(mock.jobsFind).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ customerId: 'customer' }),
      }))
    })

    it('a viewer-owned job provides same-market commercial visibility', async () => {
      mock.jobs = [job('my-job')]
      const result = await readProfile(endpoint)
      expect(result.status).toBe(200)
      expect(result.body.visibility).toBe('PUBLIC')
      expect(result.body).toHaveProperty('hourlyRate')
    })

    it('only the provider\'s quote on the viewer\'s own job grants transaction visibility', async () => {
      mock.jobs = [job('my-job'), job('other-job', 'other-customer')]
      mock.quotes = [{ jobId: 'other-job' }, { jobId: 'my-job' }]
      const result = await readProfile(endpoint)
      expect(result.status).toBe(200)
      expect(result.body.visibility).toBe(endpoint === 'taskers' ? 'PUBLIC' : 'TRANSACTION')
    })

    it('forged jobId cannot authorize someone else\'s job', async () => {
      mock.jobs = [job('other-job', 'another-customer')]
      mock.quotes = [{ jobId: 'other-job' }]
      const result = await readProfile(endpoint, 'other-job')
      expect(result.status).toBe(200)
      expect(result.body.visibility).toBe('REDUCED')
    })

    it('explicitly owned jobId remains the browsing market authority', async () => {
      mock.jobs = [job('my-job'), job('other-job', 'other-customer')]
      mock.quotes = [{ jobId: 'other-job' }]
      const result = await readProfile(endpoint, 'my-job')
      expect(result.status).toBe(200)
      expect(result.body.visibility).toBe('PUBLIC')
    })

    it('never relies on provider quotes when the viewer has no jobs', async () => {
      mock.jobs = []
      mock.quotes = [{ jobId: 'unrelated' }]
      const result = await readProfile(endpoint)
      expect(result.status).toBe(200)
      expect(result.body.visibility).toBe('REDUCED')
    })
  },
)
