import { prisma } from '@/lib/prisma'

export type CompanyAuditAction =
  | 'COMPANY_CREATE'
  | 'COMPANY_UPDATE'
  | 'OWNERSHIP_TRANSFER'
  | 'MEMBER_INVITE'
  | 'MEMBER_ACCEPT'
  | 'MEMBER_REMOVE'
  | 'MEMBER_ROLE_CHANGE'
  | 'MEMBER_SUSPEND'
  | 'MEMBER_UNSUSPEND'
  | 'SUSPENSION'
  | 'UNSUSPENSION'
  | 'KYC_SUBMIT'
  | 'KYC_APPROVE'
  | 'KYC_REJECT'
  | 'COMPANY_VERIFY'
  | 'COMPANY_REJECT'
  | 'CERTIFICATION_ADD'
  | 'CERTIFICATION_VERIFY'
  | 'CERTIFICATION_REJECT'
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_VERIFY'
  | 'QUOTE_SUBMIT'
  | 'WORKER_ASSIGN'

export interface AuditLogParams {
  companyId: string
  actorId: string
  actorRole: string
  action: CompanyAuditAction
  targetType?: string
  targetId?: string
  description?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

export async function writeCompanyAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.companyAuditLog.create({
      data: {
        companyId: params.companyId,
        actorId: params.actorId,
        actorRole: params.actorRole,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        description: params.description ?? null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress: params.ipAddress ?? null,
      },
    })
  } catch (error) {
    console.error('Failed to write company audit log:', error)
  }
}

export async function getCompanyAuditLogs(
  companyId: string,
  options?: {
    action?: CompanyAuditAction
    limit?: number
    offset?: number
  }
) {
  const where: Record<string, unknown> = { companyId }
  if (options?.action) where.action = options.action

  return prisma.companyAuditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  })
}
