import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { evaluateEligibility } from '@/lib/matching/eligibility'
import type { MatchingInput } from '@/lib/matching/types'

const job: MatchingInput = {
  jobId: 'job',
  jobMode: 'QUOTE',
  urgency: 'NORMAL',
  categoryId: 'plumbing',
  countryCode: 'CA',
}

function mockClient(owner: null | { isActive?: boolean; isSuspended?: boolean; isBanned?: boolean }, hasMembership = true) {
  const database = {
    companyProfile: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'company',
        userId: 'owner',
        // Stop the happy owner path at the next gate, so this fixture tests
        // owner authority without mocking every downstream profession gate.
        verificationStatus: 'PENDING',
        isVerified: true,
        subscriptionStatus: 'ACTIVE',
      }),
    },
    teamMember: {
      findMany: vi.fn().mockResolvedValue(hasMembership ? [{ user: owner }] : []),
    },
  }
  return { client: database as unknown as PrismaClient, mock: database }
}

async function checkOwner(owner: null | { isActive?: boolean; isSuspended?: boolean; isBanned?: boolean }, hasMembership = true) {
  const { client, mock } = mockClient(owner, hasMembership)
  const result = await evaluateEligibility({
    providerType: 'COMPANY',
    providerId: 'company',
    job,
    client,
  })
  return { result, mock }
}

describe('Phase 11 — company matching refuses missing or inactive owners', () => {
  it('rejects an inactive owner before offering company work', async () => {
    const { result, mock } = await checkOwner({
      isActive: false, isSuspended: false, isBanned: false,
    })
    expect(result.eligible).toBe(false)
    expect(result.gates).toContainEqual({
      gate: 'COMPANY_OWNER_ACTIVE',
      passed: false,
      reason: 'Company owner account is inactive or missing',
    })
    expect(mock.teamMember.findMany).toHaveBeenCalledWith({
      where: { companyId: 'company', role: 'COMPANY_OWNER', status: 'ACTIVE' },
      select: { user: { select: { isActive: true, isSuspended: true, isBanned: true } } },
    })
  })

  it('fails closed if the company owner record is missing', async () => {
    const { result, mock } = await checkOwner(null)
    expect(result.eligible).toBe(false)
    expect(result.gates.find(gate => gate.gate === 'COMPANY_OWNER_ACTIVE')?.passed).toBe(false)
    expect(mock.teamMember.findMany).toHaveBeenCalledOnce()
  })

  it('retains the suspension and banning checks for active owners', async () => {
    for (const owner of [
      { isActive: true, isSuspended: true, isBanned: false },
      { isActive: true, isSuspended: false, isBanned: true },
    ]) {
      const { result } = await checkOwner(owner)
      expect(result.eligible).toBe(false)
      expect(result.gates.find(gate => gate.gate === 'COMPANY_OWNER_ACTIVE')?.passed).toBe(false)
    }
  })

  it('fails the owner-exists gate when there is no active owner membership', async () => {
    const { result, mock } = await checkOwner({
      isActive: true, isSuspended: false, isBanned: false,
    }, false)
    expect(result.eligible).toBe(false)
    expect(result.gates).toContainEqual({
      gate: 'COMPANY_OWNER_EXISTS',
      passed: false,
      reason: 'No active company owner',
    })
    expect(mock.teamMember.findMany).toHaveBeenCalledOnce()
  })

  it('lets a real unrestricted active owner proceed to the company verification gate', async () => {
    const { result } = await checkOwner({
      isActive: true, isSuspended: false, isBanned: false,
    })
    expect(result.eligible).toBe(false) // Verification is intentionally pending in this fixture.
    expect(result.gates).toContainEqual({ gate: 'COMPANY_OWNER_ACTIVE', passed: true })
    expect(result.gates).toContainEqual({
      gate: 'COMPANY_VERIFIED',
      passed: false,
      reason: 'Company not verified',
    })
  })
})
