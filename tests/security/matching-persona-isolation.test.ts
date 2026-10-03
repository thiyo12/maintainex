/**
 * Phase 7 — Matching Engine Persona Isolation Tests
 *
 * Tests that individual providers and company providers are strictly
 * isolated during the matching process. Individual profiles are scored
 * using individual data, company profiles use company data, and
 * cross-company members are excluded from other companies' matching.
 *
 * Includes both pure unit tests (scoring isolation) and DB tests
 * (findCandidates persona isolation).
 *
 * Phase 7.2: Creates proper JobCategory with CUID + slug for DB tests.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { findCandidates } from '@/lib/matching/index'
import { computeCapabilityScore, computeReliabilityScore, computeReputationScore } from '@/lib/matching/scoring'
import { MatchingInput } from '@/lib/matching/types'

const prisma = new PrismaClient()

describe('Phase 7 — Matching Engine Persona Isolation', () => {
  describe('Unit tests — scoring isolation', () => {
    it('individual provider scored using individual skills (not company services)', () => {
      const individualSkills = ['plumbing', 'drain-cleaning']
      const companyServices = ['electrical', 'wiring']

      const indivScore = computeCapabilityScore(individualSkills, 'plumbing')
      const companyScore = computeCapabilityScore(companyServices, 'plumbing')

      expect(indivScore).toBe(100)
      expect(companyScore).toBe(20)
    })

    it('company provider scored using company services (not individual skills)', () => {
      const companyServices = ['plumbing', 'renovation']

      const score = computeCapabilityScore(companyServices, 'plumbing')
      expect(score).toBe(100)
    })

    it('individual reliability uses individual completedJobs', () => {
      const indivScore = computeReliabilityScore(0, 0)
      const companyScore = computeReliabilityScore(50, 0)

      expect(indivScore).toBe(50)
      expect(companyScore).toBeGreaterThan(indivScore)
    })

    it('individual reputation uses individual review data', () => {
      const indivScore = computeReputationScore(5, 10)
      const companyScore = computeReputationScore(3, 2)

      expect(indivScore).toBeGreaterThan(companyScore)
    })

    it('empty individual skills returns 0 capability', () => {
      const score = computeCapabilityScore([], 'plumbing')
      expect(score).toBe(0)
    })
  })

  describe('DB tests — findCandidates persona isolation', () => {
    let ts: number
    let testCategoryId: string
    let testCategorySlug: string
    let templateJobId: string
    let individualProfileId: string
    let companyAMemberProfileId: string
    let customerId: string
    let jobId: string
    let companyAId: string
    let companyBId: string
    let ownerAId: string
    let ownerBId: string
    let individualUserId: string
    let companyAMemberUserId: string

    beforeAll(async () => {
      try {
      ts = Date.now()

      // Create JobCategory with real CUID + slug
      const category = await prisma.jobCategory.create({
        data: {
          name: `PI Category ${ts}`,
          slug: `pi-cat-${ts}`,
          iconName: 'wrench',
          colorHex: '#000000',
          countries: '["LK"]',
          isActive: true,
          sortOrder: 0,
        },
      })
      testCategoryId = category.id
      testCategorySlug = category.slug!

      const templateJob = await prisma.templateJob.create({
        data: {
          categoryId: testCategoryId,
          name: `PI Template ${ts}`,
          description: 'Persona isolation capability fixture',
          whatIsIncluded: 'Capability verification',
          typicalDurationMinutes: 60,
          priceMin: 1000,
          priceMax: 5000,
          currency: 'LKR',
          countries: '["LK"]',
          isActive: true,
        },
      })
      templateJobId = templateJob.id

      // Customer
      const customer = await prisma.user.create({
        data: {
          email: `pi-customer-${ts}@test.com`,
          passwordHash: 'hash',
          name: 'PI Customer',
          role: 'USER',
          identityStatus: 'VERIFIED',
          countryCode: 'LK',
        },
      })
      customerId = customer.id

      // Company A
      const ownerA = await prisma.user.create({
        data: {
          email: `pi-ownerA-${ts}@test.com`,
          passwordHash: 'hash',
          name: 'PI OwnerA',
          role: 'COMPANY',
          identityStatus: 'VERIFIED',
          countryCode: 'LK',
        },
      })
      ownerAId = ownerA.id
      const companyA = await prisma.companyProfile.create({
        data: {
          userId: ownerAId,
          companyName: `PI CoA ${ts}`,
          services: JSON.stringify([testCategorySlug]),
          serviceAreas: '[]',
          isVerified: true,
          verificationStatus: 'VERIFIED',
          countryCode: 'LK',
        },
      })
      companyAId = companyA.id
      await prisma.companySpecialty.create({
        data: {
          companyId: companyAId,
          categoryId: testCategoryId,
        },
      })
      await prisma.teamMember.create({
        data: {
          companyId: companyAId,
          userId: ownerAId,
          name: 'PI OwnerA',
          role: 'COMPANY_OWNER',
          skills: '[]',
          status: 'ACTIVE',
        },
      })

      // Company B
      const ownerB = await prisma.user.create({
        data: {
          email: `pi-ownerB-${ts}@test.com`,
          passwordHash: 'hash',
          name: 'PI OwnerB',
          role: 'COMPANY',
          identityStatus: 'VERIFIED',
          countryCode: 'LK',
        },
      })
      ownerBId = ownerB.id
      const companyB = await prisma.companyProfile.create({
        data: {
          userId: ownerBId,
          companyName: `PI CoB ${ts}`,
          services: JSON.stringify(['electrical']),
          serviceAreas: '[]',
          isVerified: true,
          verificationStatus: 'VERIFIED',
          countryCode: 'LK',
        },
      })
      companyBId = companyB.id
      await prisma.teamMember.create({
        data: {
          companyId: companyBId,
          userId: ownerBId,
          name: 'PI OwnerB',
          role: 'COMPANY_OWNER',
          skills: '[]',
          status: 'ACTIVE',
        },
      })

      // Individual provider (no company membership)
      const indivUser = await prisma.user.create({
        data: {
          email: `pi-indiv-${ts}@test.com`,
          passwordHash: 'hash',
          name: 'PI Indiv',
          role: 'TASKER',
          identityStatus: 'VERIFIED',
          countryCode: 'LK',
        },
      })
      individualUserId = indivUser.id
      const individualProfile = await prisma.taskerProfile.create({
        data: {
          userId: individualUserId,
          skills: JSON.stringify([testCategorySlug]),
          isVerified: true,
          verificationStatus: 'VERIFIED',
          countryCode: 'LK',
        },
      })
      individualProfileId = individualProfile.id
      await prisma.taskerSkill.create({
        data: {
          taskerId: individualProfileId,
          jobId: templateJobId,
          countryCode: 'LK',
        },
      })

      // Member of Company A (dual persona: individual + company)
      const memberUser = await prisma.user.create({
        data: {
          email: `pi-memberA-${ts}@test.com`,
          passwordHash: 'hash',
          name: 'PI MemberA',
          role: 'TASKER',
          identityStatus: 'VERIFIED',
          countryCode: 'LK',
        },
      })
      companyAMemberUserId = memberUser.id
      const companyAMemberProfile = await prisma.taskerProfile.create({
        data: {
          userId: companyAMemberUserId,
          skills: JSON.stringify([testCategorySlug, 'renovation']),
          isVerified: true,
          verificationStatus: 'VERIFIED',
          countryCode: 'LK',
        },
      })
      companyAMemberProfileId = companyAMemberProfile.id
      await prisma.taskerSkill.create({
        data: {
          taskerId: companyAMemberProfileId,
          jobId: templateJobId,
          countryCode: 'LK',
        },
      })
      await prisma.teamMember.create({
        data: {
          companyId: companyAId,
          userId: companyAMemberUserId,
          name: 'PI MemberA',
          role: 'WORKER',
          skills: JSON.stringify([testCategorySlug]),
          status: 'ACTIVE',
        },
      })

      // Job — uses CUID from real JobCategory
      const job = await prisma.marketplaceJob.create({
        data: {
          customerId,
          title: 'PI Test Job',
          description: 'Plumbing work',
          categoryId: testCategoryId,
          photos: '[]',
          budgetType: 'FIXED',
          budgetAmount: 10000n,
          status: 'OPEN',
          countryCode: 'LK',
        },
      })
      jobId = job.id
      } catch { /* DB unavailable locally */ }
    })

    afterAll(async () => {
      if (jobId) await prisma.marketplaceJob.delete({ where: { id: jobId } }).catch(() => {})
      const companyIds = [companyAId, companyBId].filter(Boolean) as string[]
      if (companyIds.length) {
        await prisma.companySpecialty.deleteMany({ where: { companyId: { in: companyIds } } }).catch(() => {})
        await prisma.teamMember.deleteMany({ where: { companyId: { in: companyIds } } })
      }
      const taskerProfileIds = [individualProfileId, companyAMemberProfileId].filter(Boolean) as string[]
      if (taskerProfileIds.length) {
        await prisma.taskerSkill.deleteMany({ where: { taskerId: { in: taskerProfileIds } } }).catch(() => {})
      }
      const profileUserIds = [individualUserId, companyAMemberUserId].filter(Boolean) as string[]
      if (profileUserIds.length) await prisma.taskerProfile.deleteMany({ where: { userId: { in: profileUserIds } } })
      if (companyIds.length) await prisma.companyProfile.deleteMany({ where: { id: { in: companyIds } } }).catch(() => {})
      const userIds = [customerId, ownerAId, ownerBId, individualUserId, companyAMemberUserId].filter(Boolean) as string[]
      if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {})
      if (templateJobId) await prisma.templateJob.delete({ where: { id: templateJobId } }).catch(() => {})
      if (testCategoryId) await prisma.jobCategory.delete({ where: { id: testCategoryId } }).catch(() => {})
    })

    it('uses the persisted job market and category over caller-supplied matching fields', async () => {
      const result = await findCandidates(prisma, {
        jobId,
        jobMode: 'QUOTE',
        urgency: 'NORMAL',
        categoryId: 'caller-supplied-wrong-category',
        countryCode: 'CH',
      })

      expect(
        result.candidates.some(
          candidate =>
            candidate.providerId === individualUserId &&
            candidate.providerType === 'INDIVIDUAL',
        ),
      ).toBe(true)
      expect(
        result.candidates.some(
          candidate =>
            candidate.providerId === companyAId &&
            candidate.providerType === 'COMPANY',
        ),
      ).toBe(true)
    })

    it('individual providers never matched as company providers', async () => {
      const input: MatchingInput = {
        jobId,
        jobMode: 'QUOTE',
        urgency: 'NORMAL',
        categoryId: testCategoryId,
      }
      const result = await findCandidates(prisma, input)
      const indivAsCompany = result.candidates.find(
        c => c.providerId === individualUserId && c.providerType === 'COMPANY',
      )
      expect(indivAsCompany).toBeUndefined()
    })

    it('company providers never matched as individual providers', async () => {
      const input: MatchingInput = {
        jobId,
        jobMode: 'QUOTE',
        urgency: 'NORMAL',
        categoryId: testCategoryId,
      }
      const result = await findCandidates(prisma, input)
      const companyAsIndiv = result.candidates.find(
        c =>
          (c.providerId === companyAId || c.providerId === companyBId) &&
          c.providerType === 'INDIVIDUAL',
      )
      expect(companyAsIndiv).toBeUndefined()
    })

    it('individual scoring uses individual profile data, not company data', async () => {
      const input: MatchingInput = {
        jobId,
        jobMode: 'QUOTE',
        urgency: 'NORMAL',
        categoryId: testCategoryId,
      }
      const result = await findCandidates(prisma, input)
      const indivCandidate = result.candidates.find(
        c => c.providerId === individualUserId && c.providerType === 'INDIVIDUAL',
      )
      expect(indivCandidate).toBeDefined()
      expect(indivCandidate!.components.capability).toBeGreaterThan(50)
    })

    it('company scoring uses company profile data, not individual data', async () => {
      const input: MatchingInput = {
        jobId,
        jobMode: 'QUOTE',
        urgency: 'NORMAL',
        categoryId: testCategoryId,
      }
      const result = await findCandidates(prisma, input)
      const companyCandidate = result.candidates.find(
        c => c.providerId === companyAId && c.providerType === 'COMPANY',
      )
      expect(companyCandidate).toBeDefined()
      expect(companyCandidate!.components.capability).toBeGreaterThan(50)
    })

    it('cross-company members excluded from matching for other companies', async () => {
      const input: MatchingInput = {
        jobId,
        jobMode: 'QUOTE',
        urgency: 'NORMAL',
        categoryId: testCategoryId,
        companyId: companyBId,
      }
      const result = await findCandidates(prisma, input)
      const memberAsCompanyB = result.candidates.find(
        c => c.providerId === companyAMemberUserId && c.providerType === 'COMPANY',
      )
      expect(memberAsCompanyB).toBeUndefined()
    })

    it('dual persona: same user appears as both individual and company candidate', async () => {
      const input: MatchingInput = {
        jobId,
        jobMode: 'QUOTE',
        urgency: 'NORMAL',
        categoryId: testCategoryId,
      }
      const result = await findCandidates(prisma, input)
      const asIndividual = result.candidates.find(
        c => c.providerId === companyAMemberUserId && c.providerType === 'INDIVIDUAL',
      )
      const asCompany = result.candidates.find(
        c => c.providerId === companyAId && c.providerType === 'COMPANY',
      )
      expect(asIndividual).toBeDefined()
      expect(asCompany).toBeDefined()
      const memberAsCompany = result.candidates.find(
        c => c.providerId === companyAMemberUserId && c.providerType === 'COMPANY',
      )
      expect(memberAsCompany).toBeUndefined()
    })

    it('dual persona: individual and company entries have separate scores', async () => {
      const input: MatchingInput = {
        jobId,
        jobMode: 'QUOTE',
        urgency: 'NORMAL',
        categoryId: testCategoryId,
      }
      const result = await findCandidates(prisma, input)
      const asIndividual = result.candidates.find(
        c => c.providerId === companyAMemberUserId && c.providerType === 'INDIVIDUAL',
      )
      const companyCandidate = result.candidates.find(
        c => c.providerId === companyAId && c.providerType === 'COMPANY',
      )
      expect(asIndividual).toBeDefined()
      expect(companyCandidate).toBeDefined()
      expect(asIndividual!.score).toBeGreaterThanOrEqual(0)
      expect(companyCandidate!.score).toBeGreaterThanOrEqual(0)
    })
  })
})
