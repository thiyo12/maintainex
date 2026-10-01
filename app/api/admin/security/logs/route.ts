import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest, redactCrmSensitiveData } from '@/lib/crm/security'

function safeValue(value: string | null) {
  if (!value) return null
  try {
    return JSON.stringify(redactCrmSensitiveData(JSON.parse(value)))
  } catch {
    return '[REDACTED_UNPARSEABLE]'
  }
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'security:view',
      level: 'read',
    })
    if (!guard.ok) return guard.response

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const action = (searchParams.get('action') || '').trim().slice(0, 100)
    const adminUserId = (searchParams.get('adminUserId') || '').trim().slice(0, 128)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const where: any = {}

    if (action) where.action = action
    if (adminUserId) where.adminUserId = adminUserId
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) {
        const value = new Date(dateFrom)
        if (Number.isNaN(value.getTime())) return NextResponse.json({ error: 'Invalid dateFrom' }, { status: 400 })
        where.createdAt.gte = value
      }
      if (dateTo) {
        const value = new Date(dateTo)
        if (Number.isNaN(value.getTime())) return NextResponse.json({ error: 'Invalid dateTo' }, { status: 400 })
        where.createdAt.lte = value
      }
    }

    const [logs, total, adminsRaw, actionRows] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        select: { adminUserId: true, adminEmail: true },
        distinct: ['adminUserId'],
        orderBy: { adminUserId: 'asc' },
      }),
      prisma.auditLog.groupBy({
        by: ['action'],
        _count: { _all: true },
        orderBy: { action: 'asc' },
      }),
    ])

    return NextResponse.json(
      {
        logs: logs.map(log => ({
          ...log,
          oldValue: safeValue(log.oldValue),
          newValue: safeValue(log.newValue),
        })),
        admins: adminsRaw,
        actionTypes: actionRows.map(row => row.action),
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM security logs GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch security logs' }, { status: 500 })
  }
}
