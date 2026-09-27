import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const readFile = (relPath: string) => readFileSync(join(ROOT, relPath), 'utf-8')

describe('Legacy Bypass Closure — 4 HIGH Findings', () => {
  const companyAssign = readFile('app/api/mobile/company/assign/route.ts')
  const dailyMaintenance = readFile('app/api/cron/daily-maintenance/route.ts')
  const mobileDisputes = readFile('app/api/mobile/disputes/route.ts')
  const adminDisputes = readFile('app/api/admin/disputes/route.ts')
  const adminCommission = readFile('app/api/admin/commission/route.ts')
  const lifecycle = readFile('lib/finance/escrow/escrow-service.ts')
  const payoutEngine = readFile('lib/payout-engine.ts')

  describe('FIX 1 — Company worker assignment routes through canonical lifecycle', () => {
    it('rejects assignment when job is not QUOTE_ACCEPTED', () => {
      expect(companyAssign).toContain("job.status !== 'QUOTE_ACCEPTED'")
      expect(companyAssign).toContain('Quote must be accepted before assigning a worker')
    })

    it('no longer sets status = QUOTE_ACCEPTED directly', () => {
      expect(companyAssign).not.toContain("data: { targetTaskerId: workerUserId, status: 'QUOTE_ACCEPTED' }")
    })

    it('uses optimistic locking via updateMany with status guard', () => {
      expect(companyAssign).toContain('updateMany')
      expect(companyAssign).toContain("status: 'QUOTE_ACCEPTED', targetTaskerId: null")
      expect(companyAssign).toContain('claimed.count !== 1')
    })

    it('uses upsert for workspace instead of manual find+create/update', () => {
      expect(companyAssign).toContain('jobWorkspace.upsert')
      expect(companyAssign).not.toContain('existingWorkspace)')
    })

    it('requires an accepted quote to exist', () => {
      expect(companyAssign).toContain('No accepted quote found for this company on this job')
    })
  })

  describe('FIX 2A — Escrow timeout uses canonical expirePendingEscrow()', () => {
    it('daily-maintenance imports expirePendingEscrow from domain lifecycle', () => {
      expect(dailyMaintenance).toContain("import { expirePendingEscrow } from '@/lib/domain/job-lifecycle'")
    })

    it('daily-maintenance calls expirePendingEscrow instead of raw transaction', () => {
      expect(dailyMaintenance).toContain('expirePendingEscrow(escrow.id, { actorId: \'system\' })')
      expect(dailyMaintenance).not.toContain('tx.jobEscrow.update({ where: { id: escrow.id, status:')
      expect(dailyMaintenance).not.toMatch(/tx\.marketplaceJob\.update\(\{[^}]*data:\s*\{\s*status:\s*'OPEN'/)
    })

    it('expirePendingEscrow exists in lifecycle with optimistic locking', () => {
      expect(lifecycle).toContain('export async function expirePendingEscrow(')
      expect(lifecycle).toContain('status: \'PENDING_PAYMENT\'')
      expect(lifecycle).toContain('status: \'CANCELLED\'')
      expect(lifecycle).toContain('claimed.count !== 1')
    })

    it('expirePendingEscrow reverts quote and workspace state', () => {
      expect(lifecycle).toContain('status: \'QUOTE_ACCEPTED\'')
      expect(lifecycle).toContain('status: \'OPEN\', isActive: true')
      expect(lifecycle).toContain("data: { status: 'PENDING' }")
    })
  })

  describe('FIX 2B — Payout failure uses markFailed() for wallet restoration', () => {
    it('daily-maintenance imports markFailed from payout-engine', () => {
      expect(dailyMaintenance).toContain("import { markFailed } from '@/lib/payout-engine'")
    })

    it('daily-maintenance calls markFailed instead of direct prisma.payout.update', () => {
      expect(dailyMaintenance).toContain('markFailed(')
      expect(dailyMaintenance).toContain('cron-daily-maintenance-fail:')
      expect(dailyMaintenance).toContain("'system'")
      expect(dailyMaintenance).not.toContain('prisma.payout.update({')
    })

    it('markFailed in payout-engine restores reserved wallet funds', () => {
      expect(payoutEngine).toContain('export async function markFailed(')
      expect(payoutEngine).toContain('restoreReservedPayout')
      expect(payoutEngine).toContain('WITHDRAWAL_RELEASED')
      expect(payoutEngine).toContain('providerWallet')
    })
  })

  describe('FIX 3 — Dispute creation routes V2 jobs through raiseJobDispute()', () => {
    it('mobile disputes imports raiseJobDispute', () => {
      expect(mobileDisputes).toContain("import { raiseJobDispute } from '@/lib/domain/job-lifecycle'")
    })

    it('mobile disputes checks for MarketplaceJob first', () => {
      expect(mobileDisputes).toContain('marketplaceJob = await prisma.marketplaceJob.findUnique')
    })

    it('mobile disputes calls raiseJobDispute for V2 jobs', () => {
      expect(mobileDisputes).toContain('await raiseJobDispute(')
      expect(mobileDisputes).toContain("actorType: 'CUSTOMER'")
    })

    it('mobile disputes falls back to legacy Dispute model for JobPosting', () => {
      expect(mobileDisputes).toContain('jobPosting.findUnique')
      expect(mobileDisputes).toContain('prisma.dispute.create')
    })

    it('admin disputes checks for marketplace job on resolution', () => {
      expect(adminDisputes).toContain('marketplaceJob = await prisma.marketplaceJob.findUnique')
    })
  })

  describe('FIX 4 — Commission admin derives from canonical CommissionSettlement', () => {
    it('admin commission GET queries CommissionSettlement not WeeklySettlement', () => {
      expect(adminCommission).toContain('prisma.commissionSettlement.findMany')
      expect(adminCommission).toContain('prisma.commissionSettlement.count')
      expect(adminCommission).not.toContain('prisma.weeklySettlement.findMany')
    })

    it('admin commission POST settles canonical CommissionSettlement records', () => {
      expect(adminCommission).toContain('prisma.commissionSettlement.findMany')
      expect(adminCommission).toContain("status: 'SETTLED'")
      expect(adminCommission).toContain('settledAt: new Date()')
    })

    it('admin commission POST no longer independently calculates from MarketplaceJob', () => {
      expect(adminCommission).not.toContain('calculateWeeklyEarnings')
      expect(adminCommission).not.toContain('getCommissionRate')
      expect(adminCommission).not.toContain('calculateCommission')
    })

    it('admin commission summary uses canonical commission fields', () => {
      expect(adminCommission).toContain('_sum: { commissionAmount: true, jobAmount: true }')
    })
  })
})
