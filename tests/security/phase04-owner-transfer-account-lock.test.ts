import { beforeEach, describe, expect, it, vi } from 'vitest'
import { transferOwnership } from '@/lib/phase6/company-ownership'

const mock = vi.hoisted(() => ({
  member: vi.fn(), sql: vi.fn(), execute: vi.fn(), audit: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    teamMember: { findFirst: mock.member },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      $queryRaw: mock.sql,
      $executeRaw: mock.execute,
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
    mock.sql.mockResolvedValue([{ id: 'old-owner', ...valid }, { id: 'new-owner', ...valid }])
    mock.execute.mockResolvedValue(1)
  })

  it('transfers only when both user accounts remain active and unrestricted', async () => {
    const result = await transferOwnership('company', 'old-owner', 'new-owner')
    expect(result).toEqual({ success: true })
    expect(mock.sql).toHaveBeenCalledOnce()
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
    mock.sql.mockResolvedValue([
      { id: 'old-owner', ...valid, ...(change.id === 'old-owner' ? change : {}) },
      { id: 'new-owner', ...valid, ...(change.id === 'new-owner' ? change : {}) },
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

  it('preserves concurrency abort without audit or partial success', async () => {
    mock.execute.mockResolvedValueOnce(1).mockResolvedValueOnce(0)
    const result = await transferOwnership('company', 'old-owner', 'new-owner')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Concurrent transfer')
    expect(mock.audit).not.toHaveBeenCalled()
  })
})
