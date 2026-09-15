import { PrismaClient } from '@prisma/client'
import type { AdminSession, AuditAction } from '../admin-types'

export interface ReviewCredentialInput {
  credentialId: string
  status: 'VERIFIED' | 'REJECTED' | 'EXPIRED'
  reason?: string
  session: AdminSession
  ipAddress: string
}

export async function reviewCredential(
  tx: PrismaClient,
  input: ReviewCredentialInput
) {
  const { credentialId, status, reason, session, ipAddress } = input

  if (status === 'REJECTED' && (!reason || reason.trim().length < 3)) {
    throw new Error('Rejection reason is required (minimum 3 characters)')
  }

  const credential = await tx.certification.findUnique({
    where: { id: credentialId },
    select: {
      id: true, name: true, verificationStatus: true,
      holderType: true, holderId: true, certificationType: true,
    },
  })

  if (!credential) throw new Error('Credential not found')

  const terminalStates = ['VERIFIED', 'REJECTED', 'EXPIRED']
  if (terminalStates.includes(credential.verificationStatus)) {
    throw new Error(`Credential already in terminal state: ${credential.verificationStatus}`)
  }

  const oldValue = { verificationStatus: credential.verificationStatus }
  const newValue = { verificationStatus: status, reason: reason ?? null }

  const updateResult = await tx.certification.updateMany({
    where: { id: credentialId, verificationStatus: credential.verificationStatus },
    data: {
      verificationStatus: status,
      verificationNote: reason ?? null,
      verifiedBy: session.id,
      verifiedAt: new Date(),
    },
  })

  if (updateResult.count === 0) {
    throw new Error('Concurrent credential decision detected — another admin already acted on this credential.')
  }

  const actionMap: Record<string, AuditAction> = {
    VERIFIED: 'CREDENTIAL_APPROVE',
    REJECTED: 'CREDENTIAL_REJECT',
    EXPIRED: 'CREDENTIAL_EXPIRE',
  }

  await tx.auditLog.create({
    data: {
      adminUserId: session.id,
      adminEmail: session.email,
      adminRole: session.role,
      action: actionMap[status] || 'UPDATE',
      targetTable: 'Certification',
      targetId: credentialId,
      targetLabel: `${credential.name} (${credential.certificationType})`,
      oldValue: JSON.stringify(oldValue),
      newValue: JSON.stringify(newValue),
      ipAddress,
    },
  })

  return { success: true, credentialId, credential, newStatus: status }
}

export async function expireCredentialsByHolder(
  tx: PrismaClient,
  holderType: string,
  holderId: string,
  session: AdminSession,
  ipAddress: string
) {
  const expired = await tx.certification.updateMany({
    where: {
      holderType,
      holderId,
      verificationStatus: 'VERIFIED',
      expiryDate: { lt: new Date() },
    },
    data: {
      verificationStatus: 'EXPIRED',
      verificationNote: 'Automatically expired by system',
    },
  })

  if (expired.count > 0) {
    await tx.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: 'CREDENTIAL_EXPIRE' as AuditAction,
        targetTable: 'Certification',
        targetId: holderId,
        targetLabel: `Bulk expire: ${expired.count} credentials for ${holderType}`,
        newValue: JSON.stringify({ count: expired.count, holderType, holderId }),
        ipAddress,
      },
    })
  }

  return { expiredCount: expired.count }
}
