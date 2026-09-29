import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  marketplaceJobFindUnique: vi.fn(),
  marketplaceJobUpdateMany: vi.fn(),
  jobQuoteFindFirst: vi.fn(),
  jobQuoteUpdateMany: vi.fn(),
  companyProfileFindUnique: vi.fn(),
  jobEscrowFindFirst: vi.fn(),
  jobEscrowUpdateMany: vi.fn(),
  providerAvailabilityUpsert: vi.fn(),
  jobVerificationPinFindFirst: vi.fn(),
  jobVerificationPinCreate: vi.fn(),
  jobVerificationPinUpdate: vi.fn(),
  cancelJob: vi.fn(),
  resolveProviderActor: vi.fn(),
  completeAndReleaseEscrow: vi.fn(),
  raiseJobDispute: vi.fn(),
  transitionJobWorkspace: vi.fn(),
  notifyJobCancelled: vi.fn(),
  notifyCompletionRequested: vi.fn(),
  notifyJobCompleted: vi.fn(),
  notifyPaymentReleased: vi.fn(),
  auditEscrowRelease: vi.fn(),
  hashPassword: vi.fn(async () => 'hashed-pin'),
  verifyPassword: vi.fn(async () => true),
  emitSecurityEvent: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    marketplaceJob: { findUnique: mocks.marketplaceJobFindUnique, updateMany: mocks.marketplaceJobUpdateMany },
    jobQuote: { findFirst: mocks.jobQuoteFindFirst, updateMany: mocks.jobQuoteUpdateMany },
    companyProfile: { findUnique: mocks.companyProfileFindUnique },
    jobEscrow: { findFirst: mocks.jobEscrowFindFirst, updateMany: mocks.jobEscrowUpdateMany },
    providerAvailability: { upsert: mocks.providerAvailabilityUpsert },
    jobVerificationPin: {
      findFirst: mocks.jobVerificationPinFindFirst,
      create: mocks.jobVerificationPinCreate,
      update: mocks.jobVerificationPinUpdate,
    },
    $transaction: vi.fn(async (fn: any) => fn({
      marketplaceJob: { findUnique: mocks.marketplaceJobFindUnique, updateMany: mocks.marketplaceJobUpdateMany },
      jobQuote: { findFirst: mocks.jobQuoteFindFirst, updateMany: mocks.jobQuoteUpdateMany },
      jobEscrow: { findFirst: mocks.jobEscrowFindFirst, updateMany: mocks.jobEscrowUpdateMany },
      jobVerificationPin: {
        findFirst: mocks.jobVerificationPinFindFirst,
        create: mocks.jobVerificationPinCreate,
        update: mocks.jobVerificationPinUpdate,
      },
    })),
  },
}))

vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({
  authenticateRequest: mocks.authenticateRequest,
  assertNotSuspended: () => null,
}))

vi.mock('@/lib/domain/job-lifecycle', () => ({
  transitionJobWorkspace: mocks.transitionJobWorkspace,
  completeAndReleaseEscrow: mocks.completeAndReleaseEscrow,
  raiseJobDispute: mocks.raiseJobDispute,
  resolveProviderActor: mocks.resolveProviderActor,
  cancelJob: mocks.cancelJob,
}))

vi.mock('@/lib/notifications', () => ({
  notifyCompletionRequested: mocks.notifyCompletionRequested,
  notifyJobCompleted: mocks.notifyJobCompleted,
  notifyPaymentReleased: mocks.notifyPaymentReleased,
  notifyJobCancelled: mocks.notifyJobCancelled,
}))

vi.mock('@/lib/rate-limit/financial-guard', () => ({
  requireFinancialRateLimit: vi.fn(async () => null),
}))

vi.mock('@/lib/financial-audit', () => ({
  auditEscrowRelease: mocks.auditEscrowRelease,
}))

vi.mock('@/lib/security/password', () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
}))

vi.mock('@/lib/security/events', () => ({
  emitSecurityEvent: mocks.emitSecurityEvent,
}))

