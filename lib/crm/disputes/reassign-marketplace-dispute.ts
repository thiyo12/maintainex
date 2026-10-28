import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'
import { evaluateEffectivePermission } from '@/lib/crm/governance/permissions'

function normalizeAssignedCountries(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string').map(item => item.toUpperCase())
    }
  } catch {
    return value.split(',').map(item => item.trim().toUpperCase()).filter(Boolean)
  }
  return []
}

export type DisputeReassignmentResult =
  | { ok: true; status: 'OPEN' | 'UNDER_REVIEW'; assignedTo: string; assignedRole: string; previousAssignee: string | null }
  | { ok: false; code: 'NOT_FOUND' | 'CLOSED' | 'SELF_ASSIGNMENT' | 'TARGET_UNAVAILABLE' | 'TARGET_OUT_OF_SCOPE' | 'TARGET_LACKS_PERMISSION' }

/** Reassign an active financial case to staff currently authorized for its market. */
export async function reassignMarketplaceDisputeInTransaction(
  tx: any,
  input: {
    disputeId: string
    actorAdminId: string
    targetAdminId: string
    actorEmail?: string
    actorRole: string
    countryCode: string
    ipAddress?: string
    userAgent?: string | null
  },
): Promise<DisputeReassignmentResult> {
  const rows = await tx.$queryRawUnsafe(
    'SELECT id, status, "countryCode" FROM "MarketplaceDispute" WHERE id = $1 FOR UPDATE',
    input.disputeId,
  ) as Array<{ id: string; status: string; countryCode: string }>
  const dispute = rows[0]
  if (!dispute) return { ok: false, code: 'NOT_FOUND' }
  if (!['OPEN', 'UNDER_REVIEW'].includes(dispute.status)) return { ok: false, code: 'CLOSED' }
  if (input.actorAdminId === input.targetAdminId) return { ok: false, code: 'SELF_ASSIGNMENT' }

  const countryCode = (dispute.countryCode || input.countryCode).toUpperCase()
  if (countryCode !== input.countryCode.toUpperCase()) return { ok: false, code: 'TARGET_OUT_OF_SCOPE' }
  const target = await tx.adminUser.findUnique({
    where: { id: input.targetAdminId },
    select: {
      id: true, role: true, assignedCountries: true, isActive: true, deletedAt: true,
      lockedUntil: true, totpEnabled: true,
      permissionOverrides: { select: { permission: true, effect: true } },
    },
  })
  if (!target || !target.isActive || target.deletedAt || (target.lockedUntil && target.lockedUntil > new Date())) {
    return { ok: false, code: 'TARGET_UNAVAILABLE' }
  }
  if (!Object.hasOwn(ROLE_PERMISSIONS, target.role)) return { ok: false, code: 'TARGET_LACKS_PERMISSION' }
  if (target.role === 'SUPER_ADMIN') {
    if (!target.totpEnabled) return { ok: false, code: 'TARGET_UNAVAILABLE' }
    const secretExists = await tx.adminUser.count({ where: { id: target.id, totpSecret: { not: null } } })
    if (!secretExists) return { ok: false, code: 'TARGET_UNAVAILABLE' }
  }
  const permission = evaluateEffectivePermission({
    role: target.role as AdminRole,
    permission: 'disputes:resolve',
    overrides: target.permissionOverrides.filter((override: { effect: string }) =>
      override.effect === 'ALLOW' || override.effect === 'DENY'
    ),
  })
  if (!permission.allowed) return { ok: false, code: 'TARGET_LACKS_PERMISSION' }
  if (target.role !== 'SUPER_ADMIN' && !normalizeAssignedCountries(target.assignedCountries).includes(countryCode)) {
    return { ok: false, code: 'TARGET_OUT_OF_SCOPE' }
  }

  const status: 'OPEN' | 'UNDER_REVIEW' = 'UNDER_REVIEW'
  if (dispute.status === 'OPEN') {
    const changed = await tx.marketplaceDispute.updateMany({
      where: { id: input.disputeId, status: 'OPEN' },
      data: { status },
    })
    if (changed.count !== 1) return { ok: false, code: 'CLOSED' }
  }

  const alerts = await tx.adminAlert.findMany({
    where: {
      targetTable: 'MarketplaceDispute',
      targetId: input.disputeId,
      status: { in: ['open', 'in_progress'] },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, assignedTo: true },
  })
  const previousAssignee = alerts.find((alert: { assignedTo: string | null }) => alert.assignedTo)?.assignedTo ?? null
  if (alerts.length) {
    await tx.adminAlert.updateMany({
      where: { id: { in: alerts.map((alert: { id: string }) => alert.id) } },
      data: { assignedTo: target.id, assignedRole: target.role, status: 'in_progress' },
    })
  } else {
    await tx.adminAlert.create({
      data: {
        type: 'dispute', severity: 'high', priority: 'high',
        title: 'Marketplace financial dispute',
        description: 'Assigned to authorized staff for investigation.',
        targetTable: 'MarketplaceDispute', targetId: input.disputeId,
        assignedTo: target.id, assignedRole: target.role, status: 'in_progress',
      },
    })
  }

  await tx.securityAudit.create({
    data: {
      action: 'DISPUTE_REASSIGNED',
      category: 'DISPUTE',
      userId: input.actorAdminId,
      userEmail: input.actorEmail,
      userRole: input.actorRole,
      entityType: 'MarketplaceDispute',
      entityId: input.disputeId,
      description: 'Marketplace financial dispute reassigned to authorized staff.',
      oldValue: JSON.stringify({ assignedTo: previousAssignee }),
      newValue: JSON.stringify({ assignedTo: target.id, assignedRole: target.role, countryCode }),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      riskLevel: 'MEDIUM',
    },
  })

  return { ok: true, status, assignedTo: target.id, assignedRole: target.role, previousAssignee }
}
