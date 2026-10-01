import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const routePath = resolve(process.cwd(), 'app/api/quotes/route.ts')
const routeSource = readFileSync(routePath, 'utf-8')

describe('Line-item quote route security invariants', () => {
  it('requires verified identity and account restriction checks', () => {
    expect(routeSource).toContain('assertNotSuspended(user)')
    expect(routeSource).toContain("user.identityStatus !== 'VERIFIED'")
  })

  it('rate limits quote creation before quote writes', () => {
    const rateLimitIndex = routeSource.indexOf('checkRateLimit(request')
    const createIndex = routeSource.indexOf('tx.jobQuote.create')
    expect(rateLimitIndex).toBeGreaterThan(0)
    expect(createIndex).toBeGreaterThan(rateLimitIndex)
  })

  it('requires canonical company membership for company quotes', () => {
    expect(routeSource).toContain("resolveCompanyContext(user.id, companyId, 'quotes:submit')")
    expect(routeSource).toContain("resolvedProviderType = 'COMPANY'")
    expect(routeSource).toContain('resolvedProviderId = companyId')
  })

  it('uses the matching engine before creating a new quote', () => {
    const matchingIndex = routeSource.indexOf('findCandidates(prisma')
    const eligibleIndex = routeSource.indexOf('const eligible = matching.candidates.some')
    const createIndex = routeSource.indexOf('tx.jobQuote.create')
    expect(matchingIndex).toBeGreaterThan(0)
    expect(eligibleIndex).toBeGreaterThan(matchingIndex)
    expect(createIndex).toBeGreaterThan(eligibleIndex)
  })

  it('rejects quoting on the authenticated user own job', () => {
    expect(routeSource).toContain('job.customerId === user.id')
    expect(routeSource).toContain('Cannot quote on your own job')
  })

  it('binds country, currency, and service template to the authoritative job', () => {
    expect(routeSource).toContain('const canonicalCountry = (job.countryCode')
    expect(routeSource).toContain('countryCode.toUpperCase() !== canonicalCountry')
    expect(routeSource).toContain('getCurrencyForCountry(canonicalCountry)')
    expect(routeSource).toContain('currency.toUpperCase() !== canonicalCurrency')
    expect(routeSource).toContain('serviceTemplateId !== canonicalTemplateId')
  })

  it('requires an owned PENDING parent before revising a quote', () => {
    expect(routeSource).toContain('parent.jobId !== job.id')
    expect(routeSource).toContain('parent.providerId !== resolvedProviderId')
    expect(routeSource).toContain('parent.providerType !== resolvedProviderType')
    expect(routeSource).toContain("parent.status !== 'PENDING'")
    expect(routeSource).toContain('createQuoteRevision(prisma')
  })

  it('does not directly supersede an arbitrary client-supplied quote id', () => {
    expect(routeSource).not.toContain("where: { id: parentQuoteId },\n          data: { status: 'SUPERSEDED' }")
  })

  it('serialises bigint-backed money fields before returning JSON', () => {
    expect(routeSource).toContain('function serialiseQuote')
    expect(routeSource).toContain('quote.subtotalCents?.toString?.()')
    expect(routeSource).toContain('minorUnitsToMajorUnits(quote.price, currency)')
  })
})
