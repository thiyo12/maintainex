import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM refund approval boundary', () => {
  it('routes refund execution requests through the approval engine', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/api/admin/financial/refunds/route.ts'),
      'utf8'
    )

    expect(source).toContain("guardCrmAction(request, 'finance.refund')")
    expect(source).toContain('createCrmApprovalRequest')
    expect(source).toContain("mode: 'REQUEST_GATEWAY_REFUND'")
    expect(source).toContain("mode: 'CONFIRM_MANUAL'")
    expect(source).not.toContain('await requestRequiredPayHereRefund(intent.id)')
    expect(source).not.toContain('await confirmManualExternalRefund(intent.id')
  })

  it('executes approved refunds only from the centralized approval executor', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'lib/crm/governance/approval-execution.ts'),
      'utf8'
    )

    expect(source).toContain("request.actionId === 'finance.refund'")
    expect(source).toContain('requestRequiredProviderRefund(request.targetId, request.id)')
    expect(source).toContain('confirmManualExternalRefund(request.targetId')
    expect(source).toContain('parseRefundExecutionPayload')
  })

  it('revalidates refund amount, market, dispute and payment state before approval execution', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'lib/crm/governance/current-risk.ts'),
      'utf8'
    )

    expect(source).toContain("request.actionId === 'finance.refund'")
    expect(source).toContain('APPROVAL_AMOUNT_CHANGED')
    expect(source).toContain('APPROVAL_CURRENCY_CHANGED')
    expect(source).toContain('remainingRefundableMinor')
    expect(source).toContain('activeDispute')
  })

  it('keeps the refund page off local role templates and on V2 primitives', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/financial/refunds/page.tsx'),
      'utf8'
    )

    expect(source).toContain('@/components/crm/v2/')
    expect(source).not.toContain('ROLE_PERMISSIONS')
    expect(source).not.toContain('window.prompt')
    expect(source).not.toContain('window.confirm')
  })
})
