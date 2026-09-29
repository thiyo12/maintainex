import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'
import { ROLE_PERMISSIONS } from '@/lib/admin-types'
import { updateMarketConfig } from '@/lib/domain/market-config'
import { getIp } from '@/lib/auth/authorization/admin-rbac'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'FINANCE']

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = ROLE_PERMISSIONS[session.role as keyof typeof ROLE_PERMISSIONS]
    if (!permissions?.includes('market_config:read')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const countryCode = searchParams.get('countryCode') || 'GLOBAL'

    const config = await prisma.marketConfig.findUnique({
      where: { countryCode },
    })

    return NextResponse.json({ config })
  } catch (error) {
    console.error('Market config GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = ROLE_PERMISSIONS[session.role as keyof typeof ROLE_PERMISSIONS]
    if (!permissions?.includes('market_config:write')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { countryCode, reason, ...changes } = body

    if (!countryCode) {
      return NextResponse.json({ error: 'countryCode is required' }, { status: 400 })
    }

    const result = await updateMarketConfig(prisma, {
      countryCode,
      changes,
      reason,
      session,
      ipAddress: getIp(request),
    })

    return NextResponse.json({ success: true, config: result.config })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('Validation failed')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message.includes('No valid fields')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('Market config PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
