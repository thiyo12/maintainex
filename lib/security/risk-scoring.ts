import { SecurityEvent } from './events'

export interface RiskScore {
  score: number
  level: 'none' | 'low' | 'medium' | 'high' | 'critical'
  reasons: string[]
  shouldBlock: boolean
}

interface RiskFactor {
  type: string
  weight: number
  reason: string
}

const RISK_THRESHOLDS = {
  none: 0,
  low: 20,
  medium: 50,
  high: 80,
  critical: 95,
} as const

export function calculateRiskScore(events: SecurityEvent[], context?: {
  ip?: string
  countryCode?: string
  userAgent?: string
  failedLoginCount?: number
  recentActivityCount?: number
}): RiskScore {
  const factors: RiskFactor[] = []
  let totalScore = 0

  const failedLogins = events.filter(e =>
    e.type === 'login_failure' || e.type === 'otp_verify_failure'
  ).length

  if (failedLogins >= 5) {
    factors.push({
      type: 'repeated_auth_failure',
      weight: 30,
      reason: `${failedLogins} failed authentication attempts`,
    })
    totalScore += 30
  } else if (failedLogins >= 3) {
    factors.push({
      type: 'moderate_auth_failure',
      weight: 15,
      reason: `${failedLogins} failed authentication attempts`,
    })
    totalScore += 15
  }

  if (events.some(e => e.type === 'credential_stuffing_detected')) {
    factors.push({
      type: 'credential_stuffing',
      weight: 80,
      reason: 'Credential stuffing pattern detected',
    })
    totalScore += 80
  }

  if (events.some(e => e.type === 'bot_detected')) {
    factors.push({
      type: 'bot_activity',
      weight: 25,
      reason: 'Bot/automated activity detected',
    })
    totalScore += 25
  }

  if (events.some(e => e.type === 'ip_blocked')) {
    factors.push({
      type: 'ip_block_history',
      weight: 20,
      reason: 'IP was previously blocked',
    })
    totalScore += 20
  }

  if (context?.failedLoginCount && context.failedLoginCount >= 3) {
    factors.push({
      type: 'historical_failures',
      weight: Math.min(context.failedLoginCount * 5, 25),
      reason: `${context.failedLoginCount} historical failures for this IP`,
    })
    totalScore += Math.min(context.failedLoginCount * 5, 25)
  }

  if (context?.recentActivityCount && context.recentActivityCount > 100) {
    factors.push({
      type: 'high_activity',
      weight: 15,
      reason: 'Unusually high request volume',
    })
    totalScore += 15
  }

  if (events.some(e => e.type === 'metadata_tamper_detected' || e.type === 'financial_amount_mismatch')) {
    factors.push({
      type: 'financial_fraud_indicator',
      weight: 95,
      reason: 'Financial fraud indicators present',
    })
    totalScore += 95
  }

  totalScore = Math.min(totalScore, 100)

  let level: RiskScore['level'] = 'none'
  if (totalScore >= RISK_THRESHOLDS.critical) level = 'critical'
  else if (totalScore >= RISK_THRESHOLDS.high) level = 'high'
  else if (totalScore >= RISK_THRESHOLDS.medium) level = 'medium'
  else if (totalScore >= RISK_THRESHOLDS.low) level = 'low'

  return {
    score: totalScore,
    level,
    reasons: factors.map(f => f.reason),
    shouldBlock: level === 'critical' || level === 'high',
  }
}
