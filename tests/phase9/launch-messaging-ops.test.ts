import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('Launch messaging + operations production guards', () => {
  it('conversation reads require participant membership', () => {
    const src = source('app/api/mobile/conversations/[id]/messages/route.ts')
    expect(src).toContain('conversationId_userId')
    expect(src).toContain("return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })")
  })

  it('chat is bounded without blocking ordinary negotiation', () => {
    const src = source('app/api/mobile/conversations/[id]/messages/route.ts')
    expect(src).toContain('const DAILY_MESSAGE_LIMIT = 100')
    expect(src).toContain('const BURST_MESSAGE_LIMIT = 20')
    expect(src).toContain('const BURST_WINDOW_MS = 5 * 60 * 1000')
    expect(src).toContain('const MAX_MESSAGE_LENGTH = 1000')
  })

  it('job cancellation requires OTP and refuses post-start cancellation', () => {
    const src = source('app/api/mobile/v2/jobs/[id]/cancel/route.ts')
    expect(src).toContain("action === 'REQUEST_OTP'")
    expect(src).toContain("action !== 'CONFIRM'")
    expect(src).toContain('workStartVerifiedAt')
    expect(src).toContain('WORK_ALREADY_STARTED')
    expect(src).toContain('refundEscrow')
  })

  it('company provider actions require owner or assigned worker', () => {
    const src = source('lib/domain/job-lifecycle.ts')
    const start = src.indexOf('export async function resolveProviderActor')
    const end = src.indexOf('export interface TransitionContext', start)
    const block = src.slice(start, end)
    expect(block).toContain('company?.userId === userId')
    expect(block).toContain('companyJobAssignment.findFirst')
    expect(block).toContain("status: { in: ['ACCEPTED', 'IN_PROGRESS'] }")
  })

  it('individual matching blocks immediate active work but supports scheduled conflict checks', () => {
    const src = source('lib/matching/eligibility.ts')
    expect(src).toContain('targetJob.preferredDate')
    expect(src).toContain('targetJob.preferredTimeSlot')
    expect(src).toContain("status: { in: ['QUOTE_ACCEPTED', 'IN_PROGRESS'] }")
    expect(src).toContain("providerType === 'COMPANY'")
  })

  it('company team response exposes worker userId for dispatch', () => {
    const src = source('app/api/mobile/company/team/route.ts')
    expect(src).toContain('userId: m.userId')
  })

  it('new job and company assignment notifications use foreground live-alert metadata', () => {
    const blast = source('lib/job-blast.ts')
    const assignment = source('app/api/mobile/company/assign/route.ts')
    expect(blast).toContain("type: 'NEW_JOB'")
    expect(blast).toContain("alertMode: 'ring'")
    expect(blast).toContain("pushChannelId: 'job_offers'")
    expect(assignment).toContain("type: 'COMPANY_ASSIGNMENT'")
    expect(assignment).toContain("alertMode: 'ring'")
    expect(assignment).toContain("pushChannelId: 'job_offers'")
  })

  it('matching waves create durable inbox notifications and live push metadata', () => {
    const src = source('lib/matching/waves.ts')
    expect(src).toContain('await createNotification({')
    expect(src).toContain("pushChannelId: 'job_offers'")
    expect(src).toContain("alertMode: 'ring'")
  })

  it('quote revisions notify the customer and remain formal server-side revisions', () => {
    const src = source('app/api/mobile/v2/quotes/[id]/revision/route.ts')
    expect(src).toContain('createQuoteRevision')
    expect(src).toContain('notifyQuoteRevised')
  })

  it('company commission is withheld at job release and weekly views are reconciliation-only', () => {
    const lifecycle = source('lib/domain/job-lifecycle.ts')
    const earnings = source('app/api/mobile/company/earnings/route.ts')
    const settle = source('app/api/mobile/v2/admin/commission-settle/route.ts')
    expect(lifecycle).toContain('commissionCents')
    expect(lifecycle).toContain("accountType: 'PLATFORM'")
    expect(earnings).toContain("commissionCollectionMode: 'WITHHELD_PER_JOB'")
    expect(earnings).toContain('weeklyCommissionStatements')
    expect(settle).toContain('reconciliation-only')
    expect(settle).not.toContain("currency: 'LKR'")
  })
})
