import { NextRequest, NextResponse } from 'next/server'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { prisma } from '@/lib/prisma'
import { canAssignRole, canManageMember, isValidCompanyRole } from '@/lib/phase6/rbac'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'

export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { companyId, memberUserId, action, role } = body

    if (!companyId || !memberUserId || !action) {
      return NextResponse.json({ error: 'companyId, memberUserId, and action are required' }, { status: 400 })
    }

    const { context, error } = await resolveCompanyContext(user.id, companyId, 'members:manage')
    if (error) return error

    const member = await prisma.teamMember.findFirst({
      where: { companyId, userId: memberUserId, status: { not: 'REMOVED' } },
    })
    if (!member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    }

    switch (action) {
      case 'change_role': {
        if (!role || !isValidCompanyRole(role)) {
          return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
        }
        if (!canAssignRole(context!.role, role as any)) {
          return NextResponse.json({ error: 'Cannot assign this role' }, { status: 403 })
        }
        if (!canManageMember(context!.role, member.role as any)) {
          return NextResponse.json({ error: 'Cannot manage this member' }, { status: 403 })
        }

        const oldRole = member.role
        await prisma.teamMember.update({
          where: { id: member.id },
          data: { role },
        })

        await writeCompanyAuditLog({
          companyId,
          actorId: user.id,
          actorRole: context!.role,
          action: 'MEMBER_ROLE_CHANGE',
          targetType: 'TeamMember',
          targetId: member.id,
          description: `Changed ${member.name} role from ${oldRole} to ${role}`,
          metadata: { oldRole, newRole: role, targetUserId: memberUserId },
        })

        return NextResponse.json({ success: true, member: { id: member.id, role } })
      }

      case 'deactivate': {
        if (!canManageMember(context!.role, member.role as any)) {
          return NextResponse.json({ error: 'Cannot manage this member' }, { status: 403 })
        }
        if (member.role === 'COMPANY_OWNER') {
          const ownerCount = await prisma.teamMember.count({
            where: { companyId, role: 'COMPANY_OWNER', status: 'ACTIVE' },
          })
          if (ownerCount <= 1) {
            return NextResponse.json({ error: 'Cannot deactivate the last company owner' }, { status: 400 })
          }
        }

        await prisma.teamMember.update({
          where: { id: member.id },
          data: { status: 'SUSPENDED' },
        })

        const activeAssignments = await prisma.companyJobAssignment.findMany({
          where: { workerUserId: memberUserId, companyId, status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] } },
        })

        for (const assignment of activeAssignments) {
          await prisma.companyJobAssignment.update({
            where: { id: assignment.id },
            data: { status: 'REVOKED', revokedAt: new Date(), revokedReason: 'Worker deactivated' },
          })
          await prisma.marketplaceJob.update({
            where: { id: assignment.jobId },
            data: { targetTaskerId: null },
          })
        }

        await writeCompanyAuditLog({
          companyId,
          actorId: user.id,
          actorRole: context!.role,
          action: 'MEMBER_SUSPEND',
          targetType: 'TeamMember',
          targetId: member.id,
          description: `Deactivated ${member.name} (${member.role})`,
          metadata: { targetUserId: memberUserId, revokedAssignments: activeAssignments.length },
        })

        return NextResponse.json({
          success: true,
          member: { id: member.id, status: 'SUSPENDED' },
          revokedAssignments: activeAssignments.length,
        })
      }

      case 'reactivate': {
        if (!canManageMember(context!.role, member.role as any)) {
          return NextResponse.json({ error: 'Cannot manage this member' }, { status: 403 })
        }

        await prisma.teamMember.update({
          where: { id: member.id },
          data: { status: 'ACTIVE' },
        })

        await writeCompanyAuditLog({
          companyId,
          actorId: user.id,
          actorRole: context!.role,
          action: 'MEMBER_UNSUSPEND',
          targetType: 'TeamMember',
          targetId: member.id,
          description: `Reactivated ${member.name} (${member.role})`,
          metadata: { targetUserId: memberUserId },
        })

        return NextResponse.json({ success: true, member: { id: member.id, status: 'ACTIVE' } })
      }

      default:
        return NextResponse.json({ error: 'Invalid action. Use: change_role, deactivate, reactivate' }, { status: 400 })
    }
  } catch (err) {
    console.error('Workforce management error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
