import { describe, expect, it, vi } from 'vitest'
import { reassignMarketplaceDisputeInTransaction } from '@/lib/crm/disputes/reassign-marketplace-dispute'

function fixture(options: { status?: string; role?: string; countries?: string; active?: boolean } = {}) {
  const alerts = [{ id: 'alert-1', assignedTo: 'staff-old' }]
  const target = {
    id: 'staff-next',
    role: options.role || 'SUPPORT',
    assignedCountries: options.countries ?? '["LK"]',
    isActive: options.active ?? true,
    deletedAt: null,
    lockedUntil: null,
    totpEnabled: true,
    totpSecret: 'not-logged',
    permissionOverrides: [],
  }
  const tx = {
    $queryRawUnsafe: vi.fn(async () => [{ id: 'case-1', status: options.status || 'UNDER_REVIEW', countryCode: 'LK' }]),
    adminUser: { findUnique: vi.fn(async () => target) },
    adminAlert: {
      findMany: vi.fn(async () => alerts),
      updateMany: vi.fn(async () => ({ count: alerts.length })),
      create: vi.fn(async ({ data }: any) => data),
    },
    marketplaceDispute: { updateMany: vi.fn(async () => ({ count: 1 })) },
    securityAudit: { create: vi.fn(async ({ data }: any) => data) },
  }
  return { tx, target }
}

const input = {
  disputeId: 'case-1', actorAdminId: 'staff-current', targetAdminId: 'staff-next',
  actorEmail: 'staff@example.test', actorRole: 'SUPPORT', countryCode: 'LK', ipAddress: '127.0.0.1',
}

describe('marketplace dispute reassignment', () => {
  it('locks the case, enforces target permission and market, reassigns active alerts and audits atomically', async () => {
    const { tx } = fixture({ status: 'OPEN' })
    const result = await reassignMarketplaceDisputeInTransaction(tx, input)
    expect(result).toEqual({
      ok: true, status: 'UNDER_REVIEW', assignedTo: 'staff-next', assignedRole: 'SUPPORT', previousAssignee: 'staff-old',
    })
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), 'case-1')
    expect(tx.adminAlert.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['alert-1'] } },
      data: { assignedTo: 'staff-next', assignedRole: 'SUPPORT', status: 'in_progress' },
    })
    expect(tx.marketplaceDispute.updateMany).toHaveBeenCalledWith({
      where: { id: 'case-1', status: 'OPEN' }, data: { status: 'UNDER_REVIEW' },
    })
    expect(tx.securityAudit.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: 'DISPUTE_REASSIGNED', entityId: 'case-1', userId: 'staff-current',
      newValue: JSON.stringify({ assignedTo: 'staff-next', assignedRole: 'SUPPORT', countryCode: 'LK' }),
    }) })
  })

  it('rejects self-assignment and unavailable, out-of-market, or unauthorized targets', async () => {
    const self = fixture()
    await expect(reassignMarketplaceDisputeInTransaction(self.tx, { ...input, targetAdminId: input.actorAdminId }))
      .resolves.toEqual({ ok: false, code: 'SELF_ASSIGNMENT' })

    const inactive = fixture({ active: false })
    await expect(reassignMarketplaceDisputeInTransaction(inactive.tx, input))
      .resolves.toEqual({ ok: false, code: 'TARGET_UNAVAILABLE' })

    const outOfMarket = fixture({ countries: '["CA"]' })
    await expect(reassignMarketplaceDisputeInTransaction(outOfMarket.tx, input))
      .resolves.toEqual({ ok: false, code: 'TARGET_OUT_OF_SCOPE' })

    const noPermission = fixture({ role: 'USER_MANAGEMENT' })
    await expect(reassignMarketplaceDisputeInTransaction(noPermission.tx, input))
      .resolves.toEqual({ ok: false, code: 'TARGET_LACKS_PERMISSION' })
  })

  it('does not move a resolved case', async () => {
    const { tx } = fixture({ status: 'RESOLVED' })
    await expect(reassignMarketplaceDisputeInTransaction(tx, input))
      .resolves.toEqual({ ok: false, code: 'CLOSED' })
    expect(tx.adminUser.findUnique).not.toHaveBeenCalled()
    expect(tx.adminAlert.updateMany).not.toHaveBeenCalled()
    expect(tx.securityAudit.create).not.toHaveBeenCalled()
  })
})
