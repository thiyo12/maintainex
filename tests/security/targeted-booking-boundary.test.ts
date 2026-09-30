import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('targeted booking provider boundary', () => {
  it('stores the selected provider entity as the BOOK_NOW target', () => {
    const bookNow = read('lib/domain/book-now.ts')
    expect(bookNow).toContain('targetTaskerId: resolvedProviderEntityId')
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
})
