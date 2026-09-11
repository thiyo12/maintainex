import { RateLimitStore } from './store'
import { MemoryRateLimitStore } from './memory-store'
import { RedisRateLimitStore } from './redis-store'

let sharedStore: RateLimitStore | null = null

export function createRateLimitStore(): RateLimitStore {
  if (sharedStore) return sharedStore

  const redisUrl = process.env.REDIS_URL
  if (redisUrl) {
    try {
      sharedStore = new RedisRateLimitStore(redisUrl)
      return sharedStore
    } catch {
      // Fall through to memory
    }
  }

  sharedStore = new MemoryRateLimitStore()
  return sharedStore
}

export function resetRateLimitStore(): void {
  sharedStore = null
}
