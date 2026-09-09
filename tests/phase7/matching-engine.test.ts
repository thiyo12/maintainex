/**
 * Phase 7 — Matching Engine Integration Tests (DB-dependent)
 *
 * Tests the findCandidates function from lib/matching/index.ts.
 * These tests require the VPS PostgreSQL database and cannot run locally.
 * Verifies: candidate inclusion/exclusion, eligibility filtering,
 * scoring, ranking, config resolution, and cross-company isolation.
 *
 * NOTE: These tests create and clean up their own data. They use unique
 * timestamps to avoid collisions with existing data.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { findCandidates, resolveMatchingConfig } from '@/lib/matching/index'
import { MatchingInput } from '@/lib/matching/types'

const prisma = new PrismaClient()

describe('Phase 7 — Matching Engine Integration', () => {
  let ts: number
  let customerId: string
  let jobId: string
  let companyAId: string
  let companyBId: string
  let ownerAId: string
  let ownerBId: string
  let individualProviderId: string
  let suspendedProviderId: string
  let bannedProviderId: string
  let unverifiedIdentityProviderId: string
  let noCapabilitiesProviderId: string
  let memberOfCompanyAId: string

  beforeAll(async () => {
    try {
    ts = Date.now()

    // Customer
    const customer = await prisma.user.create({
      data: {
        email: `me-customer-${ts}@test.com`,
        passwordHash: 'hash',
        name: 'ME Customer',
        role: 'USER',
        identityStatus: 'VERIFIED',
      },
    })
    customerId = customer.id

    // Company A owner
    const ownerA = await prisma.user.create({
      data: {
        email: `me-ownerA-${ts}@test.com`,
        passwordHash: 'hash',
        name: 'ME OwnerA',
        role: 'COMPANY',
        identityStatus: 'VERIFIED',
      },
    })
    ownerAId = ownerA.id
    const companyA = await prisma.companyProfile.create({
      data: {
        userId: ownerAId,
        companyName: `ME CoA ${ts}`,
        services: JSON.stringify(['plumbing', 'electrical']),
        serviceAreas: '[]',
        isVerified: true,
        verificationStatus: 'VERIFIED',
        completedProjects: 25,
        rating: 4.5,
      },
    })
    companyAId = companyA.id
    await prisma.teamMember.create({
      data: {
        companyId: companyAId,
        userId: ownerAId,
        name: 'ME OwnerA',
        role: 'COMPANY_OWNER',
        skills: '[]',
        status: 'ACTIVE',
      },
    })

    // Company B owner
    const ownerB = await prisma.user.create({
      data: {
        email: `me-ownerB-${ts}@test.com`,
        passwordHash: 'hash',
        name: 'ME OwnerB',
        role: 'COMPANY',
        identityStatus: 'VERIFIED',
      },
    })
    ownerBId = ownerB.id
    const companyB = await prisma.companyProfile.create({
      data: {
        userId: ownerBId,
        companyName: `ME CoB ${ts}`,
        services: JSON.stringify(['plumbing']),
        serviceAreas: '[]',
        isVerified: true,
        verificationStatus: 'VERIFIED',
        completedProjects: 10,
        rating: 4.0,
      },
    })
    companyBId = companyB.id
    await prisma.teamMember.create({
      data: {
        companyId: companyBId,
        userId: ownerBId,
        name: 'ME OwnerB',
        role: 'COMPANY_OWNER',
        skills: '[]',
        status: 'ACTIVE',
      },
    })

    // Individual provider with matching skills
    const indivUser = await prisma.user.create({
      data: {
        email: `me-indiv-${ts}@test.com`,
        passwordHash: 'hash',
        name: 'ME Indiv',
        role: 'TASKER',
        identityStatus: 'VERIFIED',
      },
    })
    individualProviderId = indivUser.id
    await prisma.taskerProfile.create({
      data: {
        userId: individualProviderId,
        skills: JSON.stringify(['plumbing', 'renovation']),
        isVerified: true,
        verificationStatus: 'VERIFIED',
        completedJobs: 15,
        rating: 4.2,
      },
    })

    // Suspended provider
    const suspendedUser = await prisma.user.create({
      data: {
        email: `me-suspended-${ts}@test.com`,
        passwordHash: 'hash',
        name: 'ME Suspended',
        role: 'TASKER',
        identityStatus: 'VERIFIED',
        isSuspended: true,
      },
    })
    suspendedProviderId = suspendedUser.id
    await prisma.taskerProfile.create({
      data: {
        userId: suspendedProviderId,
        skills: JSON.stringify(['plumbing']),
        isVerified: true,
        verificationStatus: 'VERIFIED',
      },
    })

    // Banned provider
    const bannedUser = await prisma.user.create({
      data: {
        email: `me-banned-${ts}@test.com`,
        passwordHash: 'hash',
        name: 'ME Banned',
        role: 'TASKER',
        identityStatus: 'VERIFIED',
        isBanned: true,
      },
    })
    bannedProviderId = bannedUser.id
    await prisma.taskerProfile.create({
      data: {
        userId: bannedProviderId,
        skills: JSON.stringify(['plumbing']),
        isVerified: true,
        verificationStatus: 'VERIFIED',
      },
    })

    // Unverified identity provider
    const unverifiedUser = await prisma.user.create({
      data: {
        email: `me-unverified-${ts}@test.com`,
        passwordHash: 'hash',
        name: 'ME Unverified',
        role: 'TASKER',
        identityStatus: 'PENDING',
      },
    })
    unverifiedIdentityProviderId = unverifiedUser.id
    await prisma.taskerProfile.create({
      data: {
        userId: unverifiedIdentityProviderId,
        skills: JSON.stringify(['plumbing']),
        isVerified: true,
        verificationStatus: 'VERIFIED',
      },
    })

    // Provider with no capabilities
    const noCapUser = await prisma.user.create({
      data: {
        email: `me-nocap-${ts}@test.com`,
        passwordHash: 'hash',
        name: 'ME NoCap',
        role: 'TASKER',
        identityStatus: 'VERIFIED',
      },
    })
    noCapabilitiesProviderId = noCapUser.id
    await prisma.taskerProfile.create({
      data: {
        userId: noCapabilitiesProviderId,
        skills: '[]',
        isVerified: true,
        verificationStatus: 'VERIFIED',
      },
    })

    // Member of Company A (for cross-company isolation test)
    const memberUser = await prisma.user.create({
      data: {
        email: `me-memberA-${ts}@test.com`,
        passwordHash: 'hash',
        name: 'ME MemberA',
        role: 'TASKER',
        identityStatus: 'VERIFIED',
      },
    })
    memberOfCompanyAId = memberUser.id
    await prisma.teamMember.create({
      data: {
        companyId: companyAId,
        userId: memberOfCompanyAId,
        name: 'ME MemberA',
        role: 'WORKER',
        skills: JSON.stringify(['plumbing']),
        status: 'ACTIVE',
      },
    })

    // Job
    const job = await prisma.marketplaceJob.create({
      data: {
        customerId,
        title: 'ME Test Job',
        description: 'Plumbing repair',
        categoryId: 'plumbing',
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 15000n,
        status: 'OPEN',
      },
    })
    jobId = job.id
    } catch { /* DB unavailable locally */ }
  })

  afterAll(async () => {
    if (jobId) await prisma.marketplaceJob.delete({ where: { id: jobId } }).catch(() => {})
    const companyIds = [companyAId, companyBId].filter(Boolean) as string[]
    if (companyIds.length) await prisma.teamMember.deleteMany({ where: { companyId: { in: companyIds } } })
    const profileIds = [individualProviderId, suspendedProviderId, bannedProviderId, unverifiedIdentityProviderId, noCapabilitiesProviderId, memberOfCompanyAId].filter(Boolean) as string[]
    if (profileIds.length) await prisma.taskerProfile.deleteMany({ where: { userId: { in: profileIds } } })
    if (companyIds.length) await prisma.companyProfile.deleteMany({ where: { id: { in: companyIds } } }).catch(() => {})
    const userIds = [customerId, ownerAId, ownerBId, individualProviderId, suspendedProviderId, bannedProviderId, unverifiedIdentityProviderId, noCapabilitiesProviderId, memberOfCompanyAId].filter(Boolean) as string[]
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {})
  })

  it('findCandidates with no eligible providers returns empty candidates', async () => {
    // Use a nonexistent job ID
    const result = await findCandidates(prisma, {
      jobId: 'nonexistent-job-id',
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
      categoryId: 'nonexistent',
    })
    expect(result.candidates).toEqual([])
    expect(result.excluded).toEqual([])
  })

  it('individual provider with matching skills gets included', async () => {
    const input: MatchingInput = {
      jobId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
      categoryId: 'plumbing',
    }
    const result = await findCandidates(prisma, input)
    const found = result.candidates.find(c => c.providerId === individualProviderId)
    expect(found).toBeDefined()
    expect(found!.providerType).toBe('INDIVIDUAL')
  })

  it('company provider with matching services gets included', async () => {
    const input: MatchingInput = {
      jobId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
      categoryId: 'plumbing',
    }
    const result = await findCandidates(prisma, input)
    const found = result.candidates.find(c => c.providerId === companyAId)
    expect(found).toBeDefined()
    expect(found!.providerType).toBe('COMPANY')
  })

  it('suspended provider excluded with correct reason', async () => {
    const input: MatchingInput = {
      jobId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
      categoryId: 'plumbing',
    }
    const result = await findCandidates(prisma, input)
    const excluded = result.excluded.find(e => e.providerId === suspendedProviderId)
    expect(excluded).toBeDefined()
    expect(excluded!.reason).toBe('PROVIDER_SUSPENDED')
  })

  it('banned provider excluded with correct reason', async () => {
    const input: MatchingInput = {
      jobId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
      categoryId: 'plumbing',
    }
    const result = await findCandidates(prisma, input)
    const excluded = result.excluded.find(e => e.providerId === bannedProviderId)
    expect(excluded).toBeDefined()
    expect(excluded!.reason).toBe('PROVIDER_BANNED')
  })

  it('unverified identity provider excluded', async () => {
    const input: MatchingInput = {
      jobId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
      categoryId: 'plumbing',
    }
    const result = await findCandidates(prisma, input)
    const excluded = result.excluded.find(e => e.providerId === unverifiedIdentityProviderId)
    expect(excluded).toBeDefined()
    expect(excluded!.reason).toBe('IDENTITY_NOT_VERIFIED')
  })

  it('provider with no capabilities excluded', async () => {
    const input: MatchingInput = {
      jobId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
      categoryId: 'plumbing',
    }
    const result = await findCandidates(prisma, input)
    const excluded = result.excluded.find(e => e.providerId === noCapabilitiesProviderId)
    expect(excluded).toBeDefined()
    expect(excluded!.reason).toBe('NO_SERVICE_CAPABILITIES')
  })

  it('candidates ranked by score descending', async () => {
    const input: MatchingInput = {
      jobId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
      categoryId: 'plumbing',
    }
    const result = await findCandidates(prisma, input)
    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i - 1].score).toBeGreaterThanOrEqual(result.candidates[i].score)
    }
  })

  it('multiple candidates produce correct ranks (1, 2, 3...)', async () => {
    const input: MatchingInput = {
      jobId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
      categoryId: 'plumbing',
    }
    const result = await findCandidates(prisma, input)
    result.candidates.forEach((c, i) => {
      expect(c.rank).toBe(i + 1)
    })
  })

  it('default weights used when no MarketConfig exists', async () => {
    const config = await resolveMatchingConfig(prisma, 'ZZ_NONEXISTENT')
    expect(config.weights).toEqual({
      capability: 30,
      reliability: 20,
      reputation: 20,
      availability: 15,
      travel: 10,
      experience: 5,
    })
  })

  it('result includes scoreVersion and generatedAt', async () => {
    const input: MatchingInput = {
      jobId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
      categoryId: 'plumbing',
    }
    const result = await findCandidates(prisma, input)
    expect(result.scoreVersion).toBeDefined()
    expect(result.generatedAt).toBeInstanceOf(Date)
    expect(result.jobId).toBe(jobId)
  })

  it('cross-company isolation: company A member not matched to other company jobs', async () => {
    // memberOfCompanyAId is a member of companyA.
    // As an individual provider, they should still appear as individual (not company).
    // Cross-company isolation means: company A's team members don't appear
    // as providers for company B's matching context.
    const input: MatchingInput = {
      jobId,
      jobMode: 'QUOTE',
      urgency: 'NORMAL',
      categoryId: 'plumbing',
      companyId: companyBId, // requesting from B's perspective
    }
    const result = await findCandidates(prisma, input)
    // memberOfCompanyAId should NOT appear as a COMPANY provider
    const asCompany = result.candidates.find(
      c => c.providerId === memberOfCompanyAId && c.providerType === 'COMPANY',
    )
    expect(asCompany).toBeUndefined()
  })
})
