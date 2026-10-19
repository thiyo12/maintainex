import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { findCompanyCandidatesForTemplate } from '@/lib/domain/company-provider-discovery'

const mock = vi.hoisted(() => ({ findMany: vi.fn(), evaluate: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/matching/eligibility', () => ({ evaluateEligibility: mock.evaluate }))

const db = {
  companyProfile: { findMany: mock.findMany },
} as unknown as PrismaClient

const company = {
  id: 'company-id',
  companyName: 'Licensed Vancouver Team',
  logo: '/public/company-logo',
  rating: 4.6, completedProjects: 9, staffCount: 4,
  serviceAreas: '["Vancouver"]',
  latitude: 49.2827, longitude: -123.1207, serviceRadius: 10,
}
const request = {
  templateJobId: 'template-plumbing', categoryId: 'plumbing',
  countryCode: 'CA' as const,
  latitude: 49.2827, longitude: -123.1207, district: 'Vancouver',
  radiusKm: 50,
}

describe('Phase 12 — local verified company browse has no work authority', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.findMany.mockResolvedValue([company])
    mock.evaluate.mockResolvedValue({ eligible: true })
  })

  it('queries only verified companies in the selected registered market', async () => {
    const results = await findCompanyCandidatesForTemplate(request, db)
    expect(mock.findMany).toHaveBeenCalledWith({
      where: {
        countryCode: { equals: 'CA', mode: 'insensitive' },
        verificationStatus: 'VERIFIED', isVerified: true,
      },
      select: {
        id: true, companyName: true, logo: true, rating: true,
        completedProjects: true, staffCount: true, serviceAreas: true,
        latitude: true, longitude: true, serviceRadius: true,
      },
      orderBy: { rating: 'desc' }, take: 40,
    })
    expect(mock.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      providerId: 'company-id', providerType: 'COMPANY',
      job: expect.objectContaining({
        categoryId: 'plumbing', templateJobId: 'template-plumbing',
        countryCode: 'CA', jobMode: 'QUOTE',
      }), client: db,
    }))
    expect(results).toEqual([{
      id: 'company-id', providerType: 'COMPANY',
      companyName: company.companyName, logo: company.logo,
      rating: 4.6, completedJobs: 9, teamSize: 4, isVerified: true,
      isOnline: false, distance: null, score: null,
    }])
    expect(JSON.stringify(results)).not.toContain('-123.1207')
    expect(JSON.stringify(results)).not.toContain('serviceAreas')
  })

  it('does not return candidates whose owner, licence, skills or payment eligibility is revoked', async () => {
    mock.evaluate.mockResolvedValue({ eligible: false })
    expect(await findCompanyCandidatesForTemplate(request, db)).toEqual([])
  })

  it('does not label far-away companies as local despite their verified status', async () => {
    mock.findMany.mockResolvedValue([{ ...company, latitude: 49.5, longitude: -123.5 }])
    expect(await findCompanyCandidatesForTemplate(request, db)).toEqual([])
    expect(mock.evaluate).not.toHaveBeenCalled()
  })

  it('does not display unlocated companies unless their declared area includes verified municipality', async () => {
    mock.findMany.mockResolvedValue([{ ...company, latitude: null, longitude: null,
      serviceRadius: null, serviceAreas: '["Burnaby"]' }])
    expect(await findCompanyCandidatesForTemplate(request, db)).toEqual([])
    expect(mock.evaluate).not.toHaveBeenCalled()
    mock.findMany.mockResolvedValue([{ ...company, latitude: null, longitude: null,
      serviceRadius: null, serviceAreas: '["Vancouver"]' }])
    expect(await findCompanyCandidatesForTemplate(request, db)).toHaveLength(1)
  })

  it('does not treat city-wide Canadian coverage as verified with neither GPS nor declared area', async () => {
    mock.findMany.mockResolvedValue([{ ...company, serviceAreas: '[]' }])
    const result = await findCompanyCandidatesForTemplate({
      ...request, latitude: null, longitude: null, district: null,
    }, db)
    expect(result).toEqual([])
    expect(mock.evaluate).not.toHaveBeenCalled()
  })

  it('refuses malformed radius or partial location without loading providers', async () => {
    expect(await findCompanyCandidatesForTemplate({ ...request, longitude: null }, db)).toEqual([])
    expect(await findCompanyCandidatesForTemplate({ ...request, radiusKm: -1 }, db)).toEqual([])
    expect(await findCompanyCandidatesForTemplate({ ...request, radiusKm: 150 }, db)).toEqual([])
    expect(mock.findMany).not.toHaveBeenCalled()
  })
})
