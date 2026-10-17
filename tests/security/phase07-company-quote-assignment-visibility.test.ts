import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { resolveQuoteVisibility } from '@/lib/phase6/quote-visibility'

const db = {
  job: vi.fn(),
  membership: vi.fn(),
  assignment: vi.fn(),
  companyQuote: vi.fn(),
  individualQuote: vi.fn(),
}

function client(): PrismaClient {
  return {
    marketplaceJob: { findUnique: db.job },
    teamMember: { findFirst: db.membership },
    companyJobAssignment: { findFirst: db.assignment },
    jobQuote: { findFirst: db.companyQuote },
  } as unknown as PrismaClient
}

describe('Phase 07 — company quote visibility is scoped to active assigned worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.job.mockResolvedValue({ customerId: 'customer' })
    db.membership.mockResolvedValue({ role: 'WORKER' })
    db.assignment.mockResolvedValue(null)
    db.companyQuote.mockResolvedValue({ id: 'company-quote' })
  })

  it('allows the customer to view all their job quotes', async () => {
    expect(await resolveQuoteVisibility(client(), { userId: 'customer', jobId: 'job' }))
      .toEqual({ allowedQuoteIds: [], isCustomer: true })
    expect(db.membership).not.toHaveBeenCalled()
  })

  it('rejects an unrelated worker despite their generic quotes:read role', async () => {
    const result = await resolveQuoteVisibility(client(), {
      userId: 'worker', jobId: 'job', companyId: 'company',
    })
    expect(result.allowedQuoteIds).toEqual([])
    expect(db.companyQuote).not.toHaveBeenCalled()
    expect(db.assignment).toHaveBeenCalledWith({
      where: {
        jobId: 'job', companyId: 'company', workerUserId: 'worker',
        status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] },
      },
      select: { id: true },
    })
  })

  it('allows an actively assigned worker to see only their company quote', async () => {
    db.assignment.mockResolvedValue({ id: 'a' })
    const result = await resolveQuoteVisibility(client(), {
      userId: 'worker', jobId: 'job', companyId: 'company',
    })
    expect(result.allowedQuoteIds).toEqual(['company-quote'])
    expect(db.companyQuote).toHaveBeenCalledWith({
      where: { jobId: 'job', providerId: 'company', providerType: 'COMPANY' },
      select: { id: true },
    })
  })

  it('denies a removed/suspended worker even with a historical assignment', async () => {
    db.membership.mockResolvedValue(null)
    db.assignment.mockResolvedValue({ id: 'a' })
    const result = await resolveQuoteVisibility(client(), {
      userId: 'worker', jobId: 'job', companyId: 'company',
    })
    expect(result.allowedQuoteIds).toEqual([])
    expect(db.assignment).not.toHaveBeenCalled()
  })

  it('preserves full own-company quote access for active managers', async () => {
    db.membership.mockResolvedValue({ role: 'MANAGER' })
    const result = await resolveQuoteVisibility(client(), {
      userId: 'manager', jobId: 'job', companyId: 'company',
    })
    expect(result.allowedQuoteIds).toEqual(['company-quote'])
    expect(db.assignment).not.toHaveBeenCalled()
  })

  it('preserves dispatch permission without an assignment', async () => {
    db.membership.mockResolvedValue({ role: 'DISPATCHER' })
    const result = await resolveQuoteVisibility(client(), {
      userId: 'dispatcher', jobId: 'job', companyId: 'company',
    })
    expect(result.allowedQuoteIds).toEqual(['company-quote'])
    expect(db.assignment).not.toHaveBeenCalled()
  })

  it('denies active roles without company quote permission', async () => {
    db.membership.mockResolvedValue({ role: 'FINANCE' })
    const result = await resolveQuoteVisibility(client(), {
      userId: 'finance', jobId: 'job', companyId: 'company',
    })
    expect(result.allowedQuoteIds).toEqual([])
    expect(db.assignment).not.toHaveBeenCalled()
  })

  it('does not reveal company quotes without an explicit companyId', async () => {
    db.companyQuote.mockResolvedValue(null)
    const result = await resolveQuoteVisibility(client(), {
      userId: 'worker', jobId: 'job',
    })
    expect(result.allowedQuoteIds).toEqual([])
    expect(db.membership).not.toHaveBeenCalled()
  })

  it('keeps individual-provider self quote access unchanged', async () => {
    db.companyQuote.mockResolvedValue({ id: 'individual-quote' })
    const result = await resolveQuoteVisibility(client(), {
      userId: 'individual', jobId: 'job',
    })
    expect(result.allowedQuoteIds).toEqual(['individual-quote'])
    expect(db.membership).not.toHaveBeenCalled()
  })
})
