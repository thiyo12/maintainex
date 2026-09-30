import { PrismaClient } from '@prisma/client'
import type { AdminSession, AuditAction } from '../admin-types'

export type SuspensionScope = 'MARKETPLACE' | 'ALL'

export interface SuspendUserInput {
  userId: string
  reason: string
  scope: SuspensionScope
  expiresAt?: Date
  session: AdminSession
  ipAddress: string
}

export interface ReactivateUserInput {
  userId: string
  reason: string
  session: AdminSession
  ipAddress: string
}

export interface BanUserInput {
  userId: string
  reason: string
  session: AdminSession
  ipAddress: string
}

export interface UnbanUserInput {
  userId: string
  reason: string
  session: AdminSession
  ipAddress: string
}

export interface SuspendCompanyInput {
  companyProfileId: string
  reason: string
  scope: SuspensionScope
  session: AdminSession
  ipAddress: string
}

export interface ReactivateCompanyInput {
  companyProfileId: string
  reason: string
  session: AdminSession
  ipAddress: string
}

export async function suspendUser(
  tx: PrismaClient,
  input: SuspendUserInput
) {
  const { userId, reason, scope, expiresAt, session, ipAddress } = input

  if (!reason || reason.trim().length < 3) {
    throw new Error('Suspension reason is required (minimum 3 characters)')
  }

  return tx.$transaction(async (db) => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, role: true,
        isSuspended: true, isBanned: true, countryCode: true,
        suspensionReason: true, suspendedUntil: true,
      },
    })

    if (!user) throw new Error('User not found')
    if (user.isSuspended) throw new Error('User is already suspended')
    if (user.isBanned) throw new Error('User is banned — use unban first')

    const oldValue = {
      isSuspended: user.isSuspended,
      suspensionReason: user.suspensionReason,
      suspendedUntil: user.suspendedUntil,
    }
    const newValue = {
      isSuspended: true,
      suspensionReason: reason,
      suspendedUntil: expiresAt ?? null,
      scope,
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: {
        isSuspended: true,
        suspensionReason: reason,
        suspendedUntil: expiresAt ?? null,
      },
      select: {
        id: true, email: true, name: true, role: true,
        isSuspended: true, isBanned: true, countryCode: true,
      },
    })

    await db.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: user.role === 'CUSTOMER' ? 'SUSPEND' as AuditAction : 'PROVIDER_SUSPEND' as AuditAction,
        targetTable: 'User',
        targetId: userId,
        targetLabel: `${user.name} (${user.email})`,
        oldValue: JSON.stringify(oldValue),
        newValue: JSON.stringify(newValue),
        ipAddress,
      },
    })

    return { success: true, userId, user: updated }
  })
}

export async function reactivateUser(
  tx: PrismaClient,
  input: ReactivateUserInput
) {
  const { userId, reason, session, ipAddress } = input

  return tx.$transaction(async (db) => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, role: true,
        isSuspended: true, isBanned: true, suspensionReason: true,
        suspendedUntil: true, countryCode: true,
      },
    })

    if (!user) throw new Error('User not found')
    if (!user.isSuspended) throw new Error('User is not suspended')

    const oldValue = {
      isSuspended: true,
      suspensionReason: user.suspensionReason,
      suspendedUntil: user.suspendedUntil,
    }
    const newValue = {
      isSuspended: false,
      suspensionReason: null,
      suspendedUntil: null,
      reason,
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: {
        isSuspended: false,
        suspensionReason: null,
        suspendedUntil: null,
      },
      select: {
        id: true, email: true, name: true, role: true,
        isSuspended: true, isBanned: true, countryCode: true,
      },
    })

    await db.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: user.role === 'CUSTOMER' ? 'UNSUSPEND' as AuditAction : 'PROVIDER_REACTIVATE' as AuditAction,
        targetTable: 'User',
        targetId: userId,
        targetLabel: `${user.name} (${user.email})`,
        oldValue: JSON.stringify(oldValue),
        newValue: JSON.stringify(newValue),
        ipAddress,
      },
    })

    return { success: true, userId, user: updated }
  })
}

export async function banUser(
  tx: PrismaClient,
  input: BanUserInput
) {
  const { userId, reason, session, ipAddress } = input

  if (!reason || reason.trim().length < 3) {
    throw new Error('Ban reason is required (minimum 3 characters)')
  }

  return tx.$transaction(async (db) => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, role: true,
        isActive: true, isSuspended: true, isBanned: true,
        banReason: true, countryCode: true,
      },
    })

    if (!user) throw new Error('User not found')
    if (user.isBanned) throw new Error('User is already banned')

    const updated = await db.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        banReason: reason,
        isActive: false,
      },
      select: {
        id: true, email: true, name: true, role: true,
        isActive: true, isSuspended: true, isBanned: true,
        countryCode: true,
      },
    })

    await db.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: 'BAN' as AuditAction,
        targetTable: 'User',
        targetId: userId,
        targetLabel: `${user.name} (${user.email})`,
        oldValue: JSON.stringify({
          isActive: user.isActive,
          isSuspended: user.isSuspended,
          isBanned: user.isBanned,
          banReason: user.banReason,
        }),
        newValue: JSON.stringify({
          isActive: false,
          isSuspended: user.isSuspended,
          isBanned: true,
          banReason: reason,
        }),
        ipAddress,
      },
    })

    return { success: true, userId, user: updated }
  })
}

