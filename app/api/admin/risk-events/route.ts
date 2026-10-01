import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'risk_events:read',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const severity = searchParams.get('severity')
    const eventType = searchParams.get('eventType')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const skip = (page - 1) * pageSize

    if (!['pending', 'reviewed', 'all'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
    }

    const where: any = {}
    if (status === 'pending') where.reviewedAt = null
    if (status === 'reviewed') where.reviewedAt = { not: null }
    if (severity) where.severity = severity.toUpperCase().slice(0, 20)
    if (eventType) where.eventType = eventType.slice(0, 100)

    if (!security.isSuperAdmin) {
      where.job = {
        countryCode: { in: security.assignedCountries },
      }
    }

    const [events, total] = await Promise.all([
      prisma.marketplaceRiskEvent.findMany({
        where,
        include: {
          job: {
            select: { id: true, title: true, status: true, countryCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.marketplaceRiskEvent.count({ where }),
    ])

    return NextResponse.json(
      {
        events,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM risk events GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
