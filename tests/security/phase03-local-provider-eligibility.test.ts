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

const jobBlast = source('lib/job-blast.ts')
const jobLifecycle = source('lib/domain/job-lifecycle.ts')
const cronWaves = source('app/api/cron/matching-waves/route.ts')
const mobileRevision = source('app/api/mobile/v2/quotes/[id]/revision/route.ts')
const webQuotes = source('app/api/quotes/route.ts')

describe('Phase 03 — every provider dispatch path is market isolated', () => {
  it('the job blast dispatcher resolves the market from the validated address', () => {
    expect(jobBlast).toContain('requireJobMarket(job)')
    expect(jobBlast).toContain('countryCode: jobMarket.countryCode')
    expect(jobBlast).not.toContain("job.countryCode || 'GLOBAL'")
  })

  it('the background matching wave never dispatches for an unresolved market', () => {
    expect(cronWaves).toContain('requireJobMarket(job)')
    expect(cronWaves).toContain('countryCode: jobMarket.countryCode')
    expect(cronWaves).not.toContain("countryCode: job.countryCode || 'GLOBAL'")
  })

  it('quote revisions on mobile resolve the market before eligibility', () => {
    expect(mobileRevision).toContain('requireJobMarket(job)')
    expect(mobileRevision).toContain('countryCode: jobMarket.countryCode')
    expect(mobileRevision).not.toContain("job.countryCode || 'GLOBAL'")
  })

  it('the web quote route no longer trusts the stored country with an LK fallback', () => {
    expect(webQuotes).toContain('requireJobMarket(job)')
    expect(webQuotes).not.toContain("job.countryCode || 'LK'")
  })
})

describe('Phase 03 — quote acceptance can no longer fail open', () => {
  it('accepting a quote resolves the market from the validated address', () => {
    expect(jobLifecycle).toContain('requireJobMarket(job)')
    expect(jobLifecycle).toContain("throw new Error('JOB_MARKET_UNRESOLVED: ' + jobMarket.error)")
    expect(jobLifecycle).not.toContain("countryCode: job.countryCode || 'GLOBAL'")
  })

  it('the pricing-country guard no longer has a GLOBAL escape hatch', () => {
    // Previously: `if (jobCountry !== 'GLOBAL' && jobCountry !== pricingConfig.countryCode)`
    // which skipped the check entirely for marketless jobs.
    expect(jobLifecycle).not.toContain("jobCountry !== 'GLOBAL'")
    expect(jobLifecycle).toContain('if (jobCountry !== pricingConfig.countryCode)')
  })

  it('eligibility for an accepted quote uses the authoritative market', () => {
    expect(jobLifecycle).toContain('countryCode: jobCountry')
    expect(jobLifecycle).toContain('const jobCountry = jobMarket.countryCode')
  })
})
