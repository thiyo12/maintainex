import { PrismaClient } from '@prisma/client'
import { isValidKycTransition, isValidCompanyVerificationTransition, KycStatus, CompanyVerificationStatus } from './kyc'

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

function mapKycActionToCompanyStatus(action: KycAction): CompanyVerificationStatus | null {
  const map: Partial<Record<KycAction, CompanyVerificationStatus>> = {
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
  prisma: PrismaClient,
  params: {
    userId: string
    action: KycAction
    documentId?: string
    reviewNote?: string
    reviewedBy?: string
  }
): Promise<KycTransitionResult> {
  const { userId, action, documentId, reviewNote, reviewedBy } = params

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { identityStatus: true },
  })
  if (!user) return { success: false, error: 'User not found' }

  const currentStatus = (user.identityStatus || 'NOT_SUBMITTED') as KycStatus
  const targetStatus = mapKycActionToStatus(action)

  if (!isValidKycTransition(currentStatus, targetStatus)) {
    return { success: false, error: `Invalid KYC transition: ${currentStatus} → ${targetStatus}` }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { identityStatus: targetStatus },
    })

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

    const userFull = await tx.user.findUnique({
      where: { id: userId },
      include: { taskerProfile: true, companyProfile: true },
    })

    if (userFull?.taskerProfile) {
      const profileStatus = targetStatus === 'VERIFIED' ? 'VERIFIED' : targetStatus === 'REJECTED' ? 'REJECTED' : undefined
      if (profileStatus) {
        await tx.taskerProfile.update({
          where: { id: userFull.taskerProfile.id },
          data: {
            verificationStatus: profileStatus,
            verificationNote: reviewNote || (action === 'APPROVE' ? 'Documents verified' : undefined),
            ...(action === 'APPROVE' ? { verifiedAt: new Date(), isVerified: true } : {}),
          },
        })
      }
    }

    if (userFull?.companyProfile) {
      const companyTarget = mapKycActionToCompanyStatus(action)
      if (companyTarget) {
        const currentCompanyStatus = (userFull.companyProfile.verificationStatus || 'UNVERIFIED') as CompanyVerificationStatus
        if (isValidCompanyVerificationTransition(currentCompanyStatus, companyTarget)) {
          await tx.companyProfile.update({
            where: { id: userFull.companyProfile.id },
            data: {
              verificationStatus: companyTarget,
              verificationNote: reviewNote || (action === 'APPROVE' ? 'Documents verified' : undefined),
              ...(action === 'APPROVE' ? { verifiedAt: new Date(), isVerified: true } : {}),
            },
          })
        }
      }
    }
  })

  return { success: true }
}
