import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'

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
    const emailFilter = (searchParams.get('email') || '').trim().slice(0, 200)
    const ipFilter = (searchParams.get('ip') || '').trim().slice(0, 80)
    const blockedOnly = searchParams.get('blocked') === 'true'

    const where: any = {}
    if (emailFilter) where.email = { contains: emailFilter, mode: 'insensitive' }
    if (ipFilter) where.ipAddress = ipFilter
    if (blockedOnly) where.blocked = true

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const [records, total, uniqueIPs, blockedCount, recentPairs] = await Promise.all([
      prisma.failedLogin.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          ipAddress: true,
          attemptCount: true,
          blocked: true,
          blockUntil: true,
          userAgent: true,
          createdAt: true,
        },
      }),
      prisma.failedLogin.count({ where }),
      prisma.failedLogin.groupBy({ by: ['ipAddress'], where, _count: { ipAddress: true } }),
      prisma.failedLogin.count({ where: { ...where, blocked: true } }),
      prisma.failedLogin.groupBy({
        by: ['ipAddress', 'email'],
        where: { createdAt: { gte: oneHourAgo } },
        _count: { email: true },
        orderBy: { _count: { email: 'desc' } },
        take: 100,
      }),
    ])

    const ipGroups = recentPairs.reduce<Record<string, Set<string>>>((acc, row) => {
      if (!acc[row.ipAddress]) acc[row.ipAddress] = new Set<string>()
      acc[row.ipAddress].add(row.email)
      return acc
    }, {})
    const credentialStuffs = Object.entries(ipGroups)
      .map(([ip, emails]) => ({ ip, emailCount: emails.size, emails: [...emails].slice(0, 20) }))
      .filter(item => item.emailCount >= 3)
      .slice(0, 10)

    return NextResponse.json(
      {
        records: records.map(record => ({
          ...record,
          blockUntil: record.blockUntil?.toISOString() || null,
          createdAt: record.createdAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
        summary: {
          uniqueIPs: uniqueIPs.length,
          blockedCount,
          credentialStuffs,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM failed logins GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch failed logins' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'security:audit',
      allowedRoles: ['SUPER_ADMIN'],
      level: 'sensitive',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const id = (searchParams.get('id') || '').trim().slice(0, 128)
    const email = (searchParams.get('email') || '').trim().slice(0, 200)
    const all = searchParams.get('all') === 'true'
    const confirm = searchParams.get('confirm') || ''

    if (all && confirm !== 'PURGE_FAILED_LOGINS') {
      return NextResponse.json({ error: 'Explicit purge confirmation is required' }, { status: 400 })
    }
    if (!all && !email && !id) {
      return NextResponse.json({ error: 'Provide id, email, or all=true' }, { status: 400 })
    }

    let deleted = 0
    let target = ''
    if (all) {
      const result = await prisma.failedLogin.deleteMany({})
      deleted = result.count
      target = 'ALL'
    } else if (email) {
      const result = await prisma.failedLogin.deleteMany({ where: { email } })
      deleted = result.count
      target = email
    } else {
      const existing = await prisma.failedLogin.findUnique({ where: { id } })
      if (!existing) return NextResponse.json({ error: 'Record not found' }, { status: 404 })
      await prisma.failedLogin.delete({ where: { id } })
      deleted = 1
      target = id
    }

    await createAuditLog({
      action: 'DELETE',
      category: 'SECURITY',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'FailedLogin',
      entityName: target,
      description: `CRM failed-login evidence deleted (${deleted} records)`,
      newValue: { deletedCount: deleted, scope: all ? 'ALL' : email ? 'EMAIL' : 'ID' },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: all ? 'CRITICAL' : 'HIGH',
    })

    return NextResponse.json({ success: true, deleted })
  } catch (error) {
    console.error('CRM failed logins DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete records' }, { status: 500 })
  }
}
