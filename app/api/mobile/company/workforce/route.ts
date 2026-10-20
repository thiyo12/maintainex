import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { prisma, type PrismaClientOrTx } from '@/lib/prisma'
import { canAssignRole, canManageMember, hasCompanyPermission, isValidCompanyRole } from '@/lib/phase6/rbac'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'

/** Recheck the actor's live account and role under the same transaction that
 * modifies workforce. Caller holds the company row lock before invoking. */
async function assertCurrentWorkforceManager(
  tx: PrismaClientOrTx, companyId: string, actorUserId: string, actorRole: string,
): Promise<void> {
  const accounts = await tx.$queryRaw<Array<{
    isActive: boolean; isSuspended: boolean; isBanned: boolean
  }>>`
    SELECT "isActive", "isSuspended", "isBanned"
    FROM "User" WHERE id = ${actorUserId} FOR UPDATE
  `
  if (accounts.length !== 1 || !accounts[0].isActive ||
      accounts[0].isSuspended || accounts[0].isBanned) {
    throw new Error('WORKFORCE_ACTOR_NO_LONGER_AUTHORIZED')
  }
  const members = await tx.$queryRaw<Array<{ role: string; status: string }>>`
    SELECT role, status FROM "TeamMember"
    WHERE "companyId" = ${companyId} AND "userId" = ${actorUserId}
    FOR UPDATE
  `
  if (members.length !== 1 || members[0].status !== 'ACTIVE' ||
      members[0].role !== actorRole || !isValidCompanyRole(members[0].role) ||
      !hasCompanyPermission(members[0].role, 'members:manage')) {
    throw new Error('WORKFORCE_ACTOR_NO_LONGER_AUTHORIZED')
  }
}

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

          await assertCurrentWorkforceManager(tx, companyId, user.id, context!.role)

          // Serialize role transitions with dispatch, which locks the same
          // membership row before writing a worker assignment. Otherwise a
          // WORKER could become FINANCE after the dispatch preflight passed.
          await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "TeamMember" WHERE id = ${member.id} FOR UPDATE
          `
          const lockedMember = await tx.teamMember.findUnique({
            where: { id: member.id },
            select: { role: true, status: true },
          })
          if (!lockedMember || lockedMember.role !== oldRole || lockedMember.status === 'REMOVED') {
            throw new Error('MEMBER_ROLE_CHANGED')
          }

          if (oldRole === 'WORKER' && role !== 'WORKER') {
            const activeAssignments = await tx.companyJobAssignment.count({
              where: {
                companyId,
                workerUserId: memberUserId,
                status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'CREW_RESERVED', 'CREW_ACCEPTED'] },
              },
            })
            if (activeAssignments > 0) throw new Error('WORKER_HAS_ACTIVE_ASSIGNMENT')
          }

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

          await assertCurrentWorkforceManager(tx, companyId, user.id, context!.role)

          // Dispatch locks this same TeamMember row before writing an
          // assignment. Hold it until the assignment lookup and revocation
          // finish, or a competing dispatch can escape the suspension.
          await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "TeamMember" WHERE id = ${member.id} FOR UPDATE
          `
          const lockedMember = await tx.teamMember.findUnique({
            where: { id: member.id },
            select: { role: true, status: true },
          })
          if (
            !lockedMember ||
            lockedMember.role !== member.role ||
            lockedMember.status !== 'ACTIVE'
          ) {
            throw new Error('MEMBER_STATUS_CHANGED')
          }

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
              status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'CREW_RESERVED', 'CREW_ACCEPTED'] },
            },
            select: { id: true, jobId: true, status: true },
          })

          if (activeAssignments.some(assignment => assignment.status === 'IN_PROGRESS')) {
            throw new Error('WORKER_HAS_IN_PROGRESS_JOB')
          }
          // A forming crew is an indivisible capacity reservation. Revoking
          // just this worker would leave the other reservations stranded while
          // the crew still appears FORMING. Cancel the whole crew through the
          // versioned, audited roster transaction before changing membership.
          if (activeAssignments.some(assignment =>
            assignment.status === 'CREW_RESERVED' || assignment.status === 'CREW_ACCEPTED')) {
            throw new Error('WORKER_HAS_STAGED_CREW')
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
          await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "CompanyProfile" WHERE id = ${companyId} FOR UPDATE
          `
          await assertCurrentWorkforceManager(tx, companyId, user.id, context!.role)

          // The global account and membership may change after the HTTP
          // preflight. Lock them in dispatch order (User -> TeamMember) and
          // revalidate before restoring a worker's privileges.
          const accounts = await tx.$queryRaw<Array<{
            isActive: boolean; isSuspended: boolean; isBanned: boolean
          }>>`
            SELECT "isActive", "isSuspended", "isBanned"
            FROM "User" WHERE id = ${memberUserId} FOR UPDATE
          `
          const account = accounts[0]
          if (!account || !account.isActive || account.isSuspended || account.isBanned) {
            throw new Error('MEMBER_REACTIVATION_BLOCKED')
          }

          await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "TeamMember" WHERE id = ${member.id} FOR UPDATE
          `
          const lockedMember = await tx.teamMember.findUnique({
            where: { id: member.id },
            select: { role: true, status: true },
          })
          if (
            !lockedMember ||
            lockedMember.role !== member.role ||
            lockedMember.status !== member.status ||
            lockedMember.status === 'REMOVED'
          ) {
            throw new Error('MEMBER_STATUS_CHANGED')
          }

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
      if (err.message === 'WORKFORCE_ACTOR_NO_LONGER_AUTHORIZED') {
        return NextResponse.json({ error: 'Workforce manager is no longer authorized' }, { status: 403 })
      }
      if (err.message === 'LAST_COMPANY_OWNER') {
        return NextResponse.json({ error: 'Cannot remove or demote the last active company owner' }, { status: 409 })
      }
      if (err.message === 'WORKER_HAS_ACTIVE_ASSIGNMENT') {
        return NextResponse.json(
          { error: 'Reassign or finish the worker\'s active jobs before changing their role.' },
          { status: 409 }
        )
      }
      if (err.message === 'MEMBER_REACTIVATION_BLOCKED') {
        return NextResponse.json({
          error: 'Cannot reactivate membership while the user account is inactive, suspended, or banned',
        }, { status: 409 })
      }
      if (err.message === 'MEMBER_STATUS_CHANGED') {
        return NextResponse.json(
          { error: 'Member status changed concurrently; retry the request' },
          { status: 409 }
        )
      }
      if (err.message === 'MEMBER_ROLE_CHANGED') {
        return NextResponse.json({ error: 'Member role changed concurrently; retry the request' }, { status: 409 })
      }
      if (err.message === 'WORKER_HAS_STAGED_CREW') {
        return NextResponse.json(
          { error: 'Cancel the whole forming crew before deactivating its worker.' },
          { status: 409 },
        )
      }
      if (err.message === 'WORKER_HAS_IN_PROGRESS_JOB') {
        return NextResponse.json(
          { error: 'Cannot deactivate a worker while they have an in-progress job. Resolve the job first.' },
          { status: 409 }
        )
      }
    }
    secureConsole.error('Workforce management error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
