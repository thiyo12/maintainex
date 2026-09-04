import { prisma } from './prisma'
import type { AdminRole } from './admin-types'

export type AlertCategory = 'kyc' | 'dispute' | 'settlement' | 'flagged_job' | 'fraud' | 'payout' | 'system' | 'tasker_escalation'

const CATEGORY_ROLE_MAP: Record<AlertCategory, AdminRole> = {
  kyc: 'USER_MANAGEMENT',
  dispute: 'SUPPORT',
  settlement: 'FINANCE',
  flagged_job: 'MANAGER',
  fraud: 'MANAGER',
  payout: 'FINANCE',
  system: 'TECHNICAL',
  tasker_escalation: 'MANAGER',
}

const CATEGORY_SEVERITY_MAP: Record<AlertCategory, string> = {
  kyc: 'medium',
  dispute: 'high',
  settlement: 'high',
  flagged_job: 'medium',
  fraud: 'critical',
  payout: 'high',
  system: 'low',
  tasker_escalation: 'high',
}

const CATEGORY_SLA_MAP: Record<AlertCategory, number> = {
  kyc: 1440,       // 24 hours
  dispute: 2880,   // 48 hours
  settlement: 4320, // 72 hours
  flagged_job: 1440, // 24 hours
  fraud: 720,      // 12 hours
  payout: 2880,    // 48 hours
  system: 10080,   // 7 days
  tasker_escalation: 720, // 12 hours
}

export async function createWorkItem(params: {
  category: AlertCategory
  title: string
  description?: string
  targetTable?: string
  targetId?: string
  severity?: string
  priority?: string
}) {
  const role = CATEGORY_ROLE_MAP[params.category]
  const severity = params.severity || CATEGORY_SEVERITY_MAP[params.category]
  const slaMinutes = CATEGORY_SLA_MAP[params.category]

  // Find staff with this role for round-robin assignment
  const staffWithRole = await prisma.adminUser.findMany({
    where: { role, isActive: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })

  let assignedTo: string | null = null
  if (staffWithRole.length > 0) {
    // Round-robin: find staff member with fewest open alerts
    const openAlertCounts = await prisma.adminAlert.groupBy({
      by: ['assignedTo'],
      where: {
        assignedTo: { in: staffWithRole.map(s => s.id) },
        status: { in: ['open', 'in_progress'] },
      },
      _count: { id: true },
    })

    const countMap = new Map(openAlertCounts.map(a => [a.assignedTo, a._count.id]))
    const sorted = staffWithRole.sort((a, b) => (countMap.get(a.id) || 0) - (countMap.get(b.id) || 0))
    assignedTo = sorted[0].id
  }

  return prisma.adminAlert.create({
    data: {
      type: params.category,
      severity,
      title: params.title,
      description: params.description || null,
      targetTable: params.targetTable || null,
      targetId: params.targetId || null,
      assignedTo,
      assignedRole: role,
      priority: params.priority || 'medium',
      status: 'open',
      slaMinutes,
    },
  })
}

export async function reassignWorkItem(alertId: string, newAssigneeId: string) {
  return prisma.adminAlert.update({
    where: { id: alertId },
    data: { assignedTo: newAssigneeId },
  })
}

export async function getQueueForRole(role: AdminRole, staffId?: string) {
  const isManager = role === 'SUPER_ADMIN' || role === 'MANAGER'

  const where: any = { status: { in: ['open', 'in_progress'] } }

  if (!isManager) {
    // Regular staff: see alerts assigned to them OR unassigned alerts in their category
    const roleCategories = Object.entries(CATEGORY_ROLE_MAP)
      .filter(([, r]) => r === role)
      .map(([c]) => c)

    where.OR = [
      { assignedTo: staffId },
      { assignedRole: role, assignedTo: null },
    ]
  }

  return prisma.adminAlert.findMany({
    where,
    orderBy: [
      { priority: 'asc' },
      { createdAt: 'asc' },
    ],
  })
}
