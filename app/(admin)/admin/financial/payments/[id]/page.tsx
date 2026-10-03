'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowLeft,
  FiCreditCard,
  FiDollarSign,
  FiRefreshCw,
  FiShield,
  FiUser,
} from 'react-icons/fi'
import {
  CrmBadge,
  CrmButton,
  CrmCard,
  CrmField,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  crmInputClass,
  type CrmTone,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmModal } from '@/components/crm/v2/CrmOverlays'
import { crmApiError } from '@/lib/crm/api-error'

interface Payload {
  payment: any
  job: any
  customer: any
  escrow: any
  providerTransactions: any[]
  providerRefunds: any[]
  providerEvents: any[]
  settlements: any[]
  payouts: any[]
  dispute: any
  approvals: any[]
  audit: any[]
  actions: { reconcile: boolean }
}

function money(minor: unknown, currency = 'LKR') {
  const raw = Number(minor || 0)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(raw) ? raw / 100 : 0)
}

function date(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return '—'
  return parsed.toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })
}

function tone(value?: string | null): CrmTone {
  const state = String(value || '').toUpperCase()
  if (['SUCCESS', 'COMPLETED', 'MATCHED', 'REFUNDED', 'RELEASED', 'SUCCEEDED', 'APPROVED', 'PROCESSED'].includes(state)) return 'success'
  if (['FAILED', 'MISMATCH', 'CHARGEDBACK', 'REJECTED'].includes(state)) return 'danger'
  if (['PENDING', 'PROCESSING', 'REFUND_REQUIRED', 'REFUND_PROCESSING', 'MANUAL_REVIEW', 'ON_HOLD'].includes(state)) return 'warning'
  if (['CREATED', 'PROTECTED', 'UNRECONCILED'].includes(state)) return 'info'
  return 'neutral'
}

