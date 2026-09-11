import { describe, it, expect } from 'vitest'
import { MemoryRateLimitStore } from '@/lib/rate-limit/memory-store'

describe('Rate Limiting', () => {
  it('allows requests within limit', async () => {
    const store = new MemoryRateLimitStore()
    const result = await store.increment('test-key', 60000)
    expect(result.allowed).toBe(true)
    expect(result.count).toBe(1)
  })

  it('tracks count correctly', async () => {
    const store = new MemoryRateLimitStore()
    await store.increment('test-key', 60000)
    await store.increment('test-key', 60000)
    const count = await store.get('test-key')
    expect(count).toBe(2)
  })

  it('resets key', async () => {
    const store = new MemoryRateLimitStore()
    await store.increment('test-key', 60000)
    await store.reset('test-key')
    const count = await store.get('test-key')
    expect(count).toBe(0)
  })

  it('uses separate windows', async () => {
    const store = new MemoryRateLimitStore()
    await store.increment('key1', 60000)
    await store.increment('key2', 60000)
    const count1 = await store.get('key1')
    const count2 = await store.get('key2')
    expect(count1).toBe(1)
    expect(count2).toBe(1)
  })
})
