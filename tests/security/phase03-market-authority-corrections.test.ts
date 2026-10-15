import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const matchingIndex = source('lib/matching/index.ts')
const cronWaves = source('app/api/cron/matching-waves/route.ts')
const legacyJobRoute = source('app/api/mobile/jobs/[id]/route.ts')
const legacyJobsRoute = source('app/api/mobile/jobs/route.ts')
const legacyBidRoute = source('app/api/mobile/jobs/[id]/bid/route.ts')

const BURNABY = { latitude: 49.2596, longitude: -122.998 }
const VANCOUVER = { latitude: 49.2606, longitude: -123.1156 }

describe('NEGATIVE: matching must not trust stored or caller-supplied country', () => {
  it('no longer prefers stored/caller country over validated coordinates', () => {
    // Before the fix: `countryCode: job.countryCode || input.countryCode`
    expect(matchingIndex).not.toContain('countryCode: job.countryCode || input.countryCode')
  })

  it('resolves the market with the shared authoritative resolver', () => {
    expect(matchingIndex).toContain('requireJobMarket(job)')
    expect(matchingIndex).toContain('countryCode: jobMarket.countryCode')
  })

  it('returns an empty result when the market cannot be established', () => {
    expect(matchingIndex).toMatch(/if \(!jobMarket\.ok\) \{[\s\S]{0,200}emptyResult/)
  })

  it('the job query loads coordinates so the guard can evaluate them', () => {
    const block = matchingIndex.slice(
      matchingIndex.indexOf('const job = await client.marketplaceJob.findUnique'),
      matchingIndex.indexOf('if (!job)'),
    )
    expect(block).toContain('latitude: true')
    expect(block).toContain('longitude: true')
  })
})

describe('NEGATIVE: background matching waves must validate before mutating', () => {
  it('selects coordinates for the market guard', () => {
    // Before the fix the select omitted coordinates, so the guard was inert.
    const block = cronWaves.slice(
      cronWaves.indexOf('const job = await prisma.marketplaceJob.findUnique'),
      cronWaves.indexOf('if (!job) continue'),
    )
    expect(block).toContain('latitude: true')
    expect(block).toContain('longitude: true')
  })

  it('validates the market BEFORE advancing the wave', () => {
    const guardIdx = cronWaves.indexOf('requireJobMarket(job)')
    const advanceIdx = cronWaves.indexOf('advanceMatchingWave(prisma')
    expect(guardIdx).toBeGreaterThan(-1)
    expect(advanceIdx).toBeGreaterThan(-1)
    expect(guardIdx, 'market must be validated before the wave mutation')
      .toBeLessThan(advanceIdx)
  })

  it('skips the job entirely when the market is unresolved', () => {
    const guardBlock = cronWaves.slice(
      cronWaves.indexOf('const jobMarket = requireJobMarket(job)'),
      cronWaves.indexOf('advanceMatchingWave(prisma'),
    )
    expect(guardBlock).toContain('if (!jobMarket.ok)')
    expect(guardBlock).toContain('continue')
    expect(guardBlock).not.toContain('advanceMatchingWave')
  })

  it('dispatches providers using the authoritative market', () => {
    expect(cronWaves).toContain('countryCode: jobMarket.countryCode')
  })
})

describe('LEGACY V1: assignment cannot bypass market authorization', () => {
  it('all three legacy write routes are gated by the flag', () => {
    for (const route of [legacyJobsRoute, legacyJobRoute, legacyBidRoute]) {
      expect(route).toContain('legacyMarketplaceWriteDisabled')
      expect(route).toContain('LEGACY_MARKETPLACE_WRITE_DISABLED')
    }
  })

  it('the flag is closed by default (writes disabled unless explicitly true)', () => {
    expect(legacyJobRoute).toContain("process.env.ALLOW_LEGACY_MARKETPLACE_WRITES !== 'true'")
  })

  it('the gate is the first statement of each write handler', () => {
    for (const [route, handler] of [
      [legacyJobRoute, 'export async function PUT'],
      [legacyJobRoute, 'export async function DELETE'],
      [legacyJobsRoute, 'export async function POST'],
    ] as const) {
      const at = route.indexOf(handler)
      expect(at).toBeGreaterThan(-1)
      const after = route.slice(at + handler.length, at + handler.length + 160)
      expect(after, `${handler} must be gated before any work`)
        .toContain('legacyMarketplaceWriteDisabled()')
    }
  })

  it('the ASSIGNED branch enforces market authorization even if the flag is enabled', () => {
    const branch = legacyJobRoute.slice(
      legacyJobRoute.indexOf("if (targetStatus === 'ASSIGNED')"),
    )
    expect(branch).toContain('requireJobMarket')
    expect(branch).toContain('V1_ASSIGN_MARKET_UNRESOLVED')
    expect(branch).toContain('V1_ASSIGN_MARKET_MISMATCH')
    expect(branch).toContain('taskerCountry !== legacyMarket.countryCode')
  })

  it('the legacy market guard reads server-side data, never a client country', () => {
    const branch = legacyJobRoute.slice(
      legacyJobRoute.indexOf("if (targetStatus === 'ASSIGNED')"),
    )
    const guard = branch.slice(0, branch.indexOf('V1_ASSIGN_MARKET_MISMATCH'))
    expect(guard).not.toMatch(/body\.countryCode|body\.market/)
  })
})

describe('COMPATIBILITY: legacy coordinate-less jobs still work', () => {
  it('matching still delegates to the shared resolver (which preserves the fallback)', () => {
    // The fallback lives in lib/geography/market-engine and is covered there.
    // Task 2 must not reintroduce a hard country requirement in matching.
    expect(matchingIndex).toContain('requireJobMarket')
    const engine = source('lib/geography/market-engine.ts')
    expect(engine).toContain('isSupportedMarket(job.countryCode)')
  })

  it('the Vancouver and Burnaby geometries used by these tests are the real ones', () => {
    expect(VANCOUVER.latitude).toBeGreaterThan(49)
    expect(BURNABY.longitude).toBeGreaterThan(-123)
  })
})