function Badge({ value }: { value?: string | null }) {
  return <CrmBadge tone={tone(value)} dot>{String(value || '—').replaceAll('_', ' ')}</CrmBadge>
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className={`mt-1 break-words text-sm text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</div>
    </div>
  )
}

export default function PaymentDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<any | null>(null)
  const [status, setStatus] = useState<'MATCHED' | 'MISMATCH' | 'MANUAL_REVIEW'>('MATCHED')
  const [reference, setReference] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/financial/payments/${encodeURIComponent(id)}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      if (!response.ok) crmApiError(body, 'Unable to load payment')
      setData(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load payment')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const transaction = data?.providerTransactions?.[0]
  const settlement = data?.settlements?.[0]
  const providerAmount = settlement?.jobAmount
  const eventFailures = useMemo(
    () => (data?.providerEvents || []).filter(item => item.processingStatus === 'FAILED').length,
    [data]
  )

  function openReconcile(item: any) {
    setModal(item)
    setStatus(item.reconciliationStatus === 'MISMATCH' || item.reconciliationStatus === 'MANUAL_REVIEW'
      ? item.reconciliationStatus
      : 'MATCHED')
    setReference(item.reconciliationReference || '')
    setReason('')
  }

  async function reconcile() {
    if (!modal || saving) return
    if (reference.trim().length < 4 || reason.trim().length < 4) {
      toast.error('Reference and reason are required')
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/financial/payments/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: modal.id,
          reconciliationStatus: status,
          reference: reference.trim(),
          reason: reason.trim(),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Reconciliation failed')
      toast.success('Reconciliation recorded and audited')
      setModal(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reconciliation failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !data) {
    return <CrmState type="loading" title="Loading payment detail" description="Loading canonical payment, provider, reconciliation and audit context." />
  }
  if (!data) {
    return <CrmState type="error" title="Payment unavailable" description="This payment could not be loaded for the current market scope." />
  }

  const payment = data.payment
  const currency = payment.currency || 'LKR'

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="Finance · Payment 360"
        title={payment.merchantOrderId}
        description="Canonical payment state, provider transaction, refunds, reconciliation, approvals and audit in one governed workspace."
        context={
          <>
            <CrmBadge tone={payment.gateway === 'PAYPAL' ? 'info' : payment.gateway === 'PAYHERE' ? 'amber' : 'neutral'} dot>
              {String(payment.gateway || 'UNKNOWN').replaceAll('_', ' ')}
            </CrmBadge>
            <Badge value={payment.status} />
            <CrmBadge>{data.job.countryCode} · {currency}</CrmBadge>
          </>
        }
        actions={
          <CrmButton variant="secondary" onClick={load} disabled={loading}>
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </CrmButton>
        }
      />

      <div className="flex flex-wrap gap-4">
        <Link href="/admin/financial/payments" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-amber-700">
          <FiArrowLeft size={13} /> Payment Operations
        </Link>
        <Link href={`/admin/jobs/${data.job.id}`} className="text-xs font-semibold text-amber-700 hover:text-amber-800">
          Open Job 360
        </Link>
        <Link href="/admin/financial/refunds" className="text-xs font-semibold text-amber-700 hover:text-amber-800">
          Refund Queue
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CrmMetricCard
          label="Gross payment"
          value={money(payment.amount, currency)}
          helper={payment.status.replaceAll('_', ' ')}
          icon={<FiCreditCard size={16} />}
          tone="amber"
        />
        <CrmMetricCard
          label="Provider fee"
          value={transaction?.providerFee == null ? '—' : money(transaction.providerFee, transaction.currency)}
          helper={transaction ? transaction.provider : 'No provider transaction'}
          icon={<FiDollarSign size={16} />}
          tone="neutral"
        />
        <CrmMetricCard
          label="MaintainEX commission"
          value={settlement ? money(settlement.commissionAmount, settlement.currency) : '—'}
          helper={settlement?.status || 'Not settled'}
          icon={<FiShield size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="Tasker / company amount"
          value={providerAmount == null ? '—' : money(providerAmount, settlement?.currency || currency)}
          helper={data.payouts?.[0]?.status || 'Payout not recorded'}
          icon={<FiUser size={16} />}
          tone="success"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <CrmCard title="Payment & booking" description="Canonical references and current marketplace state">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment intent" value={payment.id} mono />
            <Field label="Provider order" value={transaction?.providerOrderId || payment.merchantOrderId} mono />
            <Field label="Provider capture" value={transaction?.providerCaptureId || payment.paymentId || '—'} mono />
            <Field label="Provider refund" value={payment.refundId || '—'} mono />
            <Field label="Job" value={<Link className="font-semibold text-amber-700" href={`/admin/jobs/${data.job.id}`}>{data.job.title}</Link>} />
            <Field label="Job state" value={<Badge value={data.job.status} />} />
            <Field label="Paid at" value={date(payment.paidAt)} />
            <Field label="Updated" value={date(payment.updatedAt)} />
          </div>
        </CrmCard>

        <CrmCard title="Customer & protected funds" description="Customer, escrow and dispute linkage">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Customer"
              value={data.customer?.id
                ? <Link className="font-semibold text-amber-700" href={`/admin/users/${data.customer.id}`}>{data.customer.name || data.customer.mxId}</Link>
                : '—'}
            />
            <Field label="Customer market" value={data.customer?.countryCode || '—'} />
            <Field label="Escrow" value={<Badge value={data.escrow?.status || 'NO_ESCROW'} />} />
            <Field label="Protected amount" value={data.escrow ? money(data.escrow.totalAmount, data.escrow.currency) : '—'} />
            <Field label="Dispute" value={<Badge value={data.dispute?.status || 'NONE'} />} />
            <Field label="Payment method" value={data.escrow?.paymentMethod || '—'} />
          </div>
        </CrmCard>
      </section>

      <CrmCard title="Provider transactions" description="Provider references, economics and reconciliation state">
        {data.providerTransactions.length ? (
          <div className="space-y-3">
            {data.providerTransactions.map(item => (
              <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CrmBadge tone={item.provider === 'PAYPAL' ? 'info' : 'amber'} dot>{item.provider}</CrmBadge>
                    <Badge value={item.status} />
                    <Badge value={item.reconciliationStatus} />
                  </div>
                  {data.actions.reconcile && (
                    <CrmButton variant="secondary" size="sm" onClick={() => openReconcile(item)}>
                      Reconcile
                    </CrmButton>
                  )}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <Field label="Order ID" value={item.providerOrderId || '—'} mono />
                  <Field label="Capture ID" value={item.providerCaptureId || '—'} mono />
                  <Field label="Authorization ID" value={item.providerAuthorizationId || '—'} mono />
                  <Field label="Gross" value={money(item.grossAmount, item.currency)} />
                  <Field label="Provider fee" value={item.providerFee == null ? '—' : money(item.providerFee, item.currency)} />
                  <Field label="Provider net" value={item.netSettlement == null ? '—' : money(item.netSettlement, item.currency)} />
                  <Field label="Reconciliation ref" value={item.reconciliationReference || '—'} />
                  <Field label="Reconciled" value={date(item.reconciledAt)} />
                  <Field label="Created" value={date(item.createdAt)} />
                </div>
              </div>
            ))}
          </div>
        ) : <div className="py-8 text-center text-xs text-slate-400">No provider transaction has been recorded.</div>}
      </CrmCard>

      <section className="grid gap-4 xl:grid-cols-2">
        <CrmCard title="Refund history" description="Provider refund records; partial refunds are not operator-enabled until canonical partial-ledger support exists">
          {data.providerRefunds.length ? (
            <div className="space-y-3">
              {data.providerRefunds.map(item => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-xs font-semibold text-slate-700">{item.providerRefundId || item.id}</div>
                      <div className="mt-1 text-[10px] text-slate-400">{item.provider} · {date(item.createdAt)}</div>
                    </div>
                    <Badge value={item.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-500">{item.reason || 'Provider refund'}</span>
                    <span className="font-semibold text-slate-900">{money(item.amount, item.currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="py-8 text-center text-xs text-slate-400">No provider refunds recorded.</div>}
        </CrmCard>

        <CrmCard
          title="Provider event health"
          description="Verified events only; sensitive raw payloads are not exposed"
          action={<CrmBadge tone={eventFailures ? 'danger' : 'success'}>{eventFailures} failed</CrmBadge>}
        >
          {data.providerEvents.length ? (
            <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
              {data.providerEvents.map(item => (
                <div key={item.id} className="rounded-xl border border-slate-100 bg-[#fafbf9] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-slate-800">{String(item.eventType).replaceAll('_', ' ')}</div>
                    <Badge value={item.processingStatus} />
                  </div>
                  <div className="mt-1 truncate font-mono text-[10px] text-slate-400">{item.externalEventId}</div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    {item.signatureVerified ? 'Signature verified' : 'Signature not verified'} · {date(item.occurredAt || item.createdAt)}
                  </div>
                  {item.errorMessage && <div className="mt-2 text-xs text-red-700">{item.errorMessage}</div>}
                </div>
              ))}
            </div>
          ) : <div className="py-8 text-center text-xs text-slate-400">No provider events recorded.</div>}
        </CrmCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <CrmCard title="Approval history" description="Maker-checker decisions and execution events">
          {data.approvals.length ? (
            <div className="space-y-3">
              {data.approvals.map(request => (
                <div key={request.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-slate-800">{String(request.actionId).replaceAll('_', ' ')}</div>
                    <Badge value={request.status} />
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">{request.tier} · {date(request.createdAt)}</div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(request.decisions || []).map((decision: any) => (
                      <CrmBadge key={decision.id} tone={decision.decision === 'APPROVE' ? 'success' : 'danger'}>
                        {decision.adminRole} · {decision.decision}
                      </CrmBadge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="py-8 text-center text-xs text-slate-400">No payment approval requests recorded.</div>}
        </CrmCard>

        <CrmCard title="Finance audit trail" description="Staff actions recorded against this payment intent">
          {data.audit.length ? (
            <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
              {data.audit.map(item => (
                <div key={item.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-slate-800">{String(item.action).replaceAll('_', ' ')}</div>
                    <CrmBadge tone={item.riskLevel === 'CRITICAL' || item.riskLevel === 'HIGH' ? 'danger' : 'neutral'}>{item.riskLevel}</CrmBadge>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{item.description}</div>
                  <div className="mt-1 text-[10px] text-slate-400">{item.userEmail || 'System'} · {date(item.createdAt)}</div>
                </div>
              ))}
            </div>
          ) : <div className="py-8 text-center text-xs text-slate-400">No staff audit records for this payment.</div>}
        </CrmCard>
      </section>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <FiShield size={16} className="mt-0.5 shrink-0 text-amber-700" />
          <div>
            <div className="text-sm font-semibold text-amber-950">Financial truth boundary</div>
            <p className="mt-1 text-xs leading-5 text-amber-900/75">
              Reconciliation records external evidence and is audit logged. It does not change payment amount, commission, payout amount or force a payment into SUCCESS. Refund execution remains approval-gated.
            </p>
          </div>
        </div>
      </div>

      <CrmModal
        open={Boolean(modal)}
        onClose={() => !saving && setModal(null)}
        title="Reconcile provider transaction"
        description={modal ? `${modal.provider} · ${modal.providerCaptureId || modal.providerOrderId || modal.id}` : undefined}
        footer={
          <>
            <CrmButton variant="secondary" onClick={() => setModal(null)} disabled={saving}>Cancel</CrmButton>
            <CrmButton variant="primary" onClick={reconcile} disabled={saving}>
              {saving ? 'Saving…' : 'Record reconciliation'}
            </CrmButton>
          </>
        }
      >
        <div className="space-y-4">
          <CrmField label="Result">
            <select value={status} onChange={event => setStatus(event.target.value as any)} className={crmInputClass}>
              <option value="MATCHED">Matched</option>
              <option value="MISMATCH">Mismatch</option>
              <option value="MANUAL_REVIEW">Manual review</option>
            </select>
          </CrmField>
          <CrmField label="External reconciliation reference" hint="Settlement report, provider statement or internal reconciliation reference.">
            <input value={reference} onChange={event => setReference(event.target.value.slice(0, 500))} className={crmInputClass} />
          </CrmField>
          <CrmField label="Reason / evidence note">
            <textarea
              value={reason}
              onChange={event => setReason(event.target.value.slice(0, 1000))}
              rows={4}
              className={`${crmInputClass} h-auto min-h-[100px] resize-y py-2.5`}
            />
          </CrmField>
        </div>
      </CrmModal>
    </div>
  )
}
