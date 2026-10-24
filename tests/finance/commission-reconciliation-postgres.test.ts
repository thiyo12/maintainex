import { afterAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  settleProviderReceivablesFromBankCredit,
  settleProviderReceivablesFromDirectPayment,
} from '@/lib/finance/commissions/provider-balance-service'
import { requiresPostgres } from '../helpers/test-guard'

const prisma = new PrismaClient()
const runId = `commission-recon-${Date.now()}`

describe.skipIf(!requiresPostgres())('commission remittance PostgreSQL integration', () => {
  afterAll(async () => prisma.$disconnect())

  it('allocates a partial verified remittance oldest-first and reconciles ledger/account totals', async () => {
    const providerId = `${runId}-provider`
    const identityId = `${runId}-identity`
    const weeklySettlementId = `${runId}-week`
    const accountId = `${runId}-account`
    const firstReceivableId = `${runId}-r1`
    const secondReceivableId = `${runId}-r2`
    const commissionPaymentId = `${runId}-payment`
    const currency = 'LKR'

    try {
      await prisma.user.create({
        data: { id: providerId, email: `${runId}@test.invalid`, name: 'Synthetic Provider', role: 'TASKER', countryCode: 'LK', passwordHash: 'test-only' },
      })
      await prisma.providerIdentity.create({
        data: {
          id: identityId, identityType: 'TASKER', subjectId: providerId, currentUserId: providerId,
          countryCode: 'LK', kycStatus: 'VERIFIED', standingStatus: 'ACTIVE',
        },
      })
      const weekStart = new Date('2026-10-19T00:00:00.000Z')
      await prisma.weeklySettlement.create({
        data: {
          id: weeklySettlementId, providerId, providerType: 'TASKER', weekStart,
          weekEnd: new Date('2026-10-25T23:59:59.999Z'), totalEarnings: 0,
          commissionOwed: 11, dueAt: new Date('2026-11-01T00:00:00.000Z'), currency, countryCode: 'LK',
        },
      })
      await prisma.providerFinancialAccount.create({
        data: {
          id: accountId, providerIdentityId: identityId, currency,
          commissionDue: 1100n, adjustmentDue: 0n, oldestCommissionDueAt: new Date('2026-10-19T00:00:00.000Z'),
        },
      })
      await prisma.providerCommissionReceivable.createMany({
        data: [
          {
            id: firstReceivableId, providerIdentityId: identityId, weeklySettlementId,
            jobId: `${runId}-job1`, escrowId: `${runId}-escrow1`, currency,
            amountOriginal: 600n, amountRemaining: 600n, dueAt: new Date('2026-10-20T00:00:00.000Z'),
          },
          {
            id: secondReceivableId, providerIdentityId: identityId, weeklySettlementId,
            jobId: `${runId}-job2`, escrowId: `${runId}-escrow2`, currency,
            amountOriginal: 500n, amountRemaining: 500n, dueAt: new Date('2026-10-21T00:00:00.000Z'),
          },
        ],
      })

      const result = await prisma.$transaction(tx => settleProviderReceivablesFromDirectPayment(tx, {
        weeklySettlementId,
        commissionPaymentId,
        amountPaidMinor: 800n,
        currency,
        createdBy: 'test-commission-reconciliation',
      }))

      expect(result).toMatchObject({ featureBacked: true, recoveredMinor: 800n, remainingCommissionDueMinor: 300n })
      const [first, second, account, recoveries, ledger] = await Promise.all([
        prisma.providerCommissionReceivable.findUniqueOrThrow({ where: { id: firstReceivableId } }),
        prisma.providerCommissionReceivable.findUniqueOrThrow({ where: { id: secondReceivableId } }),
        prisma.providerFinancialAccount.findUniqueOrThrow({ where: { id: accountId } }),
        prisma.providerCommissionRecovery.findMany({ where: { idempotencyKey: { startsWith: `direct-settlement:${commissionPaymentId}:` } } }),
        prisma.financialLedger.findMany({ where: { referenceType: 'COMMISSION_PAYMENT', referenceId: commissionPaymentId } }),
      ])
      expect(first).toMatchObject({ amountRemaining: 0n, status: 'SETTLED' })
      expect(second).toMatchObject({ amountRemaining: 300n, status: 'PARTIAL' })
      expect(account.commissionDue).toBe(300n)
      expect(recoveries.reduce((sum, row) => sum + row.amount, 0n)).toBe(800n)
      expect(ledger.reduce((sum, row) => sum + (row.entryType === 'DEBIT' ? row.amount : -row.amount), 0n)).toBe(0n)
      expect(ledger.some(row => row.amount === 800n && row.accountType === 'PLATFORM_CASH_CLEARING')).toBe(true)
    } finally {
      await prisma.providerCommissionRecovery.deleteMany({ where: { idempotencyKey: { startsWith: `direct-settlement:${commissionPaymentId}:` } } })
      await prisma.financialLedger.deleteMany({ where: { referenceId: commissionPaymentId } })
      await prisma.idempotencyRecord.deleteMany({ where: { idempotencyKey: `commission-payment-recovery:${commissionPaymentId}` } })
      await prisma.providerCommissionReceivable.deleteMany({ where: { id: { in: [firstReceivableId, secondReceivableId] } } })
      await prisma.providerFinancialAccount.deleteMany({ where: { id: accountId } })
      await prisma.weeklySettlement.deleteMany({ where: { id: weeklySettlementId } })
      await prisma.providerIdentity.deleteMany({ where: { id: identityId } })
      await prisma.user.deleteMany({ where: { id: providerId } })
    }
  })

  it('posts a verified bank credit once, supports a later partial collection, and balances the canonical ledger', async () => {
    const providerId = `${runId}-bank-provider`
    const identityId = `${runId}-bank-identity`
    const accountId = `${runId}-bank-account`
    const firstReceivableId = `${runId}-bank-r1`
    const secondReceivableId = `${runId}-bank-r2`
    const firstTxn = `${runId}-bank-txn-1`
    const secondTxn = `${runId}-bank-txn-2`
    const firstReconciliationId = `${runId}-bank-recon-1`
    const secondReconciliationId = `${runId}-bank-recon-2`
    const currency = 'LKR'

    try {
      await prisma.user.create({
        data: { id: providerId, email: `${runId}-bank@test.invalid`, name: 'Synthetic Bank Provider', role: 'TASKER', countryCode: 'LK', passwordHash: 'test-only' },
      })
      await prisma.providerIdentity.create({
        data: { id: identityId, identityType: 'TASKER', subjectId: providerId, currentUserId: providerId, countryCode: 'LK', kycStatus: 'VERIFIED', standingStatus: 'ACTIVE' },
      })
      await prisma.providerFinancialAccount.create({
        data: { id: accountId, providerIdentityId: identityId, currency, commissionDue: 1000n, adjustmentDue: 0n },
      })
      await prisma.providerCommissionReceivable.createMany({
        data: [
          { id: firstReceivableId, providerIdentityId: identityId, jobId: `${runId}-bank-job1`, escrowId: `${runId}-bank-escrow1`, currency, amountOriginal: 600n, amountRemaining: 600n, dueAt: new Date('2026-10-20T00:00:00.000Z') },
          { id: secondReceivableId, providerIdentityId: identityId, jobId: `${runId}-bank-job2`, escrowId: `${runId}-bank-escrow2`, currency, amountOriginal: 400n, amountRemaining: 400n, dueAt: new Date('2026-10-21T00:00:00.000Z') },
        ],
      })

      const first = await prisma.$transaction(tx => settleProviderReceivablesFromBankCredit(tx, {
        bankTransactionId: firstTxn, reconciliationId: firstReconciliationId, providerIdentityId: identityId,
        amountMinor: 800n, currency, createdBy: 'test-bank-reconciliation',
      }), { isolationLevel: 'Serializable' })
      const replay = await prisma.$transaction(tx => settleProviderReceivablesFromBankCredit(tx, {
        bankTransactionId: firstTxn, reconciliationId: firstReconciliationId, providerIdentityId: identityId,
        amountMinor: 800n, currency, createdBy: 'test-bank-reconciliation',
      }), { isolationLevel: 'Serializable' })
      const later = await prisma.$transaction(tx => settleProviderReceivablesFromBankCredit(tx, {
        bankTransactionId: secondTxn, reconciliationId: secondReconciliationId, providerIdentityId: identityId,
        amountMinor: 200n, currency, createdBy: 'test-bank-reconciliation',
      }), { isolationLevel: 'Serializable' })

      expect(first).toMatchObject({ replayed: false, recoveredMinor: 800n })
      expect(replay).toMatchObject({ replayed: true, recoveredMinor: 800n })
      expect(later).toMatchObject({ replayed: false, recoveredMinor: 200n })
      const [firstReceivable, secondReceivable, account, recoveries, ledger] = await Promise.all([
        prisma.providerCommissionReceivable.findUniqueOrThrow({ where: { id: firstReceivableId } }),
        prisma.providerCommissionReceivable.findUniqueOrThrow({ where: { id: secondReceivableId } }),
        prisma.providerFinancialAccount.findUniqueOrThrow({ where: { id: accountId } }),
        prisma.providerCommissionRecovery.findMany({ where: { idempotencyKey: { startsWith: `bank-credit:${firstTxn}:` } } }),
        prisma.financialLedger.findMany({ where: { referenceType: 'COMMISSION_BANK_RECONCILIATION', referenceId: { in: [firstReconciliationId, secondReconciliationId] } } }),
      ])
      expect(firstReceivable).toMatchObject({ amountRemaining: 0n, status: 'SETTLED' })
      expect(secondReceivable).toMatchObject({ amountRemaining: 0n, status: 'SETTLED' })
      expect(account.commissionDue).toBe(0n)
      expect(recoveries.reduce((sum, item) => sum + item.amount, 0n)).toBe(800n)
      expect(ledger.reduce((sum, row) => sum + (row.entryType === 'DEBIT' ? row.amount : -row.amount), 0n)).toBe(0n)
      expect(ledger.filter(row => row.accountType === 'PLATFORM_CASH_CLEARING').reduce((sum, row) => sum + row.amount, 0n)).toBe(1000n)
    } finally {
      await prisma.providerCommissionRecovery.deleteMany({ where: { idempotencyKey: { startsWith: `bank-credit:${firstTxn}:` } } })
      await prisma.providerCommissionRecovery.deleteMany({ where: { idempotencyKey: { startsWith: `bank-credit:${secondTxn}:` } } })
      await prisma.financialLedger.deleteMany({ where: { referenceId: { in: [firstReconciliationId, secondReconciliationId] } } })
      await prisma.providerCommissionReceivable.deleteMany({ where: { id: { in: [firstReceivableId, secondReceivableId] } } })
      await prisma.providerFinancialAccount.deleteMany({ where: { id: accountId } })
      await prisma.providerIdentity.deleteMany({ where: { id: identityId } })
      await prisma.user.deleteMany({ where: { id: providerId } })
    }
  })
})
