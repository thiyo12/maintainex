import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { safeParseJsonArr } from '@/lib/db-utils'
import { hasCompanyPermission, isValidCompanyRole } from '@/lib/phase6/rbac'
import { writeCompanyAuditLog } from '@/lib/phase6/audit'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { Prisma } from '@prisma/client'
import { blockWorkerFormingCrewsInsideTransaction } from '@/lib/domain/company-crew-workforce'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json().catch(() => ({}))
    const companyId = body.companyId || (await prisma.teamMember.findUnique({ where: { id }, select: { companyId: true } }))?.companyId

    const { context, error } = await resolveCompanyContext(user.id, companyId, 'members:remove')
    if (error) return error

    const member = await prisma.teamMember.findFirst({
      where: { id, companyId: context!.companyId, status: { not: 'REMOVED' } },
    })
    if (!member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    }

    // The initial context and member reads are for a useful 403/404 only.
    // Recheck every authorization and lifecycle invariant under row locks
    // before the write. Dispatch, workforce transitions and transfer also
    // lock TeamMember rows; an unlocked preflight is not authorization.
    const result = await prisma.$transaction(async tx => {
      const companies = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "CompanyProfile"
        WHERE id = ${context!.companyId} FOR UPDATE
      `
      if (companies.length !== 1) {
        return { status: 409, error: 'Company no longer exists' }
      }

      // Lock the global account before the memberships (dispatch order).
      const actors = await tx.$queryRaw<Array<{
        isActive: boolean; isSuspended: boolean; isBanned: boolean
      }>>`
        SELECT "isActive", "isSuspended", "isBanned"
        FROM "User" WHERE id = ${user.id} FOR UPDATE
      `
      if (
        actors.length !== 1 || !actors[0].isActive ||
        actors[0].isSuspended || actors[0].isBanned
      ) {
        return { status: 403, error: 'Actor account is restricted' }
      }

      // Stable ordering and the company-level lock serialize simultaneous
      // owner removals. Lock all current members to serialize with ownership
      // transfers and worker dispatch, which touch individual member rows.
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "TeamMember"
        WHERE "companyId" = ${context!.companyId}
        ORDER BY id FOR UPDATE
      `
      const actorMembership = await tx.teamMember.findFirst({
        where: { companyId: context!.companyId, userId: user.id, status: 'ACTIVE' },
        select: { role: true },
      })
      if (
        !actorMembership || actorMembership.role !== context!.role ||
        !isValidCompanyRole(actorMembership.role) ||
        !hasCompanyPermission(actorMembership.role, 'members:remove')
      ) {
        return { status: 403, error: 'Insufficient permissions' }
      }

      const target = await tx.teamMember.findUnique({
        where: { id },
        select: {
          companyId: true, userId: true, status: true,
          role: true, name: true,
        },
      })
      if (
        !target || target.companyId !== context!.companyId ||
        target.status !== member.status || target.role !== member.role ||
        target.userId !== member.userId || target.status === 'REMOVED'
      ) {
        return { status: 409, error: 'Team member changed concurrently' }
      }
      if (!target.userId) {
        return { status: 409, error: 'Member has no linked account' }
      }

      if (target.role === 'COMPANY_OWNER') {
        const ownerCount = await tx.teamMember.count({
          where: {
            companyId: context!.companyId,
            role: 'COMPANY_OWNER',
            status: 'ACTIVE',
          },
        })
        if (ownerCount <= 1) {
          return { status: 409, error: 'Cannot remove the last owner. Transfer ownership first.' }
        }
      }

      // Never orphan a worker's accepted, in-progress or staged crew booking. Operators
      // must deactivate/reassign pre-start work or complete active work first.
      const assignments = await tx.companyJobAssignment.count({
        where: {
          companyId: context!.companyId,
          workerUserId: target.userId,
          status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'CREW_RESERVED', 'CREW_ACCEPTED'] },
        },
      })
      if (assignments > 0) {
        return { status: 409, error: 'Member has an active job. Complete or reassign it before removal.' }
      }

      // Stage-only holds do not justify leaving coworkers orphaned. Revoke
      // the entire FORMING roster in this same transaction as removal.
      const crewInvalidation = await blockWorkerFormingCrewsInsideTransaction(tx, {
        companyId: context!.companyId, workerUserId: target.userId,
        actorUserId: user.id, actorRole: actorMembership.role, reason: 'REMOVED',
      })

      const removed = await tx.teamMember.updateMany({
        where: {
          id, companyId: context!.companyId,
          role: target.role, status: target.status,
        },
        data: { status: 'REMOVED' },
      })
      if (removed.count !== 1) {
        return { status: 409, error: 'Team member changed concurrently' }
      }

      // Commit the audit alongside the mutation, not as a best-effort
      // operation after it; the two must not disagree.
      await writeCompanyAuditLog({
        companyId: context!.companyId,
        actorId: user.id,
        actorRole: actorMembership.role,
        action: 'MEMBER_REMOVE',
        targetType: 'TeamMember',
        targetId: id,
        description: `Removed ${target.name} (${target.role}) from company`,
        metadata: {
          removedUserId: target.userId, removedRole: target.role,
          blockedCrews: crewInvalidation.blockedCrewsCount,
          revokedCrewSlots: crewInvalidation.revokedCrewSlotsCount,
        },
      }, tx)

      return { success: true } as const
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && (error.message === 'CREW_WORKFORCE_STATE_CONFLICT' ||
        (error as Error & { code?: string }).code === 'P2034')) {
      return NextResponse.json({ error: 'Crew changed concurrently or has arrival/work evidence; retry or resolve roster first' }, { status: 409 })
    }
    secureConsole.error('Team member delete error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const member = await prisma.teamMember.findUnique({
      where: { id },
      select: { companyId: true },
    })
    if (!member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    }

    const { context, error } = await resolveCompanyContext(user.id, member.companyId, 'members:read')
    if (error) return error

    const memberDetail = await prisma.teamMember.findFirst({
      where: { id, companyId: member.companyId },
    })
    if (!memberDetail) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: memberDetail.id,
      name: memberDetail.name,
      role: memberDetail.role,
      status: memberDetail.status,
      skills: safeParseJsonArr(memberDetail.skills),
      isOnline: memberDetail.isOnline,
      rating: memberDetail.rating,
      completedJobs: memberDetail.completedJobs,
      joinedAt: memberDetail.joinedAt.toISOString(),
    })
  } catch (error) {
    secureConsole.error('Team member get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
