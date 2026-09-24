import { describe, it, expect, vi } from 'vitest'
import { evaluateEligibility, mapEligibilityToExclusionReason } from '@/lib/matching/eligibility'
import type { ProviderType } from '@/lib/matching/types'

function mockPrisma(overrides: Record<string, any> = {}) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'user-1',
        isSuspended: false,
        isBanned: false,
        identityStatus: 'VERIFIED',
        isActive: true,
        countryCode: 'US',
      }),
    },
    taskerProfile: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'profile-1',
        userId: 'tasker-1',
        verificationStatus: 'VERIFIED',
        isVerified: true,
        skills: null,
        taskerSkills: [{ job: { categoryId: 'cat-1' } }],
        rating: 4.5,
        completedJobs: 5,
      }),
    },
    teamMember: {
      count: vi.fn().mockResolvedValue(1),
    },
    companyProfile: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    serviceProfessionRequirement: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    serviceSkillRequirement: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    taskerProfession: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    taskerSkill: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    companySpecialty: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    companyProfession: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    professionJurisdictionRequirement: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    certification: {
      count: vi.fn().mockResolvedValue(1),
    },
    marketplaceJob: {
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue({ preferredDate: null, preferredTimeSlot: null }),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as any
}

function makeIndivInput(overrides: Record<string, any> = {}) {
  const client = mockPrisma(overrides.clientOverrides || {})
  delete overrides.clientOverrides
  return {
    providerType: 'INDIVIDUAL' as ProviderType,
    providerId: 'tasker-1',
    job: {
      jobId: 'job-1',
      categoryId: 'cat-1',
      serviceTemplateId: undefined,
      jobMode: 'QUOTE' as const,
      urgency: 'NORMAL' as const,
      countryCode: 'US',
    },
    client,
    ...overrides,
  }
}

