import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('legacy mobile privacy boundary', () => {
  it('scopes historical booking detail to the owning user', () => {
    const route = read('app/api/mobile/bookings/[id]/route.ts')
    expect(route).toContain('where: { id, userId: user.id }')
  })

  it('disables legacy booking creation outside the V2 marketplace lifecycle', () => {
    const route = read('app/api/mobile/bookings/route.ts')
    expect(route).toContain("code: 'LEGACY_BOOKING_DISABLED'")
    expect(route).toContain('{ status: 410 }')
    expect(route).not.toContain('prisma.booking.create')
  })

  it('does not expose contact details or exact coordinates from browse profiles', () => {
    const findOne = read('app/api/mobile/find-tasker/[id]/route.ts')
    const findMany = read('app/api/mobile/find-tasker/route.ts')
    const tasker = read('app/api/mobile/taskers/[id]/route.ts')

    expect(findOne).not.toContain('phone: tasker.user.phone')
    expect(findOne).not.toContain('email: tasker.user.email')
    expect(findOne).not.toContain('latitude: tasker.latitude')
    expect(findOne).not.toContain('longitude: tasker.longitude')
    expect(findMany).not.toContain('latitude: c.profile.latitude')
    expect(findMany).not.toContain('longitude: c.profile.longitude')
    expect(tasker).not.toContain('latitude: tasker.latitude')
    expect(tasker).not.toContain('longitude: tasker.longitude')
  })

  it('returns live coordinates only for protected active accepted work', () => {
    const location = read('app/api/mobile/taskers/[id]/location/route.ts')
    expect(location).toContain("where: { jobId: job.id, status: 'ACCEPTED' }")
    expect(location).toContain("where: { jobId: job.id, status: 'PROTECTED' }")
    expect(location).toContain("return NextResponse.json({ sharing: false, location: null })")
    expect(location).not.toContain('const hasQuote =')
  })

  it('validates coordinate writes before storing them', () => {
    const route = read('app/api/mobile/taskers/location/route.ts')
    expect(route).toContain('Number.isFinite(parsedLatitude)')
    expect(route).toContain('parsedLatitude < -90')
    expect(route).toContain('parsedLongitude > 180')
  })
})