const DB_SLUGS = new Set([
  'ac-and-refrigeration', 'appliance-installation-and-repair', 'carpentry-and-furniture',
  'cleaning-services', 'curtains-blinds-and-upholstery', 'electrical-works',
  'event-and-party-services', 'gardening-and-landscaping', 'glass-and-aluminium',
  'handyman-and-general-repairs', 'home-renovation-and-interiors', 'home-security-and-automation',
  'it-and-electronics-repair', 'locksmith-services', 'masonry-and-concrete',
  'moving-and-packing', 'painting-and-decorating', 'personal-care-and-wellness',
  'pest-control', 'plumbing', 'roofing-and-gutters', 'solar-and-energy-solutions',
  'tiling-and-flooring', 'vehicle-care-and-maintenance',
])

describe('F-1 — search relevance and category ids', () => {
  it('returns no results for a nonsense query', async () => {
    const { aiSearch } = await import('@/lib/ai-search')
    expect(aiSearch('zzzznonexistentqqq')).toEqual([])
  })

  it('returns DB slug ids for a real query', async () => {
    const { aiSearch } = await import('@/lib/ai-search')
    const results = aiSearch('plumbing')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].type).toBe('category')
    expect(DB_SLUGS.has(results[0].categoryId)).toBe(true)
    for (const r of results) expect(DB_SLUGS.has(r.categoryId)).toBe(true)
  })

  it('still matches short keyword substrings for genuine queries', async () => {
    const { aiSearch } = await import('@/lib/ai-search')
    const results = aiSearch('tent hire')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(r => r.categoryId === 'event-and-party-services')).toBe(true)
  })

  it('resolves electrical search to the electrical-works slug', async () => {
    const { aiSearch } = await import('@/lib/ai-search')
    const results = aiSearch('electrical')
    expect(results.some(r => r.categoryId === 'electrical-works')).toBe(true)
  })
})

describe('F-4 — setProviderAvailability allowlist', () => {
  beforeEach(() => vi.clearAllMocks())

  it('drops unknown fields and never lets callers override providerType', async () => {
    const { setProviderAvailability } = await import('@/lib/availability-engine')
    await setProviderAvailability('prov-1', {
      monday: false,
      providerType: 'COMPANY',
      isAdmin: true,
      startTime: '09:00',
    } as any)
    expect(mocks.providerAvailabilityUpsert).toHaveBeenCalledTimes(1)
    const arg = mocks.providerAvailabilityUpsert.mock.calls[0][0]
    expect(arg.create.monday).toBe(false)
    expect(arg.create.startTime).toBe('09:00')
    expect(arg.create.providerType).toBe('INDIVIDUAL')
    expect(arg.create.isAdmin).toBeUndefined()
    expect(arg.update.isAdmin).toBeUndefined()
    expect(arg.update.providerType).toBeUndefined()
  })

  it('rejects invalid field types with a validation error', async () => {
    const { setProviderAvailability } = await import('@/lib/availability-engine')
    await expect(setProviderAvailability('prov-1', { monday: 'yes' } as any)).rejects.toThrow(
      /Invalid availability field/,
    )
    expect(mocks.providerAvailabilityUpsert).not.toHaveBeenCalled()
  })

  it('rejects payloads with no valid fields', async () => {
    const { setProviderAvailability } = await import('@/lib/availability-engine')
    await expect(setProviderAvailability('prov-1', { evil: 1 } as any)).rejects.toThrow(
      'No valid availability fields provided',
    )
    expect(mocks.providerAvailabilityUpsert).not.toHaveBeenCalled()
  })

  it('coerces vacation date strings to Date objects', async () => {
    const { setProviderAvailability } = await import('@/lib/availability-engine')
    await setProviderAvailability('prov-1', { vacationStart: '2026-12-01T00:00:00.000Z' } as any)
    const arg = mocks.providerAvailabilityUpsert.mock.calls[0][0]
    expect(arg.create.vacationStart).toBeInstanceOf(Date)
  })
})

