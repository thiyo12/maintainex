import type { RateLimitPolicy } from './store'

export type { RateLimitPolicy } from './store'

export const RATE_LIMIT_POLICIES: Record<string, RateLimitPolicy> = {
  LOGIN: {
    name: 'login',
    limit: 5,
    windowMs: 60 * 1000,
    failureMode: 'fail-closed',
    riskLevel: 'critical',
  },
  OTP_SEND: {
    name: 'otp_send',
    limit: 3,
    windowMs: 60 * 60 * 1000,
    failureMode: 'fail-closed',
    riskLevel: 'critical',
  },
  OTP_VERIFY: {
    name: 'otp_verify',
    limit: 5,
    windowMs: 5 * 60 * 1000,
    failureMode: 'fail-closed',
    riskLevel: 'critical',
  },
  PASSWORD_RESET: {
    name: 'password_reset',
    limit: 3,
    windowMs: 60 * 60 * 1000,
    failureMode: 'fail-closed',
    riskLevel: 'critical',
  },
  REGISTER: {
    name: 'register',
    limit: 3,
    windowMs: 60 * 60 * 1000,
    failureMode: 'fail-closed',
    riskLevel: 'high',
  },
  ADMIN_LOGIN: {
    name: 'admin_login',
    limit: 5,
    windowMs: 60 * 1000,
    failureMode: 'fail-closed',
    riskLevel: 'critical',
  },
  ADMIN_API: {
    name: 'admin_api',
    limit: 200,
    windowMs: 60 * 1000,
    failureMode: 'fail-open',
    riskLevel: 'low',
  },
  JOB_CREATE: {
    name: 'job_create',
    limit: 10,
    windowMs: 60 * 1000,
    failureMode: 'fail-open',
    riskLevel: 'medium',
  },
  QUOTE_CREATE: {
    name: 'quote_create',
    limit: 20,
    windowMs: 60 * 1000,
    failureMode: 'fail-open',
    riskLevel: 'medium',
  },
  SEARCH: {
    name: 'search',
    limit: 60,
    windowMs: 60 * 1000,
    failureMode: 'fail-open',
    riskLevel: 'low',
  },
  UPLOAD: {
    name: 'upload',
    limit: 10,
    windowMs: 60 * 1000,
    failureMode: 'fail-closed',
    riskLevel: 'medium',
  },
  FINANCIAL_MUTATION: {
    name: 'financial_mutation',
    limit: 20,
    windowMs: 60 * 1000,
    failureMode: 'fail-closed',
    riskLevel: 'critical',
  },
  DEFAULT: {
    name: 'default',
    limit: 100,
    windowMs: 60 * 1000,
    failureMode: 'fail-open',
    riskLevel: 'low',
  },
  AUTH: {
    name: 'auth',
    limit: 5,
    windowMs: 60 * 1000,
    failureMode: 'fail-closed',
    riskLevel: 'high',
  },
} as const

export function getPolicy(name: string): RateLimitPolicy {
  return RATE_LIMIT_POLICIES[name] || RATE_LIMIT_POLICIES.DEFAULT
}

export function buildRateLimitKey(prefix: string, identifier: string): string {
  return `rl:${prefix}:${identifier}`
}
