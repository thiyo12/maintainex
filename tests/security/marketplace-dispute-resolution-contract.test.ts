import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('marketplace dispute resolution contract', () => {
  it('persists a first-class dispute linked to MarketplaceJob', () => {
    const schema = read('prisma/schema.prisma')
    const migration = read('prisma/migrations/20260930213000_marketplace_dispute_resolution/migration.sql')

    expect(schema).toContain('model MarketplaceDispute {')
    expect(schema).toContain('job              MarketplaceJob @relation')
    expect(schema).toContain('jobId            String         @unique')
    expect(schema).toContain('resolutionAction String?')
    expect(migration).toContain('CREATE TABLE "MarketplaceDispute"')
    expect(migration).toContain('REFERENCES "MarketplaceJob"("id")')
  })

  it('creates the dispute in the same transaction that holds escrow and marks workspace disputed', () => {
    const lifecycle = read('lib/domain/job-lifecycle.ts')
    const fnStart = lifecycle.indexOf('export async function raiseJobDispute')
    const fn = lifecycle.slice(fnStart)

    const escrowClaim = fn.indexOf('const escrowClaimed = await tx.jobEscrow.updateMany')
    const workspaceClaim = fn.indexOf('const wsClaimed = await tx.jobWorkspace.updateMany')
    const disputeCreate = fn.indexOf('const dispute = await tx.marketplaceDispute.create')

    expect(escrowClaim).toBeGreaterThan(-1)
    expect(workspaceClaim).toBeGreaterThan(escrowClaim)
    expect(disputeCreate).toBeGreaterThan(workspaceClaim)
    expect(fn).toContain('disputeId: dispute.id')
  })

  it('requires an explicit money outcome for Marketplace dispute resolution', () => {
    const route = read('app/api/admin/disputes/route.ts')

    expect(route).toContain("MARKETPLACE_RESOLUTION_ACTIONS = new Set(['RELEASE_PROVIDER', 'REFUND_CUSTOMER'])")
    expect(route).toContain("completeAndReleaseEscrow(")
    expect(route).toContain("{ releaseMode: 'ADMIN_RESOLUTION' }")
    expect(route).toContain('const refund = await refundEscrow(')
    expect(route).toContain('MARKETPLACE_DISPUTE_REQUIRES_FINANCIAL_RESOLUTION')
  })

  it('keeps external refunds resolving until PayHere reconciliation completes', () => {
    const adminRoute = read('app/api/admin/disputes/route.ts')
    const paymentService = read('lib/finance/payments/payment-service.ts')

    expect(adminRoute).toContain("status: 'RESOLVING'")
    expect(adminRoute).toContain('Refund queued. Dispute will close after external reconciliation.')
    expect(paymentService).toContain("resolutionAction: 'REFUND_CUSTOMER'")
    expect(paymentService).toContain("status: 'RESOLVED'")
    expect(paymentService).toContain("targetTable: 'MarketplaceDispute'")
  })

  it('routes the customer dispute screen through V2 instead of the legacy JobPosting client', () => {
    const screen = read('apps/mobile/features/jobs/screens/customer/dispute/[id].tsx')

    expect(screen).toContain("import { v2JobActions, v2Jobs } from '@/api/v2-jobs'")
    expect(screen).toContain('v2Jobs.get(id as string)')
    expect(screen).toContain('v2JobActions.dispute(')
    expect(screen).not.toContain("import { jobs } from '@/api/jobs'")
    expect(screen).not.toContain("import { disputes } from '@/api/disputes'")
  })
})
