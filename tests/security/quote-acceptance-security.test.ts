import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const lifecyclePath = resolve(process.cwd(), 'lib/domain/job-lifecycle.ts')
const providerAvailabilityPath = resolve(process.cwd(), 'lib/domain/provider-availability.ts')
const routePath = resolve(process.cwd(), 'app/api/mobile/v2/jobs/[id]/select-quote/route.ts')
const lifecycleSource = readFileSync(lifecyclePath, 'utf-8')
const providerAvailabilitySource = readFileSync(providerAvailabilityPath, 'utf-8')
const routeSource = readFileSync(routePath, 'utf-8')

describe('quote acceptance security and commercial invariants', () => {
  it('revalidates canonical provider eligibility before acceptance', () => {
    const eligibilityIndex = lifecycleSource.indexOf('evaluateEligibility({')
    const transactionIndex = lifecycleSource.indexOf('await prisma.$transaction(async (tx) =>', lifecycleSource.indexOf('export async function acceptJobQuote'))
    expect(eligibilityIndex).toBeGreaterThan(0)
    expect(transactionIndex).toBeGreaterThan(eligibilityIndex)
    expect(lifecycleSource).toContain("throw new Error('Quote provider is no longer available')")
  })

  it('locks and rechecks provider account state inside acceptance transaction', () => {
    const acceptStart = lifecycleSource.indexOf('export async function acceptJobQuote')
    const transactionIndex = lifecycleSource.indexOf('await prisma.$transaction(async (tx) =>', acceptStart)
    const lockIndex = lifecycleSource.indexOf('lockAndAssertProviderAvailable(', transactionIndex)

    expect(lifecycleSource).toContain("import { lockAndAssertProviderAvailable } from '@/lib/domain/provider-availability'")
    expect(transactionIndex).toBeGreaterThan(acceptStart)
    expect(lockIndex).toBeGreaterThan(transactionIndex)

    expect(providerAvailabilitySource).toContain('FROM "User"')
    expect(providerAvailabilitySource).toContain('FROM "TaskerProfile"')
    expect(providerAvailabilitySource).toContain('FROM "CompanyProfile"')
    expect(providerAvailabilitySource).toContain('FROM "TeamMember"')
    expect(providerAvailabilitySource).toContain('FOR UPDATE')
  })

  it('rejects a quote whose currency no longer matches the job market', () => {
    expect(lifecycleSource).toContain('quote.currency !== pricingConfig.defaultCurrency')
    expect(lifecycleSource).toContain('currency does not match the job market')
  })

  it('snapshots exact accepted revision and authorized amount on the job', () => {
    expect(lifecycleSource).toContain('approvedQuoteId: quoteId')
    expect(lifecycleSource).toContain('approvedQuoteVersion: quote.revisionNumber')
    expect(lifecycleSource).toContain('finalAuthorizedAmountCents: acceptedAmount')
  })

  it('uses totalCents when present as the accepted escrow amount', () => {
    expect(lifecycleSource).toContain('const acceptedAmount = quote.totalCents ?? quote.price')
    expect(lifecycleSource).toContain('amount: acceptedAmount')
    expect(lifecycleSource).toContain('quoteAmountMinor: acceptedAmount')
  })

  it('loads reusable escrow inside the same acceptance transaction', () => {
    const acceptStart = lifecycleSource.indexOf('export async function acceptJobQuote')
    const transactionIndex = lifecycleSource.indexOf('await prisma.$transaction(async (tx) =>', acceptStart)
    const escrowIndex = lifecycleSource.indexOf('const existingEscrow = await tx.jobEscrow.findFirst', transactionIndex)
    expect(transactionIndex).toBeGreaterThan(acceptStart)
    expect(escrowIndex).toBeGreaterThan(transactionIndex)
  })

  it('serializes bigint quote money fields in the select-quote response', () => {
    expect(routeSource).toContain('subtotalCents: result.quote.subtotalCents?.toString() ?? null')
    expect(routeSource).toContain('taxCents: result.quote.taxCents?.toString() ?? null')
    expect(routeSource).toContain('totalCents: result.quote.totalCents?.toString() ?? null')
  })
})
