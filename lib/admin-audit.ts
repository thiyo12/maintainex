import { prisma } from './prisma'
import type { AdminSession } from './admin-types'

export async function writeAuditLog(params: {
  session: AdminSession
  action: string
  targetTable?: string
  targetId?: string
  targetLabel?: string
  oldValue?: unknown
  newValue?: unknown
  ipAddress: string
  userAgent?: string | null
}) {
  try {
    await prisma.auditLog.create({
      data: {
        adminUserId: params.session.id,
        adminEmail: params.session.email,
        adminRole: params.session.role,
        action: params.action,
        targetTable: params.targetTable || null,
        targetId: params.targetId || null,
        targetLabel: params.targetLabel || null,
        oldValue: params.oldValue != null ? JSON.stringify(params.oldValue) : null,
        newValue: params.newValue != null ? JSON.stringify(params.newValue) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    })
  } catch (e) {
    console.error('Audit log error:', e)
  }
}

export async function createAlert(params: {
  type: string
  severity: string
  title: string
  description?: string
  targetTable?: string
  targetId?: string
  assignedTo?: string
  slaMinutes?: number
}) {
  try {
    await prisma.adminAlert.create({ data: params })
  } catch (e) {
    console.error('Alert creation error:', e)
  }
}