describe('Phase 10.2 — Eligibility Engine', () => {
  describe('evaluateEligibility — INDIVIDUAL', () => {
    it('passes all basic gates for a valid individual provider (legacy fallback)', async () => {
      const input = makeIndivInput()
      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(true)
      expect(result.gates.every(g => g.passed)).toBe(true)
      expect(result.gates.find(g => g.gate === 'PROVIDER_VERIFIED')?.passed).toBe(true)
    })

    it('returns correct flag values when eligible', async () => {
      const input = makeIndivInput()
      const result = await evaluateEligibility(input)
      expect(result.jurisdictionPassed).toBe(true)
      expect(result.serviceAreaPassed).toBe(true)
      expect(result.availabilityPassed).toBe(true)
    })

    it('fails ACCOUNT_EXISTS when user not found', async () => {
      const input = makeIndivInput({
        clientOverrides: {
          user: { findUnique: vi.fn().mockResolvedValue(null) },
        },
      })
      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(false)
      expect(result.gates.find(g => g.gate === 'ACCOUNT_EXISTS')?.passed).toBe(false)
    })

    it('fails NOT_SUSPENDED when user is suspended', async () => {
      const input = makeIndivInput({
        clientOverrides: {
          user: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'user-1', isSuspended: true, isBanned: false,
              identityStatus: 'VERIFIED', isActive: true,
            }),
          },
        },
      })
      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(false)
      expect(result.gates.find(g => g.gate === 'NOT_SUSPENDED')?.passed).toBe(false)
    })

    it('fails NOT_BANNED when user is banned', async () => {
      const input = makeIndivInput({
        clientOverrides: {
          user: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'user-1', isSuspended: false, isBanned: true,
              identityStatus: 'VERIFIED', isActive: true,
            }),
          },
        },
      })
      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(false)
      expect(result.gates.find(g => g.gate === 'NOT_BANNED')?.passed).toBe(false)
    })

    it('fails IDENTITY_VERIFIED when identity not verified', async () => {
      const input = makeIndivInput({
        clientOverrides: {
          user: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'user-1', isSuspended: false, isBanned: false,
              identityStatus: 'PENDING', isActive: true,
            }),
          },
        },
      })
      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(false)
      expect(result.gates.find(g => g.gate === 'IDENTITY_VERIFIED')?.passed).toBe(false)
    })

    it('fails PROVIDER_PROFILE when profile not found', async () => {
      const input = makeIndivInput({
        clientOverrides: {
          taskerProfile: { findUnique: vi.fn().mockResolvedValue(null) },
        },
      })
      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(false)
      expect(result.gates.find(g => g.gate === 'PROVIDER_PROFILE')?.passed).toBe(false)
    })

    it('fails PROVIDER_VERIFIED when profile not verified', async () => {
      const input = makeIndivInput({
        clientOverrides: {
          taskerProfile: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'profile-1', verificationStatus: 'PENDING', isVerified: false,
            }),
          },
        },
      })
      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(false)
      expect(result.gates.find(g => g.gate === 'PROVIDER_VERIFIED')?.passed).toBe(false)
    })

    it('fails PROFESSION_MATCH when no matching capability (legacy fallback)', async () => {
      const input = makeIndivInput({
        clientOverrides: {
          taskerProfile: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'profile-1', verificationStatus: 'VERIFIED', isVerified: true,
              taskerSkills: [], // no matching skills
            }),
          },
        },
      })
      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(false)
      expect(result.gates.find(g => g.gate === 'PROFESSION_MATCH')?.passed).toBe(false)
    })

    it('passes PROFESSION_MATCH when serviceProfessionRequirement configured', async () => {
      const input = makeIndivInput({
        clientOverrides: {
          serviceProfessionRequirement: {
            findMany: vi.fn().mockResolvedValue([
              { professionId: 'prof-1', isRequired: true, skillRequirements: [], alternativeGroupId: null },
            ]),
          },
          taskerProfession: {
            findMany: vi.fn().mockResolvedValue([{
              professionId: 'prof-1',
              status: 'APPROVED',
              profession: { id: 'prof-1', isActive: true },
              skills: [],
            }]),
          },
        },
      })
      const result = await evaluateEligibility(input)
      expect(result.gates.find(g => g.gate === 'PROFESSION_MATCH')?.passed).toBe(true)
    })
  })

  describe('evaluateEligibility — COMPANY', () => {
    it('passes all basic gates for a valid company', async () => {
      const client = mockPrisma({
        companyProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'company-1',
            userId: 'owner-1',
            verificationStatus: 'VERIFIED',
            isVerified: true,
            subscriptionStatus: 'ACTIVE',
            services: null,
            specialties: [{ categoryId: 'cat-1', jobId: null }],
            user: { countryCode: 'US' },
            rating: 4.5,
            completedProjects: 5,
          }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'owner-1', isSuspended: false, isBanned: false,
          }),
        },
        $queryRaw: vi.fn().mockResolvedValue([{ cnt: 0n }]),
      })
      const input = {
        providerType: 'COMPANY' as ProviderType,
        providerId: 'company-1',
        job: {
          jobId: 'job-1', categoryId: 'cat-1',
          jobMode: 'QUOTE' as const, urgency: 'NORMAL' as const,
          countryCode: 'US',
        },
        client,
      }
      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(true)
      expect(result.gates.every(g => g.passed)).toBe(true)
    })

    it('fails COMPANY_EXISTS when company not found', async () => {
      const client = mockPrisma({
        companyProfile: { findUnique: vi.fn().mockResolvedValue(null) },
      })
      const input = {
        providerType: 'COMPANY' as ProviderType,
        providerId: 'nonexistent',
        job: {
          jobId: 'job-1', categoryId: 'cat-1',
          jobMode: 'QUOTE' as const, urgency: 'NORMAL' as const,
          countryCode: 'US',
        },
        client,
      }
      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(false)
      expect(result.gates.find(g => g.gate === 'COMPANY_EXISTS')?.passed).toBe(false)
    })

    it('fails COMPANY_OWNER_ACTIVE when owner suspended', async () => {
      const client = mockPrisma({
        companyProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'company-1', userId: 'owner-1',
            verificationStatus: 'VERIFIED', isVerified: true,
            subscriptionStatus: 'ACTIVE',
          }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'owner-1', isSuspended: true, isBanned: false,
          }),
        },
      })
      const input = {
        providerType: 'COMPANY' as ProviderType,
        providerId: 'company-1',
        job: {
          jobId: 'job-1', categoryId: 'cat-1',
          jobMode: 'QUOTE' as const, urgency: 'NORMAL' as const,
          countryCode: 'US',
        },
        client,
      }
      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(false)
      expect(result.gates.find(g => g.gate === 'COMPANY_OWNER_ACTIVE')?.passed).toBe(false)
    })

    it('fails COMPANY_SUBSCRIPTION when subscription cancelled', async () => {
      const client = mockPrisma({
        companyProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'company-1', userId: 'owner-1',
            verificationStatus: 'VERIFIED', isVerified: true,
            subscriptionStatus: 'CANCELLED',
          }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'owner-1', isSuspended: false, isBanned: false,
          }),
        },
      })
      const input = {
        providerType: 'COMPANY' as ProviderType,
        providerId: 'company-1',
        job: {
          jobId: 'job-1', categoryId: 'cat-1',
          jobMode: 'QUOTE' as const, urgency: 'NORMAL' as const,
          countryCode: 'US',
        },
        client,
      }
      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(false)
      expect(result.gates.find(g => g.gate === 'COMPANY_SUBSCRIPTION')?.passed).toBe(false)
    })

    it('fails COMPANY_OWNER_EXISTS when no active owner', async () => {
      const client = mockPrisma({
        companyProfile: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'company-1', userId: 'owner-1',
            verificationStatus: 'VERIFIED', isVerified: true,
            subscriptionStatus: 'ACTIVE',
          }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'owner-1', isSuspended: false, isBanned: false,
          }),
        },
        teamMember: { count: vi.fn().mockResolvedValue(0) },
      })
      const input = {
        providerType: 'COMPANY' as ProviderType,
        providerId: 'company-1',
        job: {
          jobId: 'job-1', categoryId: 'cat-1',
          jobMode: 'QUOTE' as const, urgency: 'NORMAL' as const,
          countryCode: 'US',
        },
        client,
      }
      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(false)
      expect(result.gates.find(g => g.gate === 'COMPANY_OWNER_EXISTS')?.passed).toBe(false)
    })
  })

  describe('mapEligibilityToExclusionReason', () => {
    it('maps owner suspended reason correctly (specific before general)', () => {
      expect(
        mapEligibilityToExclusionReason({ gate: 'COMPANY_OWNER_ACTIVE', passed: false, reason: 'Company owner suspended' })
      ).toBe('COMPANY_OWNER_SUSPENDED')
    })

    it('maps owner banned reason correctly', () => {
      expect(
        mapEligibilityToExclusionReason({ gate: 'COMPANY_OWNER_ACTIVE', passed: false, reason: 'Company owner banned' })
      ).toBe('COMPANY_OWNER_BANNED')
    })

    it('maps no active owner reason correctly', () => {
      expect(
        mapEligibilityToExclusionReason({ gate: 'COMPANY_OWNER_EXISTS', passed: false, reason: 'No active company owner' })
      ).toBe('NO_ACTIVE_COMPANY_OWNER')
    })

    it('maps subscription cancelled reason correctly', () => {
      expect(
        mapEligibilityToExclusionReason({ gate: 'COMPANY_SUBSCRIPTION', passed: false, reason: 'Subscription cancelled' })
      ).toBe('COMPANY_SUBSCRIPTION_CANCELLED')
    })

    it('maps Identity reason correctly', () => {
      expect(
        mapEligibilityToExclusionReason({ gate: 'IDENTITY_VERIFIED', passed: false, reason: 'Identity not verified' })
      ).toBe('IDENTITY_NOT_VERIFIED')
    })

    it('maps not verified reason correctly', () => {
      expect(
        mapEligibilityToExclusionReason({ gate: 'PROVIDER_VERIFIED', passed: false, reason: 'Provider not verified' })
      ).toBe('PROVIDER_VERIFICATION_NOT_APPROVED')
    })

    it('maps suspended reason correctly (general)', () => {
      expect(
        mapEligibilityToExclusionReason({ gate: 'NOT_SUSPENDED', passed: false, reason: 'Account is suspended' })
      ).toBe('PROVIDER_SUSPENDED')
    })

    it('maps banned reason correctly (general)', () => {
      expect(
        mapEligibilityToExclusionReason({ gate: 'NOT_BANNED', passed: false, reason: 'Account is banned' })
      ).toBe('PROVIDER_BANNED')
    })

    it('maps not found reason correctly', () => {
      expect(
        mapEligibilityToExclusionReason({ gate: 'ACCOUNT_EXISTS', passed: false, reason: 'User not found' })
      ).toBe('PROVIDER_NOT_FOUND')
    })

    it('maps PROFESSION_MATCH gate to PROFESSION_MISMATCH', () => {
      expect(
        mapEligibilityToExclusionReason({ gate: 'PROFESSION_MATCH', passed: false, reason: 'No matching capability' })
      ).toBe('PROFESSION_MISMATCH')
    })

    it('defaults to CAPABILITY_MISMATCH for unmatched reason', () => {
      expect(
        mapEligibilityToExclusionReason({ gate: 'UNKNOWN', passed: false, reason: 'Something unknown' })
      ).toBe('CAPABILITY_MISMATCH')
    })

    it('maps JURISDICTION_CREDENTIAL gate to JURISDICTION_CREDENTIAL_REQUIRED', () => {
      expect(
        mapEligibilityToExclusionReason({ gate: 'JURISDICTION_CREDENTIAL', passed: false, reason: 'Missing jurisdiction credential: ELECTRICAL' })
      ).toBe('JURISDICTION_CREDENTIAL_REQUIRED')
    })

    it('maps SERVICE_AREA gate to OUTSIDE_SERVICE_AREA', () => {
      expect(
        mapEligibilityToExclusionReason({ gate: 'SERVICE_AREA', passed: false })
      ).toBe('OUTSIDE_SERVICE_AREA')
    })

    it('maps NO_CONFLICT gate to ASSIGNMENT_CONFLICT', () => {
      expect(
        mapEligibilityToExclusionReason({ gate: 'NO_CONFLICT', passed: false, reason: 'Active job conflict: 1 in-progress job(s)' })
      ).toBe('ASSIGNMENT_CONFLICT')
    })

    it('maps QUALITY_FLOOR gate to QUALITY_FLOOR', () => {
      expect(
        mapEligibilityToExclusionReason({ gate: 'QUALITY_FLOOR', passed: false })
      ).toBe('QUALITY_FLOOR')
    })
  })

  describe('evaluateEligibility — jurisdiction credential', () => {
    it('fails JURISDICTION_CREDENTIAL when credential required but not held', async () => {
      const input = makeIndivInput({
        clientOverrides: {
          serviceProfessionRequirement: {
            findMany: vi.fn().mockResolvedValue([
              { professionId: 'prof-1', isRequired: true, skillRequirements: [], alternativeGroupId: null },
            ]),
          },
          taskerProfession: {
            findMany: vi.fn().mockResolvedValue([{
              professionId: 'prof-1',
              status: 'APPROVED',
              profession: { id: 'prof-1', isActive: true },
              skills: [],
            }]),
          },
          professionJurisdictionRequirement: {
            findMany: vi.fn().mockResolvedValue([
              { countryCode: 'US', professionId: 'prof-1', credentialRequired: true, credentialType: 'ELECTRICAL', isActive: true },
            ]),
          },
          certification: {
            count: vi.fn().mockResolvedValue(0),
          },
        },
      })
      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(false)
      expect(result.gates.find(g => g.gate === 'JURISDICTION_CREDENTIAL')?.passed).toBe(false)
    })

    it('passes JURISDICTION_CREDENTIAL when credential is held', async () => {
      const input = makeIndivInput({
        clientOverrides: {
          serviceProfessionRequirement: {
            findMany: vi.fn().mockResolvedValue([
              { professionId: 'prof-1', isRequired: true, skillRequirements: [], alternativeGroupId: null },
            ]),
          },
          taskerProfession: {
            findMany: vi.fn().mockResolvedValue([{
              professionId: 'prof-1',
              status: 'APPROVED',
              profession: { id: 'prof-1', isActive: true },
              skills: [],
            }]),
          },
          professionJurisdictionRequirement: {
            findMany: vi.fn().mockResolvedValue([
              { countryCode: 'US', professionId: 'prof-1', credentialRequired: true, credentialType: 'ELECTRICAL', isActive: true },
            ]),
          },
          certification: {
            count: vi.fn().mockResolvedValue(1),
          },
        },
      })
      const result = await evaluateEligibility(input)
      expect(result.gates.find(g => g.gate === 'JURISDICTION_CREDENTIAL')?.passed).toBe(true)
    })

    it('skips JURISDICTION_CREDENTIAL when no jurisdiction requirements', async () => {
      const input = makeIndivInput()
      const result = await evaluateEligibility(input)
      const jurisdictionGate = result.gates.find(g => g.gate === 'JURISDICTION_CREDENTIAL')
      // When no profession matched, jurisdiction gate is not evaluated at all
      expect(jurisdictionGate).toBeUndefined()
    })
  })

  describe('evaluateEligibility — service area', () => {
    it('fails SERVICE_AREA when country does not match', async () => {
      const input = makeIndivInput({
        clientOverrides: {
          user: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'user-1', isSuspended: false, isBanned: false,
              identityStatus: 'VERIFIED', isActive: true, countryCode: 'CA',
            }),
          },
        },
      })
      input.job.countryCode = 'US'
      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(false)
      expect(result.gates.find(g => g.gate === 'SERVICE_AREA')?.passed).toBe(false)
      expect(result.serviceAreaPassed).toBe(false)
    })
  })

  describe('evaluateEligibility — local service area', () => {
    it('rejects a provider whose configured service area does not include the job area', async () => {
      const profile = {
        id: 'profile-1',
        userId: 'tasker-1',
        verificationStatus: 'VERIFIED',
        isVerified: true,
        skills: null,
        taskerSkills: [{ job: { categoryId: 'cat-1' } }],
        rating: 4.5,
        completedJobs: 5,
        countryCode: 'LK',
        serviceAreas: JSON.stringify(['Colombo']),
        latitude: null,
        longitude: null,
        serviceRadius: null,
      }
      const input = makeIndivInput({
        clientOverrides: {
          user: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'tasker-1',
              isSuspended: false,
              isBanned: false,
              identityStatus: 'VERIFIED',
              isActive: true,
              countryCode: 'LK',
            }),
          },
          taskerProfile: { findUnique: vi.fn().mockResolvedValue(profile) },
          marketplaceJob: {
            count: vi.fn().mockResolvedValue(0),
            findUnique: vi.fn().mockImplementation(({ select }: any) => {
              if (select?.areaId) return Promise.resolve({ areaId: 'lk-jaffna-town', latitude: null, longitude: null })
              return Promise.resolve({ preferredDate: null, preferredTimeSlot: null })
            }),
          },
        },
      })
      input.job.countryCode = 'LK'

      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(false)
      expect(result.gates.find(g => g.gate === 'SERVICE_AREA')?.passed).toBe(false)
    })

    it('accepts a provider whose configured district matches the job location name', async () => {
      const profile = {
        id: 'profile-1',
        userId: 'tasker-1',
        verificationStatus: 'VERIFIED',
        isVerified: true,
        skills: null,
        taskerSkills: [{ job: { categoryId: 'cat-1' } }],
        rating: 4.5,
        completedJobs: 5,
        countryCode: 'LK',
        serviceAreas: JSON.stringify(['Jaffna']),
        latitude: null,
        longitude: null,
        serviceRadius: null,
      }
      const input = makeIndivInput({
        clientOverrides: {
          user: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'tasker-1',
              isSuspended: false,
              isBanned: false,
              identityStatus: 'VERIFIED',
              isActive: true,
              countryCode: 'LK',
            }),
          },
          taskerProfile: { findUnique: vi.fn().mockResolvedValue(profile) },
          marketplaceJob: {
            count: vi.fn().mockResolvedValue(0),
            findUnique: vi.fn().mockImplementation(({ select }: any) => {
              if (select?.areaId) return Promise.resolve({ areaId: 'lk-jaffna-town', latitude: null, longitude: null })
              return Promise.resolve({ preferredDate: null, preferredTimeSlot: null })
            }),
          },
        },
      })
      input.job.countryCode = 'LK'

      const result = await evaluateEligibility(input)
      expect(result.gates.find(g => g.gate === 'SERVICE_AREA')?.passed).toBe(true)
    })

    it('rejects a job outside the configured service radius', async () => {
      const profile = {
        id: 'profile-1',
        userId: 'tasker-1',
        verificationStatus: 'VERIFIED',
        isVerified: true,
        skills: null,
        taskerSkills: [{ job: { categoryId: 'cat-1' } }],
        rating: 4.5,
        completedJobs: 5,
        countryCode: 'LK',
        serviceAreas: null,
        latitude: 9.6615,
        longitude: 80.0255,
        serviceRadius: 5,
      }
      const input = makeIndivInput({
        clientOverrides: {
          user: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'tasker-1',
              isSuspended: false,
              isBanned: false,
              identityStatus: 'VERIFIED',
              isActive: true,
              countryCode: 'LK',
            }),
          },
          taskerProfile: { findUnique: vi.fn().mockResolvedValue(profile) },
          marketplaceJob: {
            count: vi.fn().mockResolvedValue(0),
            findUnique: vi.fn().mockImplementation(({ select }: any) => {
              if (select?.areaId) return Promise.resolve({ areaId: 'lk-colombo-wellawatte', latitude: 6.8741, longitude: 79.8608 })
              return Promise.resolve({ preferredDate: null, preferredTimeSlot: null })
            }),
          },
        },
      })
      input.job.countryCode = 'LK'

      const result = await evaluateEligibility(input)
      expect(result.gates.find(g => g.gate === 'SERVICE_AREA')?.passed).toBe(false)
    })
  })

  describe('evaluateEligibility — conflict', () => {
    it('fails NO_CONFLICT for an unscheduled request when provider has an active job', async () => {
      const input = makeIndivInput({
        clientOverrides: {
          $queryRaw: vi.fn().mockResolvedValue([
            { id: 'active-1', status: 'IN_PROGRESS', preferredDate: null, preferredTimeSlot: null },
          ]),
        },
      })
      const result = await evaluateEligibility(input)
      expect(result.eligible).toBe(false)
      expect(result.gates.find(g => g.gate === 'NO_CONFLICT')?.passed).toBe(false)
    })

    it('allows a future-day booking while an unscheduled job is currently in progress', async () => {
      const tomorrow = new Date()
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

      const input = makeIndivInput({
        clientOverrides: {
          marketplaceJob: {
            findUnique: vi.fn().mockResolvedValue({ preferredDate: tomorrow, preferredTimeSlot: 'afternoon' }),
          },
          $queryRaw: vi.fn().mockResolvedValue([
            { id: 'active-1', status: 'IN_PROGRESS', preferredDate: null, preferredTimeSlot: null },
          ]),
        },
      })
      const result = await evaluateEligibility(input)
      expect(result.gates.find(g => g.gate === 'NO_CONFLICT')?.passed).toBe(true)
    })

    it('blocks the same day and same time slot', async () => {
      const day = new Date('2026-10-05T00:00:00.000Z')
      const input = makeIndivInput({
        clientOverrides: {
          marketplaceJob: {
            findUnique: vi.fn().mockResolvedValue({ preferredDate: day, preferredTimeSlot: 'morning' }),
          },
          $queryRaw: vi.fn().mockResolvedValue([
            { id: 'active-1', status: 'QUOTE_ACCEPTED', preferredDate: day, preferredTimeSlot: 'morning' },
          ]),
        },
      })
      const result = await evaluateEligibility(input)
      expect(result.gates.find(g => g.gate === 'NO_CONFLICT')?.passed).toBe(false)
    })

    it('allows different dayparts on the same date', async () => {
      const day = new Date('2026-10-05T00:00:00.000Z')
      const input = makeIndivInput({
        clientOverrides: {
          marketplaceJob: {
            findUnique: vi.fn().mockResolvedValue({ preferredDate: day, preferredTimeSlot: 'evening' }),
          },
          $queryRaw: vi.fn().mockResolvedValue([
            { id: 'active-1', status: 'QUOTE_ACCEPTED', preferredDate: day, preferredTimeSlot: 'morning' },
          ]),
        },
      })
      const result = await evaluateEligibility(input)
      expect(result.gates.find(g => g.gate === 'NO_CONFLICT')?.passed).toBe(true)
    })
  })

  describe('evaluateEligibility — quality floor', () => {
    it('fails QUALITY_FLOOR when rating below threshold', async () => {
      const input = makeIndivInput({
        clientOverrides: {
          taskerProfile: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'profile-1', userId: 'tasker-1',
              verificationStatus: 'VERIFIED', isVerified: true,
              taskerSkills: [{ job: { categoryId: 'cat-1' } }],
              rating: 2.0, completedJobs: 10,
            }),
          },
        },
      })
      const result = await evaluateEligibility(input)
      expect(result.gates.find(g => g.gate === 'QUALITY_FLOOR')?.passed).toBe(false)
    })

    it('passes QUALITY_FLOOR for new providers with 0 completed jobs', async () => {
      const input = makeIndivInput({
        clientOverrides: {
          taskerProfile: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'profile-1', userId: 'tasker-1',
              verificationStatus: 'VERIFIED', isVerified: true,
              taskerSkills: [{ job: { categoryId: 'cat-1' } }],
              rating: 0, completedJobs: 0,
            }),
          },
        },
      })
      const result = await evaluateEligibility(input)
      expect(result.gates.find(g => g.gate === 'QUALITY_FLOOR')?.passed).toBe(true)
    })
  })
})
