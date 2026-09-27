import { NextRequest, NextResponse } from 'next/server'
import { createRateLimitStore } from './index'
import { getPolicy, buildRateLimitKey, type RateLimitPolicy } from './policies'
import { getRequestId } from '../observability/request-context'

export interface RateLimitOptions {
  policy?: RateLimitPolicy
  policyName?: string
  keyPrefix: string
  identifier: string
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
}

export async function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const policy = options.policy || getPolicy(options.policyName || 'DEFAULT')
  const store = createRateLimitStore()
  const key = buildRateLimitKey(options.keyPrefix, options.identifier)

  try {
    const result = await store.increment(key, policy.windowMs)
    const remaining = Math.max(0, policy.limit - result.count)
    const limited = result.count > policy.limit

    if (limited) {
      const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)

      if (policy.failureMode === 'fail-closed') {
        const requestId = getRequestId()
        return {
          allowed: false,
          response: NextResponse.json(
            {
              error: {
                code: 'RATE_LIMITED',
                message: 'Too many requests. Try again later.',
                requestId,
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
          ),
        }
      }
    }

    return { allowed: true }
  } catch {
    if (policy.failureMode === 'fail-closed') {
      return { allowed: false }
    }
    return { allowed: true }
  }
}

export function ipKey(request: NextRequest): string {
  return getClientIp(request)
}

export function userKey(request: NextRequest): string {
  const userId = request.headers.get('x-user-id')
  return userId || getClientIp(request)
}

export function hashKey(value: string): string {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex').slice(0, 16)
}
