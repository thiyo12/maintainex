import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  evaluateTaskerEligibility,
  evaluateCompanyEligibility,
  getEligibleTaskers,
  getEligibleCompanies,
} from '@/lib/matching/index'

const mock = vi.hoisted(() => ({ evaluate: vi.fn() }))
vi.mock('@/lib/matching/eligibility', () => ({
  evaluateEligibility: mock.evaluate,
  mapEligibilityToExclusionReason: vi.fn(),
}))

const job = {
  id: 'booking', categoryId: 'category', countryCode: 'LK',
  latitude: null, longitude: null, preferredDate: null,
  serviceTemplateId: 'template', templateJobId: null,
}

function client(overrides: Partial<typeof job> = {}) {
  const db = {
    marketplaceJob: { findUnique: vi.fn().mockResolvedValue({ ...job, ...overrides }) },
    jobCategory: { findUnique: vi.fn().mockResolvedValue({ id: 'category', slug: 'plumbing' }) },
    serviceTemplate: { findUnique: vi.fn().mockResolvedValue({
      slug: 'pipe-repair', jobCategoryId: 'category', templateJobId: 'pipe-repair',
    }) },
    templateJob: { findUnique: vi.fn().mockImplementation(async ({ where }) => ({
      id: where.id, categoryId: 'category',
    })) },
    taskerProfile: { findMany: vi.fn().mockResolvedValue([{ userId: 'worker' }]) },
    companyProfile: { findMany: vi.fn().mockResolvedValue([{ id: 'company' }]) },
  }
  return { db: db as unknown as PrismaClient, mocks: db }
}

describe('Phase 04 — every matching entry point preserves the exact canonical service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.evaluate.mockResolvedValue({
      eligible: true, gates: [], matchedProfessionId: null, matchedSkills: [],
      preferredSkillsMatched: [], jurisdictionPassed: true,
      serviceAreaPassed: true, availabilityPassed: true,
    })
  })

  it('passes a linked service TemplateJob into single-tasker evaluation', async () => {
    const { db } = client()
    expect((await evaluateTaskerEligibility(db, 'worker', 'booking')).eligible).toBe(true)
    expect(mock.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      providerId: 'worker',
      job: expect.objectContaining({ templateJobId: 'pipe-repair' }),
    }))
  })

  it('passes the same linked service into single-company evaluation', async () => {
    const { db } = client()
    expect((await evaluateCompanyEligibility(db, 'company', 'booking')).eligible).toBe(true)
    expect(mock.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      providerId: 'company',
      job: expect.objectContaining({ templateJobId: 'pipe-repair' }),
    }))
  })

  it('passes the exact linked TemplateJob for discovered individual candidates', async () => {
    const { db } = client()
    expect(await getEligibleTaskers(db, 'booking')).toHaveLength(1)
    expect(mock.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      providerId: 'worker',
      job: expect.objectContaining({ templateJobId: 'pipe-repair' }),
    }))
  })

  it('passes the exact linked TemplateJob for discovered company candidates', async () => {
    const { db } = client()
    expect(await getEligibleCompanies(db, 'booking')).toHaveLength(1)
    expect(mock.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      providerId: 'company',
      job: expect.objectContaining({ templateJobId: 'pipe-repair' }),
    }))
  })

  it('does not broaden inconsistent direct and linked TemplateJob pointers', async () => {
    const { db } = client({ templateJobId: 'sibling' })
    const result = await evaluateTaskerEligibility(db, 'worker', 'booking')
    expect(result.eligible).toBe(false)
    expect(result.gates[0].gate).toBe('JOB_CAPABILITY')
    expect(mock.evaluate).not.toHaveBeenCalled()
  })

  it('does not list any company when a service points at an inconsistent canonical job', async () => {
    const { db } = client({ templateJobId: 'sibling' })
    expect(await getEligibleCompanies(db, 'booking')).toEqual([])
    expect(mock.evaluate).not.toHaveBeenCalled()
  })

  it('passes an exact directly selected canonical job for bookings without a service link', async () => {
    const { db } = client({ serviceTemplateId: null, templateJobId: 'direct-job' })
    expect((await evaluateTaskerEligibility(db, 'worker', 'booking')).eligible).toBe(true)
    expect(mock.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      job: expect.objectContaining({ templateJobId: 'direct-job' }),
    }))
  })

  it('retains historical category-level bookings that never selected a canonical job', async () => {
    const { db, mocks } = client({ serviceTemplateId: null, templateJobId: null })
    expect((await evaluateCompanyEligibility(db, 'company', 'booking')).eligible).toBe(true)
    expect(mock.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      job: expect.objectContaining({ templateJobId: undefined }),
    }))
    expect(mocks.serviceTemplate.findUnique).not.toHaveBeenCalled()
  })

  it('fails closed when the service belongs to another category', async () => {
    const { db, mocks } = client()
    mocks.serviceTemplate.findUnique.mockResolvedValue({
      slug: 'wrong-market', jobCategoryId: 'electrical', templateJobId: 'pipe-repair',
    })
    expect(await getEligibleTaskers(db, 'booking')).toEqual([])
    expect(mock.evaluate).not.toHaveBeenCalled()
  })
})
