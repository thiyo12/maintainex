const ipRequests = new Map<string, { count: number; resetAt: number }>()

const WINDOW_MS = 60 * 1000
const MAX_REQUESTS = 10

export function checkRateLimit(ip: string, maxRequests = MAX_REQUESTS, windowMs = WINDOW_MS): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = ipRequests.get(ip)

  if (!entry || now > entry.resetAt) {
    ipRequests.set(ip, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs }
  }

  entry.count += 1
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt }
}
