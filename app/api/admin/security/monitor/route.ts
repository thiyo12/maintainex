import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !['SUPER_ADMIN', 'OPERATIONS'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    const [
      totalEventsToday,
      blockedIPs,
      failedLogins,
      highRiskEvents,
      activeSessions,
      apiRequestsLastHour,
      recentEvents,
      blockedIPList,
      loginAttemptsSuccess,
      loginAttemptsFailed,
      riskDistributionRaw,
      topThreatsRaw,
      hourlyLoginData,
    ] = await Promise.all([
      prisma.securityAudit.count({
        where: { createdAt: { gte: startOfDay } },
      }),
      prisma.ipBlock.count({
        where: { expiresAt: { gt: now } },
      }),
      prisma.failedLogin.count({
        where: { createdAt: { gte: startOfDay } },
      }),
      prisma.securityAudit.count({
        where: {
          createdAt: { gte: startOfDay },
          riskLevel: { in: ['HIGH', 'CRITICAL'] },
        },
      }),
      prisma.session.count({
        where: { isValid: true, expiresAt: { gt: now } },
      }),
      prisma.rateLimitLog.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),
      prisma.securityAudit.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          action: true,
          category: true,
          userId: true,
          riskLevel: true,
          ipAddress: true,
          description: true,
          createdAt: true,
        },
      }),
      prisma.ipBlock.findMany({
        where: { expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.securityAudit.count({
        where: {
          createdAt: { gte: startOfDay },
          action: 'LOGIN',
          success: true,
        },
      }),
      prisma.securityAudit.count({
        where: {
          createdAt: { gte: startOfDay },
          action: 'LOGIN',
          success: false,
        },
      }),
      prisma.securityAudit.groupBy({
        by: ['riskLevel'],
        where: { createdAt: { gte: startOfDay } },
        _count: { riskLevel: true },
      }),
      prisma.failedLogin.groupBy({
        by: ['ipAddress'],
        where: { createdAt: { gte: startOfDay } },
        _count: { ipAddress: true },
        orderBy: { _count: { ipAddress: 'desc' } },
        take: 10,
      }),
      prisma.securityAudit.findMany({
        where: {
          createdAt: { gte: startOfDay },
          action: 'LOGIN',
        },
        select: {
          createdAt: true,
          success: true,
        },
      }),
    ])

    const riskDistribution: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
    riskDistributionRaw.forEach((r: any) => {
      riskDistribution[r.riskLevel] = r._count.riskLevel
    })

    const byHourMap = new Map<string, { success: number; failed: number }>()
    for (let h = 0; h < 24; h++) {
      const hour = String(h).padStart(2, '0') + ':00'
      byHourMap.set(hour, { success: 0, failed: 0 })
    }
    hourlyLoginData.forEach((entry: any) => {
      const hour = new Date(entry.createdAt).getHours()
      const key = String(hour).padStart(2, '0') + ':00'
      const bucket = byHourMap.get(key)
      if (bucket) {
        if (entry.success) bucket.success++
        else bucket.failed++
      }
    })

    const topThreats = topThreatsRaw.map((t: any) => ({
      ip: t.ipAddress,
      attempts: t._count.ipAddress,
      riskLevel: t._count.ipAddress >= 10 ? 'HIGH' : t._count.ipAddress >= 5 ? 'MEDIUM' : 'LOW',
      reason: 'Multiple failed logins',
    }))

    return NextResponse.json({
      summary: {
        totalEventsToday,
        blockedIPs,
        failedLogins,
        highRiskEvents,
        activeSessions,
        apiRequestsLastHour,
      },
      recentEvents: recentEvents.map((e: any) => ({
        id: e.id,
        action: e.action,
        category: e.category,
        userId: e.userId,
        riskLevel: e.riskLevel,
        ipAddress: e.ipAddress,
        description: e.description,
        createdAt: e.createdAt.toISOString(),
      })),
      blockedIPs: blockedIPList.map((b: any) => ({
        ip: b.ip,
        reason: b.reason,
        blockedAt: b.createdAt.toISOString(),
        expiresAt: b.expiresAt?.toISOString() || new Date().toISOString(),
      })),
      loginAttempts: {
        success: loginAttemptsSuccess,
        failed: loginAttemptsFailed,
        byHour: Array.from(byHourMap.entries()).map(([hour, data]) => ({
          hour,
          ...data,
        })),
      },
      riskDistribution,
      topThreats,
    })
  } catch (error) {
    console.error('Security monitor GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch security data' }, { status: 500 })
  }
}
