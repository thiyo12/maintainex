import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  if (session.role !== 'SUPER_ADMIN') {
    await prisma.securityAudit.create({
      data: {
        action: 'ACCESS_DENIED',
        category: 'SECURITY',
        userId: session.id,
        userEmail: session.email,
        userRole: session.role,
        description: 'Attempted to access audit logs without SUPER_ADMIN role',
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
        success: false,
        errorMessage: 'Insufficient permissions',
        riskLevel: 'HIGH',
        isSuspicious: true,
      },
    })
    
    return NextResponse.json(
      { error: 'Forbidden - SUPER_ADMIN access required' },
      { status: 403 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
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
        userId: session.id,
        userEmail: session.email,
        userRole: session.role,
        description: `Viewed audit logs - page ${page}, filters applied`,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
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
    console.error('Failed to fetch audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
