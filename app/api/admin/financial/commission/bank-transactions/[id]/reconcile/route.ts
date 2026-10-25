import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/shared/observability/logger'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmAction } from '@/lib/crm/security'
import { createCrmApprovalRequest } from '@/lib/crm/governance'
import { resolveCurrentApprovalRisk } from '@/lib/crm/governance/current-risk'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
import { prepareCommissionBankReconciliation } from '@/lib/finance/commissions/bank-credit-reconciliation'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardCrmAction(request, 'finance.commission.reconcile')
    if (!guard.ok) return guard.response
    const limited = await requireFinancialRateLimit(request, 'commission-payment-confirm')
    if (limited) return limited
    const { id } = await context.params
    if (!id || id.length > 160) return NextResponse.json({ error: 'Invalid bank transaction ID' }, { status: 400 })
    const bankTransaction = await prisma.commissionBankTransaction.findUnique({
      where: { id },
      include: { statementImport: true, reconciliation: true },
    })
    if (!bankTransaction) return NextResponse.json({ error: 'Bank transaction not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(guard.context, bankTransaction.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (bankTransaction.statementImport.provenanceStatus !== 'VERIFIED') {
      return NextResponse.json({ error: 'Independent bank source verification is required before reconciliation.', code: 'BANK_PROVENANCE_NOT_VERIFIED' }, { status: 409 })
    }
    const reconciliation = bankTransaction.reconciliation || await prepareCommissionBankReconciliation({
      bankTransactionId: id,
      actorAdminId: guard.context.adminId,
    })
    if (reconciliation.approvalRequestId) {
      return NextResponse.json({ reconciliationId: reconciliation.id, approvalRequestId: reconciliation.approvalRequestId, status: reconciliation.status }, { status: 202 })
    }
    if (reconciliation.initiatedByAdminId !== guard.context.adminId) {
      return NextResponse.json({ error: 'Reconciliation was initiated by another Finance user' }, { status: 409 })
    }
    const risk = await resolveCurrentApprovalRisk({
      actionId: 'finance.commission.reconcile',
      market: bankTransaction.countryCode,
      targetType: 'CommissionBankTransaction',
      targetId: id,
      amountMinor: bankTransaction.amountMinor,
      currency: bankTransaction.currency,
    })
    const approval = await createCrmApprovalRequest({
      actionId: 'finance.commission.reconcile',
      initiatorAdminId: guard.context.adminId,
      market: bankTransaction.countryCode,
      targetType: 'CommissionBankTransaction',
      targetId: id,
      amountMinor: bankTransaction.amountMinor,
      currency: bankTransaction.currency,
      reasonCode: 'BANK_CREDIT_MATCH',
      note: 'Independent bank evidence matched; maker-checker approval required.',
      idempotencyKey: `commission-bank-reconciliation:${id}`,
      actionPayload: { mode: 'BANK_CREDIT', bankTransactionId: id },
      risk: risk.risk,
    })
    const linked = await prisma.$transaction(async (tx) => {
      const updated = await tx.commissionBankReconciliation.updateMany({
        where: { id: reconciliation.id, approvalRequestId: null },
        data: { approvalRequestId: approval.request.id },
      })
      if (updated.count === 1) {
        await tx.commissionBankReconciliationEvent.create({
          data: {
            reconciliationId: reconciliation.id,
            eventType: 'APPROVAL_REQUESTED',
            actorAdminId: guard.context.adminId,
            metadata: JSON.stringify({ approvalRequestId: approval.request.id }),
          },
        })
      }
      const current = await tx.commissionBankReconciliation.findUnique({
        where: { id: reconciliation.id }, select: { approvalRequestId: true },
      })
      return current?.approvalRequestId === approval.request.id
    })
    if (!linked) return NextResponse.json({ error: 'A different approval is already linked to this reconciliation' }, { status: 409 })
    return NextResponse.json({
      reconciliationId: reconciliation.id,
      approval: { id: approval.request.id, status: approval.request.status, tier: approval.request.tier, reused: approval.reused },
    }, { status: 202, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    const known = new Set([
      'BANK_PROVENANCE_NOT_VERIFIED', 'BANK_VERIFICATION_PROVENANCE_MISMATCH', 'BANK_SOURCE_NOT_TRUSTED', 'SIMULATED_BANK_EVIDENCE_DISABLED', 'BANK_ENTRY_NOT_CREDIT',
      'BANK_REVERSAL_REQUIRES_REVIEW', 'BANK_TRANSACTION_ALREADY_USED', 'BANK_REFERENCE_NOT_AN_OPEN_COMMISSION',
      'BANK_COMMISSION_DEBTOR_MISMATCH', 'BANK_COMMISSION_MARKET_MISMATCH', 'BANK_COMMISSION_DEBTOR_COUNTRY_MISMATCH',
      'BANK_COMMISSION_AMOUNT_MISMATCH', 'BANK_STATEMENT_ROW_MISMATCH', 'BANK_COMMISSION_DEBTOR_INVALID',
    ])
    if (known.has(code)) return NextResponse.json({ error: 'Bank credit cannot be reconciled', code }, { status: 409 })
    logger.error('CRM commission bank reconciliation request failed', {
      errorType: error instanceof Error ? error.name : 'unknown',
      route: '/api/admin/financial/commission/bank-transactions/[id]/reconcile', method: 'POST',
    })
    return NextResponse.json({ error: 'Unable to prepare commission bank reconciliation' }, { status: 500 })
  }
}
