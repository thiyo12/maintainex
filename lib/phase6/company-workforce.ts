import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { hasCompanyPermission, type CompanyRole } from './rbac'

export interface WorkforceAuthContext {
  companyId: string
  role: CompanyRole
  membershipId: string
  isAssignedToJob: boolean
  assignmentId: string | null
}

export async function requireWorkforceAssignment(
  userId: string,
  companyId: string,
  jobId: string,
  requiredPermission?: string
): Promise<{ context: WorkforceAuthContext | null; error?: NextResponse }> {
  const membership = await prisma.teamMember.findFirst({
    where: { companyId, userId, status: 'ACTIVE' },
    select: { id: true, role: true },
  })

  if (!membership) {
    return {
      context: null,
      error: NextResponse.json({ error: 'Not a member of this company' }, { status: 403 }),
    }
  }

  const role = membership.role as CompanyRole

  if (requiredPermission && !hasCompanyPermission(role, requiredPermission)) {
    return {
      context: null,
      error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }),
    }
  }

  const assignment = await prisma.companyJobAssignment.findFirst({
    where: {
      jobId,
      companyId,
      workerUserId: userId,
      status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
    },
    select: { id: true },
  })

  return {
    context: {
      companyId,
      role,
      membershipId: membership.id,
      isAssignedToJob: !!assignment,
      assignmentId: assignment?.id ?? null,
    },
  }
}

export async function requireCompanyMembership(
  userId: string,
  companyId: string
): Promise<{ role: CompanyRole; membershipId: string } | NextResponse> {
  const membership = await prisma.teamMember.findFirst({
    where: { companyId, userId, status: 'ACTIVE' },
    select: { id: true, role: true },
  })

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this company' }, { status: 403 })
  }

  return { role: membership.role as CompanyRole, membershipId: membership.id }
}

export async function requireCompanyPermission(
  userId: string,
  companyId: string,
  permission: string
): Promise<{ role: CompanyRole; membershipId: string } | NextResponse> {
  const result = await requireCompanyMembership(userId, companyId)
  if (result instanceof NextResponse) return result

  if (!hasCompanyPermission(result.role, permission)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  return result
}

export async function isWorkerAssignedToJob(
  workerUserId: string,
  jobId: string,
  companyId: string
): Promise<boolean> {
  const assignment = await prisma.companyJobAssignment.findFirst({
    where: {
      jobId,
      companyId,
      workerUserId,
      status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] },
    },
  })
  return !!assignment
}
