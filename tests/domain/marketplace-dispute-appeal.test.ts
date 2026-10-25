import { describe, expect, it, vi } from 'vitest'
import { appealMarketplaceDisputeInTransaction } from '@/lib/domain/marketplace-dispute-appeal'

function txFixture(status = 'RESOLVED', customerId = 'customer-1') {
  const events: Array<{ metadata: string }> = []
  const alerts: Array<{ id: string }> = []
  const tx = {
    $queryRawUnsafe: vi.fn(async () => [{
      id: 'dispute-1', jobId: 'job-1', status,
      resolution: 'Provider completed most work', resolutionAction: 'RELEASE_PROVIDER',
      resolvedBy: 'finance-1', resolvedAt: new Date('2026-01-01T00:00:00Z'),
    }]),
    marketplaceJob: { findUnique: vi.fn(async () => ({ id: 'job-1', customerId })) },
    jobQuote: { findFirst: vi.fn(async () => null) },
    jobLifecycleEvent: {
      findMany: vi.fn(async () => events.map(event => ({ metadata: event.metadata }))),
      create: vi.fn(async ({ data }: { data: { metadata: string } }) => {
        events.push({ metadata: data.metadata })
        return data
      }),
    },
    marketplaceDispute: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    adminAlert: {
      findMany: vi.fn(async () => alerts),
      create: vi.fn(async ({ data }: { data: { id?: string } }) => {
        const alert = { id: data.id || 'appeal-alert' }
        alerts.push(alert)
        return alert
      }),
      updateMany: vi.fn(async () => ({ count: alerts.length })),
    },
  }
  return { tx, events, alerts }
}

const input = {
  disputeId: 'dispute-1',
  actorId: 'customer-1',
  appeal: 'The resolution did not account for the later collection.',
  idempotencyKey: 'appeal-request-0001',
}

describe('marketplace dispute appeals', () => {
  it('reopens a resolved case, preserves the old decision in history, and queues support without moving money', async () => {
    const { tx, events, alerts } = txFixture()
    const result = await appealMarketplaceDisputeInTransaction(tx, input)

    expect(result).toEqual({ ok: true, status: 'OPEN', replayed: false })
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), 'dispute-1')
    expect(tx.marketplaceDispute.updateMany).toHaveBeenCalledWith({
      where: { id: 'dispute-1', status: 'RESOLVED' },
      data: { status: 'OPEN', resolution: null, resolutionAction: null, resolvedBy: null, resolvedAt: null },
    })
    expect(JSON.parse(events[0].metadata)).toMatchObject({
      disputeId: 'dispute-1',
      previousResolution: 'Provider completed most work',
      previousResolutionAction: 'RELEASE_PROVIDER',
      financialEffect: 'NONE',
    })
    expect(alerts).toHaveLength(1)
    expect(tx.adminAlert.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      targetTable: 'MarketplaceDispute', targetId: 'dispute-1', assignedRole: 'SUPPORT', status: 'open',
    }) })
  })

  it('returns an idempotent replay without duplicating the alert or history event', async () => {
    const { tx, events } = txFixture('OPEN')
    events.push({ metadata: JSON.stringify({
      disputeId: input.disputeId, actorId: input.actorId, idempotencyKey: input.idempotencyKey,
    }) })

    const result = await appealMarketplaceDisputeInTransaction(tx, input)

    expect(result).toEqual({ ok: true, status: 'OPEN', replayed: true })
    expect(tx.marketplaceDispute.updateMany).not.toHaveBeenCalled()
    expect(tx.jobLifecycleEvent.create).not.toHaveBeenCalled()
    expect(tx.adminAlert.create).not.toHaveBeenCalled()
  })

  it('rejects an already reopened case when the request key does not match', async () => {
    const { tx } = txFixture('OPEN')
    const result = await appealMarketplaceDisputeInTransaction(tx, { ...input, idempotencyKey: 'appeal-request-0002' })

    expect(result).toEqual({ ok: false, code: 'IDEMPOTENCY_CONFLICT' })
    expect(tx.marketplaceDispute.updateMany).not.toHaveBeenCalled()
    expect(tx.jobLifecycleEvent.create).not.toHaveBeenCalled()
  })

  it('does not reopen a case while it is resolving', async () => {
    const { tx } = txFixture('RESOLVING')
    const result = await appealMarketplaceDisputeInTransaction(tx, input)

    expect(result).toEqual({ ok: false, code: 'NOT_RESOLVED' })
    expect(tx.adminAlert.create).not.toHaveBeenCalled()
  })

  it('rejects a caller who is not the customer or current accepted provider', async () => {
    const { tx } = txFixture('RESOLVED', 'another-customer')
    const result = await appealMarketplaceDisputeInTransaction(tx, input)

    expect(result).toEqual({ ok: false, code: 'NOT_PARTICIPANT' })
    expect(tx.marketplaceDispute.updateMany).not.toHaveBeenCalled()
    expect(tx.jobLifecycleEvent.create).not.toHaveBeenCalled()
  })
})
