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
  let membership: { id: string; role: string; companyId: string } | null = null

  if (companyId) {
    membership = await prisma.teamMember.findFirst({
      where: {
        companyId,
        userId,
        status: 'ACTIVE',
      },
      select: { id: true, role: true, companyId: true },
    })
  } else {
    // The mobile app can safely default to a single active company.
    // Multiple-company users must choose explicitly so RBAC never guesses.
    const memberships = await prisma.teamMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: { id: true, role: true, companyId: true },
      orderBy: { joinedAt: 'asc' },
      take: 2,
    })

    if (memberships.length > 1) {
      return {
        context: null,
        error: NextResponse.json(
          { error: 'companyId is required when you belong to multiple companies' },
          { status: 400 }
        ),
      }
    }

    membership = memberships[0] ?? null
  }

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
      companyId: membership.companyId,
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
