import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/shared/observability/logger'
import { getTrustedClientIp } from '@/lib/security/client-ip'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { createMarketplaceAuthSession, buildAuthResponse } from '@/lib/auth/marketplace-session'

const ALLOWED_ROLES = ['CUSTOMER', 'TASKER', 'COMPANY']

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const suspended = assertNotSuspended(user)
    if (suspended) return suspended

    const body = await request.json()
    const targetRole = body.role

    if (!targetRole || !ALLOWED_ROLES.includes(targetRole)) {
      return NextResponse.json(
        { error: `Invalid role. Allowed: ${ALLOWED_ROLES.join(', ')}` },
        { status: 400 }
      )
    }

    if (targetRole === user.role) {
      return NextResponse.json({ error: 'Already on this role' }, { status: 400 })
    }

    if (targetRole === 'TASKER') {
      const profile = await prisma.taskerProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!profile) {
        return NextResponse.json({ error: 'Tasker profile does not exist for this account' }, { status: 403 })
      }
    }

    if (targetRole === 'COMPANY') {
      const [ownedCompany, membership] = await Promise.all([
        prisma.companyProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
        prisma.teamMember.findFirst({
          where: { userId: user.id, status: 'ACTIVE' },
          select: { id: true },
        }),
      ])
      if (!ownedCompany && !membership) {
        return NextResponse.json({ error: 'Company membership does not exist for this account' }, { status: 403 })
      }
    }

    const ip = getTrustedClientIp(request.headers)
    const userAgent = request.headers.get('user-agent') ?? ''

    const oldRole = user.role

    await prisma.user.update({
      where: { id: user.id },
      data: { role: targetRole },
    })

    await prisma.securityAudit.create({
      data: {
        action: 'ROLE_SWITCH',
        category: 'AUTH',
        userId: user.id,
        userEmail: user.email,
        userRole: targetRole,
        entityType: 'USER',
        entityId: user.id,
        description: `Role switched from ${oldRole} to ${targetRole}`,
        oldValue: JSON.stringify({ role: oldRole }),
        newValue: JSON.stringify({ role: targetRole }),
        ipAddress: ip,
        userAgent,
      },
    })

    const authSession = await createMarketplaceAuthSession(user.id, {
      ipAddress: ip,
      userAgent: userAgent || undefined,
    })
    const response = buildAuthResponse(authSession)

    return NextResponse.json({
      ...response,
      token: response.accessToken,
      user: response.user,
    })
  } catch (error) {
    logger.error('Mobile role switch failed unexpectedly', { err: error })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
