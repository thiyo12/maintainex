import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { lockAndAssertWorkerScheduleAvailable } from '@/lib/domain/company-job-assignment'

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  busy: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: vi.fn() }))
vi.mock('@/lib/security/events', () => ({ emitSecurityEvent: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ notifyCompanyWorkerAssigned: vi.fn() }))
vi.mock('@/lib/phase6/provider-eligibility', () => ({ checkWorkerEligibility: vi.fn() }))

const tx = {
  $queryRaw: mocks.sql,
  companyJobAssignment: { findFirst: mocks.busy },
} as unknown as PrismaClient

const eligibleUser = {
  id: 'worker', isActive: true, isSuspended: false, isBanned: false,
  identityStatus: 'VERIFIED',
}

async function check(date: Date | null = null, photo = false) {
  return lockAndAssertWorkerScheduleAvailable(
    tx, 'worker', 'new-job', date, 'morning', 'company', photo,
  )
}

describe('Phase 04 — dispatch transaction locks and rechecks worker identity and capacity', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.sql
      .mockResolvedValueOnce([eligibleUser])
      .mockResolvedValueOnce([{ role: 'WORKER', status: 'ACTIVE' }])
    mocks.busy.mockResolvedValue(null)
  })

  it('allows a verified active company worker who has no current assignment', async () => {
    await expect(check()).resolves.toBeUndefined()
    expect(mocks.sql).toHaveBeenCalledTimes(2)
    expect(mocks.busy).toHaveBeenCalledWith({
      where: {
        workerUserId: 'worker',
        jobId: { not: 'new-job' },
        status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'CREW_RESERVED'] },
      },
      select: { id: true, jobId: true },
    })
  })

  it.each([
    { isActive: false },
    { isSuspended: true },
    { isBanned: true },
    { identityStatus: 'PENDING' },
  ])('refuses a worker whose account status changed before commit: %j', async change => {
    vi.resetAllMocks()
    mocks.sql.mockResolvedValueOnce([{ ...eligibleUser, ...change }])
    await expect(check()).rejects.toThrow('Worker identity or account status changed')
    expect(mocks.busy).not.toHaveBeenCalled()
  })

  it.each([
    { role: 'FINANCE', status: 'ACTIVE' },
    { role: 'DISPATCHER', status: 'ACTIVE' },
    { role: 'WORKER', status: 'SUSPENDED' },
  ])('blocks a non-worker or suspended membership inside the transaction: %j', async member => {
    vi.resetAllMocks()
    mocks.sql.mockResolvedValueOnce([eligibleUser]).mockResolvedValueOnce([member])
    await expect(check()).rejects.toThrow('Worker membership or role changed')
    expect(mocks.busy).not.toHaveBeenCalled()
  })

  it('rejects a deleted membership instead of silently allowing dispatch', async () => {
    vi.resetAllMocks()
    mocks.sql.mockResolvedValueOnce([eligibleUser]).mockResolvedValueOnce([])
    await expect(check()).rejects.toThrow('Worker membership or role changed')
  })

  it('requires a currently approved real worker photo when identity check is demanded', async () => {
    mocks.sql.mockResolvedValueOnce([])
    await expect(check(null, true)).rejects.toThrow('Worker verified photo is no longer approved')
    expect(mocks.busy).not.toHaveBeenCalled()
  })

  it('accepts a locked verified identity with photo when the customer requires it', async () => {
    mocks.sql.mockResolvedValueOnce([{ id: 'verified-identity' }])
    await expect(check(null, true)).resolves.toBeUndefined()
    expect(mocks.sql).toHaveBeenCalledTimes(3)
  })

  it('blocks double booking even when a new job has no preferred date', async () => {
    mocks.busy.mockResolvedValue({ id: 'already-assigned' })
    await expect(check()).rejects.toThrow('Worker scheduling conflict changed concurrently')
  })

  it('includes existing undated assignments when checking a scheduled job', async () => {
    await expect(check(new Date('2026-11-01T09:00:00.000Z'))).resolves.toBeUndefined()
    expect(mocks.busy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { status: 'IN_PROGRESS' },
            expect.objectContaining({
              status: { in: ['ASSIGNED', 'ACCEPTED', 'CREW_RESERVED'] },
              job: expect.objectContaining({
                OR: expect.arrayContaining([{ preferredDate: null }]),
              }),
            }),
          ]),
        }),
      }),
    )
  })

  it('never applies calendar-date filters to an already IN_PROGRESS worker job', async () => {
    await expect(check(new Date('2026-11-02T09:00:00.000Z'))).resolves.toBeUndefined()
    const query = mocks.busy.mock.calls[0][0].where
    expect(query.OR[0]).toEqual({ status: 'IN_PROGRESS' })
    expect(query.OR[0]).not.toHaveProperty('job')
    expect(query.OR[1].job.OR).toEqual(expect.arrayContaining([{ preferredDate: null }]))
  })

  it('rejects conflicts discovered only after the initial preflight', async () => {
    mocks.busy.mockResolvedValue({ id: 'another-worker-job' })
    await expect(check(new Date('2026-11-01T09:00:00.000Z')))
      .rejects.toThrow('Worker scheduling conflict changed concurrently')
  })
})
