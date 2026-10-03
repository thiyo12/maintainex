'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiArrowUpRight,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiRefreshCw,
  FiRotateCw,
  FiSearch,
  FiShield,
} from 'react-icons/fi'
import {
  CrmBadge,
  CrmButton,
  CrmFilterBar,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  CrmTableFrame,
  crmInputClass,
  crmTableClass,
  crmTdClass,
  crmThClass,
  type CrmTone,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmModal } from '@/components/crm/v2/CrmOverlays'
import { CrmPagination } from '@/components/crm/v2/CrmOperational'
import { crmApiError } from '@/lib/crm/api-error'

interface RefundItem {
  id: string
  jobId: string
  escrowId: string
  merchantOrderId: string
  paymentId?: string | null
  gateway: string
  refundId?: string | null
  amount: string
  currency: string
  status: string
  paidAt?: string | null
  createdAt: string
  updatedAt: string
  job?: {
    id: string
    title: string
    countryCode: string
    status: string
  } | null
  customer?: {
    id: string
    mxId?: string | null
    name?: string | null
    email?: string | null
  } | null
}

interface Payload {
  refunds: RefundItem[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  actions: {
    refund: boolean
  }
}

type RefundAction = 'RETRY' | 'RECONCILE' | 'CONFIRM_MANUAL'

function money(minor: string, currency: string) {
  const amount = Number(minor || 0) / 100
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function date(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function toneForStatus(status: string): CrmTone {
  if (status === 'REFUNDED') return 'success'
  if (status === 'REFUND_PROCESSING') return 'info'
  if (status === 'CHARGEDBACK') return 'danger'
  return 'warning'
}

function newIdempotencyKey(item: RefundItem, action: RefundAction) {
  const nonce =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `crm-refund:${item.id}:${action.toLowerCase()}:${nonce}`
}

export default function RefundQueuePage() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [manualTarget, setManualTarget] = useState<RefundItem | null>(null)
  const [manualReference, setManualReference] = useState('')
  const [manualNote, setManualNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '30',
      })
      if (status) params.set('status', status)

      const response = await fetch(`/api/admin/financial/refunds?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))

      if (response.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      if (!response.ok) crmApiError(body, 'Unable to load refund queue')

      setPayload(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load refund queue')
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [status])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return payload?.refunds || []

    return (payload?.refunds || []).filter(item =>
      [
        item.merchantOrderId,
        item.paymentId,
        item.gateway,
        item.refundId,
        item.job?.title,
        item.job?.id,
        item.customer?.name,
        item.customer?.email,
        item.customer?.mxId,
      ].some(value => String(value || '').toLowerCase().includes(q))
    )
  }, [payload, query])

  const metrics = useMemo(() => {
    const all = payload?.refunds || []
    return {
      required: all.filter(item => item.status === 'REFUND_REQUIRED').length,
      processing: all.filter(item => item.status === 'REFUND_PROCESSING').length,
      refunded: all.filter(item => item.status === 'REFUNDED').length,
      amount: all
        .filter(item => item.status !== 'REFUNDED')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    }
  }, [payload])

  async function submitAction(
    item: RefundItem,
    action: RefundAction,
    input?: { manualReference?: string; note?: string }
  ) {
    if (acting) return
    if (!payload?.actions?.refund) {
      toast.error('Your live staff permissions do not allow refund actions')
      return
    }

    setActing(item.id)
    try {
      const body: Record<string, unknown> = {
        paymentIntentId: item.id,
        action,
      }

      if (action !== 'RECONCILE') {
        body.idempotencyKey = newIdempotencyKey(item, action)
      }
      if (action === 'CONFIRM_MANUAL') {
        body.manualReference = input?.manualReference
        body.note = input?.note
      }

      const response = await fetch('/api/admin/financial/refunds', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok && response.status !== 202) {
        crmApiError(result?.result ? { error: { message: result?.error, code: undefined }, ...result.result } : result, 'Refund action failed')
      }

      if (result?.mode === 'APPROVAL_REQUIRED') {
        toast.success(
          `Refund approval created · ${result.approval?.tier || 'review required'}`
        )
      } else {
        toast.success(
          result?.result?.status === 'REFUNDED'
            ? 'Gateway refund state reconciled as refunded'
            : 'Refund state reconciled'
        )
      }

      setManualTarget(null)
      setManualReference('')
      setManualNote('')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Refund action failed')
    } finally {
      setActing(null)
    }
  }

  function openManual(item: RefundItem) {
    setManualTarget(item)
    setManualReference('')
    setManualNote('')
  }

  async function submitManual() {
    if (!manualTarget) return
    if (manualReference.trim().length < 4) {
      toast.error('Enter the external refund reference')
      return
    }

    await submitAction(manualTarget, 'CONFIRM_MANUAL', {
      manualReference: manualReference.trim(),
      note: manualNote.trim(),
    })
  }

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="Finance · Payment recovery"
        title="Refund Queue"
        description="Reconcile external gateway truth or submit refund execution for maker-checker approval. CRM never directly edits payment status."
        actions={
          <>
            <Link href="/admin/approvals">
              <CrmButton variant="secondary">
                <FiShield size={14} />
                Approval queue
              </CrmButton>
            </Link>
            <CrmButton variant="secondary" onClick={load} disabled={loading}>
              <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </CrmButton>
          </>
        }
      />

      <div>
        <Link
          href="/admin/financial"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-amber-700"
        >
          <FiArrowLeft size={13} />
          Finance Control Centre
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CrmMetricCard
          label="Refund required"
          value={metrics.required}
          helper="Needs refund initiation"
          icon={<FiAlertTriangle size={16} />}
          tone={metrics.required > 0 ? 'warning' : 'neutral'}
        />
        <CrmMetricCard
          label="Processing"
          value={metrics.processing}
          helper="Gateway/external processing"
          icon={<FiClock size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="Confirmed"
          value={metrics.refunded}
          helper="Refund completed"
          icon={<FiCheckCircle size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="Open value on page"
          value={money(String(metrics.amount), payload?.refunds?.[0]?.currency || 'LKR')}
          helper="Informational only; approvals use server amounts"
          icon={<FiCreditCard size={16} />}
          tone="neutral"
        />
      </section>

      <CrmFilterBar>
        <div className="relative min-w-0 flex-1">
          <FiSearch
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={15}
          />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search order, payment, job or customer…"
            className={`${crmInputClass} pl-9`}
          />
        </div>

        <select
          value={status}
          onChange={event => setStatus(event.target.value)}
          className={crmInputClass}
          aria-label="Refund state"
        >
          <option value="">All refund states</option>
          <option value="REFUND_REQUIRED">Refund required</option>
          <option value="REFUND_PROCESSING">Processing</option>
          <option value="REFUNDED">Refunded</option>
        </select>
      </CrmFilterBar>

      {loading ? (
        <CrmState
          type="loading"
          title="Loading refund queue"
          description="Loading country-scoped payment intents and refund state."
        />
      ) : rows.length === 0 ? (
        <CrmState
          type="empty"
          title="No refunds match this view"
          description="No payment intents in this market match the current search and status filter."
        />
      ) : (
        <CrmTableFrame
          title="Provider and external refund operations"
          description="PayPal and PayHere refund requests use the same governed approval path. Manual confirmation is approval-gated; reconciliation trusts verified provider truth, not the browser."
        >
          <table className={`${crmTableClass} min-w-[1460px]`}>
            <thead>
              <tr>
                <th className={crmThClass}>Payment</th>
                <th className={crmThClass}>Provider</th>
                <th className={crmThClass}>Customer</th>
                <th className={crmThClass}>Job</th>
                <th className={crmThClass}>Amount</th>
                <th className={crmThClass}>State</th>
                <th className={crmThClass}>Updated</th>
                <th className={`${crmThClass} text-right`}>Controls</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(item => (
                <tr key={item.id} className="transition-colors hover:bg-[#fafbf9]">
                  <td className={crmTdClass}>
                    <div className="font-mono text-xs font-semibold text-slate-800">
                      {item.merchantOrderId}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-slate-400">
                      {item.paymentId || item.id}
                    </div>
                  </td>

                  <td className={crmTdClass}>
                    <CrmBadge
                      tone={item.gateway === 'PAYPAL' ? 'info' : item.gateway === 'PAYHERE' ? 'amber' : 'neutral'}
                      dot
                    >
                      {(item.gateway || 'UNKNOWN').replaceAll('_', ' ')}
                    </CrmBadge>
                    {item.refundId && (
                      <div className="mt-1 max-w-[220px] truncate font-mono text-[10px] text-slate-400">
                        Refund {item.refundId}
                      </div>
                    )}
                  </td>

                  <td className={crmTdClass}>
                    {item.customer?.id ? (
                      <Link
                        href={`/admin/users/${item.customer.id}`}
                        className="font-semibold text-slate-800 hover:text-amber-700"
                      >
                        {item.customer.name || item.customer.mxId || 'Customer'}
                      </Link>
                    ) : (
                      <span className="text-slate-500">Unknown customer</span>
                    )}
                    <div className="mt-1 max-w-[220px] truncate text-xs text-slate-400">
                      {item.customer?.email || '—'}
                    </div>
                  </td>

                  <td className={crmTdClass}>
                    <Link
                      href={`/admin/jobs/${item.jobId}`}
                      className="font-semibold text-slate-800 hover:text-amber-700"
                    >
                      {item.job?.title || item.jobId}
                    </Link>
                    <div className="mt-1 text-xs text-slate-400">
                      {item.job?.countryCode || '—'} · {item.job?.status || '—'}
                    </div>
                  </td>

                  <td className={crmTdClass}>
                    <div className="font-semibold text-slate-900">
                      {money(item.amount, item.currency)}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-slate-400">
                      {item.currency}
                    </div>
                  </td>

                  <td className={crmTdClass}>
                    <CrmBadge tone={toneForStatus(item.status)} dot>
                      {item.status.replaceAll('_', ' ')}
                    </CrmBadge>
                  </td>

                  <td className={crmTdClass}>
                    <div className="text-xs text-slate-600">{date(item.updatedAt)}</div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      Paid: {date(item.paidAt)}
                    </div>
                  </td>

                  <td className={`${crmTdClass} text-right`}>
                    <div className="flex items-center justify-end gap-2">
                      {payload?.actions?.refund ? (
                        <>
                          <CrmButton
                            variant="secondary"
                            size="sm"
                            onClick={() => submitAction(item, 'RECONCILE')}
                            disabled={acting === item.id}
                          >
                            <FiRefreshCw size={13} />
                            Reconcile
                          </CrmButton>

                          {item.status === 'REFUND_REQUIRED' && (
                            <CrmButton
                              variant="secondary"
                              size="sm"
                              onClick={() => submitAction(item, 'RETRY')}
                              disabled={acting === item.id}
                            >
                              <FiRotateCw size={13} />
                              Request refund
                            </CrmButton>
                          )}

                          {item.status !== 'REFUNDED' && (
                            <CrmButton
                              variant="primary"
                              size="sm"
                              onClick={() => openManual(item)}
                              disabled={acting === item.id}
                            >
                              Confirm external
                            </CrmButton>
                          )}
                        </>
                      ) : (
                        <CrmBadge>Read only</CrmBadge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <CrmPagination
            page={payload?.pagination.page || page}
            totalPages={payload?.pagination.pages || 1}
            total={payload?.pagination.total || 0}
            pageSize={payload?.pagination.limit || 30}
            onPageChange={setPage}
          />
        </CrmTableFrame>
      )}

      <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3.5">
        <div className="flex items-start gap-3">
          <FiShield className="mt-0.5 shrink-0 text-amber-700" size={16} />
          <div>
            <div className="text-sm font-semibold text-amber-950">Refund safety model</div>
            <p className="mt-1 text-xs leading-5 text-amber-900/75">
              Amount, market, refundable state and dispute status are recalculated on the server.
              T1–T4 approval, maker-checker separation and TOTP step-up are applied in the Approval Queue.
              An active dispute places refund execution on hold.
            </p>
          </div>
        </div>
      </div>

      <CrmModal
        open={Boolean(manualTarget)}
        onClose={() => {
          if (!acting) setManualTarget(null)
        }}
        title="Confirm external refund"
        description={
          manualTarget
            ? `${manualTarget.merchantOrderId} · ${money(manualTarget.amount, manualTarget.currency)}`
            : undefined
        }
        maxWidth="max-w-lg"
        footer={
          <>
            <CrmButton
              variant="secondary"
              onClick={() => setManualTarget(null)}
              disabled={Boolean(acting)}
            >
              Cancel
            </CrmButton>
            <CrmButton
              variant="primary"
              onClick={submitManual}
              disabled={Boolean(acting)}
            >
              {acting ? 'Submitting…' : 'Submit for approval'}
            </CrmButton>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              External refund reference
            </label>
            <input
              value={manualReference}
              onChange={event => setManualReference(event.target.value.slice(0, 200))}
              className={crmInputClass}
              placeholder="Bank / provider dashboard refund reference"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Finance note
            </label>
            <textarea
              value={manualNote}
              onChange={event => setManualNote(event.target.value.slice(0, 500))}
              rows={4}
              className="w-full resize-none rounded-[11px] border border-[var(--crm-border)] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
              placeholder="Evidence or reconciliation note…"
            />
          </div>

          <div className="rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-3 text-xs leading-5 text-slate-500">
            This does not mark the payment refunded immediately. It creates a finance approval request.
            The external reference is executed only after the required approval slots and live risk checks pass.
          </div>
        </div>
      </CrmModal>
    </div>
  )
}
