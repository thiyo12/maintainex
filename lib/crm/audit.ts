import { prisma } from '@/lib/prisma'

interface AuditLogParams {
  action: string
  category: string
  userId?: string
  userEmail?: string
  userRole?: string
  userProvince?: string
  entityType?: string
  entityId?: string
  entityName?: string
  description: string
  oldValue?: any
  newValue?: any
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  success?: boolean
  errorMessage?: string
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export async function createAuditLog(params: AuditLogParams) {
  try {
    await prisma.securityAudit.create({
      data: {
        action: params.action,
        category: params.category,
        userId: params.userId,
        userEmail: params.userEmail,
        userRole: params.userRole,
        userProvince: params.userProvince,
        entityType: params.entityType,
        entityId: params.entityId,
        entityName: params.entityName,
        description: params.description,
        oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
        newValue: params.newValue ? JSON.stringify(params.newValue) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        sessionId: params.sessionId,
        success: params.success ?? true,
        errorMessage: params.errorMessage,
        riskLevel: params.riskLevel ?? 'LOW',
        isSuspicious: params.riskLevel === 'HIGH' || params.riskLevel === 'CRITICAL',
      },
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
  }
}

export async function getRecentAuditLogs(limit = 50, filters?: {
  category?: string
  action?: string
  userId?: string
  riskLevel?: string
}) {
  const where: any = {}
  if (filters?.category) where.category = filters.category
  if (filters?.action) where.action = filters.action
  if (filters?.userId) where.userId = filters.userId
  if (filters?.riskLevel) where.riskLevel = filters.riskLevel

  return prisma.securityAudit.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function getSuspiciousActivity(timeframeHours = 24) {
  const since = new Date(Date.now() - timeframeHours * 60 * 60 * 1000)
  
  return prisma.securityAudit.findMany({
    where: {
      isSuspicious: true,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
  })
}