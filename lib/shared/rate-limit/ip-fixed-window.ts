// Fixed-window in-memory IP rate limiter used by the Next.js middleware.
// Extracted verbatim from middleware.ts during Phase A (structure only —
// no behavior change): same window math, same auth/admin/default budgets,
// same 60s cleanup interval and 120s retention.

const RATE_LIMITS: Record<string, { maxRequests: number; windowSeconds: number }> = {
  default: { maxRequests: 100, windowSeconds: 60 },
  auth: { maxRequests: 5, windowSeconds: 60 },
  admin: { maxRequests: 200, windowSeconds: 60 },
}

const inMemoryRateLimit = new Map<string, { count: number; windowStart: number }>()

export function getInMemoryRateLimit(ip: string, limitType: string): { remaining: number; resetAt: Date; limited: boolean } {
  const config = RATE_LIMITS[limitType] || RATE_LIMITS.default
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  const windowStart = now - (now % windowMs)
  const key = `${ip}:${limitType}:${windowStart}`
  const entry = inMemoryRateLimit.get(key)
  if (!entry || entry.windowStart !== windowStart) {
    inMemoryRateLimit.set(key, { count: 1, windowStart })
    return { remaining: config.maxRequests - 1, resetAt: new Date(windowStart + windowMs), limited: false }
  }
  entry.count++
  const remaining = Math.max(0, config.maxRequests - entry.count)
  return { remaining, resetAt: new Date(windowStart + windowMs), limited: remaining <= 0 }
}

if (typeof globalThis.__rateLimitCleanup === 'undefined') {
  globalThis.__rateLimitCleanup = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of inMemoryRateLimit.entries()) {
      if (now - entry.windowStart > 120000) {
        inMemoryRateLimit.delete(key)
      }
    }
  }, 60000)
}

declare global {
  var __rateLimitCleanup: ReturnType<typeof setInterval> | undefined
}
