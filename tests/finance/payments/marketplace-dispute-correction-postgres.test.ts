import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { assertNotProductionDb, requiresPostgres } from '@/tests/helpers/test-guard'
import { applyMarketplaceDisputeCorrectionInTransaction } from '@/lib/crm/disputes/apply-marketplace-dispute-correction'

const databaseUrl = process.env.DATABASE_URL || ''
if (databaseUrl) assertNotProductionDb()
const enabled = requiresPostgres()
const prisma = new PrismaClient()
const prefix = `dispute-correction-${Date.now()}`
const customerId = `${prefix}-customer`
const categoryId = `${prefix}-category`
const jobId = `${prefix}-job`
const disputeId = `${prefix}-case`
const providerIdentityId = `${prefix}-provider`
const receivableId = `${prefix}-receivable`
const approvalIds = [`${prefix}-approval-a`, `${prefix}-approval-b`, `${prefix}-approval-c`]

describe.skipIf(!enabled)('PostgreSQL dispute commission correction', () => {
  beforeAll(async () => {
    await prisma.user.create({ data: { id: customerId, email: `${prefix}@test.local`, passwordHash: 'fixture-only', name: 'Synthetic Customer', role: 'CUSTOMER', countryCode: 'LK', isActive: true, updatedAt: new Date() } })
    await prisma.jobCategory.create({ data: { id: categoryId, name: prefix, slug: prefix, iconName: 'wrench', colorHex: '#000000', countries: '["LK"]' } })
    await prisma.marketplaceJob.create({ data: { id: jobId, customerId, title: 'Synthetic correction fixture', description: 'Isolated database test only', categoryId, photos: '[]', budgetType: 'FIXED', budgetAmount: 10000n, status: 'COMPLETED', countryCode: 'LK' } })
    await prisma.marketplaceDispute.create({ data: { id: disputeId, jobId, escrowId: `${prefix}-escrow`, raisedById: customerId, actorType: 'CUSTOMER', reason: 'PARTIAL_WORK', status: 'UNDER_REVIEW', countryCode: 'LK' } })
    await prisma.providerIdentity.create({ data: { id: providerIdentityId, identityType: 'TASKER', subjectId: `${prefix}-subject`, countryCode: 'LK' } })
    await prisma.providerFinancialAccount.create({ data: { providerIdentityId, currency: 'LKR', commissionDue: 100n } })
    await prisma.providerCommissionReceivable.create({ data: { id: receivableId, providerIdentityId, jobId, escrowId: `${prefix}-receivable-escrow`, currency: 'LKR', amountOriginal: 100n, amountRemaining: 100n, dueAt: new Date() } })
    await prisma.crmApprovalRequest.createMany({ data: approvalIds.map((id, index) => ({ id, actionId: 'disputes.financial_resolution', status: 'APPROVED', initiatorAdminId: `${prefix}-maker`, market: 'LK', targetType: 'MarketplaceDispute', targetId: disputeId, amountMinor: index === 2 ? 30n : 70n, currency: 'LKR', tier: 'T2', reversibility: 'R3', policyVersion: 'test', actionPayload: '{}' })) })
  })

  afterAll(async () => { await prisma.$disconnect() })

  it('serializes competing partial waivers, preserves ledger history and closes only at zero', async () => {
    const competing = await Promise.allSettled(approvalIds.slice(0, 2).map(approvalRequestId =>
      prisma.$transaction(tx => applyMarketplaceDisputeCorrectionInTransaction(tx, {
        disputeId, receivableId, amountMinor: 70n, reason: 'Synthetic partial-work correction.', approvalRequestId, adminId: `${prefix}-checker`,
      }))
    ))
    expect(competing.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(competing.filter(result => result.status === 'rejected')).toHaveLength(1)
    const state = await prisma.providerCommissionReceivable.findUniqueOrThrow({ where: { id: receivableId } })
    expect(state).toMatchObject({ amountRemaining: 30n, amountWaived: 70n, status: 'PARTIAL' })
    await prisma.$transaction(tx => applyMarketplaceDisputeCorrectionInTransaction(tx, {
      disputeId, receivableId, amountMinor: 30n, reason: 'Synthetic remaining balance correction.', approvalRequestId: approvalIds[2], adminId: `${prefix}-checker-2`,
    }))
    const final = await prisma.providerCommissionReceivable.findUniqueOrThrow({ where: { id: receivableId } })
    expect(final).toMatchObject({ amountRemaining: 0n, amountWaived: 100n, status: 'WAIVED' })
    expect(await prisma.providerFinancialAccount.findUniqueOrThrow({ where: { providerIdentityId_currency: { providerIdentityId, currency: 'LKR' } } })).toMatchObject({ commissionDue: 0n })
    const corrections = await prisma.marketplaceDisputeCorrection.findMany({ where: { disputeId }, select: { id: true } })
    expect(corrections).toHaveLength(2)
    expect(await prisma.financialLedger.count({ where: { referenceType: 'MARKETPLACE_DISPUTE_COMMISSION_WAIVER', referenceId: { in: corrections.map(item => item.id) } } })).toBe(4)
    expect(await prisma.marketplaceDisputeCorrectionEvent.count({ where: { correction: { disputeId } } })).toBe(2)
  })
})
