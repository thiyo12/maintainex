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
