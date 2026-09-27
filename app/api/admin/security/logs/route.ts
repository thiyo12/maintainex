import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !['SUPER_ADMIN', 'TECHNICAL', 'SUPPORT'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const action = searchParams.get('action') || undefined
    const riskLevel = searchParams.get('riskLevel') || undefined
    const suspiciousOnly = searchParams.get('suspicious') === 'true'
    const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined
    const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : undefined

    const where: any = {}
    if (action) where.action = action
    if (riskLevel) where.riskLevel = riskLevel
    if (suspiciousOnly) where.isSuspicious = true
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = from
      if (to) where.createdAt.lte = to
    }

    const [events, total] = await Promise.all([
      prisma.securityAudit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.securityAudit.count({ where }),
    ])

    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        category: e.category,
        userId: e.userId,
        entityType: e.entityType,
        entityId: e.entityId,
        riskLevel: e.riskLevel,
        ipAddress: e.ipAddress,
        description: e.description,
        success: e.success,
        isSuspicious: e.isSuspicious,
        details: e.details ? JSON.parse(e.details) : null,
        createdAt: e.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Security logs GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch security logs' }, { status: 500 })
  }
}