describe('F-6 — job PIN version sequence', () => {
  beforeEach(() => vi.clearAllMocks())

  it('continues version numbering after revoke (no unique-constraint 500)', async () => {
    const { generateJobPin } = await import('@/lib/domain/job-pin')
    mocks.marketplaceJobFindUnique.mockResolvedValue({ id: 'job-1', customerId: 'cust-1' })

    mocks.jobVerificationPinFindFirst.mockImplementation(async () => ({ id: 'pin-1', status: 'ACTIVE', version: 1 }))
    await expect(generateJobPin('job-1', 'cust-1')).rejects.toThrow('An active PIN already exists')

    mocks.jobVerificationPinFindFirst.mockImplementation(async (args: any) => {
      if (args?.where?.status === 'ACTIVE') return null
      return { version: 3 }
    })
    mocks.jobVerificationPinCreate.mockResolvedValue({ version: 4 })

    const result = await generateJobPin('job-1', 'cust-1')
    expect(result.version).toBe(4)
    expect(mocks.jobVerificationPinCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 4 }) }),
    )
  })
})

function postRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('F-5 — CANCEL action on POST /v2/jobs/[id]/complete', () => {
  const params = { params: Promise.resolve({ id: 'job-1' }) }

  beforeEach(() => vi.clearAllMocks())

  it('rejects unknown actions with the updated message', async () => {
    const { POST } = await import('@/app/api/mobile/v2/jobs/[id]/complete/route')
    mocks.authenticateRequest.mockResolvedValue({ id: 'cust-1', role: 'CUSTOMER' })
    const res = await POST(postRequest('https://maintainex.lk/x', { action: 'NOPE' }), params)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('CANCEL')
  })

  it('returns 403 for a user who is neither owner nor provider', async () => {
    const { POST } = await import('@/app/api/mobile/v2/jobs/[id]/complete/route')
    mocks.authenticateRequest.mockResolvedValue({ id: 'outsider', role: 'CUSTOMER' })
    mocks.marketplaceJobFindUnique.mockResolvedValue({ id: 'job-1', customerId: 'cust-1', status: 'OPEN', title: 'Plumbing' })
    mocks.resolveProviderActor.mockResolvedValue(null)

    const res = await POST(postRequest('https://maintainex.lk/x', { action: 'CANCEL' }), params)
    expect(res.status).toBe(403)
    expect(mocks.cancelJob).not.toHaveBeenCalled()
  })

  it('returns 409 when the customer tries to cancel after work started', async () => {
    const { POST } = await import('@/app/api/mobile/v2/jobs/[id]/complete/route')
    mocks.authenticateRequest.mockResolvedValue({ id: 'cust-1', role: 'CUSTOMER' })
    mocks.marketplaceJobFindUnique.mockResolvedValue({ id: 'job-1', customerId: 'cust-1', status: 'IN_PROGRESS', title: 'Plumbing' })

    const res = await POST(postRequest('https://maintainex.lk/x', { action: 'CANCEL' }), params)
    expect(res.status).toBe(409)
    expect(mocks.cancelJob).not.toHaveBeenCalled()
  })

  it('cancels an open job as customer and notifies the accepted provider', async () => {
    const { POST } = await import('@/app/api/mobile/v2/jobs/[id]/complete/route')
    mocks.authenticateRequest.mockResolvedValue({ id: 'cust-1', role: 'CUSTOMER' })
    mocks.marketplaceJobFindUnique.mockResolvedValue({ id: 'job-1', customerId: 'cust-1', status: 'OPEN', title: 'Plumbing' })
    mocks.jobQuoteFindFirst.mockResolvedValue({ providerId: 'prov-profile-1', providerType: 'INDIVIDUAL' })
    mocks.cancelJob.mockResolvedValue({ jobId: 'job-1', previousStatus: 'OPEN' })

    const res = await POST(postRequest('https://maintainex.lk/x', { action: 'CANCEL', reason: 'No longer needed' }), params)
    expect(res.status).toBe(200)
    expect(mocks.cancelJob).toHaveBeenCalledWith(
      { jobId: 'job-1', actorId: 'cust-1', actorType: 'CUSTOMER' },
    )
    expect(mocks.notifyJobCancelled).toHaveBeenCalledWith(
      'job-1', 'prov-profile-1', 'Plumbing', 'customer', 'No longer needed',
    )
  })

  it('lets the assigned provider cancel a pre-start job and notifies the customer', async () => {
    const { POST } = await import('@/app/api/mobile/v2/jobs/[id]/complete/route')
    mocks.authenticateRequest.mockResolvedValue({ id: 'prov-user-1', role: 'TASKER' })
    mocks.marketplaceJobFindUnique.mockResolvedValue({ id: 'job-1', customerId: 'cust-1', status: 'QUOTE_ACCEPTED', title: 'Plumbing' })
    mocks.resolveProviderActor.mockResolvedValue('PROVIDER')
    mocks.cancelJob.mockResolvedValue({ jobId: 'job-1', previousStatus: 'QUOTE_ACCEPTED' })

    const res = await POST(postRequest('https://maintainex.lk/x', { action: 'CANCEL', reason: 'Unavailable' }), params)
    expect(res.status).toBe(200)
    expect(mocks.cancelJob).toHaveBeenCalledWith(
      { jobId: 'job-1', actorId: 'prov-user-1', actorType: 'PROVIDER' },
    )
    expect(mocks.notifyJobCancelled).toHaveBeenCalledWith(
      'job-1', 'cust-1', 'Plumbing', 'provider', 'Unavailable',
    )
  })
})

