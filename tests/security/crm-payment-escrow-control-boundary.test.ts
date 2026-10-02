import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('CRM V2 payment and escrow control boundary', () => {
  it('keeps the payment workspace read-only over canonical payment state', () => {
    const page = source('app/(admin)/admin/financial/payments/page.tsx')
    const route = source('app/api/admin/financial/payments/route.ts')

    expect(page).toContain('@/components/crm/v2/')
    expect(page).toContain('/api/admin/financial/payments')
    expect(page).not.toContain("method: 'PATCH'")
    expect(page).not.toContain("method: 'POST'")
    expect(page).not.toContain("method: 'DELETE'")
    expect(route).toContain("permission: 'finance:payments:view'")
    expect(route).not.toContain('gatewayResponse')
    expect(route).not.toContain('paymentIntent.update')
    expect(route).not.toContain('paymentIntent.updateMany')
  })

  it('routes manual escrow release through governance instead of direct route mutation', () => {
    const page = source('app/(admin)/admin/financial/escrow/page.tsx')
    const route = source('app/api/admin/financial/escrow/route.ts')

    expect(page).toContain('@/components/crm/v2/')
    expect(page).toContain('/api/admin/financial/escrow')
    expect(page).toContain('Submit for approval')

    expect(route).toContain("guardCrmAction(request, 'finance.escrow.manual_release')")
    expect(route).toContain('createCrmApprovalRequest')
    expect(route).toContain('resolveCurrentApprovalRisk')
    expect(route).not.toContain('jobEscrow.update')
    expect(route).not.toContain('jobEscrow.updateMany')
  })

  it('revalidates escrow risk and executes approved release via the canonical escrow service', () => {
    const risk = source('lib/crm/governance/current-risk.ts')
    const execution = source('lib/crm/governance/approval-execution.ts')

    expect(risk).toContain("request.actionId === 'finance.escrow.manual_release'")
    expect(risk).toContain("request.targetType !== 'JobEscrow'")
    expect(risk).toContain('APPROVAL_ESCROW_JOB_NOT_READY')
    expect(risk).toContain("escrow.paymentMethod === 'CASH'")

    expect(execution).toContain("request.actionId === 'finance.escrow.manual_release'")
    expect(execution).toContain('await releaseEscrow(')
    expect(execution).not.toContain("data: { status: 'RELEASED' }")
  })

  it('keeps finance overview linked to both canonical workspaces', () => {
    const overview = source('app/(admin)/admin/financial/page.tsx')
    expect(overview).toContain('href="/admin/financial/payments"')
    expect(overview).toContain('href="/admin/financial/escrow"')
  })
})
