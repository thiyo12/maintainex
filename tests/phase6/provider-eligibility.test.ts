import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  checkIndividualProviderEligibility,
  checkCompanyEligibility,
  checkWorkerEligibility,
} from '@/lib/phase6/provider-eligibility'
import { requiresPostgres } from '../helpers/test-guard'

const prisma = new PrismaClient()

describe.skipIf(!requiresPostgres())('Phase 6 — Provider Eligibility', () => {
  let verifiedUserId: string
  let unverifiedUserId: string
  let suspendedUserId: string
  let companyId: string
  let verifiedCompanyId: string
  let unverifiedCompanyId: string

  beforeAll(async () => {
    const ts = Date.now()
    const verifiedUser = await prisma.user.create({
      data: { email: `elig-verified-${ts}@test.com`, passwordHash: 'hash', name: 'Verified', role: 'TASKER', identityStatus: 'VERIFIED' },
    })
    verifiedUserId = verifiedUser.id

    const unverifiedUser = await prisma.user.create({
      data: { email: `elig-unverified-${ts}@test.com`, passwordHash: 'hash', name: 'Unverified', role: 'TASKER', identityStatus: 'NOT_SUBMITTED' },
    })
    unverifiedUserId = unverifiedUser.id

    const suspendedUser = await prisma.user.create({
      data: { email: `elig-suspended-${ts}@test.com`, passwordHash: 'hash', name: 'Suspended', role: 'TASKER', identityStatus: 'VERIFIED', isSuspended: true },
    })
    suspendedUserId = suspendedUser.id

    await prisma.taskerProfile.create({
      data: { userId: verifiedUserId, verificationStatus: 'VERIFIED', isVerified: true, skills: '["plumbing"]' },
    })
    await prisma.taskerProfile.create({
      data: { userId: unverifiedUserId, verificationStatus: 'PENDING', skills: '["electrical"]' },
    })
    await prisma.taskerProfile.create({
      data: { userId: suspendedUserId, verificationStatus: 'VERIFIED', isVerified: true, skills: '["cleaning"]' },
    })

    const companyOwner = await prisma.user.create({
      data: { email: `elig-company-owner-${ts}@test.com`, passwordHash: 'hash', name: 'CompanyOwner', role: 'COMPANY' },
    })
    const verifiedCompany = await prisma.companyProfile.create({
      data: { userId: companyOwner.id, companyName: 'Verified Co', services: 'plumbing', serviceAreas: 'Colombo', verificationStatus: 'VERIFIED', isVerified: true },
    })
    verifiedCompanyId = verifiedCompany.id

    const unverifiedCompanyOwner = await prisma.user.create({
      data: { email: `elig-unverified-co-${ts}@test.com`, passwordHash: 'hash', name: 'UnverifiedOwner', role: 'COMPANY' },
    })
    const unverifiedCompany = await prisma.companyProfile.create({
      data: { userId: unverifiedCompanyOwner.id, companyName: 'Unverified Co', services: 'electrical', serviceAreas: 'Gampaha', verificationStatus: 'PENDING' },
    })
    unverifiedCompanyId = unverifiedCompany.id

    await prisma.teamMember.create({
      data: { companyId: verifiedCompanyId, userId: companyOwner.id, name: 'Owner', role: 'COMPANY_OWNER', skills: '[]' },
    })
    await prisma.teamMember.create({
      data: { companyId: verifiedCompanyId, userId: verifiedUserId, name: 'Verified Worker', role: 'WORKER', skills: '[]' },
    })
  })

  afterAll(async () => {
    await prisma.taskerProfile.deleteMany({ where: { userId: { in: [verifiedUserId, unverifiedUserId, suspendedUserId] } } })
    await prisma.teamMember.deleteMany({ where: { companyId: { in: [verifiedCompanyId, unverifiedCompanyId] } } })
    await prisma.companyProfile.deleteMany({ where: { id: { in: [verifiedCompanyId, unverifiedCompanyId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [verifiedUserId, unverifiedUserId, suspendedUserId] } } })
    const coOwner = await prisma.companyProfile.findUnique({ where: { id: verifiedCompanyId }, select: { userId: true } })
    const unverCoOwner = await prisma.companyProfile.findUnique({ where: { id: unverifiedCompanyId }, select: { userId: true } })
    if (coOwner) await prisma.user.delete({ where: { id: coOwner.userId } }).catch(() => {})
    if (unverCoOwner) await prisma.user.delete({ where: { id: unverCoOwner.userId } }).catch(() => {})
  })

  describe('Individual provider eligibility', () => {
    it('verified provider with profile is eligible', async () => {
      const result = await checkIndividualProviderEligibility(verifiedUserId)
      expect(result.eligible).toBe(true)
      expect(result.reasons).toHaveLength(0)
    })

    it('unverified identity makes provider ineligible', async () => {
      const result = await checkIndividualProviderEligibility(unverifiedUserId)
      expect(result.eligible).toBe(false)
      expect(result.reasons.some(r => r.includes('Identity'))).toBe(true)
    })

    it('suspended provider is ineligible', async () => {
      const result = await checkIndividualProviderEligibility(suspendedUserId)
      expect(result.eligible).toBe(false)
      expect(result.reasons.some(r => r.includes('suspended'))).toBe(true)
    })

    it('non-existent user returns ineligible', async () => {
      const result = await checkIndividualProviderEligibility('nonexistent')
      expect(result.eligible).toBe(false)
      expect(result.reasons.some(r => r.includes('not found'))).toBe(true)
    })
  })

  describe('Company eligibility', () => {
    it('verified company with owner is eligible', async () => {
      const result = await checkCompanyEligibility(verifiedCompanyId)
      expect(result.eligible).toBe(true)
      expect(result.reasons).toHaveLength(0)
    })

    it('unverified company is ineligible', async () => {
      const result = await checkCompanyEligibility(unverifiedCompanyId)
      expect(result.eligible).toBe(false)
      expect(result.reasons.some(r => r.includes('verification'))).toBe(true)
    })

    it('non-existent company returns ineligible', async () => {
      const result = await checkCompanyEligibility('nonexistent')
      expect(result.eligible).toBe(false)
    })
  })

  describe('Worker eligibility', () => {
    it('active verified worker is eligible', async () => {
      const result = await checkWorkerEligibility(verifiedCompanyId, verifiedUserId)
      expect(result.eligible).toBe(true)
    })

    it('non-member is ineligible', async () => {
      const result = await checkWorkerEligibility(verifiedCompanyId, unverifiedUserId)
      expect(result.eligible).toBe(false)
      expect(result.reasons.some(r => r.includes('Not an active member'))).toBe(true)
    })

    it('suspended worker is ineligible', async () => {
      const member = await prisma.teamMember.create({
        data: { companyId: verifiedCompanyId, userId: suspendedUserId, name: 'Suspended Worker', role: 'WORKER', skills: '[]' },
      })
      const result = await checkWorkerEligibility(verifiedCompanyId, suspendedUserId)
      expect(result.eligible).toBe(false)
      expect(result.reasons.some(r => r.includes('suspended'))).toBe(true)
      await prisma.teamMember.delete({ where: { id: member.id } })
    })
  })
})
