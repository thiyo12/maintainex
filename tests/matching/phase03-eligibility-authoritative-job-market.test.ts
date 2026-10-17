import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  findJob: vi.fn(), taskers: vi.fn(), companies: vi.fn(), evaluate: vi.fn(),
}))
vi.mock('@/lib/matching/eligibility', () => ({
  evaluateEligibility: mock.evaluate,
  mapEligibilityToExclusionReason: vi.fn(),
}))
import {
  evaluateTaskerEligibility, evaluateCompanyEligibility,
  getEligibleTaskers, getEligibleCompanies,
} from '@/lib/matching/index'

const db = {
  marketplaceJob: { findUnique: mock.findJob },
  taskerProfile: { findMany: mock.taskers },
  companyProfile: { findMany: mock.companies },
} as any

const VANCOUVER = { latitude: 49.2827, longitude: -123.1207 }
const TORONTO = { latitude: 43.6532, longitude: -79.3832 }
const COLOMBO = { latitude: 6.9271, longitude: 79.8612 }

describe('Phase 03 — all provider eligibility helpers derive job market from address', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.findJob.mockResolvedValue({
      categoryId: 'category', serviceTemplateId: null, templateJobId: null,
      countryCode: 'LK', preferredDate: null, ...VANCOUVER,
    })
    mock.taskers.mockResolvedValue([{ userId: 'tasker' }])
    mock.companies.mockResolvedValue([{ id: 'company' }])
    mock.evaluate.mockResolvedValue({ eligible: true, gates: [], matchedProfessionId: null,
      matchedSkills: [], preferredSkillsMatched: [],
      jurisdictionPassed: true, serviceAreaPassed: true, availabilityPassed: true })
  })

  it('resolves Vancouver instead of stale stored LK for direct individual eligibility', async () => {
    expect((await evaluateTaskerEligibility(db, 'tasker', 'job')).eligible).toBe(true)
    expect(mock.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      job: expect.objectContaining({ countryCode: 'CA' }),
    }))
  })

  it('resolves Vancouver instead of stale stored LK for direct company eligibility', async () => {
    expect((await evaluateCompanyEligibility(db, 'company', 'job')).eligible).toBe(true)
    expect(mock.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      job: expect.objectContaining({ countryCode: 'CA' }),
    }))
  })

  it('rejects Toronto address despite stored CA for an individual before querying eligibility', async () => {
    mock.findJob.mockResolvedValue({ categoryId: 'category', countryCode: 'CA', ...TORONTO })
    expect(await evaluateTaskerEligibility(db, 'tasker', 'job')).toMatchObject({
      eligible: false, gates: [{ gate: 'JOB_MARKET', passed: false }],
    })
    expect(mock.evaluate).not.toHaveBeenCalled()
  })

  it('rejects partial coordinate evidence before company eligibility', async () => {
    mock.findJob.mockResolvedValue({ categoryId: 'category', countryCode: 'CA',
      latitude: 49.2827, longitude: null })
    expect((await evaluateCompanyEligibility(db, 'company', 'job')).eligible).toBe(false)
    expect(mock.evaluate).not.toHaveBeenCalled()
  })

  it('does not load individuals when address is outside both markets', async () => {
    mock.findJob.mockResolvedValue({ categoryId: 'category', countryCode: 'LK', ...TORONTO })
    expect(await getEligibleTaskers(db, 'job')).toEqual([])
    expect(mock.taskers).not.toHaveBeenCalled()
  })

  it('does not load companies when Canadian coordinates are incomplete', async () => {
    mock.findJob.mockResolvedValue({ categoryId: 'category', countryCode: 'CA',
      latitude: 49.2827, longitude: null })
    expect(await getEligibleCompanies(db, 'job')).toEqual([])
    expect(mock.companies).not.toHaveBeenCalled()
  })

  it('scopes individual candidate query and eligibility to Vancouver rather than stored LK', async () => {
    expect(await getEligibleTaskers(db, 'job')).toHaveLength(1)
    expect(mock.taskers).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        user: { countryCode: { equals: 'CA', mode: 'insensitive' } },
      }),
    }))
    expect(mock.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      job: expect.objectContaining({ countryCode: 'CA' }),
    }))
  })

  it('scopes company candidate query and eligibility to Vancouver rather than stored LK', async () => {
    expect(await getEligibleCompanies(db, 'job')).toHaveLength(1)
    expect(mock.companies).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        user: { countryCode: { equals: 'CA', mode: 'insensitive' } },
      }),
    }))
    expect(mock.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      job: expect.objectContaining({ countryCode: 'CA' }),
    }))
  })

  it('preserves coordinate-less historical LK job matching', async () => {
    mock.findJob.mockResolvedValue({ categoryId: 'category', countryCode: 'LK',
      latitude: null, longitude: null })
    expect(await getEligibleTaskers(db, 'job')).toHaveLength(1)
    expect(mock.taskers).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        user: { countryCode: { equals: 'LK', mode: 'insensitive' } },
      }),
    }))
  })

  it('detects LK by Colombo coordinates even when country is stored as CA', async () => {
    mock.findJob.mockResolvedValue({ categoryId: 'category', countryCode: 'CA', ...COLOMBO })
    expect(await getEligibleCompanies(db, 'job')).toHaveLength(1)
    expect(mock.companies).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        user: { countryCode: { equals: 'LK', mode: 'insensitive' } },
      }),
    }))
  })

  it('rejects corrupted stored coordinates rather than falling back to stored country', async () => {
    mock.findJob.mockResolvedValue({ categoryId: 'category', countryCode: 'LK',
      latitude: 6.9271, longitude: Number.NaN })
    expect(await getEligibleTaskers(db, 'job')).toEqual([])
    expect(mock.taskers).not.toHaveBeenCalled()
  })
})
