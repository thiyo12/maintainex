import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const matchRoute = source('app/api/mobile/v2/match/[jobId]/route.ts')
const eligibility = source('lib/matching/eligibility.ts')
const matchingIndex = source('lib/matching/index.ts')

describe('Phase 03 — discovery only returns eligible local providers', () => {
  it('the match endpoint resolves the market from the authoritative address', () => {
    expect(matchRoute).toContain("import { requireJobMarket } from '@/lib/geography/market-engine'")
    expect(matchRoute).toContain('requireJobMarket(job)')
    expect(matchRoute).toContain('countryCode: jobMarket.countryCode')
  })

  it('the match endpoint fails closed instead of matching without a market', () => {
    expect(matchRoute).toContain('jobMarket.code')
    expect(matchRoute).toMatch(/if \(!jobMarket\.ok\)[\s\S]{0,200}status: 409/)
  })

  it('no endpoint reaches matching with a GLOBAL fallback market', () => {
    // A GLOBAL market has no jurisdiction gate, which would widen eligibility.
    expect(matchRoute).not.toContain("job.countryCode || 'GLOBAL'")
    expect(matchRoute).not.toContain('countryCode: job.countryCode')
  })

  it('persisted job market still wins over caller-supplied matching fields', () => {
    expect(matchingIndex).toContain('countryCode: job.countryCode || input.countryCode')
    expect(matchingIndex).toContain('const job = await client.marketplaceJob.findUnique')
  })

  it('service-area eligibility fails closed when no market can be established', () => {
    // Previously `if (!job.countryCode) return true`, which surfaced providers
    // from any country for a job with no market at all.
    expect(eligibility).not.toContain('if (!job.countryCode) return true')
    expect(eligibility).toContain('if (!job.countryCode) return false')
  })

  it('compares provider and job markets case-insensitively', () => {
    // Casing differences must never silently exclude a legitimately local provider.
    expect(eligibility).toContain("const jobCountry = job.countryCode.toUpperCase()")
    expect(eligibility).toContain(
      "const providerCountry = (profile?.countryCode || user?.countryCode || '').toUpperCase()",
    )
    expect(eligibility).toContain(
      "const providerCountry = (company.countryCode || company.user?.countryCode || '').toUpperCase()",
    )
    expect(eligibility).not.toContain('providerCountry !== job.countryCode')
  })

  it('both individuals and companies are gated on the same authoritative market', () => {
    // Each provider-country resolution must be immediately rejected when it
    // disagrees with the job market.
    const gates = eligibility.match(
      /const providerCountry = \([^)]*\)[\s\S]{0,40}?if \(providerCountry !== jobCountry\) return false/g,
    )
    expect(gates).not.toBeNull()
    expect(gates).toHaveLength(2)
  })
})
