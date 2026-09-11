import { describe, it, expect } from 'vitest'
import { calculateRiskScore } from '@/lib/security/risk-scoring'
import type { SecurityEvent } from '@/lib/security/events'

describe('Risk Scoring', () => {
  it('returns none for empty events', () => {
    const result = calculateRiskScore([])
    expect(result.score).toBe(0)
    expect(result.level).toBe('none')
    expect(result.shouldBlock).toBe(false)
  })

  it('detects repeated auth failures', () => {
    const events: SecurityEvent[] = Array.from({ length: 5 }, () => ({
      type: 'login_failure',
      riskLevel: 'low',
      timestamp: new Date(),
    }))
    const result = calculateRiskScore(events)
    expect(result.score).toBeGreaterThanOrEqual(30)
    expect(result.level).not.toBe('none')
  })

  it('blocks on credential stuffing', () => {
    const events: SecurityEvent[] = [{
      type: 'credential_stuffing_detected',
      riskLevel: 'critical',
      timestamp: new Date(),
    }]
    const result = calculateRiskScore(events)
    expect(result.shouldBlock).toBe(true)
    expect(result.level).toBe('high')
  })

  it('blocks on financial fraud indicators', () => {
    const events: SecurityEvent[] = [{
      type: 'financial_amount_mismatch',
      riskLevel: 'critical',
      timestamp: new Date(),
    }]
    const result = calculateRiskScore(events)
    expect(result.shouldBlock).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(60)
  })

  it('detects bot activity', () => {
    const events: SecurityEvent[] = [{
      type: 'bot_detected',
      riskLevel: 'medium',
      timestamp: new Date(),
    }]
    const result = calculateRiskScore(events)
    expect(result.score).toBeGreaterThanOrEqual(25)
  })
})
