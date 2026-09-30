import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const eligibility = readFileSync(
  resolve(process.cwd(), 'lib/phase6/provider-eligibility.ts'),
  'utf-8',
)

describe('company worker scheduling regressions', () => {
  it('checks the entire requested calendar day instead of exact DateTime equality', () => {
    expect(eligibility).toContain('dayStart.setHours(0, 0, 0, 0)')
    expect(eligibility).toContain('dayEnd.setDate(dayEnd.getDate() + 1)')
    expect(eligibility).toContain('preferredDate: { gte: dayStart, lt: dayEnd }')
    expect(eligibility).not.toContain('preferredDate: job.preferredDate')
  })

  it('treats anytime and unspecified slots as conflicting with a concrete slot', () => {
    expect(eligibility).toContain("{ preferredTimeSlot: job.preferredTimeSlot }")
    expect(eligibility).toContain("{ preferredTimeSlot: 'anytime' }")
    expect(eligibility).toContain("{ preferredTimeSlot: null }")
  })

  it('only considers active company assignments as blocking work', () => {
    expect(eligibility).toContain("status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] }")
    expect(eligibility).toContain("jobId: { not: requiredJobId }")
  })
})
