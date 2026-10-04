import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { guardCrmRequest } from '@/lib/crm/security'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const guard = await guardCrmRequest(request, {
    permission: 'security:audit',
    allowedRoles: ['SUPER_ADMIN'],
    level: 'read',
  })
  if (!guard.ok) return guard.response

  const searchParams = request.nextUrl.searchParams
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100)
  const category = searchParams.get('category')
  const action = searchParams.get('action')
  const userId = searchParams.get('userId')
  const riskLevel = searchParams.get('riskLevel')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const isSuspicious = searchParams.get('isSuspicious')
  const search = searchParams.get('search')

  const where: any = {}

  if (category) where.category = category
  if (action) where.action = action
  if (userId) where.userId = userId
  if (riskLevel) where.riskLevel = riskLevel
  if (isSuspicious === 'true') where.isSuspicious = true
  if (isSuspicious === 'false') where.isSuspicious = false

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = new Date(startDate)
    if (endDate) where.createdAt.lte = new Date(endDate)
  }

  if (search) {
    where.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { userEmail: { contains: search, mode: 'insensitive' } },
      { entityName: { contains: search, mode: 'insensitive' } },
    ]
  }

  try {
    const [logs, total] = await Promise.all([
      prisma.securityAudit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.securityAudit.count({ where }),
    ])

    await prisma.securityAudit.create({
      data: {
        action: 'VIEW',
        category: 'SECURITY',
        userId: guard.context.adminId,
        userEmail: guard.context.email,
        userRole: guard.context.role,
        description: `Viewed audit logs - page ${page}, filters applied`,
        ipAddress: guard.context.ipAddress,
        userAgent: guard.context.userAgent,
        success: true,
        riskLevel: 'LOW',
      },
    })

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    secureConsole.error('Failed to fetch audit logs:', error)
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}