export async function unbanUser(
  tx: PrismaClient,
  input: UnbanUserInput
) {
  const { userId, reason, session, ipAddress } = input

  return tx.$transaction(async (db) => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, role: true,
        isActive: true, isSuspended: true, isBanned: true,
        banReason: true, countryCode: true,
      },
    })

    if (!user) throw new Error('User not found')
    if (!user.isBanned) throw new Error('User is not banned')

    const updated = await db.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        banReason: null,
        isActive: true,
      },
      select: {
        id: true, email: true, name: true, role: true,
        isActive: true, isSuspended: true, isBanned: true,
        countryCode: true,
      },
    })

    await db.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: 'UNBAN' as AuditAction,
        targetTable: 'User',
        targetId: userId,
        targetLabel: `${user.name} (${user.email})`,
        oldValue: JSON.stringify({
          isActive: user.isActive,
          isSuspended: user.isSuspended,
          isBanned: user.isBanned,
          banReason: user.banReason,
        }),
        newValue: JSON.stringify({
          isActive: true,
          isSuspended: user.isSuspended,
          isBanned: false,
          banReason: null,
          reason,
        }),
        ipAddress,
      },
    })

    return { success: true, userId, user: updated }
  })
}

export async function suspendCompany(
  tx: PrismaClient,
  input: SuspendCompanyInput
) {
  const { companyProfileId, reason, scope, session, ipAddress } = input

  if (!reason || reason.trim().length < 3) {
    throw new Error('Suspension reason is required (minimum 3 characters)')
  }

  return tx.$transaction(async (db) => {
    const company = await db.companyProfile.findUnique({
      where: { id: companyProfileId },
      select: {
        id: true, companyName: true, userId: true,
        verificationStatus: true,
      },
    })

    if (!company) throw new Error('Company not found')
    if (company.verificationStatus === 'SUSPENDED') {
      throw new Error('Company is already suspended')
    }

    const user = await db.user.findUnique({
      where: { id: company.userId },
      select: { id: true, isSuspended: true, suspensionReason: true },
    })

    if (user?.isSuspended) throw new Error('Company owner is already suspended')

    const oldValue = { verificationStatus: company.verificationStatus }
    const ownerSuspensionReason = `Company suspended [${companyProfileId}]: ${reason}`
    const newValue = { verificationStatus: 'SUSPENDED', reason, scope }

    await db.companyProfile.update({
      where: { id: companyProfileId },
      data: { verificationStatus: 'SUSPENDED' },
    })

    if (user) {
      await db.user.update({
        where: { id: company.userId },
        data: {
          isSuspended: true,
          suspensionReason: ownerSuspensionReason,
          suspendedUntil: null,
        },
      })
    }

    await db.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: 'COMPANY_SUSPEND' as AuditAction,
        targetTable: 'CompanyProfile',
        targetId: companyProfileId,
        targetLabel: company.companyName,
        oldValue: JSON.stringify(oldValue),
        newValue: JSON.stringify(newValue),
        ipAddress,
      },
    })

    return { success: true, companyProfileId, company }
  })
}

export async function reactivateCompany(
  tx: PrismaClient,
  input: ReactivateCompanyInput
) {
  const { companyProfileId, reason, session, ipAddress } = input

  return tx.$transaction(async (db) => {
    const company = await db.companyProfile.findUnique({
      where: { id: companyProfileId },
      select: {
        id: true, companyName: true, userId: true,
        verificationStatus: true,
      },
    })

    if (!company) throw new Error('Company not found')
    if (company.verificationStatus !== 'SUSPENDED') {
      throw new Error('Company is not suspended')
    }

    const owner = company.userId
      ? await db.user.findUnique({
          where: { id: company.userId },
          select: {
            id: true,
            isSuspended: true,
            isBanned: true,
            suspensionReason: true,
          },
        })
      : null

    if (owner?.isBanned) {
      throw new Error('Company owner is banned — unban before reactivating company')
    }

    const companySuspensionPrefix = `Company suspended [${companyProfileId}]:`
    const isCompanySuspensionReason = (value: string | null) =>
      Boolean(
        value &&
        (
          value.startsWith(companySuspensionPrefix) ||
          value.startsWith('Company suspended:')
        )
      )

    if (
      owner?.isSuspended &&
      owner.suspensionReason &&
      !isCompanySuspensionReason(owner.suspensionReason)
    ) {
      throw new Error('Company owner has a separate account suspension that must be resolved independently')
    }

    const oldValue = { verificationStatus: 'SUSPENDED' }
    const newValue = { verificationStatus: 'VERIFIED', reason }

    await db.companyProfile.update({
      where: { id: companyProfileId },
      data: { verificationStatus: 'VERIFIED' },
    })

    if (owner?.isSuspended && isCompanySuspensionReason(owner.suspensionReason)) {
      await db.user.update({
        where: { id: company.userId },
        data: {
          isSuspended: false,
          suspensionReason: null,
          suspendedUntil: null,
        },
      })
    }

    await db.auditLog.create({
      data: {
        adminUserId: session.id,
        adminEmail: session.email,
        adminRole: session.role,
        action: 'COMPANY_REACTIVATE' as AuditAction,
        targetTable: 'CompanyProfile',
        targetId: companyProfileId,
        targetLabel: company.companyName,
        oldValue: JSON.stringify(oldValue),
        newValue: JSON.stringify(newValue),
        ipAddress,
      },
    })

    return { success: true, companyProfileId, company }
  })
}

export async function isUserSuspended(
  tx: PrismaClient,
  userId: string
): Promise<boolean> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { isSuspended: true },
  })
  return user?.isSuspended ?? false
}
