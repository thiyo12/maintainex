import { logger } from '../observability/logger'

export type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'login_lockout'
  | 'otp_send'
  | 'otp_verify_success'
  | 'otp_verify_failure'
  | 'password_change'
  | 'password_reset_request'
  | 'account_created'
  | 'account_suspended'
  | 'account_banned'
  | 'kyc_submitted'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'dispute_created'
  | 'dispute_resolved'
  | 'wallet_withdrawal'
  | 'wallet_deposit'
  | 'admin_action'
  | 'rate_limit_hit'
  | 'ip_blocked'
  | 'ip_unblocked'
  | 'idempotency_violation'
  | 'financial_amount_mismatch'
  | 'metadata_tamper_detected'
  | 'path_traversal_attempt'
  | 'unauthorized_access_attempt'
  | 'credential_stuffing_detected'
  | 'bot_detected'
  | 'ai_boundary_exceeded'

export type RiskLevel = 'info' | 'low' | 'medium' | 'high' | 'critical'

export interface SecurityEvent {
  type: SecurityEventType
  riskLevel: RiskLevel
  actorId?: string
  actorType?: 'user' | 'admin' | 'system' | 'anonymous'
  ip?: string
  userAgent?: string
  countryCode?: string
  details?: Record<string, unknown>
  requestId?: string
  timestamp: Date
}

const RISK_LEVEL_MAP: Record<SecurityEventType, RiskLevel> = {
  login_success: 'info',
  login_failure: 'low',
  login_lockout: 'medium',
  otp_send: 'info',
  otp_verify_success: 'info',
  otp_verify_failure: 'low',
  password_change: 'info',
  password_reset_request: 'low',
  account_created: 'info',
  account_suspended: 'medium',
  account_banned: 'high',
  kyc_submitted: 'info',
  kyc_approved: 'info',
  kyc_rejected: 'low',
  dispute_created: 'medium',
  dispute_resolved: 'info',
  wallet_withdrawal: 'medium',
  wallet_deposit: 'info',
  admin_action: 'info',
  rate_limit_hit: 'medium',
  ip_blocked: 'high',
  ip_unblocked: 'info',
  idempotency_violation: 'medium',
  financial_amount_mismatch: 'critical',
  metadata_tamper_detected: 'critical',
  path_traversal_attempt: 'high',
  unauthorized_access_attempt: 'high',
  credential_stuffing_detected: 'critical',
  bot_detected: 'medium',
  ai_boundary_exceeded: 'high',
}

export function emitSecurityEvent(event: Omit<SecurityEvent, 'timestamp' | 'riskLevel'>): void {
  try {
    const riskLevel = RISK_LEVEL_MAP[event.type] || 'info'

    const enriched: SecurityEvent = {
      ...event,
      riskLevel,
      timestamp: new Date(),
    }

    if (riskLevel === 'critical') {
      logger.error(`SECURITY: ${event.type}`, {
        eventType: event.type,
        actorId: event.actorId,
        actorType: event.actorType,
        ip: event.ip,
        countryCode: event.countryCode,
        details: event.details,
        requestId: event.requestId,
      })
    } else if (riskLevel === 'high' || riskLevel === 'medium') {
      logger.warn(`SECURITY: ${event.type}`, {
        eventType: event.type,
        actorId: event.actorId,
        actorType: event.actorType,
        ip: event.ip,
        countryCode: event.countryCode,
        details: event.details,
        requestId: event.requestId,
      })
    } else {
      logger.info(`SECURITY: ${event.type}`, {
        eventType: event.type,
        actorId: event.actorId,
        actorType: event.actorType,
        ip: event.ip,
        countryCode: event.countryCode,
        details: event.details,
        requestId: event.requestId,
      })
    }
  } catch {
    // Security event logging must never crash the caller
  }
}
