import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromCookie, adminAuthorize, getIp } from '@/lib/admin-rbac'
import { auditLogQuerySchema } from '@/lib/admin-schemas'

export async function GET(request: NextRequest) {
  const rawSession = getSessionFromCookie(request)
  const auth = adminAuthorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'SUPPORT'])(rawSession)
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const session = rawSession!
  try {
    const { searchParams } = request.nextUrl
    const query = auditLogQuerySchema.parse({
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 25,
      action: searchParams.get('action') || undefined,
      targetTable: searchParams.get('target_table') || undefined,
      adminId: searchParams.get('admin_id') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
    })

    const where: any = {}
    if (query.action) where.action = query.action
    if (query.targetTable) where.targetTable = query.targetTable
    if (query.adminId) where.adminUserId = query.adminId
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {}
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom)
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo)
    }

    if (session.role !== 'SUPER_ADMIN') {
      where.adminUserId = session.id
    }

    const skip = (query.page - 1) * query.limit
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: logs.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      })),
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    })
  } catch (e) {
    console.error('Audit log error:', e)
    return NextResponse.json({ success: false, error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}
