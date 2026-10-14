import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const catalogRoute = source('app/api/catalog/route.ts')
const websiteClient = source('app/(public)/services/client.tsx')
const legacyRoute = source('app/api/categories/route.ts')
const offersRoute = source('app/api/seasonal-offers/route.ts')
const sharedHelper = source('lib/api/request-country.ts')

describe('Phase 01 — website and mobile share the canonical V2 catalogue', () => {
  it('the public website reads the canonical V2 catalogue, not the legacy V1 one', () => {
    expect(websiteClient).toContain("fetch('/api/catalog'")
    expect(websiteClient).not.toContain("fetch('/api/categories')")
  })

  it('the public catalogue endpoint is served from the V2 models', () => {
    expect(catalogRoute).toContain('prisma.jobCategory.findMany')
    expect(catalogRoute).toContain('jobs: {')
    // It must not fall back to the legacy V1 Category/Service models.
    expect(catalogRoute).not.toContain('prisma.category.findMany')
    expect(catalogRoute).not.toContain('prisma.service.findMany')
  })

  it('only active V2 entries are published', () => {
    expect(catalogRoute).toContain('where: { isActive: true }')
    expect(catalogRoute).toMatch(/jobs:\s*\{\s*where: \{ isActive: true/)
  })

  it('a category with no usable job in the market is omitted entirely', () => {
    // Listing a market in metadata must never be enough to make it look live.
    expect(catalogRoute).toContain('isCatalogAvailableInMarket(category.countries, market)')
    expect(catalogRoute).toContain('isCatalogAvailableInMarket(job.countries, market)')
    expect(catalogRoute).toContain('if (jobs.length === 0) return null')
    expect(catalogRoute).toContain('.filter(Boolean)')
  })

  it('prices are filtered to the market currency and never invented for Canada', () => {
    expect(catalogRoute).toContain('currency: expectedCurrency')
    expect(catalogRoute).toContain('price: job.priceMin === null ? null : Number(job.priceMin)')
  })

  it('an unsupported market is refused rather than falling back', () => {
    expect(catalogRoute).toContain('isSupportedMarket(requested)')
    expect(catalogRoute).toContain('MARKET_NOT_SUPPORTED')
  })

  it('the legacy V1 catalogue endpoint is preserved for historical consumers', () => {
    // Historical bookings and legacy admin screens still depend on V1.
    expect(legacyRoute).toContain('prisma.category.findMany')
    expect(legacyRoute).toContain('serializeService')
  })
})

describe('Phase 01 — request market resolution is not duplicated', () => {
  it('the shared helper exists once and is reused by every public route', () => {
    expect(sharedHelper).toContain('export function requestCountry')
    expect(legacyRoute).toContain("from '@/lib/api/request-country'")
    expect(offersRoute).toContain("from '@/lib/api/request-country'")
    expect(catalogRoute).toContain("from '@/lib/api/request-country'")
  })

  it('no route keeps its own copy of the helper', () => {
    expect(legacyRoute).not.toContain('function requestCountry(request: NextRequest)')
    expect(offersRoute).not.toContain('function requestCountry(request: NextRequest)')
  })
})
