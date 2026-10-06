import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('booking IDOR authorization contracts', () => {
  it('binds mobile booking reads to the authenticated owner in the database query', () => {
    for (const path of [
      'app/api/mobile/bookings/[id]/route.ts',
      'app/api/mobile/quick-bookings/[id]/route.ts',
    ]) {
      const route = source(path)
      expect(route).toContain('authenticateRequest(request)')
      expect(route).toContain('where: { id, userId: user.id }')
      expect(route).toContain("status: 404")
    }
  })

  it('keeps the legacy customer booking read path owner-only', () => {
    const route = source('app/api/bookings/[id]/route.ts')
    expect(route).toContain("legacySession?.role === 'CUSTOMER'")
    expect(route).toContain('booking.userId !== legacySession.id')
    expect(route).toContain("status: 403")
  })

  it('routes staff booking reads and mutations through live CRM authorization', () => {
    const route = source('app/api/bookings/[id]/route.ts')
    expect(route).toContain("authorizeCrmBooking(request, id, 'jobs:view', 'read')")
    expect(route).toContain("authorizeCrmBooking(request, id, 'jobs:manage', 'mutation')")
    expect(route).toContain("authorizeCrmBooking(request, id, 'jobs:manage', 'sensitive')")
    expect(route).toContain('requireCountryScope: true')
  })
})
