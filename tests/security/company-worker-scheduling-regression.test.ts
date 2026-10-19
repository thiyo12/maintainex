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

  it('treats active individual assignments and reserved crew slots as busy when the new job has no date', () => {
    // Crew reservations consume real capacity even before every crew member accepts.
    expect(eligibility).toContain(
      "status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'CREW_RESERVED', 'CREW_ACCEPTED'] }",
    )
    // A job must not conflict with its own existing assignment.
    expect(eligibility).toContain("jobId: { not: requiredJobId }")
  })

  it('blocks ongoing jobs on any date and reserves crew slots for overlapping appointments', () => {
    // In-progress work remains busy even if its originally planned date has passed.
    expect(eligibility).toContain("{ status: 'IN_PROGRESS' }")
    // An assigned or reserved crew slot blocks the same appointment as a single worker.
    expect(eligibility).toContain(
      "status: { in: ['ASSIGNED', 'ACCEPTED', 'CREW_RESERVED', 'CREW_ACCEPTED'] }",
    )
    expect(eligibility).toContain("{ preferredDate: null }")
    expect(eligibility).toContain(
      "{ preferredDate: { gte: dayStart, lt: dayEnd }, ...slotFilter }",
    )
  })
})
