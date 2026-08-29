import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie } from '@/lib/admin-rbac'

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromCookie(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const severity = searchParams.get('severity')
    const category = searchParams.get('category')
    const assignedTo = searchParams.get('assignedTo')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const isManager = ['SUPER_ADMIN', 'MANAGER'].includes(session.role)

    const where: any = {}

    // Role-based filtering
    if (!isManager) {
      // Regular staff: see alerts assigned to them OR unassigned alerts in their category
      const roleCategoryMap: Record<string, string[]> = {
        USER_MANAGEMENT: ['kyc'],
        SUPPORT: ['dispute'],
        FINANCE: ['settlement', 'payout'],
        TECHNICAL: ['system'],
      }
      const allowedCategories = roleCategoryMap[session.role] || []
      where.OR = [
        { assignedTo: session.id },
        { assignedRole: session.role, assignedTo: null },
        { type: { in: allowedCategories }, assignedTo: null },
      ]
    }

    if (status && status !== 'ALL' && status !== '') {
      where.status = status
    } else if (!status || status === 'ALL') {
      // Default: show open + in_progress
      where.status = { in: ['open', 'in_progress'] }
    }

    if (severity && severity !== 'ALL') {
      where.severity = severity
    }

    if (category && category !== 'ALL') {
      where.type = category
    }

    if (assignedTo) {
      if (assignedTo === 'unassigned') {
        where.assignedTo = null
      } else {
        where.assignedTo = assignedTo
      }
    }

    const [alerts, total] = await Promise.all([
      prisma.adminAlert.findMany({
        where,
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'asc' },
        ],
        skip,
        take: limit,
      }),
      prisma.adminAlert.count({ where }),
    ])

    // Enrich with assignee info
    const assigneeIds = [...new Set(alerts.map(a => a.assignedTo).filter(Boolean))] as string[]
    const assignees = assigneeIds.length > 0
      ? await prisma.adminUser.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        })
      : []
    const assigneeMap = new Map(assignees.map(a => [a.id, a]))

    // Summary counts
    const summaryWhere = isManager ? {} : {
      OR: [
        { assignedTo: session.id },
        { assignedRole: session.role, assignedTo: null },
      ],
    }
    const [openCount, inProgressCount, resolvedCount] = await Promise.all([
      prisma.adminAlert.count({ where: { ...summaryWhere, status: 'open' } }),
      prisma.adminAlert.count({ where: { ...summaryWhere, status: 'in_progress' } }),
      prisma.adminAlert.count({ where: { ...summaryWhere, status: 'resolved' } }),
    ])

    return NextResponse.json({
      alerts: alerts.map(a => ({
        ...a,
        assignee: a.assignedTo ? assigneeMap.get(a.assignedTo) || null : null,
      })),
      summary: { openCount, inProgressCount, resolvedCount },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Alerts GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 })
  }
}
