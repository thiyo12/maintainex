import { PrismaClient } from '@prisma/client'
import { isValidKycTransition, isValidCompanyVerificationTransition, KycStatus, CompanyVerificationStatus } from './kyc'
import { writeCompanyAuditLog } from './audit'

export type KycAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'SUSPEND' | 'EXPIRE'

const KYC_ACTION_MAP: Record<KycAction, { from: KycStatus[]; to: KycStatus }> = {
  SUBMIT: { from: ['NOT_SUBMITTED', 'REJECTED', 'EXPIRED', 'SUSPENDED'], to: 'PENDING' },
  APPROVE: { from: ['PENDING'], to: 'VERIFIED' },
  REJECT: { from: ['PENDING'], to: 'REJECTED' },
  SUSPEND: { from: ['VERIFIED'], to: 'SUSPENDED' },
  EXPIRE: { from: ['VERIFIED'], to: 'EXPIRED' },
}

function mapKycActionToStatus(action: KycAction): KycStatus {
  return KYC_ACTION_MAP[action].to
}

function mapKycActionToTaskerProfileStatus(action: KycAction): string | null {
  const map: Partial<Record<KycAction, string>> = {
    SUBMIT: 'PENDING',
    APPROVE: 'VERIFIED',
    REJECT: 'REJECTED',
    SUSPEND: 'SUSPENDED',
  }
  return map[action] ?? null
}

export interface KycTransitionResult {
  success: boolean
  error?: string
}

export async function transitionUserKyc(
  client: PrismaClient,
  params: {
    userId: string
    action: KycAction
    documentId?: string
    reviewNote?: string
    reviewedBy?: string
  }
): Promise<KycTransitionResult> {
  const { userId, action, documentId, reviewNote, reviewedBy } = params

  const user = await client.user.findUnique({
    where: { id: userId },
    select: { identityStatus: true },
  })
  if (!user) return { success: false, error: 'User not found' }

  const currentStatus = (user.identityStatus || 'NOT_SUBMITTED') as KycStatus
  const targetStatus = mapKycActionToStatus(action)

  if (!isValidKycTransition(currentStatus, targetStatus)) {
    return { success: false, error: `Invalid KYC transition: ${currentStatus} → ${targetStatus}` }
  }

  const userFull = await client.user.findUnique({
    where: { id: userId },
    include: { taskerProfile: true },
  })

  if (userFull?.taskerProfile) {
    const profileTarget = targetStatus === 'VERIFIED' ? 'VERIFIED' : targetStatus === 'REJECTED' ? 'REJECTED' : targetStatus === 'PENDING' ? 'PENDING' : null
    if (profileTarget) {
      const currentProfileStatus = (userFull.taskerProfile.verificationStatus || 'NOT_SUBMITTED') as any
      const validProfileTransitions: Record<string, string[]> = {
        NOT_SUBMITTED: ['PENDING'],
        PENDING: ['VERIFIED', 'REJECTED'],
        VERIFIED: ['SUSPENDED'],
        REJECTED: ['PENDING'],
        SUSPENDED: ['PENDING'],
      }
      if (!validProfileTransitions[currentProfileStatus]?.includes(profileTarget)) {
        return { success: false, error: `Invalid provider verification transition: ${currentProfileStatus} → ${profileTarget}` }
      }
    }
  }

  try {
    await client.$transaction(async (tx) => {
      const updated = await tx.$executeRawUnsafe(
        `UPDATE "User" SET "identityStatus" = $1, "updatedAt" = NOW() WHERE "id" = $2 AND "identityStatus" = $3`,
        targetStatus,
        userId,
        currentStatus,
      )

      if (updated === 0) {
        throw new Error('KYC_STATUS_CHANGED_BY_ANOTHER_REQUEST')
      }

      if (documentId) {
        const docStatus = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : action === 'SUBMIT' ? 'PENDING' : undefined
        if (docStatus) {
          await tx.identityDocument.update({
            where: { id: documentId },
            data: {
              status: docStatus,
              ...(reviewNote ? { reviewNote } : {}),
              ...(reviewedBy ? { reviewedBy } : {}),
              ...(docStatus !== 'PENDING' ? { reviewedAt: new Date() } : {}),
            },
          })
        }
      }

      if (userFull?.taskerProfile) {
        const taskerStatus = mapKycActionToTaskerProfileStatus(action)
        if (taskerStatus) {
          await tx.taskerProfile.update({
            where: { id: userFull.taskerProfile.id },
            data: {
              verificationStatus: taskerStatus,
              verificationNote: reviewNote || (action === 'APPROVE' ? 'Documents verified' : undefined),
              ...(action === 'APPROVE' ? { verifiedAt: new Date(), isVerified: true } : { isVerified: false }),
            },
          })
        }
      }
    })
  } catch (err: any) {
    if (err?.message === 'KYC_STATUS_CHANGED_BY_ANOTHER_REQUEST') {
      return { success: false, error: 'KYC status changed by another request' }
    }
    throw err
  }

  return { success: true }
}

