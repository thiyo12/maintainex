import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const legacyJob = readFileSync(resolve(process.cwd(), 'app/api/mobile/jobs/[id]/route.ts'), 'utf-8')
const legacyJobs = readFileSync(resolve(process.cwd(), 'app/api/mobile/jobs/route.ts'), 'utf-8')
const legacyBid = readFileSync(resolve(process.cwd(), 'app/api/mobile/jobs/[id]/bid/route.ts'), 'utf-8')
const disputes = readFileSync(resolve(process.cwd(), 'app/api/mobile/disputes/route.ts'), 'utf-8')
const conversations = readFileSync(resolve(process.cwd(), 'app/api/mobile/conversations/route.ts'), 'utf-8')
const schedule = readFileSync(resolve(process.cwd(), 'app/api/mobile/v2/schedule/route.ts'), 'utf-8')
const mobileJobs = readFileSync(resolve(process.cwd(), 'apps/mobile/api/jobs.ts'), 'utf-8')

describe('legacy marketplace route hardening', () => {
  it('serializes V1 state transitions and ties assignment to an accepted bid', () => {
    expect(legacyJob).toContain('FROM "JobPosting"')
    expect(legacyJob).toContain('FOR UPDATE')
    expect(legacyJob).toContain("where: { jobId_taskerId: { jobId: id, taskerId } }")
    expect(legacyJob).toContain("data: { status: 'ACCEPTED' }")
    expect(legacyJob).toContain("data: { jobId: id, taskerId, status: 'ASSIGNED' }")
    expect(mobileJobs).toContain("JSON.stringify({ status: 'ASSIGNED', taskerId })")
  })

  it('requires the assigned tasker to start V1 work and scopes cancellation to participants', () => {
    expect(legacyJob).toContain("if (!isAssignedTasker || activeAssignment?.status !== 'ASSIGNED')")
    expect(legacyJob).toContain("const canCancel = isCustomerOwner || (job.status !== 'OPEN' && isAssignedTasker)")
    expect(legacyJob).toContain("status: { in: ['ASSIGNED', 'IN_PROGRESS'] }")
    expect(legacyJob).toContain("data: { status: 'CANCELLED' }")
  })

  it('does not expose competitor bids or non-open V1 jobs to unrelated providers', () => {
    expect(legacyJob).toContain("job.bids.filter(bid => bid.taskerId === viewerTaskerId)")
    expect(legacyJob).toContain("if (job.status !== 'OPEN')")
    expect(legacyJobs).toContain("{ assignments: { some: { taskerId: tasker.id } } }")
    expect(legacyJobs).toContain("j.bids.filter(bid => bid.taskerId === viewerTaskerId)")
  })

  it('enforces canonical eligibility on legacy bid creation', () => {
    expect(legacyBid).toContain('checkIndividualProviderEligibility(user.id)')
    expect(legacyBid).toContain("user.role !== 'TASKER'")
  })

  it('requires true job participation for disputes', () => {
    expect(disputes).toContain('resolveProviderActor(jobId, user.id)')
    expect(disputes).toContain("return NextResponse.json({ error: 'You are not part of this job' }, { status: 403 })")
    expect(disputes).toContain("status: { in: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] }")
  })

  it('does not let conversation creation bypass message scanning', () => {
    expect(conversations).toContain('scanChatMessage(rawInitialMessage')
    expect(conversations).toContain('safeInitialMessage')
  })

  it('requires authentication before exposing schedule clusters', () => {
    const authIndex = schedule.indexOf('authenticateRequest(request)')
    const rejectIndex = schedule.indexOf("return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })")
    const clusterIndex = schedule.indexOf("action === 'cluster'")
    expect(authIndex).toBeGreaterThan(0)
    expect(rejectIndex).toBeGreaterThan(authIndex)
    expect(clusterIndex).toBeGreaterThan(rejectIndex)
  })
})
