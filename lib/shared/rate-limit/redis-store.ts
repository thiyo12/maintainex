import { RateLimitStore, RateLimitResult } from './store'

let RedisIORedis: typeof import('ioredis').default | null = null

async function loadRedis(): Promise<typeof import('ioredis').default | null> {
  if (RedisIORedis) return RedisIORedis
  try {
    const mod = await import('ioredis')
    RedisIORedis = mod.default
    return RedisIORedis
  } catch {
    return null
  }
}

export class RedisRateLimitStore implements RateLimitStore {
  private client: any
  private ready: Promise<boolean>

  constructor(redisUrl: string) {
    this.ready = this.connect(redisUrl)
  }

  private async connect(url: string): Promise<boolean> {
    const Redis = await loadRedis()
    if (!Redis) return false
    try {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 3,
        retryStrategy(times: number) {
          if (times > 3) return null
          return Math.min(times * 200, 1000)
        },
        lazyConnect: true,
        enableReadyCheck: true,
        connectTimeout: 3000,
      })
      await this.client.connect()
      return true
    } catch {
      return false
    }
  }

  private async ensureReady(): Promise<boolean> {
    return this.ready
  }

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const ready = await this.ensureReady()
    if (!ready || !this.client) {
      throw new Error('Redis unavailable')
    }

    const now = Date.now()
    const ttlSeconds = Math.ceil(windowMs / 1000)

    const result = await this.client!.multi()
      .incr(key)
      .pexpire(key, windowMs)
      .exec()

    const count = result[0]?.[1] as number
    const resetAt = new Date(now + windowMs)

    return {
      allowed: true,
      count,
      resetAt,
      remaining: -1,
    }
  }

  async get(key: string): Promise<number> {
    const ready = await this.ensureReady()
    if (!ready || !this.client) return 0
    try {
      const val = await this.client!.get(key)
      return val ? parseInt(val, 10) : 0
    } catch {
      return 0
    }
  }

  async reset(key: string): Promise<void> {
    const ready = await this.ensureReady()
    if (!ready || !this.client) return
    try {
      await this.client!.del(key)
    } catch {}
  }
}
