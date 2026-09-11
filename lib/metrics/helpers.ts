import { incrementCounter, setGauge, observeHistogram } from './index'

export function recordApiRequest(method: string, path: string, statusCode: number, durationMs: number): void {
  incrementCounter('http_requests_total', 1, { method, path, status: statusCode.toString() })
  observeHistogram('http_request_duration_ms', durationMs, { method, path })
  if (statusCode >= 400) {
    incrementCounter('http_errors_total', 1, { method, path, status: statusCode.toString() })
  }
}

export function recordAuthEvent(type: 'login' | 'logout' | 'otp_send' | 'otp_verify' | 'password_reset', success: boolean): void {
  incrementCounter('auth_events_total', 1, { type, success: success.toString() })
}

export function recordSecurityEvent(type: string, riskLevel: string): void {
  incrementCounter('security_events_total', 1, { type, riskLevel })
}

export function recordRateLimitHit(policy: string): void {
  incrementCounter('rate_limit_hits_total', 1, { policy })
}

export function recordDatabaseQuery(operation: string, durationMs: number, success: boolean): void {
  incrementCounter('db_queries_total', 1, { operation, success: success.toString() })
  observeHistogram('db_query_duration_ms', durationMs, { operation })
}

export function recordBackgroundJob(jobType: string, status: 'started' | 'completed' | 'failed'): void {
  incrementCounter('background_jobs_total', 1, { jobType, status })
}

export function setConnectedUsers(count: number): void {
  setGauge('connected_users', count)
}

export function setDatabasePoolStats(active: number, idle: number, total: number): void {
  setGauge('db_pool_active', active)
  setGauge('db_pool_idle', idle)
  setGauge('db_pool_total', total)
}
