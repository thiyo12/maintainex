import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const readFile = (relPath: string) => readFileSync(join(ROOT, relPath), 'utf-8')

describe('Legacy Bypass Closure — current marketplace and finance boundaries', () => {
  const companyAssign = readFile('app/api/mobile/company/assign/route.ts')
  const companyAssignmentDomain = readFile('lib/domain/company-job-assignment.ts')
  const dailyMaintenance = readFile('app/api/cron/daily-maintenance/route.ts')
  const mobileDisputes = readFile('app/api/mobile/disputes/route.ts')
  const adminDisputes = readFile('app/api/admin/disputes/route.ts')
  const commissionRoute = readFile('app/api/admin/financial/commission/route.ts')
  const commissionPayments = readFile('app/api/admin/financial/commission/payments/route.ts')
  const providerBalance = readFile('lib/finance/commissions/provider-balance-service.ts')
  const lifecycle = readFile('lib/finance/escrow/escrow-service.ts')
  const payoutEngine = readFile('lib/finance/payouts/payout-engine.ts')

  describe('FIX 1 — Company worker assignment routes through canonical domain writers', () => {
    it('requires authenticated company context and worker eligibility', () => {
      expect(companyAssign).toContain('resolveCompanyContext')
      expect(companyAssign).toContain('checkWorkerEligibility')
      expect(companyAssign).toContain("'workers:assign'")
    })

    it('delegates create/reassign to the canonical assignment state machine', () => {
      expect(companyAssign).toContain('createAssignment')
      expect(companyAssign).toContain('reassignWorker')
      expect(companyAssign).not.toContain('marketplaceJob.update(')
      expect(companyAssign).not.toContain('companyJobAssignment.create(')
    })

    it('domain writer verifies accepted-company ownership and uses compare-and-set state claims', () => {
      expect(companyAssignmentDomain).toContain("status: 'ACCEPTED'")
      expect(companyAssignmentDomain).toContain('updateMany')
      expect(companyAssignmentDomain).toContain('Actor is not authorized to assign workers for this company')
    })
  })

  describe('FIX 2A — Escrow timeout uses canonical expirePendingEscrow()', () => {
    it('daily-maintenance imports and calls canonical escrow expiry', () => {
      expect(dailyMaintenance).toContain("import { expirePendingEscrow } from '@/lib/finance/escrow/escrow-service'")
      expect(dailyMaintenance).toContain("expirePendingEscrow(escrow.id, { actorId: 'system' })")
      expect(dailyMaintenance).not.toContain('prisma.jobEscrow.update({')
    })

    it('expirePendingEscrow uses optimistic state claims and restores quote availability', () => {
      expect(lifecycle).toContain('export async function expirePendingEscrow(')
      expect(lifecycle).toContain("status: 'PENDING_PAYMENT'")
      expect(lifecycle).toContain("status: 'CANCELLED'")
      expect(lifecycle).toContain('claimed.count !== 1')
      expect(lifecycle).toContain("status: 'OPEN', isActive: true")
      expect(lifecycle).toContain("data: { status: 'PENDING' }")
    })
  })

  describe('FIX 2B — Payout failure uses markFailed() for wallet restoration', () => {
    it('daily-maintenance delegates stale payout failure to payout-engine', () => {
      expect(dailyMaintenance).toContain("import { markFailed } from '@/lib/finance/payouts/payout-engine'")
      expect(dailyMaintenance).toContain('markFailed(')
      expect(dailyMaintenance).toContain('cron-daily-maintenance-fail:')
      expect(dailyMaintenance).not.toContain('prisma.payout.update({')
    })

    it('markFailed restores the reserved payout through canonical finance writers', () => {
      expect(payoutEngine).toContain('export async function markFailed(')
      expect(payoutEngine).toContain('restoreReservedPayout')
      expect(payoutEngine).toContain('WITHDRAWAL_RELEASED')
    })
  })

  describe('FIX 3 — Dispute creation/resolution stays on canonical V2 lifecycle', () => {
    it('mobile marketplace disputes delegate to raiseJobDispute', () => {
      expect(mobileDisputes).toContain("import { raiseJobDispute } from '@/lib/domain/job-lifecycle'")
      expect(mobileDisputes).toContain('marketplaceJob = await prisma.marketplaceJob.findUnique')
      expect(mobileDisputes).toContain('await raiseJobDispute(')
    })

    it('admin dispute resolution detects marketplace jobs before financial action', () => {
      expect(adminDisputes).toContain('marketplaceJob = await prisma.marketplaceJob.findUnique')
    })
  })

  describe('FIX 4 — Commission debt is governed by settlement + receivable evidence', () => {
    it('commission overview reads market-scoped WeeklySettlement state and does not permit direct MARK_PAID', () => {
      expect(commissionRoute).toContain('prisma.weeklySettlement.findMany')
      expect(commissionRoute).toContain('prisma.weeklySettlement.groupBy')
      expect(commissionRoute).toContain('COMMISSION_PAYMENT_EVIDENCE_REQUIRED')
      expect(commissionRoute).toContain("guardCrmAction(request, 'finance.commission.enforce')")
    })

    it('payment confirmation reconciles durable provider receivables before clearing debt', () => {
      expect(commissionPayments).toContain('settleProviderReceivablesFromDirectPayment')
      expect(commissionPayments).toContain("guardCrmAction(request, 'finance.commission.reconcile')")
      expect(commissionPayments).toContain("status: 'PAID'")
      expect(providerBalance).toContain('providerCommissionReceivable')
      expect(providerBalance).toContain("method: 'DIRECT_SETTLEMENT'")
    })

    it('cash jobs create real platform receivables rather than fake provider wallet funds', () => {
      expect(lifecycle).toContain('recordCashPlatformReceivable')
      expect(providerBalance).toContain("referenceType: 'CASH_PLATFORM_RECEIVABLE'")
      expect(providerBalance).toContain("accountType: 'PROVIDER_COMMISSION_RECEIVABLE'")
    })
  })
})
