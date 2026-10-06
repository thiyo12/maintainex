import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest, redactCrmSensitiveData } from '@/lib/crm/security'

function safeAuditJson(value: string | null) {
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
      permission: 'audit:read',
      level: 'read',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const action = (searchParams.get('action') || '').trim().slice(0, 100)
    const requestedAdminUserId = (searchParams.get('adminUserId') || '').trim().slice(0, 128)
    const targetTable = (searchParams.get('targetTable') || '').trim().slice(0, 100)
    const targetId = (searchParams.get('targetId') || '').trim().slice(0, 128)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50')))
    const skip = (page - 1) * pageSize

    const canReadGlobalAudit = security.isSuperAdmin || security.role === 'TECHNICAL'
    const where: any = {}

    if (canReadGlobalAudit) {
      if (requestedAdminUserId) where.adminUserId = requestedAdminUserId
    } else {
      where.adminUserId = security.adminId
    }

    if (action) where.action = action
    if (targetTable) where.targetTable = targetTable
    if (targetId) where.targetId = targetId

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

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json(
      {
        logs: logs.map(log => ({
          ...log,
          oldValue: safeAuditJson(log.oldValue),
          newValue: safeAuditJson(log.newValue),
        })),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        scope: canReadGlobalAudit ? 'GLOBAL_SECURITY' : 'SELF',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    secureConsole.error('CRM audit GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
