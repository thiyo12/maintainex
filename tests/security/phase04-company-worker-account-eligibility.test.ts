import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkIndividualProviderEligibility,
  checkCompanyEligibility,
  checkWorkerEligibility,
} from '@/lib/phase6/provider-eligibility'

const mock = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  taskerFindUnique: vi.fn(),
  companyFindUnique: vi.fn(),
  memberFindFirst: vi.fn(),
  teamOwnerCount: vi.fn(),
  taskerSkillCount: vi.fn(),
  companySpecialtyCount: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mock.userFindUnique },
    taskerProfile: { findUnique: mock.taskerFindUnique },
    companyProfile: { findUnique: mock.companyFindUnique },
    teamMember: { findFirst: mock.memberFindFirst, count: mock.teamOwnerCount },
    taskerSkill: { count: mock.taskerSkillCount },
    companySpecialty: { count: mock.companySpecialtyCount },
  },
}))

describe('Phase 04 — inactive provider and worker accounts never become eligible', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.userFindUnique.mockResolvedValue({
      identityStatus: 'VERIFIED',
      isActive: true,
      isSuspended: false,
      isBanned: false,
    })
    mock.memberFindFirst.mockResolvedValue({
      id: 'member', companyId: 'company', userId: 'worker', status: 'ACTIVE',
    })
    mock.companyFindUnique.mockResolvedValue({
      verificationStatus: 'VERIFIED', isVerified: true,
      services: '["plumbing"]', subscriptionStatus: 'ACTIVE', userId: 'owner',
    })
    mock.taskerFindUnique.mockResolvedValue({
      id: 'tasker', verificationStatus: 'VERIFIED',
      isVerified: true, skills: '["plumbing"]',
    })
    mock.teamOwnerCount.mockResolvedValue(1)
    mock.taskerSkillCount.mockResolvedValue(1)
    mock.companySpecialtyCount.mockResolvedValue(0)
  })

  it('allows a verified active worker with active company membership', async () => {
    const result = await checkWorkerEligibility('company', 'worker')
    expect(result.eligible).toBe(true)
  })

  it('refuses an inactive worker even with active company membership and verified identity', async () => {
    mock.userFindUnique.mockResolvedValue({
      identityStatus: 'VERIFIED', isActive: false, isSuspended: false, isBanned: false,
    })
    const result = await checkWorkerEligibility('company', 'worker')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('Worker account is inactive')
  })

  it('retains worker suspension blocking independently from inactivity', async () => {
    mock.userFindUnique.mockResolvedValue({
      identityStatus: 'VERIFIED', isActive: true, isSuspended: true, isBanned: false,
    })
    const result = await checkWorkerEligibility('company', 'worker')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('Worker account is suspended')
  })

  it('keeps an active verified company with an active owner eligible', async () => {
    const result = await checkCompanyEligibility('company')
    expect(result.eligible).toBe(true)
  })

  it('refuses company eligibility when its owner user account is inactive', async () => {
    mock.userFindUnique.mockResolvedValue({
      identityStatus: 'VERIFIED', isActive: false, isSuspended: false, isBanned: false,
    })
    const result = await checkCompanyEligibility('company')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('Company owner account is inactive')
  })

  it('keeps active verified individual providers eligible', async () => {
    const result = await checkIndividualProviderEligibility('tasker-user')
    expect(result.eligible).toBe(true)
  })

  it('refuses inactive individual providers even if their identity and services are verified', async () => {
    mock.userFindUnique.mockResolvedValue({
      identityStatus: 'VERIFIED', isActive: false, isSuspended: false, isBanned: false,
    })
    const result = await checkIndividualProviderEligibility('tasker-user')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('Account is inactive')
  })

  it('keeps existing identity and suspension checks intact', async () => {
    mock.userFindUnique.mockResolvedValue({
      identityStatus: 'NOT_SUBMITTED', isActive: true, isSuspended: true, isBanned: false,
    })
    const result = await checkIndividualProviderEligibility('tasker-user')
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('Identity not verified')
    expect(result.reasons).toContain('Account is suspended')
  })
})
