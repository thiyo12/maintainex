import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { assertNotProductionDb, requiresPostgres } from '@/tests/helpers/test-guard'
import { appealMarketplaceDisputeInTransaction } from '@/lib/domain/marketplace-dispute-appeal'

const databaseUrl = process.env.DATABASE_URL || ''
if (databaseUrl) assertNotProductionDb()
const isIsolatedPostgres = requiresPostgres()
const prisma = new PrismaClient()
const prefix = `dispute-appeal-${Date.now()}`
const customerId = `${prefix}-customer`
const categoryId = `${prefix}-category`
const jobId = `${prefix}-job`
const disputeId = `${prefix}-case`

describe.skipIf(!isIsolatedPostgres)('PostgreSQL financial dispute appeal workflow', () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: customerId,
        email: `${prefix}@test.local`,
        passwordHash: 'test-only',
        name: 'Synthetic Appeal Customer',
        role: 'CUSTOMER',
        countryCode: 'LK',
        isActive: true,
        updatedAt: new Date(),
      },
    })
    await prisma.jobCategory.create({
      data: { id: categoryId, name: prefix, slug: prefix, iconName: 'wrench', colorHex: '#000000', countries: '["LK"]' },
    })
    await prisma.marketplaceJob.create({
      data: {
        id: jobId,
        customerId,
        title: 'Synthetic dispute appeal fixture',
        description: 'Isolated integration test; not a real booking.',
        categoryId,
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 10000n,
        status: 'COMPLETED',
        countryCode: 'LK',
      },
    })
    await prisma.marketplaceDispute.create({
      data: {
        id: disputeId,
        jobId,
        escrowId: `${prefix}-escrow-reference`,
        raisedById: customerId,
        actorType: 'CUSTOMER',
        reason: 'PARTIAL_WORK',
        description: 'Synthetic fixture for appeal serialization.',
        status: 'RESOLVED',
        resolution: 'Provider receives the verified completed-work amount.',
        resolutionAction: 'RELEASE_PROVIDER',
        resolvedBy: `${prefix}-finance-admin`,
        resolvedAt: new Date('2026-01-01T00:00:00Z'),
        countryCode: 'LK',
      },
    })
  })

  afterAll(async () => {
    await prisma.adminAlert.deleteMany({ where: { targetTable: 'MarketplaceDispute', targetId: disputeId } }).catch(() => {})
    await prisma.marketplaceJob.deleteMany({ where: { id: jobId } }).catch(() => {})
    await prisma.jobCategory.deleteMany({ where: { id: categoryId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: customerId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('serializes concurrent appeal requests and preserves one immutable decision event', async () => {
    const requests = ['appeal-request-concurrent-001', 'appeal-request-concurrent-002']
    const results = await Promise.all(requests.map(idempotencyKey =>
      prisma.$transaction(tx => appealMarketplaceDisputeInTransaction(tx, {
        disputeId,
        actorId: customerId,
        appeal: 'The decision did not account for the later customer collection.',
        idempotencyKey,
      }))
    ))

    expect(results.filter(result => result.ok)).toHaveLength(1)
    expect(results.filter(result => !result.ok)).toEqual([{ ok: false, code: 'IDEMPOTENCY_CONFLICT' }])

    const successfulIndex = results.findIndex(result => result.ok)
    const replay = await prisma.$transaction(tx => appealMarketplaceDisputeInTransaction(tx, {
      disputeId,
      actorId: customerId,
      appeal: 'The decision did not account for the later customer collection.',
      idempotencyKey: requests[successfulIndex],
    }))
    expect(replay).toEqual({ ok: true, status: 'OPEN', replayed: true })

    const [dispute, events, alerts] = await Promise.all([
      prisma.marketplaceDispute.findUniqueOrThrow({ where: { id: disputeId } }),
      prisma.jobLifecycleEvent.findMany({ where: { jobId, action: 'FINANCIAL_DISPUTE_APPEALED' } }),
      prisma.adminAlert.findMany({ where: { targetTable: 'MarketplaceDispute', targetId: disputeId, status: 'open' } }),
    ])
    expect(dispute.status).toBe('OPEN')
    expect(dispute.resolution).toBeNull()
    expect(events).toHaveLength(1)
    expect(JSON.parse(events[0].metadata || '{}')).toMatchObject({
      previousResolution: 'Provider receives the verified completed-work amount.',
      previousResolutionAction: 'RELEASE_PROVIDER',
      financialEffect: 'NONE',
    })
    expect(alerts).toHaveLength(1)
  })
})
