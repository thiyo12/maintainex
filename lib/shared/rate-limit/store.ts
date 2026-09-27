export interface RateLimitResult {
  allowed: boolean
  count: number
  resetAt: Date
  remaining: number
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitResult>
  get(key: string): Promise<number>
  reset(key: string): Promise<void>
}

export type FailureMode = 'fail-open' | 'fail-closed'

export interface RateLimitPolicy {
  name: string
  limit: number
  windowMs: number
  failureMode: FailureMode
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}
