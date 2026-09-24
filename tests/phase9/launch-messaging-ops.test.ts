import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function source(path: string) {
  return readFileSync(resolve(__dirname, '../..', path), 'utf-8')
}

describe('launch messaging + operations source guards', () => {
  it('protects GET conversation messages with participant membership', () => {
    const src = source('app/api/mobile/conversations/[id]/messages/route.ts')
    const membership = src.indexOf('conversationParticipant.findUnique')
    const read = src.indexOf('prisma.message.findMany', membership)
    expect(membership).toBeGreaterThan(-1)
    expect(read).toBeGreaterThan(membership)
    expect(src).toContain('conversationId_userId')
  })

  it('enforces chat length, burst and daily message limits', () => {
    const src = source('app/api/mobile/conversations/[id]/messages/route.ts')
    expect(src).toContain('MAX_MESSAGE_LENGTH = 2000')
    expect(src).toContain('BURST_MESSAGE_LIMIT = 15')
    expect(src).toContain('DAILY_MESSAGE_LIMIT = 120')
  })

  it('keeps urgent job push aligned with V3 ring channel', () => {
    const blast = source('lib/job-blast.ts')
    const waves = source('lib/matching/waves.ts')
    expect(blast).toContain("channelId: 'job_offers'")
    expect(blast).toContain("alertMode: profile.isOnline ? 'ring' : 'push'")
    expect(waves).toContain("alertMode: 'ring'")
    expect(waves).toContain('sendExpoPush(')
  })

  it('prevents immediate matching to already committed solo taskers', () => {
    const src = source('lib/matching/index.ts')
    expect(src).toContain('activeIndividualQuotes')
    expect(src).toContain('hasScheduleConflict')
    expect(src).toContain("reason: 'ASSIGNMENT_CONFLICT'")
    expect(src).toContain('preferredTimeSlot')
  })

  it('returns worker userId and status for company dispatch', () => {
    const src = source('app/api/mobile/company/team/route.ts')
    expect(src).toContain('userId: m.userId')
    expect(src).toContain('status: m.status')
  })

  it('requires OTP-confirmed cancellation and blocks after work starts', () => {
    const src = source('app/api/mobile/v2/jobs/[id]/cancel/route.ts')
    expect(src).toContain("action === 'REQUEST_CODE' || action === 'REQUEST_OTP'")
    expect(src).toContain("action !== 'CONFIRM'")
    expect(src).toContain('WORK_ALREADY_STARTED')
    expect(src).toContain('allowAcceptedProviderCancellation')
    expect(src).toContain("purpose = `${PURPOSE_PREFIX}${id}`")
  })

  it('weekly commission job reconciles already-withheld commission without another wallet debit', () => {
    const src = source('app/api/cron/weekly-commission/route.ts')
    expect(src).toContain("status: 'SETTLED'")
    expect(src).toContain("status: 'PAID'")
    expect(src).toContain('No second wallet debit')
    expect(src).not.toContain('providerWallet.update')
    expect(src).not.toContain('postLedgerTransaction')
  })

  it('quote revisions notify customers', () => {
    const src = source('app/api/mobile/v2/quotes/[id]/revision/route.ts')
    expect(src).toContain('createAndPushNotification')
    expect(src).toContain("type: 'QUOTE_REVISED'")
  })
})
