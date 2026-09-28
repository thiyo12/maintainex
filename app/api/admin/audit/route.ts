import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/auth/authentication/admin-auth'
import { ROLE_PERMISSIONS } from '@/lib/admin-types'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'MANAGER', 'USER_MANAGEMENT', 'FINANCE', 'SUPPORT', 'TECHNICAL']

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = ROLE_PERMISSIONS[session.role as keyof typeof ROLE_PERMISSIONS]
    if (!permissions?.includes('audit:read')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const adminUserId = searchParams.get('adminUserId')
    const targetTable = searchParams.get('targetTable')
    const targetId = searchParams.get('targetId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}
    if (action) where.action = action
    if (adminUserId) where.adminUserId = adminUserId
    if (targetTable) where.targetTable = targetTable
    if (targetId) where.targetId = targetId
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom)
      if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo)
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('Audit GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
