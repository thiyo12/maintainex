import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'security:view',
      level: 'read',
    })
    if (!guard.ok) return guard.response

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
      credentialStuffsRaw,
      botAgentsRaw,
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
      prisma.userSession.count({
        where: { expiresAt: { gt: now } },
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
      prisma.failedLogin.groupBy({
        by: ['ipAddress'],
        where: {
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        _count: { email: true, ipAddress: true },
        having: { email: { _count: { gte: 3 } } },
        orderBy: { _count: { email: 'desc' } },
        take: 10,
      }),
      prisma.rateLimitLog.findMany({
        where: {
          createdAt: { gte: startOfDay },
          type: 'login-failed',
        },
        select: { identifier: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
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

    const credentialStuffs = credentialStuffsRaw.map((c: any) => ({
      ip: c.ipAddress,
      uniqueEmails: c._count.email,
      riskLevel: c._count.email >= 5 ? 'CRITICAL' : c._count.email >= 3 ? 'HIGH' : 'MEDIUM',
    }))

    const ipTimestamps = new Map<string, number[]>()
    botAgentsRaw.forEach((r: any) => {
      const existing = ipTimestamps.get(r.identifier) || []
      existing.push(r.createdAt.getTime())
      ipTimestamps.set(r.identifier, existing)
    })
    const botsDetected: { ip: string; intervalVariance: number; requestCount: number }[] = []
    ipTimestamps.forEach((timestamps, ip) => {
      if (timestamps.length < 3) return
      timestamps.sort((a, b) => a - b)
      const intervals: number[] = []
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1])
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const variance = intervals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / intervals.length
      const cv = avg > 0 ? Math.sqrt(variance) / avg : 1
      if (cv < 0.2 && avg < 5000 && timestamps.length >= 3) {
        botsDetected.push({ ip, intervalVariance: Math.round(cv * 100) / 100, requestCount: timestamps.length })
      }
    })

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
      credentialStuffs,
      botsDetected,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    secureConsole.error('Security monitor GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch security data' }, { status: 500 })
  }
}
