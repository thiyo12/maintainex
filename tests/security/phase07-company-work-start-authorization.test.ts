import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { checkWorkStartAuthorization } from '@/lib/domain/work-start-auth'

function client(options: {
  providerType?: 'INDIVIDUAL' | 'COMPANY'
  providerId?: string
  member?: boolean
  actorStatus?: 'ACTIVE' | 'SUSPENDED' | 'UNVERIFIED'
  assigned?: boolean
  assignmentStatus?: string
  jobStatus?: string
  workersCount?: number
  requiresInspection?: boolean
  inspectionVerified?: boolean
  accepted?: boolean
} = {}) {
  const c = {
    marketplaceJob: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'job',
        status: options.jobStatus ?? 'QUOTE_ACCEPTED',
        requiresInspection: options.requiresInspection ?? false,
        approvedQuoteId: 'accepted-quote',
        customerId: 'customer',
        workersCount: options.workersCount ?? 1,
      }),
    },
    jobQuote: {
      findFirst: vi.fn().mockResolvedValue(options.accepted === false ? null : {
        id: 'accepted-quote',
        providerId: options.providerId ?? 'company',
        providerType: options.providerType ?? 'COMPANY',
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        isActive: true,
        isSuspended: options.actorStatus === 'SUSPENDED',
        isBanned: false,
        identityStatus: options.actorStatus === 'UNVERIFIED' ? 'PENDING' : 'VERIFIED',
      }),
    },
    teamMember: {
      findFirst: vi.fn().mockResolvedValue(options.member === false ? null : { id: 'active-member' }),
    },
    companyJobAssignment: {
      findFirst: vi.fn().mockImplementation(async ({ where }: { where: { status: string } }) =>
        options.assigned === false || (options.assignmentStatus && where.status !== options.assignmentStatus)
          ? null : { id: 'accepted-assignment' },
      ),
    },
    jobInspection: {
      findFirst: vi.fn().mockResolvedValue(options.inspectionVerified === false ? null : {
        id: 'inspection', status: 'COMPLETED', verifiedByCustomer: true,
      }),
    },
  }
  return { c: c as unknown as PrismaClient, mocked: c }
}

describe('Phase 07 — company work-start authorization follows the actual assigned worker', () => {
  it('refuses an unrelated active company employee with no accepted assignment', async () => {
    const { c, mocked } = client({ assigned: false })
    const result = await checkWorkStartAuthorization(c, 'job', 'finance-member')
    expect(result).toEqual({ authorized: false, reason: 'NOT_PROVIDER' })
    expect(mocked.companyJobAssignment.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: 'company',
        jobId: 'job',
        workerUserId: 'finance-member',
        status: 'ACCEPTED',
      },
      select: { id: true },
    })
  })

  it('refuses a suspended/removed company member even with an accepted worker assignment', async () => {
    const { c } = client({ member: false, assigned: true })
    const result = await checkWorkStartAuthorization(c, 'job', 'worker')
    expect(result).toEqual({ authorized: false, reason: 'NOT_PROVIDER' })
  })

  it('refuses a merely ASSIGNED worker who has not accepted the assignment', async () => {
    const { c } = client({ assignmentStatus: 'ASSIGNED' })
    const result = await checkWorkStartAuthorization(c, 'job', 'worker')
    expect(result).toEqual({ authorized: false, reason: 'NOT_PROVIDER' })
  })

  it('blocks a suspended or unverified assigned worker before work start', async () => {
    for (const actorStatus of ['SUSPENDED', 'UNVERIFIED'] as const) {
      const { c } = client({ actorStatus })
      expect(await checkWorkStartAuthorization(c, 'job', 'worker'))
        .toEqual({ authorized: false, reason: 'NOT_PROVIDER' })
    }
  })

  it('refuses a partial crew even if an individual assignment is accepted', async () => {
    const { c, mocked } = client({ workersCount: 3 })
    expect(await checkWorkStartAuthorization(c, 'job', 'worker'))
      .toEqual({ authorized: false, reason: 'CREW_UNSUPPORTED' })
    expect(mocked.companyJobAssignment.findFirst).not.toHaveBeenCalled()
  })

  it('allows an active, accepted company worker with no inspection requirement', async () => {
    const { c } = client()
    const result = await checkWorkStartAuthorization(c, 'job', 'worker')
    expect(result).toEqual({ authorized: true })
  })

  it('retains individual-provider work start without requiring a company membership', async () => {
    const { c, mocked } = client({ providerType: 'INDIVIDUAL', providerId: 'individual' })
    const result = await checkWorkStartAuthorization(c, 'job', 'individual')
    expect(result).toEqual({ authorized: true })
    expect(mocked.teamMember.findFirst).not.toHaveBeenCalled()
    expect(mocked.companyJobAssignment.findFirst).not.toHaveBeenCalled()
  })

  it('blocks work start when a required inspection has not been customer-verified', async () => {
    const { c } = client({ requiresInspection: true, inspectionVerified: false })
    const result = await checkWorkStartAuthorization(c, 'job', 'worker')
    expect(result.authorized).toBe(false)
    expect(result.missingRequirements).toContain('inspection_not_completed_or_verified')
  })

  it('blocks work start when the job is no longer quote-accepted', async () => {
    const { c } = client({ jobStatus: 'CANCELLED' })
    const result = await checkWorkStartAuthorization(c, 'job', 'worker')
    expect(result).toMatchObject({ authorized: false, reason: 'INVALID_JOB_STATUS' })
  })

  it('blocks work start without an accepted quote', async () => {
    const { c } = client({ accepted: false })
    const result = await checkWorkStartAuthorization(c, 'job', 'worker')
    expect(result).toEqual({ authorized: false, reason: 'NO_ACCEPTED_QUOTE' })
  })
})
