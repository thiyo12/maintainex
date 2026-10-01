import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const path = resolve(process.cwd(), 'app/api/mobile/v2/quotes/[id]/revision/route.ts')
const source = readFileSync(path, 'utf-8')

describe('quote revision route security invariants', () => {
  it('requires verified identity and rate limiting', () => {
    expect(source).toContain("user.identityStatus !== 'VERIFIED'")
    expect(source).toContain("policyName: 'QUOTE_CREATE'")
    expect(source).toContain("keyPrefix: 'quote_revision'")
  })

  it('requires company quote-submit permission rather than membership alone', () => {
    expect(source).toContain("resolveCompanyContext(")
    expect(source).toContain("'quotes:submit'")
  })

  it('binds revisions to the authenticated provider identity', () => {
    expect(source).toContain('originalQuote.providerId !== resolvedProviderId')
    expect(source).toContain('originalQuote.providerType !== resolvedProviderType')
    expect(source).toContain("originalQuote.status !== 'PENDING'")
  })

  it('requires the job to remain open and provider to remain matching-eligible', () => {
    expect(source).toContain("job.status !== 'OPEN'")
    const matchIndex = source.indexOf('findCandidates(prisma')
    const revisionIndex = source.indexOf('createQuoteRevision(prisma')
    expect(matchIndex).toBeGreaterThan(0)
    expect(revisionIndex).toBeGreaterThan(matchIndex)
  })

  it('uses the job service template for benchmark classification', () => {
    expect(source).toContain('if (job.serviceTemplateId)')
    expect(source).toContain('serviceTemplateId: job.serviceTemplateId')
    expect(source).not.toContain('serviceTemplateId: job.categoryId')
  })
})
