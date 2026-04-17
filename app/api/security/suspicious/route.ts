import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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
        description: 'Attempted to access suspicious activity without SUPER_ADMIN role',
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
  const hours = parseInt(searchParams.get('hours') || '24')
  const riskLevel = searchParams.get('riskLevel')
  const category = searchParams.get('category')
  const action = searchParams.get('action')
  const groupBy = searchParams.get('groupBy')

  const since = new Date(Date.now() - hours * 60 * 60 * 1000)
  
  const where: any = {
    isSuspicious: true,
    createdAt: { gte: since },
  }
  
  if (riskLevel) where.riskLevel = riskLevel
  if (category) where.category = category
  if (action) where.action = action

  try {
    if (groupBy === 'ip') {
      const rawResults = await prisma.$queryRaw<
        Array<{ ipAddress: string; count: bigint; riskLevel: string; lastActivity: Date }>
      >`
        SELECT 
          "ipAddress",
          COUNT(*) as count,
          MAX("riskLevel") as "riskLevel",
          MAX("createdAt") as "lastActivity"
        FROM "SecurityAudit"
        WHERE "isSuspicious" = true
          AND "createdAt" >= ${since}
          ${riskLevel ? Prisma.sql`AND "riskLevel" = ${riskLevel}` : Prisma.empty}
        GROUP BY "ipAddress"
        ORDER BY count DESC
        LIMIT ${limit}
      `

      const groupedResults = rawResults.map(item => ({
        ipAddress: item.ipAddress,
        count: Number(item.count),
        riskLevel: item.riskLevel,
        lastActivity: item.lastActivity,
      }))

      return NextResponse.json({
        activity: groupedResults,
        groupBy: 'ip',
        hours,
        pagination: {
          page,
          limit,
          total: groupedResults.length,
        },
      })
    }

    if (groupBy === 'user') {
      const rawResults = await prisma.$queryRaw<
        Array<{ userId: string; userEmail: string; count: bigint; riskLevel: string; lastActivity: Date }>
      >`
        SELECT 
          "userId",
          "userEmail",
          COUNT(*) as count,
          MAX("riskLevel") as "riskLevel",
          MAX("createdAt") as "lastActivity"
        FROM "SecurityAudit"
        WHERE "isSuspicious" = true
          AND "createdAt" >= ${since}
          AND "userId" IS NOT NULL
          ${riskLevel ? Prisma.sql`AND "riskLevel" = ${riskLevel}` : Prisma.empty}
        GROUP BY "userId", "userEmail"
        ORDER BY count DESC
        LIMIT ${limit}
      `

      const groupedResults = rawResults.map(item => ({
        userId: item.userId,
        userEmail: item.userEmail,
        count: Number(item.count),
        riskLevel: item.riskLevel,
        lastActivity: item.lastActivity,
      }))

      return NextResponse.json({
        activity: groupedResults,
        groupBy: 'user',
        hours,
        pagination: {
          page,
          limit,
          total: groupedResults.length,
        },
      })
    }

    const [activity, total] = await Promise.all([
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
        description: `Viewed suspicious activity - page ${page}, last ${hours} hours`,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
        success: true,
        riskLevel: 'LOW',
      },
    })

    const riskBreakdown = await prisma.$queryRaw<
      Array<{ riskLevel: string; count: bigint }>
    >`
      SELECT "riskLevel", COUNT(*) as count
      FROM "SecurityAudit"
      WHERE "isSuspicious" = true AND "createdAt" >= ${since}
      GROUP BY "riskLevel"
    `

    return NextResponse.json({
      activity,
      stats: {
        total: total,
        riskBreakdown: riskBreakdown.map(r => ({
          riskLevel: r.riskLevel,
          count: Number(r.count),
        })),
      },
      hours,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Failed to fetch suspicious activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suspicious activity' },
      { status: 500 }
    )
  }
}
