import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { hasCompanyPermission, type CompanyRole } from '@/lib/phase6/rbac'
import { prisma } from '@/lib/prisma'
import {
  workerAcceptAssignment,
  workerRejectAssignment,
  revokeAssignment,
} from '@/lib/domain/company-job-assignment'

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
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const assignment = await prisma.companyJobAssignment.findUnique({
      where: { id },
      include: {
        job: { select: { id: true, title: true, status: true, createdAt: true } },
        worker: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, companyName: true, userId: true } },
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    const isWorker = assignment.workerUserId === user.id
    const isOwner = assignment.company.userId === user.id
    const membership = isOwner
      ? null
      : await prisma.teamMember.findFirst({
          where: { companyId: assignment.companyId, userId: user.id, status: 'ACTIVE' },
          select: { role: true },
        })

    const canReadAssignment =
      isWorker ||
      isOwner ||
      (!!membership && hasCompanyPermission(membership.role as CompanyRole, 'workers:read'))

    if (!canReadAssignment) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const canManageAssignment =
      isOwner ||
      (!!membership && hasCompanyPermission(membership.role as CompanyRole, 'workers:assign'))

    return NextResponse.json({
      id: assignment.id,
      jobId: assignment.jobId,
      workerUserId: assignment.workerUserId,
      assignedBy: assignment.assignedBy,
      status: assignment.status,
      assignedAt: assignment.assignedAt.toISOString(),
      acceptedAt: assignment.acceptedAt?.toISOString() || null,
      startedAt: assignment.startedAt?.toISOString() || null,
      completedAt: assignment.completedAt?.toISOString() || null,
      rejectedAt: assignment.rejectedAt?.toISOString() || null,
      revokedAt: assignment.revokedAt?.toISOString() || null,
      revokedReason: assignment.revokedReason,
      rejectReason: assignment.rejectReason,
      job: assignment.job,
      worker: assignment.worker,
      company: assignment.company,
      capabilities: {
        isAssignedWorker: isWorker,
        canReadAssignment,
        canManageAssignment,
      },
    })
  } catch (error) {
    secureConsole.error('Get assignment error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(
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

    const body = await request.json()
    const { action, reason } = body

    if (!action || !['accept', 'reject', 'revoke'].includes(action)) {
      return NextResponse.json({ error: 'action must be one of: accept, reject, revoke' }, { status: 400 })
    }

    const assignment = await prisma.companyJobAssignment.findUnique({ where: { id } })
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    let result

    switch (action) {
      case 'accept': {
        if (assignment.workerUserId !== user.id) {
          return NextResponse.json({ error: 'Only the assigned worker can accept' }, { status: 403 })
        }
        result = await workerAcceptAssignment(id, user.id)
        break
      }

      case 'reject': {
        if (assignment.workerUserId !== user.id) {
          return NextResponse.json({ error: 'Only the assigned worker can reject' }, { status: 403 })
        }
        result = await workerRejectAssignment(id, user.id, reason)
        break
      }

      case 'revoke': {
        const { context, error } = await resolveCompanyContext(
          user.id, assignment.companyId, 'workers:assign'
        )
        if (error) return error
        result = await revokeAssignment(id, assignment.companyId, user.id, context!.role, reason)
        break
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, assignmentId: id })
  } catch (error) {
    secureConsole.error('Assignment action error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
