import { describe, it, expect, vi } from 'vitest'
import { checkWorkStartAuthorization } from '@/lib/domain/work-start-auth'

function mockPrisma(overrides: Record<string, any> = {}) {
  const hasJob = 'job' in overrides
  const hasAcceptedQuote = 'acceptedQuote' in overrides
  const hasInspection = 'inspection' in overrides
  const defaultInspection = hasInspection ? overrides.inspection : null

  return {
    marketplaceJob: {
      findUnique: vi.fn().mockResolvedValue(hasJob ? overrides.job : {
        id: 'job-1',
        requiresInspection: false,
        approvedQuoteId: 'quote-1',
        status: 'QUOTE_ACCEPTED',
        customerId: 'customer-1',
      }),
    },
    jobQuote: {
      findFirst: vi.fn().mockResolvedValue(hasAcceptedQuote ? overrides.acceptedQuote : {
        id: 'quote-1',
        providerId: 'provider-1',
        providerType: 'INDIVIDUAL',
      }),
    },
    jobInspection: {
      findFirst: vi.fn().mockImplementation((args: any) => {
        if (defaultInspection && args?.where?.verifiedByCustomer === true && !defaultInspection.verifiedByCustomer) {
          return Promise.resolve(null)
        }
        return Promise.resolve(defaultInspection)
      }),
    },
    teamMember: {
      findFirst: overrides.teamMember !== undefined
        ? vi.fn().mockResolvedValue(overrides.teamMember)
        : vi.fn().mockResolvedValue(null),
    },
  } as any
}

describe('Work-start authorization', () => {
  it('authorizes when all prerequisites met (no inspection required)', async () => {
    const prisma = mockPrisma()
    const result = await checkWorkStartAuthorization(prisma, 'job-1', 'provider-1')
    expect(result.authorized).toBe(true)
  })

  it('rejects non-provider', async () => {
    const prisma = mockPrisma()
    const result = await checkWorkStartAuthorization(prisma, 'job-1', 'wrong-user')
    expect(result.authorized).toBe(false)
    expect(result.reason).toBe('NOT_PROVIDER')
  })

  it('rejects when job not in QUOTE_ACCEPTED status', async () => {
    const prisma = mockPrisma({
      job: { id: 'job-1', requiresInspection: false, approvedQuoteId: 'quote-1', status: 'OPEN', customerId: 'customer-1' },
    })
    const result = await checkWorkStartAuthorization(prisma, 'job-1', 'provider-1')
    expect(result.authorized).toBe(false)
    expect(result.reason).toBe('INVALID_JOB_STATUS')
  })

  it('requires inspection when requiresInspection is true', async () => {
    const prisma = mockPrisma({
      job: { id: 'job-1', requiresInspection: true, approvedQuoteId: 'quote-1', status: 'QUOTE_ACCEPTED', customerId: 'customer-1' },
    })
    const result = await checkWorkStartAuthorization(prisma, 'job-1', 'provider-1')
    expect(result.authorized).toBe(false)
    expect(result.missingRequirements).toContain('inspection_not_completed_or_verified')
  })

  it('authorizes when inspection is completed and verified', async () => {
    const prisma = mockPrisma({
      job: { id: 'job-1', requiresInspection: true, approvedQuoteId: 'quote-1', status: 'QUOTE_ACCEPTED', customerId: 'customer-1' },
      inspection: { id: 'insp-1', status: 'COMPLETED', verifiedByCustomer: true },
    })
    const result = await checkWorkStartAuthorization(prisma, 'job-1', 'provider-1')
    expect(result.authorized).toBe(true)
  })

  it('rejects when inspection completed but not verified by customer', async () => {
    const prisma = mockPrisma({
      job: { id: 'job-1', requiresInspection: true, approvedQuoteId: 'quote-1', status: 'QUOTE_ACCEPTED', customerId: 'customer-1' },
      inspection: { id: 'insp-1', status: 'COMPLETED', verifiedByCustomer: false },
    })
    const result = await checkWorkStartAuthorization(prisma, 'job-1', 'provider-1')
    expect(result.authorized).toBe(false)
    expect(result.missingRequirements).toContain('inspection_not_completed_or_verified')
  })

  it('rejects when no accepted quote exists', async () => {
    const prisma = mockPrisma({
      acceptedQuote: null,
      job: { id: 'job-1', requiresInspection: false, approvedQuoteId: null, status: 'QUOTE_ACCEPTED', customerId: 'customer-1' },
    })
    const result = await checkWorkStartAuthorization(prisma, 'job-1', 'provider-1')
    expect(result.authorized).toBe(false)
    expect(result.reason).toBe('NO_ACCEPTED_QUOTE')
  })

  it('returns JOB_NOT_FOUND for non-existent job', async () => {
    const prisma = mockPrisma({
      job: null,
    })
    const result = await checkWorkStartAuthorization(prisma, 'nonexistent', 'provider-1')
    expect(result.authorized).toBe(false)
    expect(result.reason).toBe('JOB_NOT_FOUND')
  })

  it('authorizes company member as provider', async () => {
    const prisma = mockPrisma({
      acceptedQuote: { id: 'quote-1', providerId: 'company-1', providerType: 'COMPANY' },
      teamMember: { id: 'tm-1' }, // findFirst returns this truthy value
    })
    const result = await checkWorkStartAuthorization(prisma, 'job-1', 'member-1')
    expect(result.authorized).toBe(true)
  })
})