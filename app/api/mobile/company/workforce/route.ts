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
        await prisma.$transaction(async tx => {
          await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id
            FROM "CompanyProfile"
            WHERE id = ${companyId}
            FOR UPDATE
          `

          if (oldRole === 'COMPANY_OWNER' && role !== 'COMPANY_OWNER') {
            const ownerCount = await tx.teamMember.count({
              where: { companyId, role: 'COMPANY_OWNER', status: 'ACTIVE' },
            })
            if (ownerCount <= 1) throw new Error('LAST_COMPANY_OWNER')
          }

          await tx.teamMember.update({
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
          }, tx)
        })

        return NextResponse.json({ success: true, member: { id: member.id, role } })
      }

      case 'deactivate': {
        if (!canManageMember(context!.role, member.role as any)) {
          return NextResponse.json({ error: 'Cannot manage this member' }, { status: 403 })
        }
        const revokedAssignments = await prisma.$transaction(async tx => {
          await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id
            FROM "CompanyProfile"
            WHERE id = ${companyId}
            FOR UPDATE
          `

          if (member.role === 'COMPANY_OWNER') {
            const ownerCount = await tx.teamMember.count({
              where: { companyId, role: 'COMPANY_OWNER', status: 'ACTIVE' },
            })
            if (ownerCount <= 1) throw new Error('LAST_COMPANY_OWNER')
          }

          const activeAssignments = await tx.companyJobAssignment.findMany({
            where: {
              workerUserId: memberUserId,
              companyId,
              status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
            },
            select: { id: true, jobId: true, status: true },
          })

          if (activeAssignments.some(assignment => assignment.status === 'IN_PROGRESS')) {
            throw new Error('WORKER_HAS_IN_PROGRESS_JOB')
          }

          await tx.teamMember.update({
            where: { id: member.id },
            data: { status: 'SUSPENDED' },
          })

          const revocableIds = activeAssignments.map(assignment => assignment.id)
          const jobIds = activeAssignments.map(assignment => assignment.jobId)
          if (revocableIds.length > 0) {
            await tx.companyJobAssignment.updateMany({
              where: { id: { in: revocableIds }, status: { in: ['ASSIGNED', 'ACCEPTED'] } },
              data: { status: 'REVOKED', revokedAt: new Date(), revokedReason: 'Worker deactivated' },
            })
            await tx.marketplaceJob.updateMany({
              where: { id: { in: jobIds }, targetTaskerId: memberUserId, status: 'QUOTE_ACCEPTED' },
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
            metadata: { targetUserId: memberUserId, revokedAssignments: revocableIds.length },
          }, tx)

          return revocableIds.length
        })

        return NextResponse.json({
          success: true,
          member: { id: member.id, status: 'SUSPENDED' },
          revokedAssignments,
        })
      }

      case 'reactivate': {
        if (!canManageMember(context!.role, member.role as any)) {
          return NextResponse.json({ error: 'Cannot manage this member' }, { status: 403 })
        }

        const targetUser = await prisma.user.findUnique({
          where: { id: memberUserId },
          select: { isActive: true, isSuspended: true, isBanned: true },
        })
        if (!targetUser || !targetUser.isActive || targetUser.isSuspended || targetUser.isBanned) {
          return NextResponse.json(
            { error: 'Cannot reactivate membership while the user account is inactive, suspended, or banned' },
            { status: 409 }
          )
        }

        await prisma.$transaction(async tx => {
          await tx.teamMember.update({
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
          }, tx)
        })

        return NextResponse.json({ success: true, member: { id: member.id, status: 'ACTIVE' } })
      }

      default:
        return NextResponse.json({ error: 'Invalid action. Use: change_role, deactivate, reactivate' }, { status: 400 })
    }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'LAST_COMPANY_OWNER') {
        return NextResponse.json({ error: 'Cannot remove or demote the last active company owner' }, { status: 409 })
      }
      if (err.message === 'WORKER_HAS_IN_PROGRESS_JOB') {
        return NextResponse.json(
          { error: 'Cannot deactivate a worker while they have an in-progress job. Resolve the job first.' },
          { status: 409 }
        )
      }
    }
    console.error('Workforce management error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
