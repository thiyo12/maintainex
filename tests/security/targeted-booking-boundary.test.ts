import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('targeted booking provider boundary', () => {
  it('validates targeted providers before generic job creation', () => {
    const jobs = read('app/api/mobile/v2/jobs/route.ts')

    expect(jobs).toContain('checkIndividualProviderEligibility(tasker.userId)')
    expect(jobs).toContain('checkCompanyEligibility(company.id)')
    expect(jobs).toContain('Cannot target yourself as the provider')
    expect(jobs).toContain('Cannot target your own company')
    expect(jobs).toContain('TARGET_PROVIDER_COUNTRY_MISMATCH')
    expect(jobs).toContain('Target provider lacks the required capability for this job')
    expect(jobs).toContain('Target company lacks the required capability for this job')
    expect(jobs).toContain("return NextResponse.json({ error: 'Target provider not found' }, { status: 404 })")
  })

  it('canonicalizes targeted IDs before storing the job', () => {
    const jobs = read('app/api/mobile/v2/jobs/route.ts')

    expect(jobs).toContain('targetTaskerId = tasker.userId')
    expect(jobs).toContain('targetTaskerId = company.id')
  })

  it('stores the selected provider entity as the BOOK_NOW target', () => {
    const bookNow = read('lib/domain/book-now.ts')
    expect(bookNow).toContain('targetTaskerId: resolvedProviderEntityId')
  })

  it('keeps retry blasts restricted to targeted taskers or companies', () => {
    const blast = read('lib/job-blast.ts')

    expect(blast).toContain('const [targetTasker, targetCompany] = await Promise.all([')
    expect(blast).toContain('candidate.userId === targetTasker.userId')
    expect(blast).toContain('candidate.companyId === targetCompany.id')
    expect(blast).toContain('candidate.providerId === targetCompany.id')
    expect(blast).toContain('companyCandidates = []')
  })

  it('does not blast targeted jobs to unrelated providers', () => {
    const jobs = read('app/api/mobile/v2/jobs/route.ts')
    expect(jobs).toContain('if (!job.targetTaskerId)')
    expect(jobs).toContain('await blastJobToTaskers(job.id)')
  })

  it('hides targeted open jobs from provider lists unless the target matches', () => {
    const jobs = read('app/api/mobile/v2/jobs/route.ts')
    expect(jobs).toContain('{ targetTaskerId: null }')
    expect(jobs).toContain('{ targetTaskerId: { in: uniqueTargetIds } }')
  })

  it('rejects non-target quote submission before and inside the locked transaction', () => {
    const quotes = read('app/api/mobile/v2/quotes/route.ts')
    expect(quotes).toContain("code: 'TARGET_PROVIDER_MISMATCH'")
    expect(quotes).toContain('if (job.targetTaskerId && !allowedTargetIds.has(job.targetTaskerId))')
    expect(quotes).toContain('if (lockedJob.targetTaskerId && !allowedTargetIds.has(lockedJob.targetTaskerId))')
  })

  it('preserves accepted company access after target moves to an assigned worker', () => {
    const detail = read('app/api/mobile/v2/jobs/[id]/route.ts')

    expect(detail).toContain('const participantCompanyIds = [...new Set([')
    expect(detail).toContain("providerType: 'COMPANY'")
    expect(detail).toContain("status: 'ACCEPTED'")
    expect(detail).toContain('hasAcceptedCompanyParticipation = Boolean(acceptedCompanyQuote)')
    expect(detail).toContain(
      '!readableTargetIds.has(job.targetTaskerId) && !hasAcceptedCompanyParticipation'
    )
  })

  it('protects targeted job detail reads from unrelated authenticated users', () => {
    const detail = read('app/api/mobile/v2/jobs/[id]/route.ts')
    expect(detail).toContain('if (!isOwner && job.targetTaskerId)')
    expect(detail).toContain('getReadableCompanyIds(user.id)')
    expect(detail).toContain('if (!readableTargetIds.has(job.targetTaskerId))')
    expect(detail).toContain('This direct booking is reserved for another provider')
  })
})
