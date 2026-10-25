import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { assertNotProductionDb } from '../../helpers/test-guard'
import { reconcileFinancialTransfer, type TransferEvidenceQuery, type TrustedTransferEvidenceSource } from '@/lib/finance/transfers/reconciliation'

const url = process.env.DATABASE_URL || ''
const isolatedPostgres = /^postgres(?:ql)?:\/\//.test(url) && (url.includes('maintainex_test') || url.includes('_ci'))
assertNotProductionDb()
const prisma = new PrismaClient()
const prefix = `transfer-evidence-${Date.now()}`
const ids = {
  customer: `${prefix}-customer`, provider: `${prefix}-provider`, category: `${prefix}-category`,
  job: `${prefix}-job`, quote: `${prefix}-quote`, escrow: `${prefix}-escrow`,
  intent: `${prefix}-intent`, refund: `${prefix}-refund`,
}

describe.skipIf(!isolatedPostgres)('provider-neutral transfer reconciliation (isolated PostgreSQL)', () => {
  beforeAll(async () => {
    await prisma.user.createMany({ data: [
      { id: ids.customer, email: `${prefix}-customer@test.local`, passwordHash: 'test-hash', name: 'Synthetic customer', role: 'CUSTOMER', phone: `+9477${Date.now().toString().slice(-7)}`, countryCode: 'LK', isActive: true, updatedAt: new Date() },
      { id: ids.provider, email: `${prefix}-provider@test.local`, passwordHash: 'test-hash', name: 'Synthetic provider', role: 'TASKER', phone: `+9478${Date.now().toString().slice(-7)}`, countryCode: 'LK', isActive: true, updatedAt: new Date() },
    ] })
    await prisma.jobCategory.create({ data: { id: ids.category, name: prefix, slug: prefix, iconName: 'test', colorHex: '#000000', countries: 'LK' } })
    await prisma.marketplaceJob.create({ data: {
      id: ids.job, customerId: ids.customer, title: 'Synthetic refund', description: 'Isolated financial test',
      categoryId: ids.category, photos: '[]', budgetType: 'FIXED', countryCode: 'LK', status: 'CANCELLED',
    } })
    await prisma.jobQuote.create({ data: {
      id: ids.quote, jobId: ids.job, providerId: ids.provider, providerType: 'INDIVIDUAL', price: 10000n,
      estimatedCompletionTime: 'test', attachments: '[]', status: 'ACCEPTED',
    } })
    await prisma.jobEscrow.create({ data: {
      id: ids.escrow, jobId: ids.job, quoteId: ids.quote, customerId: ids.customer, providerId: ids.provider,
      amount: 10000n, serviceFee: 0n, totalAmount: 10000n, paymentMethod: 'CARD', currency: 'LKR', status: 'ON_HOLD',
    } })
    await prisma.paymentIntent.create({ data: {
      id: ids.intent, jobId: ids.job, customerId: ids.customer, escrowId: ids.escrow,
      merchantOrderId: `${prefix}-order`, gateway: 'UNSELECTED', amount: 10000n, currency: 'LKR', status: 'REFUND_REQUIRED',
    } })
    await prisma.paymentProviderRefund.create({ data: {
      id: ids.refund, paymentIntentId: ids.intent, countryCode: 'LK', provider: 'UNSELECTED',
      amount: 10000n, currency: 'LKR', status: 'REQUESTED',
    } })
    const approval = await prisma.crmApprovalRequest.create({ data: {
      actionId: 'finance.refund', status: 'SUCCEEDED', initiatorAdminId: `${prefix}-maker`, market: 'LK',
      targetType: 'PaymentIntent', targetId: ids.intent, amountMinor: 10000n, currency: 'LKR',
      tier: 'T1', reversibility: 'R4', policyVersion: 'test',
      executionRef: `PaymentProviderRefund:${ids.refund}:REQUESTED_PROVIDER_UNSELECTED`,
    } })
    await prisma.paymentProviderRefund.update({ where: { id: ids.refund }, data: { approvalRequestId: approval.id } })
  })

  afterAll(async () => {
    await prisma.paymentProviderRefund.deleteMany({ where: { id: ids.refund } }).catch(() => {})
    await prisma.paymentIntent.deleteMany({ where: { id: ids.intent } }).catch(() => {})
    await prisma.jobEscrow.deleteMany({ where: { id: ids.escrow } }).catch(() => {})
    await prisma.jobQuote.deleteMany({ where: { id: ids.quote } }).catch(() => {})
    await prisma.marketplaceJob.deleteMany({ where: { id: ids.job } }).catch(() => {})
    await prisma.jobCategory.deleteMany({ where: { id: ids.category } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ids.customer, ids.provider] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('posts a verified refund once, rejects event replay changes, and compensates a reversal', async () => {
    const sourceId = `${prefix}-synthetic-bank`
    const source: TrustedTransferEvidenceSource = {
      sourceId,
      verifyAndFetch: async (query: TransferEvidenceQuery) => ({
        externalEventId: query.externalEventId, externalReference: `fixture-${query.externalEventId}`,
        outcome: query.externalEventId === 'refund-reversal' ? 'REVERSED' as const : 'SUCCEEDED' as const,
        amount: query.expectedAmount, currency: query.currency, countryCode: query.countryCode,
        verificationMethod: 'INDEPENDENT_API_QUERY', payloadHash: query.externalEventId === 'refund-settled' ? 'c'.repeat(64) : 'd'.repeat(64),
        verifiedAt: new Date(), observedAt: new Date(),
      }),
    }
    const query: TransferEvidenceQuery = {
      transferType: 'REFUND', targetId: ids.refund, externalEventId: 'refund-settled',
      expectedAmount: 10000n, currency: 'LKR', countryCode: 'LK',
    }
    const settled = await reconcileFinancialTransfer(query, source, `${prefix}-finance`)
    expect(settled).toMatchObject({ ok: true, status: 'SUCCEEDED', replayed: false })
    expect(await reconcileFinancialTransfer(query, source, `${prefix}-finance`)).toMatchObject({ ok: true, status: 'SUCCEEDED', replayed: true })
    expect(await prisma.financialLedger.count({ where: { referenceType: 'ESCROW_EXTERNAL_REFUND', referenceId: ids.escrow } })).toBe(2)
    await expect(prisma.financialTransferEvidence.update({ where: { sourceId_externalEventId: { sourceId, externalEventId: 'refund-settled' } }, data: { outcome: 'FAILED' } })).rejects.toThrow()

    const reversed = await reconcileFinancialTransfer({ ...query, externalEventId: 'refund-reversal' }, source, `${prefix}-finance`)
    expect(reversed).toMatchObject({ ok: true, status: 'REVERSED', replayed: false })
    expect((await prisma.paymentIntent.findUniqueOrThrow({ where: { id: ids.intent } })).status).toBe('REFUND_REQUIRED')
    expect((await prisma.jobEscrow.findUniqueOrThrow({ where: { id: ids.escrow } })).status).toBe('ON_HOLD')
    expect(await prisma.financialLedger.count({ where: { referenceType: 'ESCROW_EXTERNAL_REFUND_REVERSAL', referenceId: ids.escrow } })).toBe(2)
  })

  it('rejects partial amount, wrong market/currency and unauthenticated/mismatched source results', async () => {
    const source: TrustedTransferEvidenceSource = {
      sourceId: `${prefix}-mismatch-source`,
      verifyAndFetch: async query => ({
        externalEventId: query.externalEventId, externalReference: 'fixture-ref', outcome: 'SUCCEEDED',
        amount: query.expectedAmount, currency: query.currency, countryCode: query.countryCode,
        verificationMethod: 'AUTHENTICATED_STATEMENT', payloadHash: 'e'.repeat(64), verifiedAt: new Date(), observedAt: new Date(),
      }),
    }
    const wrongMarket = await reconcileFinancialTransfer({
      transferType: 'REFUND', targetId: ids.refund, externalEventId: 'wrong-market', expectedAmount: 10000n, currency: 'CAD', countryCode: 'CA',
    }, source, `${prefix}-finance`)
    expect(wrongMarket).toMatchObject({ ok: false, code: 'TRANSFER_TARGET_MISMATCH' })
    const partialSource: TrustedTransferEvidenceSource = {
      ...source,
      sourceId: `${prefix}-partial-source`,
      verifyAndFetch: async query => ({
        externalEventId: query.externalEventId, externalReference: 'fixture-ref', outcome: 'SUCCEEDED',
        amount: query.expectedAmount, currency: query.currency, countryCode: query.countryCode,
        verificationMethod: 'AUTHENTICATED_STATEMENT', payloadHash: 'f'.repeat(64), verifiedAt: new Date(), observedAt: new Date(),
      }),
    }
    const partial = await reconcileFinancialTransfer({
      transferType: 'REFUND', targetId: ids.refund, externalEventId: 'partial-refund', expectedAmount: 5000n, currency: 'LKR', countryCode: 'LK',
    }, partialSource, `${prefix}-finance`)
    expect(partial).toMatchObject({ ok: false, code: 'TRANSFER_TARGET_MISMATCH' })
    expect(await prisma.financialTransferEvidence.count({ where: { targetId: ids.refund, externalEventId: { in: ['wrong-market', 'partial-refund'] } } })).toBe(0)
  })
})
