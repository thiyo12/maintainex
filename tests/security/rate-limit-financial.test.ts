import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRateLimitStore } from '@/lib/rate-limit/memory-store'
import { getPolicy, buildRateLimitKey, RATE_LIMIT_POLICIES } from '@/lib/rate-limit/policies'

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: any, init?: any) => ({
      body,
      status: init?.status ?? 200,
      headers: init?.headers ?? {},
    })),
  },
}))

describe('MemoryRateLimitStore — Financial Rate Limiting', () => {
  let store: MemoryRateLimitStore

  beforeEach(() => {
    store = new MemoryRateLimitStore()
  })

  it('allows first request', async () => {
    const result = await store.increment('financial:test', 60000)
    expect(result.allowed).toBe(true)
    expect(result.count).toBe(1)
  })

  it('tracks request count within window', async () => {
    for (let i = 0; i < 5; i++) {
      await store.increment('financial:deposit:user1', 60000)
    }
    const count = await store.get('financial:deposit:user1')
    expect(count).toBe(5)
  })

  it('returns separate counts for different users', async () => {
    await store.increment('financial:withdraw:user1', 60000)
    await store.increment('financial:withdraw:user2', 60000)
    await store.increment('financial:withdraw:user1', 60000)

    expect(await store.get('financial:withdraw:user1')).toBe(2)
    expect(await store.get('financial:withdraw:user2')).toBe(1)
  })

  it('returns separate counts for different actions', async () => {
    await store.increment('financial:deposit:user1', 60000)
    await store.increment('financial:withdraw:user1', 60000)

    expect(await store.get('financial:deposit:user1')).toBe(1)
    expect(await store.get('financial:withdraw:user1')).toBe(1)
  })

  it('resets key correctly', async () => {
    await store.increment('financial:reset-test', 60000)
    await store.increment('financial:reset-test', 60000)
    expect(await store.get('financial:reset-test')).toBe(2)

    await store.reset('financial:reset-test')
    expect(await store.get('financial:reset-test')).toBe(0)
  })

  it('returns 0 for non-existent key', async () => {
    expect(await store.get('financial:nonexistent')).toBe(0)
  })

  it('resets all keys independently', async () => {
    await store.increment('key-a', 60000)
    await store.increment('key-b', 60000)
    await store.reset('key-a')

    expect(await store.get('key-a')).toBe(0)
    expect(await store.get('key-b')).toBe(1)
  })
})

describe('Financial Rate Limit Policy', () => {
  it('FINANCIAL_MUTATION policy has correct limits', () => {
    const policy = getPolicy('FINANCIAL_MUTATION')
    expect(policy.limit).toBe(20)
    expect(policy.windowMs).toBe(60 * 1000)
    expect(policy.failureMode).toBe('fail-closed')
    expect(policy.riskLevel).toBe('critical')
  })

  it('unknown policy falls back to DEFAULT', () => {
    const policy = getPolicy('NONEXISTENT')
    expect(policy.name).toBe('default')
    expect(policy.limit).toBe(100)
  })

  it('buildRateLimitKey produces correct format', () => {
    const key = buildRateLimitKey('financial:deposit', 'user-123')
    expect(key).toBe('rl:financial:deposit:user-123')
  })

  it('all financial policies have fail-closed', () => {
    const financialPolicies = ['FINANCIAL_MUTATION', 'LOGIN', 'OTP_SEND', 'OTP_VERIFY', 'PASSWORD_RESET']
    for (const name of financialPolicies) {
      const policy = getPolicy(name)
      expect(policy.failureMode).toBe('fail-closed')
    }
  })

  it('FINANCIAL_MUTATION policy is critical risk', () => {
    const policy = getPolicy('FINANCIAL_MUTATION')
    expect(policy.riskLevel).toBe('critical')
  })
})

describe('Financial Rate Limiter Integration', () => {
  it('rate limiter enforces financial mutation limits', async () => {
    const store = new MemoryRateLimitStore()
    const policy = getPolicy('FINANCIAL_MUTATION')
    const key = buildRateLimitKey(`financial:mutation`, 'test-user')

    let blockedAt = -1
    for (let i = 1; i <= policy.limit + 5; i++) {
      const result = await store.increment(key, policy.windowMs)
      if (result.count > policy.limit) {
        blockedAt = i
        break
      }
    }

    expect(blockedAt).toBe(policy.limit + 1)
  })

  it('different users have independent rate limits', async () => {
    const store = new MemoryRateLimitStore()
    const policy = getPolicy('FINANCIAL_MUTATION')

    const user1Key = buildRateLimitKey('financial:mutation', 'user-1')
    const user2Key = buildRateLimitKey('financial:mutation', 'user-2')

    for (let i = 0; i < policy.limit; i++) {
      await store.increment(user1Key, policy.windowMs)
    }

    const user2Result = await store.increment(user2Key, policy.windowMs)
    expect(user2Result.count).toBe(1)
    expect(user2Result.allowed).toBe(true)
  })

  it('window expiration resets the count', async () => {
    const store = new MemoryRateLimitStore()
    const key = buildRateLimitKey('financial:mutation', 'window-test')

    const result1 = await store.increment(key, 1)
    expect(result1.count).toBe(1)

    await new Promise(r => setTimeout(r, 10))

    const result2 = await store.increment(key, 1)
    expect(result2.count).toBe(1)
  })
})
