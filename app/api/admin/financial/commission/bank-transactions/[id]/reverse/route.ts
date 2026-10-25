import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/shared/observability/logger'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmAction } from '@/lib/crm/security'
import { createCrmApprovalRequest } from '@/lib/crm/governance'
import { resolveCurrentApprovalRisk } from '@/lib/crm/governance/current-risk'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
import { prepareCommissionBankReversal } from '@/lib/finance/commissions/bank-credit-reversal'

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
      include: { statementImport: true },
    })
    if (!bankTransaction) return NextResponse.json({ error: 'Bank transaction not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(guard.context, bankTransaction.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (
      bankTransaction.direction !== 'DEBIT' || !bankTransaction.reversalOfTransactionId ||
      bankTransaction.statementImport.provenanceStatus !== 'VERIFIED'
    ) {
      return NextResponse.json({ error: 'A source-verified reversal debit linked to an original credit is required', code: 'BANK_ENTRY_NOT_REVERSAL' }, { status: 409 })
    }

    const reversal = await prepareCommissionBankReversal({ bankTransactionId: id, actorAdminId: guard.context.adminId })
    if (reversal.approvalRequestId) {
      return NextResponse.json({ reversalId: reversal.id, approvalRequestId: reversal.approvalRequestId, status: reversal.status }, { status: 202 })
    }
    if (reversal.initiatedByAdminId !== guard.context.adminId) {
      return NextResponse.json({ error: 'Reversal was initiated by another Finance user' }, { status: 409 })
    }

    const risk = await resolveCurrentApprovalRisk({
      actionId: 'finance.commission.reconcile',
      market: bankTransaction.countryCode,
      targetType: 'CommissionBankTransaction',
      targetId: id,
      amountMinor: bankTransaction.amountMinor,
      currency: bankTransaction.currency,
      actionPayload: JSON.stringify({ mode: 'BANK_REVERSAL', bankTransactionId: id }),
    })
    const approval = await createCrmApprovalRequest({
      actionId: 'finance.commission.reconcile',
      initiatorAdminId: guard.context.adminId,
      market: bankTransaction.countryCode,
      targetType: 'CommissionBankTransaction',
      targetId: id,
      amountMinor: bankTransaction.amountMinor,
      currency: bankTransaction.currency,
      reasonCode: 'BANK_CREDIT_REVERSAL',
      note: 'Source-verified bank debit links to a previously settled commission credit; maker-checker approval required before restoring the debtor balance.',
      idempotencyKey: `commission-bank-reversal:${id}`,
      actionPayload: { mode: 'BANK_REVERSAL', bankTransactionId: id },
      risk: risk.risk,
    })
    const linked = await prisma.$transaction(async tx => {
      const updated = await tx.commissionBankReversal.updateMany({
        where: { id: reversal.id, approvalRequestId: null, status: 'PENDING_REVIEW' },
        data: { approvalRequestId: approval.request.id },
      })
      if (updated.count === 1) {
        await tx.commissionBankReversalEvent.create({
          data: {
            reversalId: reversal.id,
            eventType: 'APPROVAL_REQUESTED',
            actorAdminId: guard.context.adminId,
            metadata: JSON.stringify({ approvalRequestId: approval.request.id }),
          },
        })
      }
      const current = await tx.commissionBankReversal.findUnique({ where: { id: reversal.id }, select: { approvalRequestId: true } })
      return current?.approvalRequestId === approval.request.id
    })
    if (!linked) return NextResponse.json({ error: 'A different approval is already linked to this reversal' }, { status: 409 })
    return NextResponse.json({
      reversalId: reversal.id,
      approval: { id: approval.request.id, status: approval.request.status, tier: approval.request.tier, reused: approval.reused },
    }, { status: 202, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    const known = new Set([
      'BANK_PROVENANCE_NOT_VERIFIED', 'BANK_VERIFICATION_PROVENANCE_MISMATCH', 'BANK_SOURCE_NOT_TRUSTED', 'SIMULATED_BANK_EVIDENCE_DISABLED',
      'BANK_ENTRY_NOT_REVERSAL', 'BANK_REVERSAL_TRANSACTION_ALREADY_USED', 'BANK_REVERSAL_ORIGINAL_NOT_FOUND',
      'BANK_REVERSAL_ORIGINAL_MISMATCH', 'BANK_REVERSAL_ORIGINAL_NOT_POSTED', 'BANK_REVERSAL_RECONCILIATION_MISMATCH',
      'BANK_REVERSAL_ALLOCATION_TOTAL_MISMATCH', 'BANK_REVERSAL_RECOVERY_LINK_MISMATCH',
      'BANK_REVERSAL_AMOUNT_EXCEEDS_SETTLED_CREDIT', 'BANK_REVERSAL_DEBTOR_MARKET_MISMATCH',
    ])
    if (known.has(code)) return NextResponse.json({ error: 'Bank reversal cannot be prepared', code }, { status: 409 })
    logger.error('CRM commission bank reversal request failed', {
      errorType: error instanceof Error ? error.name : 'unknown',
      route: '/api/admin/financial/commission/bank-transactions/[id]/reverse', method: 'POST',
    })
    return NextResponse.json({ error: 'Unable to prepare commission bank reversal' }, { status: 500 })
  }
}
