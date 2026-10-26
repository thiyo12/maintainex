import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { authenticateRequest, db } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  db: {
    job: vi.fn(), user: vi.fn(), quotes: vi.fn(), escrow: vi.fn(), workspace: vi.fn(),
    jobReviews: vi.fn(), providerReviews: vi.fn(), category: vi.fn(), template: vi.fn(), service: vi.fn(),
  },
}))

vi.mock('@/lib/auth/compatibility/mobile-auth', () => ({ authenticateRequest }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    marketplaceJob: { findUnique: db.job }, user: { findUnique: db.user },
    jobQuote: { findMany: db.quotes }, jobEscrow: { findFirst: db.escrow },
    jobWorkspace: { findUnique: db.workspace }, jobReview: { findMany: db.jobReviews },
    providerReview: { findMany: db.providerReviews }, jobCategory: { findUnique: db.category },
    templateJob: { findUnique: db.template }, serviceTemplate: { findUnique: db.service },
  },
}))
vi.mock('@/lib/locations', () => ({ getLocationName: vi.fn(() => null) }))
vi.mock('@/lib/phase6/company-job-read-access', () => ({
  getReadableCompanyIds: vi.fn(async () => []),
  getActiveAssignedCompanyId: vi.fn(async () => null),
}))

import { GET } from '@/app/api/mobile/v2/jobs/[id]/route'

const job = {
  id: 'job-a', customerId: 'customer-a', countryCode: 'LK', status: 'OPEN', targetTaskerId: null,
  categoryId: null, templateJobId: null, serviceTemplateId: null, areaId: null,
  budgetAmount: null, addressStreet: 'synthetic private address', addressBuilding: null,
  addressApartment: null, addressLandmark: null, latitude: null, longitude: null,
  addressSharedAt: null, aiEstimateJson: null, smartBookingJson: null, notifiedCount: 1,
}

function request() {
  return new NextRequest('https://maintainex.test/api/mobile/v2/jobs/job-a')
}

describe('mobile V2 job-detail customer authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.job.mockResolvedValue(job)
    db.user.mockResolvedValue({ id: 'customer-a', name: 'Synthetic Customer A' })
    db.quotes.mockResolvedValue([])
    db.escrow.mockResolvedValue(null)
    db.workspace.mockResolvedValue(null)
    db.jobReviews.mockResolvedValue([])
    db.providerReviews.mockResolvedValue([])
    db.category.mockResolvedValue(null)
    db.template.mockResolvedValue(null)
    db.service.mockResolvedValue(null)
  })

  it('hides another customer’s open job before reading owner details', async () => {
    authenticateRequest.mockResolvedValue({ id: 'customer-b', role: 'CUSTOMER' })

    const response = await GET(request(), { params: Promise.resolve({ id: 'job-a' }) })

    expect(response.status).toBe(404)
    expect(await response.json()).not.toHaveProperty('job')
    expect(db.user).not.toHaveBeenCalled()
    expect(db.quotes).not.toHaveBeenCalled()
    expect(db.escrow).not.toHaveBeenCalled()
    expect(db.workspace).not.toHaveBeenCalled()
  })

  it('preserves the owner’s access to their own open job', async () => {
    authenticateRequest.mockResolvedValue({ id: 'customer-a', role: 'CUSTOMER' })

    const response = await GET(request(), { params: Promise.resolve({ id: 'job-a' }) })

    expect(response.status).toBe(200)
    expect((await response.json()).job.customerId).toBe('customer-a')
  })
})
