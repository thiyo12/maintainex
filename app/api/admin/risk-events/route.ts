import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { ROLE_PERMISSIONS } from '@/lib/admin-types'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'MANAGER', 'SUPPORT', 'USER_MANAGEMENT']

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = ROLE_PERMISSIONS[session.role as keyof typeof ROLE_PERMISSIONS]
    if (!permissions?.includes('risk_events:read')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const severity = searchParams.get('severity')
    const eventType = searchParams.get('eventType')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}
    if (status === 'pending') {
      where.reviewedAt = null
    } else if (status === 'reviewed') {
      where.reviewedAt = { not: null }
    }
    if (severity) where.severity = severity
    if (eventType) where.eventType = eventType

    const [events, total] = await Promise.all([
      prisma.marketplaceRiskEvent.findMany({
        where,
        include: {
          job: {
            select: { id: true, title: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.marketplaceRiskEvent.count({ where }),
    ])

    return NextResponse.json({
      events,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('Risk events GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
