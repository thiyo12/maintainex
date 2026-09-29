import { RateLimitStore, RateLimitResult } from './store'

declare global {
  // eslint-disable-next-line no-var
  var __rateLimitCleanup: ReturnType<typeof setInterval> | undefined
}

interface WindowEntry {
  count: number
  windowStart: number
  windowMs: number
}

export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, WindowEntry>()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    if (typeof globalThis.__rateLimitCleanup === 'undefined') {
      this.cleanupTimer = setInterval(() => this.cleanup(), 60000)
      globalThis.__rateLimitCleanup = this.cleanupTimer
    }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart > entry.windowMs * 2) {
        this.store.delete(key)
      }
    }
  }

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now()
    const windowStart = now - (now % windowMs)
    const entry = this.store.get(key)

    if (!entry || entry.windowStart !== windowStart || entry.windowMs !== windowMs) {
      this.store.set(key, { count: 1, windowStart, windowMs })
      return {
        allowed: true,
        count: 1,
        resetAt: new Date(windowStart + windowMs),
        remaining: -1,
      }
    }

    entry.count++
    return {
      allowed: true,
      count: entry.count,
      resetAt: new Date(windowStart + windowMs),
      remaining: -1,
    }
  }

  async get(key: string): Promise<number> {
    const entry = this.store.get(key)
    if (!entry) return 0
    const now = Date.now()
    if (now - entry.windowStart > entry.windowMs) {
      this.store.delete(key)
      return 0
    }
    return entry.count
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key)
  }
}
