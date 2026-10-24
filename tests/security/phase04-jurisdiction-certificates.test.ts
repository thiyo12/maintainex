import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { evaluateJurisdictionCredential } from '@/lib/matching/eligibility'

const mocks = vi.hoisted(() => ({ requirements: vi.fn(), count: vi.fn() }))
const db = {
  professionJurisdictionRequirement: { findMany: mocks.requirements },
  certification: { count: mocks.count },
} as unknown as PrismaClient

function requireTypes(...types: Array<string | null>) {
  return types.map(credentialType => ({
    countryCode: 'LK', professionId: 'electrician',
    isActive: true, credentialRequired: true, credentialType,
  }))
}
async function check(kind: 'INDIVIDUAL' | 'COMPANY' = 'INDIVIDUAL', country = 'LK') {
  return (await evaluateJurisdictionCredential(
    db, kind, kind === 'COMPANY' ? 'company' : 'tasker', country, 'electrician',
  )).gate
}

describe('Phase 04 — provider licensing requires every valid unexpired credential', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.requirements.mockResolvedValue(requireTypes('ELECTRICAL'))
    mocks.count.mockResolvedValue(1)
  })

  it('requires verified active certificates that have not expired', async () => {
    expect((await check()).passed).toBe(true)
    expect(mocks.count).toHaveBeenCalledWith({
      where: {
        holderType: 'INDIVIDUAL', holderId: 'tasker',
        certificationType: 'ELECTRICAL', verificationStatus: 'VERIFIED',
        isActive: true,
        OR: [
          { expiryDate: null },
          { expiryDate: { gt: expect.any(Date) } },
        ],
      },
    })
  })

  it('denies the provider when only expired certificates exist', async () => {
    // Real Prisma count is zero when the expiryDate condition excludes them.
    mocks.count.mockResolvedValue(0)
    const result = await check()
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('ELECTRICAL')
  })

  it('requires all separately mandatory certificates, not just any one', async () => {
    mocks.requirements.mockResolvedValue(requireTypes('ELECTRICAL', 'GAS'))
    mocks.count.mockImplementation(async ({ where }) =>
      where.certificationType === 'ELECTRICAL' ? 1 : 0)
    const result = await check()
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('GAS')
    expect(mocks.count).toHaveBeenCalledTimes(2)
  })

  it('permits providers that hold all mandatory license types', async () => {
    mocks.requirements.mockResolvedValue(requireTypes('ELECTRICAL', 'GAS'))
    expect((await check('COMPANY')).passed).toBe(true)
    expect(mocks.count).toHaveBeenCalledTimes(2)
    expect(mocks.count.mock.calls[0][0].where.holderType).toBe('COMPANY')
    expect(mocks.count.mock.calls[0][0].where.holderId).toBe('company')
  })

  it('does not accept a blank mandatory credential type as automatically satisfied', async () => {
    mocks.requirements.mockResolvedValue(requireTypes(null))
    const result = await check()
    expect(result.passed).toBe(false)
    expect(mocks.count).not.toHaveBeenCalled()
  })

  it('does not declare credentials valid without a verified job jurisdiction', async () => {
    const result = (await evaluateJurisdictionCredential(
      db, 'INDIVIDUAL', 'tasker', undefined, 'electrician',
    )).gate
    expect(result.passed).toBe(false)
    expect(mocks.requirements).not.toHaveBeenCalled()
  })

  it('preserves no-license-required professions', async () => {
    mocks.requirements.mockResolvedValue([])
    expect((await check()).passed).toBe(true)
    expect(mocks.count).not.toHaveBeenCalled()
  })

  it('deduplicates redundant rules for the same required credential', async () => {
    mocks.requirements.mockResolvedValue(requireTypes('ELECTRICAL', 'ELECTRICAL'))
    expect((await check()).passed).toBe(true)
    expect(mocks.count).toHaveBeenCalledTimes(1)
  })
})
