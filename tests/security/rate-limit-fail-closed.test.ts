import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const path = resolve(process.cwd(), 'lib/shared/rate-limit/middleware.ts')
const source = readFileSync(path, 'utf-8')

describe('fail-closed rate limit contract', () => {
  it('returns an explicit response when the backing store fails closed', () => {
    expect(source).toContain("policy.failureMode === 'fail-closed'")
    expect(source).toContain("code: 'RATE_LIMIT_UNAVAILABLE'")
    expect(source).toContain('status: 503')
    expect(source).toContain("'Retry-After': '5'")
  })

  it('preserves fail-open behavior for lower-risk policies', () => {
    expect(source).toContain('return { allowed: true }')
  })
})
