import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const source = readFileSync(
  resolve(process.cwd(), 'app/api/mobile/v2/jobs/[id]/complete/route.ts'),
  'utf-8',
)

describe('company job notification recipient routing', () => {
  it('includes the company owner and assigned workers for accepted company jobs', () => {
    expect(source).toContain('async function getAcceptedProviderRecipientIds')
    expect(source).toContain("status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] }")
    expect(source).toContain('company?.userId ?? null')
    expect(source).toContain('...assignments.map(assignment => assignment.workerUserId)')
    expect(source).toContain('return [...new Set(')
  })

  it('notifies all provider participants when the customer raises a dispute', () => {
    expect(source).toContain('const disputeRecipientIds = isCustomer')
    expect(source).toContain('disputeRecipientIds.map(recipientId =>')
    expect(source).toContain('notifyDisputeRaised(job.id, recipientId, job.title)')
  })

  it('notifies assigned company participants on the direct refund path', () => {
    const refundRoute = readFileSync(
      resolve(process.cwd(), 'app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts'),
      'utf-8',
    )

    expect(refundRoute).toContain("status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'] }")
    expect(refundRoute).toContain('providerRecipientIds = [...new Set(')
    expect(refundRoute).toContain('providerRecipientIds.map(recipientId =>')
    expect(refundRoute).toContain('notifyJobCancelled(')
  })

  it('notifies all provider participants when the customer cancels before start', () => {
    expect(source).toContain('const providerRecipientIds = isCustomer')
    expect(source).toContain('providerRecipientIds.map(recipientId =>')
    expect(source).toContain("notifyJobCancelled(job.id, recipientId, job.title, 'customer', reason)")
  })
})
