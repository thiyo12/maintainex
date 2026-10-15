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

  it('the persisted job decides the market, and coordinates outrank stored country', () => {
    // Phase 03 strengthened this: the persisted job is still the authority over
    // caller-supplied fields, but its validated coordinates now outrank its own
    // stored country, via the shared market resolver.
    expect(matchingIndex).toContain('const job = await client.marketplaceJob.findUnique')
    expect(matchingIndex).toContain('requireJobMarket(job)')
    expect(matchingIndex).toContain('countryCode: jobMarket.countryCode')
    expect(matchingIndex).not.toContain('countryCode: job.countryCode || input.countryCode')
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

const taskerDirectory = source('app/api/mobile/taskers/route.ts')
const findTaskerRoute = source('app/api/mobile/find-tasker/route.ts')
const deprecatedMatcher = source('lib/job-matching.ts')
const providerEligibility = source('lib/phase6/provider-eligibility.ts')

describe('Phase 03 — provider discovery never crosses markets', () => {
  it('the provider directory is market scoped and fails closed', () => {
    // Previously: `where = { isVerified: true }` with no market filter at all.
    expect(taskerDirectory).not.toMatch(/const where: any = \{ isVerified: true \}/)
    expect(taskerDirectory).toContain('resolveDirectoryMarket')
    expect(taskerDirectory).toContain('isSupportedMarket')
    expect(taskerDirectory).toContain('MARKET_NOT_SUPPORTED')
  })

  it('the directory filters providers by market in the query itself', () => {
    expect(taskerDirectory).toContain('countryCode: market')
    expect(taskerDirectory).toContain('user: { countryCode: market }')
  })

  it('the browse endpoint rejects an unsupported market instead of defaulting', () => {
    expect(findTaskerRoute).toContain('isSupportedMarket(requestedCountry)')
    expect(findTaskerRoute).toContain('MARKET_NOT_SUPPORTED')
  })

  it('the deprecated matcher never drops its market filter', () => {
    // Previously the filter was omitted entirely when countryCode was falsy.
    expect(deprecatedMatcher).not.toContain(
      "...(input.countryCode ? { countryCode: input.countryCode } : {})",
    )
    expect(deprecatedMatcher).toContain('const marketFilter =')
    expect(deprecatedMatcher).toContain('...marketFilter')
    expect(deprecatedMatcher).toContain("{ countryCode: '__none__' }")
  })

  it('company worker assignment is gated on the job market', () => {
    // Assignment overwrites the job's target provider, so it must not accept a
    // worker from another market.
    expect(providerEligibility).toContain('requireJobMarket(job)')
    expect(providerEligibility).toContain('Worker market does not match the job market')
    expect(providerEligibility).toContain('Worker market is unknown')
    expect(providerEligibility).toContain('Job service address is not in a supported market')
  })

  it('the worker market gate reads the validated job address, not stored metadata', () => {
    expect(providerEligibility).toContain('workerCountry !== jobMarket.countryCode')
    expect(providerEligibility).not.toContain('workerCountry !== job.countryCode')
  })
})

const offerMatcher = source('lib/offer-matcher.ts')
const matchingIndex2 = source('lib/matching/index.ts')

describe('Phase 03 — instant offers and matching queries fail closed', () => {
  it('the instant-offer matcher only draws from the booking market', () => {
    expect(offerMatcher).toContain('requireJobMarket')
    expect(offerMatcher).toContain('bookingMarket.countryCode')
    expect(offerMatcher).toContain('t.countryCode === bookingMarket.countryCode')
    expect(offerMatcher).toContain('no_tasker_available')
  })

  it('the cron-reachable notify path re-verifies the market', () => {
    // notifyNextOfferCandidate is reachable from app/api/cron/offer-timeouts and
    // bypasses matchOfferBooking, so it must not trust an already-ranked queue.
    const notifyIndex = offerMatcher.indexOf('export async function notifyNextOfferCandidate')
    expect(notifyIndex).toBeGreaterThan(-1)
    const notifyBody = offerMatcher.slice(notifyIndex)
    expect(notifyBody).toContain('requireJobMarket')
    expect(notifyBody).toContain('candidateCountry !== offerMarket.countryCode')
    expect(notifyBody).toContain("status: 'expired'")
  })

  it('matching queries never widen to every market when no market is established', () => {
    expect(matchingIndex2).not.toContain(
      'user: canonicalInput.countryCode ? { countryCode: canonicalInput.countryCode } : undefined',
    )
    expect(matchingIndex2).toContain("equals: canonicalInput.countryCode || '__none__'")
    expect(matchingIndex2).toContain("mode: 'insensitive'")
  })

  it('market comparison is case-insensitive so casing cannot hide a local provider', () => {
    expect(matchingIndex2).toContain("mode: 'insensitive'")
    expect(eligibility).toContain('.toUpperCase()')
  })
})
