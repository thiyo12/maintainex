import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('legacy marketplace write boundary', () => {
  const routes = [
    'app/api/mobile/jobs/route.ts',
    'app/api/mobile/jobs/[id]/route.ts',
    'app/api/mobile/jobs/[id]/bid/route.ts',
  ]

  for (const route of routes) {
    it(`${route} requires explicit legacy-write opt-in`, () => {
      const source = read(route)
      expect(source).toContain("process.env.ALLOW_LEGACY_MARKETPLACE_WRITES !== 'true'")
      expect(source).toContain("code: 'LEGACY_MARKETPLACE_WRITE_DISABLED'")
      expect(source).toContain('{ status: 410')
    })
  }

  it('keeps legacy reads available for historical records', () => {
    expect(read('app/api/mobile/jobs/route.ts')).toContain('export async function GET')
    expect(read('app/api/mobile/jobs/[id]/route.ts')).toContain('export async function GET')
  })

  it('blocks legacy create, state mutation, delete, and bid before their old state machines run', () => {
    const collection = read('app/api/mobile/jobs/route.ts')
    const detail = read('app/api/mobile/jobs/[id]/route.ts')
    const bid = read('app/api/mobile/jobs/[id]/bid/route.ts')

    const postStart = collection.indexOf('export async function POST')
    const postGuard = collection.indexOf('legacyMarketplaceWriteDisabled()', postStart)
    const postAuth = collection.indexOf('const user = await authenticateRequest(request)', postStart)
    expect(postGuard).toBeGreaterThan(postStart)
    expect(postAuth).toBeGreaterThan(postGuard)
    expect(detail.indexOf('legacyMarketplaceWriteDisabled()', detail.indexOf('export async function PUT'))).toBeGreaterThan(-1)
    expect(detail.indexOf('legacyMarketplaceWriteDisabled()', detail.indexOf('export async function DELETE'))).toBeGreaterThan(-1)
    expect(bid.indexOf('legacyMarketplaceWriteDisabled()', bid.indexOf('export async function POST'))).toBeGreaterThan(-1)
  })
})
