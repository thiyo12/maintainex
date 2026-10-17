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

function mockClient(owner: null | { isActive?: boolean; isSuspended?: boolean; isBanned?: boolean }) {
  const database = {
    companyProfile: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'company',
        userId: 'owner',
        verificationStatus: 'VERIFIED',
        isVerified: true,
        subscriptionStatus: 'ACTIVE',
      }),
    },
    user: { findUnique: vi.fn().mockResolvedValue(owner) },
    teamMember: { count: vi.fn().mockResolvedValue(0) },
  }
  return { client: database as unknown as PrismaClient, mock: database }
}

async function checkOwner(owner: null | { isActive?: boolean; isSuspended?: boolean; isBanned?: boolean }) {
  const { client, mock } = mockClient(owner)
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
    expect(mock.teamMember.count).not.toHaveBeenCalled()
    expect(mock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'owner' },
      select: { isActive: true, isSuspended: true, isBanned: true },
    })
  })

  it('fails closed if the company owner record is missing', async () => {
    const { result, mock } = await checkOwner(null)
    expect(result.eligible).toBe(false)
    expect(result.gates.find(gate => gate.gate === 'COMPANY_OWNER_ACTIVE')?.passed).toBe(false)
    expect(mock.teamMember.count).not.toHaveBeenCalled()
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

  it('lets a genuinely active owner proceed to the separate active-membership gate', async () => {
    const { result, mock } = await checkOwner({
      isActive: true, isSuspended: false, isBanned: false,
    })
    expect(result.eligible).toBe(false) // Mock intentionally has no active owner membership.
    expect(result.gates).toContainEqual({ gate: 'COMPANY_OWNER_ACTIVE', passed: true })
    expect(result.gates).toContainEqual({
      gate: 'COMPANY_OWNER_EXISTS',
      passed: false,
      reason: 'No active company owner',
    })
    expect(mock.teamMember.count).toHaveBeenCalledOnce()
  })
})
