import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  hasDeclaredProviderCapabilities,
  checkCompanyEligibility,
  checkIndividualProviderEligibility,
} from '@/lib/phase6/provider-eligibility'

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  companyFindUnique: vi.fn(),
  specialtyCount: vi.fn(),
  ownersFindMany: vi.fn(),
  taskerFindUnique: vi.fn(),
  taskerSkillCount: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    companyProfile: { findUnique: mocks.companyFindUnique },
    companySpecialty: { count: mocks.specialtyCount },
    teamMember: { findMany: mocks.ownersFindMany },
    taskerProfile: { findUnique: mocks.taskerFindUnique },
    taskerSkill: { count: mocks.taskerSkillCount },
  },
}))

describe('Phase 04 — provider onboarding requires actual declared capabilities', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.userFindUnique.mockResolvedValue({
      identityStatus: 'VERIFIED',
      isSuspended: false,
      isBanned: false,
      role: 'TASKER',
    })
    mocks.companyFindUnique.mockResolvedValue({
      isVerified: true,
      verificationStatus: 'VERIFIED',
      services: '[]',
      subscriptionStatus: 'ACTIVE',
      userId: 'owner',
    })
    mocks.taskerFindUnique.mockResolvedValue({
      id: 'tasker',
      isVerified: true,
      verificationStatus: 'VERIFIED',
      skills: '[]',
    })
    mocks.specialtyCount.mockResolvedValue(0)
    mocks.ownersFindMany.mockResolvedValue([{
      user: { isActive: true, isSuspended: false, isBanned: false },
    }])
    mocks.taskerSkillCount.mockResolvedValue(0)
  })

  it('does not treat an empty serialized array as a real service capability', () => {
    for (const raw of [null, '', ' ', '[]', ' [ ] ', '[""]', '["   "]']) {
      expect(hasDeclaredProviderCapabilities(raw)).toBe(false)
    }
  })

  it('preserves genuine legacy comma-separated and JSON capabilities', () => {
    for (const raw of ['plumbing', 'plumbing,electrical', '["plumbing"]', '["plumbing","electrical"]']) {
      expect(hasDeclaredProviderCapabilities(raw)).toBe(true)
    }
  })

  it('blocks a verified company with empty JSON services and no specialty', async () => {
    const result = await checkCompanyEligibility('company')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('No service capabilities declared')
  })

  it('accepts a verified company with a legitimate legacy service label', async () => {
    mocks.companyFindUnique.mockResolvedValue({
      isVerified: true, verificationStatus: 'VERIFIED',
      services: 'plumbing', subscriptionStatus: 'ACTIVE', userId: 'owner',
    })
    const result = await checkCompanyEligibility('company')
    expect(result.eligible).toBe(true)
  })

  it('accepts a verified company with a relational specialty even if legacy list is empty', async () => {
    mocks.specialtyCount.mockResolvedValue(1)
    const result = await checkCompanyEligibility('company')
    expect(result.eligible).toBe(true)
  })

  it('fails closed when an approved company owner account has been deleted', async () => {
    mocks.companyFindUnique.mockResolvedValue({
      isVerified: true, verificationStatus: 'VERIFIED',
      services: '["plumbing"]', subscriptionStatus: 'ACTIVE', userId: 'missing-owner',
    })
    mocks.ownersFindMany.mockResolvedValue([{ user: null }])
    const result = await checkCompanyEligibility('company')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('Company owner account is missing')
  })

  it('rejects companies with no actual active owner membership', async () => {
    mocks.ownersFindMany.mockResolvedValue([])
    mocks.companyFindUnique.mockResolvedValue({
      isVerified: true, verificationStatus: 'VERIFIED', services: '["plumbing"]',
      subscriptionStatus: 'ACTIVE', userId: 'historical-owner',
    })
    const result = await checkCompanyEligibility('company')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('No active company owner')
  })

  it('keeps a transferred company eligible when its original creator is no longer an active owner', async () => {
    mocks.companyFindUnique.mockResolvedValue({
      isVerified: true, verificationStatus: 'VERIFIED', services: '["plumbing"]',
      subscriptionStatus: 'ACTIVE', userId: 'historical-owner',
    })
    mocks.userFindUnique.mockResolvedValue(null)
    const result = await checkCompanyEligibility('company')
    expect(result.eligible).toBe(true)
    expect(mocks.ownersFindMany).toHaveBeenCalledWith({
      where: { companyId: 'company', role: 'COMPANY_OWNER', status: 'ACTIVE' },
      select: { user: { select: { isActive: true, isSuspended: true, isBanned: true } } },
    })
  })

  it('blocks an individual verified provider with blank capabilities', async () => {
    const result = await checkIndividualProviderEligibility('tasker-user')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('No service capabilities declared')
  })

  it('preserves eligible existing providers with a real JSON capability', async () => {
    mocks.taskerFindUnique.mockResolvedValue({
      id: 'tasker', verificationStatus: 'VERIFIED', isVerified: true, skills: '["plumbing"]',
    })
    const result = await checkIndividualProviderEligibility('tasker-user')
    expect(result.eligible).toBe(true)
  })

  it('accepts relational individual capabilities even without legacy labels', async () => {
    mocks.taskerSkillCount.mockResolvedValue(1)
    const result = await checkIndividualProviderEligibility('tasker-user')
    expect(result.eligible).toBe(true)
  })
})