export type CompanyVerifyAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'SUSPEND'

export interface CompanyVerifyTransitionResult {
  success: boolean
  error?: string
}

export async function transitionCompanyVerification(
  client: PrismaClient,
  params: {
    companyId: string
    action: CompanyVerifyAction
    reviewNote?: string
    reviewedBy?: string
    actorId: string
    actorRole: string
  }
): Promise<CompanyVerifyTransitionResult> {
  const { companyId, action, reviewNote, reviewedBy, actorId, actorRole } = params

  const company = await client.companyProfile.findUnique({
    where: { id: companyId },
    select: { id: true, verificationStatus: true },
  })
  if (!company) return { success: false, error: 'Company not found' }

  const currentStatus = (company.verificationStatus || 'UNVERIFIED') as CompanyVerificationStatus

  const actionTargetMap: Record<CompanyVerifyAction, CompanyVerificationStatus> = {
    SUBMIT: 'PENDING',
    APPROVE: 'VERIFIED',
    REJECT: 'REJECTED',
    SUSPEND: 'SUSPENDED',
  }
  const targetStatus = actionTargetMap[action]

  if (!isValidCompanyVerificationTransition(currentStatus, targetStatus)) {
    return { success: false, error: `Invalid company verification transition: ${currentStatus} → ${targetStatus}` }
  }

  try {
    await client.$transaction(async (tx) => {
      const updated = await tx.$executeRawUnsafe(
        `UPDATE "CompanyProfile" SET "verificationStatus" = $1, "updatedAt" = NOW() WHERE "id" = $2 AND "verificationStatus" = $3`,
        targetStatus,
        companyId,
        currentStatus,
      )

      if (updated === 0) {
        throw new Error('COMPANY_STATUS_CHANGED_BY_ANOTHER_REQUEST')
      }

      const updateData: Record<string, unknown> = {
        verificationStatus: targetStatus,
        isVerified: action === 'APPROVE',
      }
      if (reviewNote) updateData.verificationNote = reviewNote
      if (action === 'APPROVE') {
        updateData.verifiedAt = new Date()
      }
      if (action !== 'SUBMIT' && reviewedBy) {
        updateData.verifiedBy = reviewedBy
      }

      await tx.companyProfile.update({
        where: { id: companyId },
        data: updateData,
      })

      const auditAction = action === 'APPROVE' ? 'COMPANY_VERIFY' : action === 'REJECT' ? 'COMPANY_REJECT' : 'COMPANY_UPDATE'
      await writeCompanyAuditLog({
        companyId,
        actorId,
        actorRole,
        action: auditAction,
        targetType: 'CompanyProfile',
        targetId: companyId,
        description: `Company verification ${action.toLowerCase()}ed`,
        metadata: { previousStatus: currentStatus, newStatus: targetStatus },
      }, tx)
    })
  } catch (err: any) {
    if (err?.message === 'COMPANY_STATUS_CHANGED_BY_ANOTHER_REQUEST') {
      return { success: false, error: 'Company verification status changed by another request' }
    }
    throw err
  }

  return { success: true }
}