describe('F-3 — escrow/completion error mapping', () => {
  const params = { params: Promise.resolve({ id: 'job-1' }) }

  beforeEach(() => vi.clearAllMocks())

  it('maps "Job is not in progress" from release-escrow to 409', async () => {
    const { POST } = await import('@/app/api/mobile/v2/jobs/[id]/release-escrow/route')
    mocks.authenticateRequest.mockResolvedValue({ id: 'cust-1', role: 'CUSTOMER' })
    mocks.marketplaceJobFindUnique.mockResolvedValue({ id: 'job-1', customerId: 'cust-1', status: 'QUOTE_ACCEPTED' })
    mocks.completeAndReleaseEscrow.mockRejectedValue(new Error('Job is not in progress'))

    const res = await POST(postRequest('https://maintainex.lk/x', {}), params)
    expect(res.status).toBe(409)
  })

  it('maps "No protected escrow found" from DISPUTE to 409', async () => {
    const { POST } = await import('@/app/api/mobile/v2/jobs/[id]/complete/route')
    mocks.authenticateRequest.mockResolvedValue({ id: 'cust-1', role: 'CUSTOMER' })
    mocks.marketplaceJobFindUnique.mockResolvedValue({ id: 'job-1', customerId: 'cust-1', status: 'QUOTE_ACCEPTED', title: 'Plumbing' })
    mocks.raiseJobDispute.mockRejectedValue(new Error('No protected escrow found'))

    const res = await POST(postRequest('https://maintainex.lk/x', { action: 'DISPUTE' }), params)
    expect(res.status).toBe(409)
  })

  it('maps "Only the customer can approve" from APPROVE_COMPLETION to 403', async () => {
    const { POST } = await import('@/app/api/mobile/v2/jobs/[id]/complete/route')
    mocks.authenticateRequest.mockResolvedValue({ id: 'prov-user-1', role: 'TASKER' })
    mocks.marketplaceJobFindUnique.mockResolvedValue({ id: 'job-1', customerId: 'cust-1', status: 'IN_PROGRESS', title: 'Plumbing' })
    mocks.completeAndReleaseEscrow.mockRejectedValue(new Error('Only the customer can approve'))

    const res = await POST(postRequest('https://maintainex.lk/x', { action: 'APPROVE_COMPLETION' }), params)
    expect(res.status).toBe(403)
  })
})
