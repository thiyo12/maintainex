import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { CompanyRole, hasCompanyPermission } from './rbac'

export interface CompanyContext {
  companyId: string
  role: CompanyRole
  membershipId: string
}

export async function resolveCompanyContext(
  userId: string,
  companyId: string | null,
  requiredPermission?: string
): Promise<{ context: CompanyContext | null; error?: NextResponse }> {
  if (!companyId) {
    return { context: null, error: NextResponse.json({ error: 'companyId is required' }, { status: 400 }) }
  }

  const membership = await prisma.teamMember.findFirst({
    where: {
      companyId,
      userId,
      status: 'ACTIVE',
    },
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

  return {
    context: {
      companyId,
      role,
      membershipId: membership.id,
    },
  }
}

export async function requireCompanyContext(
  userId: string,
  companyId: string | null,
  requiredPermission?: string
): Promise<CompanyContext> {
  const { context, error } = await resolveCompanyContext(userId, companyId, requiredPermission)
  if (error) throw error
  return context!
}
