import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmAction } from '@/lib/crm/security'
import { createCrmApprovalRequest } from '@/lib/crm/governance'
import { resolveCurrentApprovalRisk } from '@/lib/crm/governance/current-risk'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'

async function assertAssignedCaseStaff(disputeId: string, security: { adminId: string; role: string }) {
  if (security.role === 'MANAGER' || security.role === 'SUPER_ADMIN') return true
  const alert = await prisma.adminAlert.findFirst({
    where: { targetTable: 'MarketplaceDispute', targetId: disputeId, status: { in: ['open', 'in_progress'] } },
    select: { assignedTo: true }, orderBy: { createdAt: 'asc' },
  })
  return alert?.assignedTo === security.adminId
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardCrmAction(request, 'disputes.financial_resolution')
  if (!guard.ok) return guard.response
  const { id } = await params
  const dispute = await prisma.marketplaceDispute.findUnique({ where: { id }, select: { id: true, jobId: true, countryCode: true, job: { select: { countryCode: true } } } })
  if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
  const market = (dispute.countryCode || dispute.job.countryCode).toUpperCase()
  if (!assertCrmCountryAllowed(guard.context, market)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!await assertAssignedCaseStaff(dispute.id, guard.context)) return NextResponse.json({ error: 'Case must be assigned to you before financial correction review' }, { status: 403 })
  const receivables = await prisma.providerCommissionReceivable.findMany({
    where: { jobId: dispute.jobId, status: { in: ['OPEN', 'PARTIAL'] }, providerIdentity: { countryCode: market } },
    select: { id: true, currency: true, amountRemaining: true, providerIdentity: { select: { identityType: true } } },
    orderBy: { createdAt: 'asc' }, take: 25,
  })
  return NextResponse.json({ receivables: receivables.map(row => ({ id: row.id, currency: row.currency, amountRemaining: row.amountRemaining.toString(), debtorType: row.providerIdentity.identityType })) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardCrmAction(request, 'disputes.financial_resolution')
  if (!guard.ok) return guard.response
  const limited = await requireFinancialRateLimit(request, 'commission-payment-confirm')
  if (limited) return limited
  const { id: disputeId } = await params
  const body = await request.json().catch(() => null)
  const receivableId = typeof body?.receivableId === 'string' ? body.receivableId.trim() : ''
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  const key = request.headers.get('Idempotency-Key')?.trim() || ''
  let amountMinor: bigint
  try { amountMinor = BigInt(body?.amountMinor) } catch { amountMinor = 0n }
  if (!disputeId || disputeId.length > 160 || !receivableId || receivableId.length > 160 ||
      reason.length < 10 || reason.length > 1000 || key.length < 8 || key.length > 128 || amountMinor <= 0n) {
    return NextResponse.json({ error: 'Valid receivableId, positive amountMinor, detailed reason and Idempotency-Key are required' }, { status: 400 })
  }
  const [dispute, receivable] = await Promise.all([
    prisma.marketplaceDispute.findUnique({ where: { id: disputeId }, select: { id: true, status: true, countryCode: true, job: { select: { id: true, countryCode: true } } } }),
    prisma.providerCommissionReceivable.findUnique({ where: { id: receivableId }, select: { id: true, jobId: true, currency: true, amountRemaining: true, status: true, providerIdentity: { select: { countryCode: true } } } }),
  ])
  if (!dispute || !receivable) return NextResponse.json({ error: 'Dispute or receivable not found' }, { status: 404 })
  const market = (dispute.countryCode || dispute.job.countryCode).toUpperCase()
  if (!assertCrmCountryAllowed(guard.context, market)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!await assertAssignedCaseStaff(dispute.id, guard.context)) return NextResponse.json({ error: 'Case must be assigned to you before financial correction review' }, { status: 403 })
  if (dispute.job.id !== receivable.jobId || market !== dispute.job.countryCode.toUpperCase() || market !== receivable.providerIdentity.countryCode.toUpperCase()) {
    return NextResponse.json({ error: 'Dispute and commission receivable must belong to the same market and job' }, { status: 409 })
  }
  if (!['OPEN', 'UNDER_REVIEW', 'RESOLVING'].includes(dispute.status)) return NextResponse.json({ error: 'Dispute must be active for financial correction' }, { status: 409 })
  if (!['OPEN', 'PARTIAL'].includes(receivable.status) || amountMinor > receivable.amountRemaining) return NextResponse.json({ error: 'Correction exceeds the open receivable balance' }, { status: 409 })
  const payload = { mode: 'COMMISSION_WAIVER', disputeId, receivableId, reason }
  const currentRisk = await resolveCurrentApprovalRisk({
    actionId: 'disputes.financial_resolution', market, targetType: 'MarketplaceDispute', targetId: disputeId,
    amountMinor, currency: receivable.currency, actionPayload: JSON.stringify(payload), initiatorAdminId: guard.context.adminId,
  })
  const approval = await createCrmApprovalRequest({
    actionId: 'disputes.financial_resolution', initiatorAdminId: guard.context.adminId, market,
    targetType: 'MarketplaceDispute', targetId: disputeId, amountMinor, currency: receivable.currency,
    reasonCode: 'COMMISSION_WAIVER', note: reason, idempotencyKey: `dispute-correction:${key}`,
    actionPayload: payload, risk: currentRisk.risk,
  })
  return NextResponse.json({ status: 'APPROVAL_REQUIRED', approval: { id: approval.request.id, status: approval.request.status, tier: approval.request.tier, reused: approval.reused } }, { status: 202, headers: { 'Cache-Control': 'no-store' } })
}
