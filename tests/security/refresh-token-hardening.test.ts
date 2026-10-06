import { describe, expect, it } from 'vitest'
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseRefreshToken } from '@/lib/auth/refresh'
import { parseStaffRefreshToken } from '@/lib/auth/staff-rotation'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('refresh-token hardening', () => {
  const validSecret = crypto.randomBytes(64).toString('hex')

  it('accepts only bounded marketplace refresh tokens with the canonical opaque-secret shape', () => {
    expect(parseRefreshToken(`session_123.${validSecret}`)).toEqual({
      sessionId: 'session_123',
      secret: validSecret,
    })
    expect(parseRefreshToken('x.' + 'a'.repeat(10000))).toBeNull()
    expect(parseRefreshToken('session.' + 'a'.repeat(127))).toBeNull()
    expect(parseRefreshToken('session.' + 'z'.repeat(128))).toBeNull()
    expect(parseRefreshToken('session.bad.' + validSecret)).toBeNull()
  })

  it('applies the same bounded opaque-token contract to staff refresh tokens', () => {
    expect(parseStaffRefreshToken(`staff_session.${validSecret}`)).toEqual({
      sessionId: 'staff_session',
      secret: validSecret,
    })
    expect(parseStaffRefreshToken('x.' + 'a'.repeat(10000))).toBeNull()
    expect(parseStaffRefreshToken('staff.' + 'a'.repeat(127))).toBeNull()
    expect(parseStaffRefreshToken('staff.' + 'z'.repeat(128))).toBeNull()
  })

  it('rate-limits marketplace refresh and caps request payload size before rotation', () => {
    const route = source('app/api/mobile/auth/refresh/route.ts')

    expect(route).toContain("policyName: 'AUTH'")
    expect(route).toContain("keyPrefix: 'marketplace_refresh'")
    expect(route).toContain('MAX_REFRESH_BODY_BYTES')
    expect(route).toContain("status: 413")
    expect(route).toContain('Buffer.byteLength')
    expect(route).toContain('rotateMarketplaceRefreshToken')
  })

  it('records refresh security context from the canonical trusted client-IP resolver', () => {
    const route = source('app/api/mobile/auth/refresh/route.ts')

    expect(route).toContain('getTrustedClientIp(request.headers)')
    expect(route).not.toContain("request.headers.get('x-forwarded-for')")
  })
})
