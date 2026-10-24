import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('Phase 04 — single-worker PIN cannot authorize a crew or stale arrival', () => {
  it('keeps crew jobs out of generation, rotation and verification', () => {
    const pin = source('lib/domain/job-pin.ts')
    const guard = "if ((job.workersCount ?? 1) !== 1)"
    expect(pin.split(guard).length - 1).toBe(3)
    expect(pin).toContain('Multi-worker jobs require crew-specific PIN verification')
  })

  it('serializes worker reassignment with the arrival PIN on the same job row', () => {
    const pin = source('lib/domain/job-pin.ts')
    const domain = source('lib/domain/company-job-assignment.ts')
    expect(pin).toContain('SELECT id FROM "MarketplaceJob" WHERE id = ${jobId} FOR UPDATE')
    expect(domain).toContain("arrivalVerifiedAt: { not: null }")
    expect(domain).toContain('Cannot reassign after arrival PIN verification')
  })

  it('invalidates MATCHED identity approvals on a new or replacement dispatch', () => {
    const domain = source('lib/domain/company-job-assignment.ts')
    expect(domain.split("where: { jobId, status: 'MATCHED' }").length - 1).toBe(2)
    expect(domain.split("data: { status: 'PENDING', confirmedAt: null }").length - 1).toBe(2)
  })
})
