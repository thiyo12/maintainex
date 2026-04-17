import { prisma } from '@/lib/prisma'

interface RateLimitConfig {
  maxRequests: number
  windowSeconds: number
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: { maxRequests: 100, windowSeconds: 60 },
  auth: { maxRequests: 5, windowSeconds: 60 },
  export: { maxRequests: 10, windowSeconds: 60 },
  bulk: { maxRequests: 5, windowSeconds: 60 },
}

export async function checkRateLimit(
  identifier: string,
  type: 'IP' | 'API_KEY' | 'USER',
  endpoint: string,
  method: string,
  limitType = 'default'
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const config = RATE_LIMITS[limitType] || RATE_LIMITS.default
  const windowStart = new Date(Date.now() - config.windowSeconds * 1000)
  const windowEnd = new Date()
  
  const existing = await prisma.rateLimitLog.findFirst({
    where: {
      identifier,
      type,
      endpoint,
      method,
      windowStart: { gte: windowStart },
    },
    orderBy: { windowStart: 'desc' },
  })

  if (!existing || existing.windowStart < windowStart) {
    await prisma.rateLimitLog.create({
      data: {
        identifier,
        type,
        endpoint,
        method,
        requestCount: 1,
        windowStart: new Date(),
        windowEnd: new Date(Date.now() + config.windowSeconds * 1000),
        limited: false,
      },
    })
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: new Date(Date.now() + config.windowSeconds * 1000),
    }
  }

  const newCount = existing.requestCount + 1
  const limited = newCount > config.maxRequests

  if (!limited) {
    await prisma.rateLimitLog.update({
      where: { id: existing.id },
      data: { requestCount: newCount },
    })
  } else {
    await prisma.rateLimitLog.update({
      where: { id: existing.id },
      data: { 
        limited: true,
        blockUntil: new Date(Date.now() + config.windowSeconds * 1000),
      },
    })
  }

  return {
    allowed: !limited,
    remaining: Math.max(0, config.maxRequests - newCount),
    resetAt: existing.windowStart,
  }
}