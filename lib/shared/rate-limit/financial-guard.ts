import { NextRequest, NextResponse } from 'next/server'
import { getTrustedClientIp } from '@/lib/security/client-ip'
import { MemoryRateLimitStore } from './memory-store'
import { getPolicy, buildRateLimitKey } from './policies'

const store = new MemoryRateLimitStore()
const policy = getPolicy('FINANCIAL_MUTATION')

function getClientIp(request: NextRequest): string {
  return getTrustedClientIp(request.headers)
}

export async function requireFinancialRateLimit(
  request: NextRequest,
  action: string
): Promise<NextResponse | null> {
  const userId = request.headers.get('x-user-id') || getClientIp(request)
  const key = buildRateLimitKey(`financial:${action}`, userId)

  try {
    const result = await store.increment(key, policy.windowMs)
    const limited = result.count > policy.limit

    if (limited) {
      const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many financial requests. Try again later.',
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.floor(result.resetAt.getTime() / 1000).toString(),
          },
        }
      )
    }

    return null
  } catch {
    if (policy.failureMode === 'fail-closed') {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Rate limit service unavailable.' } },
        { status: 429 }
      )
    }
    return null
  }
}
