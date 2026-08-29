import { prisma } from '@/lib/prisma'

export interface RiskAssessment {
  score: number
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  reasons: string[]
  recommendedActions: string[]
}

export async function assessLoginRisk(
  userId: string | null,
  email: string,
  ip: string,
  userAgent: string
): Promise<RiskAssessment> {
  const reasons: string[] = []
  let score = 0

  const recentFailures = await prisma.rateLimitLog.count({
    where: {
      identifier: ip,
      type: 'login-failed',
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
    }
  })
  if (recentFailures > 5) {
    score += 30
    reasons.push(`${recentFailures} failed login attempts from this IP in the last hour`)
  }

  const blocked = await prisma.ipBlock.findFirst({
    where: { ip, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
  })
  if (blocked) {
    score += 50
    reasons.push(`IP is blocked: ${blocked.reason}`)
  }

  if (userId) {
    const knownDevices = await prisma.userDevice.count({
      where: { userId, userAgent }
    })
    if (knownDevices === 0) {
      score += 15
      reasons.push('Login from new device/browser')
    }
  }

  const recentAccounts = await prisma.user.count({
    where: {
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
    }
  })
  if (recentAccounts > 10) {
    score += 20
    reasons.push('Multiple accounts created recently')
  }

  const hour = new Date().getHours()
  if (hour >= 0 && hour <= 5) {
    score += 5
    reasons.push('Login attempt during unusual hours (midnight-5am)')
  }

  const recentFromIP = await prisma.rateLimitLog.findMany({
    where: {
      identifier: ip,
      type: 'login-failed',
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { createdAt: true },
  })
  if (recentFromIP.length >= 3) {
    const intervals: number[] = []
    for (let i = 1; i < recentFromIP.length; i++) {
      intervals.push(recentFromIP[i].createdAt.getTime() - recentFromIP[i - 1].createdAt.getTime())
    }
    if (intervals.length >= 2) {
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / intervals.length
      const cv = Math.sqrt(variance) / avg
      if (cv < 0.15 && avg < 5000) {
        score += 35
        reasons.push('BOT_DETECTED: Login attempts at unnaturally regular intervals (cron pattern)')
      }
    }
  }

  const uniqueEmailsFromIP = await prisma.failedLogin.groupBy({
    by: ['email'],
    where: {
      ipAddress: ip,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  })
  if (uniqueEmailsFromIP.length >= 3) {
    score += 25
    reasons.push(`CREDENTIAL_STUFFING: ${uniqueEmailsFromIP.length} different emails attempted from same IP`)
  }

  const userAgentBots = /bot|crawl|spider|scrape|curl|wget|python|java|go-http|node-fetch|axios/i
  if (userAgentBots.test(userAgent)) {
    score += 20
    reasons.push(`AUTOMATED_CLIENT: User agent matches known bot patterns: ${userAgent.substring(0, 80)}`)
  }

  let level: RiskAssessment['level'] = 'LOW'
  const actions: string[] = []

  if (score >= 80) {
    level = 'CRITICAL'
    actions.push('BLOCK_IP', 'LOCK_ACCOUNT', 'NOTIFY_ADMIN', 'PRESERVE_FORENSICS')
  } else if (score >= 50) {
    level = 'HIGH'
    actions.push('BLOCK_IP_1H', 'REQUIRE_MFA', 'NOTIFY_ADMIN')
  } else if (score >= 25) {
    level = 'MEDIUM'
    actions.push('REQUIRE_MFA', 'NOTIFY_USER')
  } else {
    actions.push('LOG_ONLY')
  }

  return { score: Math.min(score, 100), level, reasons, recommendedActions: actions }
}

export async function recordSecurityEvent(
  action: string,
  category: string,
  userId: string | null,
  entityType: string,
  entityId: string,
  riskLevel: string,
  details?: Record<string, unknown>
): Promise<void> {
  await prisma.securityAudit.create({
    data: {
      action,
      category,
      userId,
      entityType,
      entityId,
      riskLevel,
      isSuspicious: ['HIGH', 'CRITICAL'].includes(riskLevel),
      details: details ? JSON.stringify(details) : null,
      description: `${action} on ${entityType}:${entityId}`,
      createdAt: new Date()
    }
  })
}
