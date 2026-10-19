import { beforeEach, describe, expect, it, vi } from 'vitest'
import { transferOwnership } from '@/lib/phase6/company-ownership'

const mock = vi.hoisted(() => ({
  member: vi.fn(), sql: vi.fn(), execute: vi.fn(), audit: vi.fn(),
  activeAssignments: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    teamMember: { findFirst: mock.member },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      $queryRaw: mock.sql,
      $executeRaw: mock.execute,
      companyJobAssignment: { count: mock.activeAssignments },
    }),
  },
}))
vi.mock('@/lib/phase6/audit', () => ({ writeCompanyAuditLog: mock.audit }))

const valid = { isActive: true, isSuspended: false, isBanned: false }
const owner = { id: 'owner-member', role: 'COMPANY_OWNER' }
const successor = { id: 'next-member', role: 'WORKER' }

describe('Phase 04 — ownership transfer verifies both global accounts under row locks', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.member.mockResolvedValueOnce(owner).mockResolvedValueOnce(successor)
    mock.sql.mockResolvedValueOnce([{ id: 'old-owner', ...valid }, { id: 'new-owner', ...valid }])
      .mockResolvedValueOnce([{ id: 'next-member', role: 'WORKER', status: 'ACTIVE' }])
    mock.activeAssignments.mockResolvedValue(0)
    mock.execute.mockResolvedValue(1)
  })

  it('transfers only when both user accounts remain active and unrestricted', async () => {
    const result = await transferOwnership('company', 'old-owner', 'new-owner')
    expect(result).toEqual({ success: true })
    expect(mock.sql).toHaveBeenCalledTimes(2)
    expect(mock.execute).toHaveBeenCalledTimes(2)
    expect(mock.audit).toHaveBeenCalledOnce()
  })

  it.each([
    { id: 'new-owner', isActive: false },
    { id: 'new-owner', isSuspended: true },
    { id: 'new-owner', isBanned: true },
    { id: 'old-owner', isActive: false },
    { id: 'old-owner', isSuspended: true },
    { id: 'old-owner', isBanned: true },
  ])('denies restricted owner changes without writing memberships: %j', async change => {
    const { id: changedId, ...restrictions } = change
    mock.sql.mockResolvedValue([
      { id: 'old-owner', ...valid, ...(changedId === 'old-owner' ? restrictions : {}) },
      { id: 'new-owner', ...valid, ...(changedId === 'new-owner' ? restrictions : {}) },
    ])
    const result = await transferOwnership('company', 'old-owner', 'new-owner')
    expect(result.success).toBe(false)
    expect(result.error).toContain('restricted')
    expect(mock.execute).not.toHaveBeenCalled()
    expect(mock.audit).not.toHaveBeenCalled()
  })

  it('fails closed if either account disappears between preflight and commit', async () => {
    mock.sql.mockResolvedValue([{ id: 'old-owner', ...valid }])
    const result = await transferOwnership('company', 'old-owner', 'new-owner')
    expect(result.success).toBe(false)
    expect(mock.execute).not.toHaveBeenCalled()
  })

  it('refuses ownership promotion while the successor has an active company job', async () => {
    mock.activeAssignments.mockResolvedValue(1)
    const result = await transferOwnership('company', 'old-owner', 'new-owner')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Finish or reassign')
    expect(mock.activeAssignments).toHaveBeenCalledWith({
      where: {
        companyId: 'company',
        workerUserId: 'new-owner',
        status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
      },
    })
    expect(mock.execute).not.toHaveBeenCalled()
    expect(mock.audit).not.toHaveBeenCalled()
  })

  it('rejects a successor whose worker membership changes under the row lock', async () => {
    mock.sql.mockReset()
    mock.sql.mockResolvedValueOnce([
      { id: 'old-owner', ...valid }, { id: 'new-owner', ...valid },
    ]).mockResolvedValueOnce([{ id: 'next-member', role: 'MANAGER', status: 'ACTIVE' }])
    const result = await transferOwnership('company', 'old-owner', 'new-owner')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Concurrent transfer')
    expect(mock.activeAssignments).not.toHaveBeenCalled()
    expect(mock.execute).not.toHaveBeenCalled()
  })

  it('continues to permit an idle successor with zero active jobs', async () => {
    const result = await transferOwnership('company', 'old-owner', 'new-owner')
    expect(result.success).toBe(true)
    expect(mock.activeAssignments).toHaveBeenCalledOnce()
  })

  it('preserves concurrency abort without audit or partial success', async () => {
    mock.execute.mockResolvedValueOnce(1).mockResolvedValueOnce(0)
    const result = await transferOwnership('company', 'old-owner', 'new-owner')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Concurrent transfer')
    expect(mock.audit).not.toHaveBeenCalled()
  })
})
