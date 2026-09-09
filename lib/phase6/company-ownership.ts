import { prisma } from '@/lib/prisma'
import { CompanyRole } from './rbac'
import { writeCompanyAuditLog } from './audit'

export async function getCompanyOwnerCount(companyId: string): Promise<number> {
  const count = await prisma.teamMember.count({
    where: {
      companyId,
      role: 'COMPANY_OWNER',
      status: 'ACTIVE',
    },
  })
  return count
}

export async function hasActiveOwner(companyId: string): Promise<boolean> {
  const count = await getCompanyOwnerCount(companyId)
  return count > 0
}

export async function isLastOwner(companyId: string, userId: string): Promise<boolean> {
  const ownerCount = await getCompanyOwnerCount(companyId)
  if (ownerCount > 1) return false
  const member = await prisma.teamMember.findFirst({
    where: {
      companyId,
      userId,
      role: 'COMPANY_OWNER',
      status: 'ACTIVE',
    },
  })
  return member !== null
}

export async function canRemoveMemberSafe(
  companyId: string,
  actorUserId: string,
  targetUserId: string,
  actorRole: CompanyRole
): Promise<{ allowed: boolean; reason?: string }> {
  const actorMembership = await prisma.teamMember.findFirst({
    where: { companyId, userId: actorUserId, status: 'ACTIVE' },
  })
  if (!actorMembership) {
    return { allowed: false, reason: 'Not a member of this company' }
  }

  if (actorRole !== 'COMPANY_OWNER' && actorRole !== 'MANAGER') {
    return { allowed: false, reason: 'Insufficient permissions' }
  }

  if (actorUserId === targetUserId) {
    const lastOwner = await isLastOwner(companyId, targetUserId)
    if (lastOwner) {
      return { allowed: false, reason: 'Cannot remove yourself as the last owner' }
    }
  }

  const targetMember = await prisma.teamMember.findFirst({
    where: { companyId, userId: targetUserId, status: 'ACTIVE' },
  })
  if (!targetMember) {
    return { allowed: false, reason: 'Member not found' }
  }

  if (targetMember.role === 'COMPANY_OWNER' && actorRole !== 'COMPANY_OWNER') {
    return { allowed: false, reason: 'Only owners can remove other owners' }
  }

  if (targetMember.role === 'COMPANY_OWNER') {
    const lastOwner = await isLastOwner(companyId, targetUserId)
    if (lastOwner) {
      return { allowed: false, reason: 'Cannot remove the last owner. Transfer ownership first.' }
    }
  }

  return { allowed: true }
}

export async function transferOwnership(
  companyId: string,
  currentOwnerId: string,
  newOwnerId: string,
  demoteToRole: CompanyRole = 'MANAGER'
): Promise<{ success: boolean; error?: string }> {
  if (demoteToRole === 'COMPANY_OWNER') {
    return { success: false, error: 'Demote role cannot be COMPANY_OWNER' }
  }

  const currentOwnerMembership = await prisma.teamMember.findFirst({
    where: { companyId, userId: currentOwnerId, role: 'COMPANY_OWNER', status: 'ACTIVE' },
  })
  if (!currentOwnerMembership) {
    return { success: false, error: 'Current owner must be an active COMPANY_OWNER' }
  }

  const newOwnerMembership = await prisma.teamMember.findFirst({
    where: { companyId, userId: newOwnerId, status: 'ACTIVE' },
  })
  if (!newOwnerMembership) {
    return { success: false, error: 'New owner must be an active team member' }
  }

  if (newOwnerId === currentOwnerId) {
    return { success: false, error: 'Cannot transfer ownership to yourself' }
  }

  const originalRole = newOwnerMembership.role as CompanyRole

  try {
    await prisma.$transaction(async (tx) => {
      const promoted = await tx.$executeRaw`
        UPDATE "TeamMember"
        SET "role" = 'COMPANY_OWNER', "updatedAt" = NOW()
        WHERE "id" = ${newOwnerMembership.id}
          AND "companyId" = ${companyId}
          AND "status" = 'ACTIVE'
          AND "role" != 'COMPANY_OWNER'
      `

      if (promoted === 0) {
        throw new Error('TRANSFER_CONCURRENT')
      }

      const demoted = await tx.$executeRaw`
        UPDATE "TeamMember"
        SET "role" = ${demoteToRole}, "updatedAt" = NOW()
        WHERE "id" = ${currentOwnerMembership.id}
          AND "companyId" = ${companyId}
          AND "status" = 'ACTIVE'
          AND "role" = 'COMPANY_OWNER'
      `

      if (demoted === 0) {
        throw new Error('TRANSFER_CONCURRENT')
      }

      await writeCompanyAuditLog({
        companyId,
        actorId: currentOwnerId,
        actorRole: 'COMPANY_OWNER',
        action: 'OWNERSHIP_TRANSFER',
        targetType: 'TeamMember',
        targetId: newOwnerId,
        description: `Ownership transferred from ${currentOwnerId} to ${newOwnerId}`,
        metadata: { previousRole: originalRole, demotedTo: demoteToRole },
      }, tx)
    })
  } catch (err: any) {
    if (err?.message === 'TRANSFER_CONCURRENT') {
      return { success: false, error: 'Concurrent transfer detected' }
    }
    throw err
  }

  return { success: true }
}

export async function getCompanyMembers(companyId: string) {
  return prisma.teamMember.findMany({
    where: { companyId, status: { not: 'REMOVED' } },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true, identityStatus: true, isSuspended: true, isBanned: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })
}

export async function isUserCompanyMember(companyId: string, userId: string): Promise<boolean> {
  const count = await prisma.teamMember.count({
    where: { companyId, userId, status: 'ACTIVE' },
  })
  return count > 0
}

export async function getUserCompanyRole(companyId: string, userId: string): Promise<CompanyRole | null> {
  const member = await prisma.teamMember.findFirst({
    where: { companyId, userId, status: 'ACTIVE' },
    select: { role: true },
  })
  return (member?.role as CompanyRole) ?? null
}
