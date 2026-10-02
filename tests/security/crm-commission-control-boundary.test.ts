import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('CRM V2 commission control boundary', () => {
  it('retires duplicate legacy commission APIs', () => {
    expect(existsSync(resolve(process.cwd(), 'app/api/admin/commission/route.ts'))).toBe(false)
    expect(existsSync(resolve(process.cwd(), 'app/api/admin/commission/payments/route.ts'))).toBe(false)
    expect(existsSync(resolve(process.cwd(), 'app/api/mobile/v2/admin/commission-settle/route.ts'))).toBe(false)
  })

  it('uses the canonical finance commission routes and V2 design primitives', () => {
    const page = read('app/(admin)/admin/financial/commission/page.tsx')

    expect(page).toContain("from '@/components/crm/v2/CrmPrimitives'")
    expect(page).toContain("from '@/components/crm/v2/CrmStepUpModal'")
    expect(page).toContain('/api/admin/financial/commission')
    expect(page).toContain('/api/admin/financial/commission/payments')
    expect(page).not.toContain('ROLE_PERMISSIONS')
    expect(page).not.toContain("bg-[#15161E]")
    expect(page).not.toContain('Mark Paid')
  })

  it('requires evidence-backed payment reconciliation instead of direct debt clearing', () => {
    const route = read('app/api/admin/financial/commission/route.ts')
    const payments = read('app/api/admin/financial/commission/payments/route.ts')

    expect(route).toContain('COMMISSION_PAYMENT_EVIDENCE_REQUIRED')
    expect(route).toContain("guardCrmAction(request, 'finance.commission.enforce')")
    expect(route).toContain("actionId: 'finance.commission.enforce'")
    expect(route).toContain("request.headers.get('x-crm-step-up')")

    expect(payments).toContain("guardCrmAction(request, 'finance.commission.reconcile')")
    expect(payments).toContain("actionId: 'finance.commission.reconcile'")
    expect(payments).toContain("request.headers.get('x-crm-step-up')")
    expect(payments).toContain("status: 'PENDING'")
    expect(payments).toContain('COMMISSION_PAYMENT_CONCURRENTLY_PROCESSED')
    expect(payments).toContain('amountMatches(payment.amountDue, payment.weeklySettlement.commissionOwed)')
  })

  it('does not allow commission enforcement before the due date', () => {
    const route = read('app/api/admin/financial/commission/route.ts')
    expect(route).toContain('settlement.dueAt >= now')
    expect(route).toContain('Commission enforcement is only allowed after the due date')
  })
})
