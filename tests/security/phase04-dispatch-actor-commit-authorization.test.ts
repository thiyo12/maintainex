import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { lockAndAssertAssignmentActorAuthorized } from '@/lib/domain/company-job-assignment'

const db = vi.hoisted(() => ({ sql: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: vi.fn() }))
vi.mock('@/lib/security/events', () => ({ emitSecurityEvent: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ notifyCompanyWorkerAssigned: vi.fn() }))
vi.mock('@/lib/phase6/provider-eligibility', () => ({ checkWorkerEligibility: vi.fn() }))

const tx = { $queryRaw: db.sql } as unknown as PrismaClient
const actor = { isActive: true, isSuspended: false, isBanned: false }
async function check(role = 'DISPATCHER') {
  return lockAndAssertAssignmentActorAuthorized(tx, 'company', 'actor', role)
}

describe('Phase 04 — dispatch actor must stay authorized until commit', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.sql.mockResolvedValueOnce([actor])
      .mockResolvedValueOnce([{ role: 'DISPATCHER', status: 'ACTIVE' }])
  })

  it('allows an active dispatcher with active company permissions', async () => {
    await expect(check()).resolves.toBeUndefined()
    expect(db.sql).toHaveBeenCalledTimes(2)
  })

  it.each([
    { isActive: false }, { isSuspended: true }, { isBanned: true },
  ])('denies a restricted dispatcher at commit time: %j', async change => {
    vi.resetAllMocks()
    db.sql.mockResolvedValueOnce([{ ...actor, ...change }])
    await expect(check()).rejects.toThrow('Assigning actor is no longer authorized')
    expect(db.sql).toHaveBeenCalledTimes(1)
  })

  it('denies an actor account deleted after the first check', async () => {
    vi.resetAllMocks()
    db.sql.mockResolvedValueOnce([])
    await expect(check()).rejects.toThrow('Assigning actor is no longer authorized')
  })

  it.each(['WORKER', 'FINANCE', 'UNRECOGNIZED'])(
    'denies assignment after the actor role changes to %s', async role => {
      vi.resetAllMocks()
      db.sql.mockResolvedValueOnce([actor])
        .mockResolvedValueOnce([{ role, status: 'ACTIVE' }])
      await expect(check()).rejects.toThrow('Assigning actor is no longer authorized')
    },
  )

  it('denies an actor whose membership was suspended', async () => {
    vi.resetAllMocks()
    db.sql.mockResolvedValueOnce([actor])
      .mockResolvedValueOnce([{ role: 'DISPATCHER', status: 'SUSPENDED' }])
    await expect(check()).rejects.toThrow('Assigning actor is no longer authorized')
  })

  it('denies an actor whose membership was removed', async () => {
    vi.resetAllMocks()
    db.sql.mockResolvedValueOnce([actor]).mockResolvedValueOnce([])
    await expect(check()).rejects.toThrow('Assigning actor is no longer authorized')
  })

  it('denies an outdated role assertion even if both roles could assign', async () => {
    vi.resetAllMocks()
    db.sql.mockResolvedValueOnce([actor])
      .mockResolvedValueOnce([{ role: 'MANAGER', status: 'ACTIVE' }])
    await expect(check()).rejects.toThrow('Assigning actor is no longer authorized')
  })

  it.each(['COMPANY_OWNER', 'MANAGER'])('permits an active authorized %s', async role => {
    vi.resetAllMocks()
    db.sql.mockResolvedValueOnce([actor])
      .mockResolvedValueOnce([{ role, status: 'ACTIVE' }])
    await expect(check(role)).resolves.toBeUndefined()
  })

  it('rejects prototype-like forged role values', async () => {
    vi.resetAllMocks()
    db.sql.mockResolvedValueOnce([actor])
      .mockResolvedValueOnce([{ role: 'constructor', status: 'ACTIVE' }])
    await expect(check('constructor')).rejects.toThrow('Assigning actor is no longer authorized')
  })
})
