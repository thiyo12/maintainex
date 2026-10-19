import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { getEligibleCompanies } from '@/lib/matching/index'

const mock = vi.hoisted(() => ({ evaluate: vi.fn() }))
vi.mock('@/lib/matching/eligibility', () => ({
  evaluateEligibility: mock.evaluate,
  mapEligibilityToExclusionReason: vi.fn(),
}))

describe('Phase 04 — company discovery follows the registered market after ownership transfer', () => {
  it('queries the company market and evaluates the actual provider, not the historical creator', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'company' }])
    mock.evaluate.mockResolvedValue({
      eligible: true, gates: [], matchedProfessionId: null,
      matchedSkills: [], preferredSkillsMatched: [],
      jurisdictionPassed: true, serviceAreaPassed: true, availabilityPassed: true,
    })
    const db = {
      marketplaceJob: { findUnique: vi.fn().mockResolvedValue({
        categoryId: 'plumbing', countryCode: 'CA',
        latitude: 49.2827, longitude: -123.1207,
        serviceTemplateId: null, templateJobId: null,
        preferredDate: null,
      }) },
      jobCategory: { findUnique: vi.fn().mockResolvedValue({
        id: 'plumbing', slug: 'plumbing',
      }) },
      companyProfile: { findMany },
    } as unknown as PrismaClient

    expect(await getEligibleCompanies(db, 'booking')).toHaveLength(1)
    expect(findMany).toHaveBeenCalledWith({
      where: {
        verificationStatus: 'VERIFIED',
        isVerified: true,
        countryCode: { equals: 'CA', mode: 'insensitive' },
      },
      select: { id: true },
    })
    expect(mock.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      providerType: 'COMPANY',
      providerId: 'company',
      job: expect.objectContaining({ countryCode: 'CA' }),
    }))
  })
})
