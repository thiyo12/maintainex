'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiRefreshCw,
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
import { CrmPagination } from '@/components/crm/v2/CrmOperational'
import { crmApiError } from '@/lib/crm/api-error'

interface PaymentItem {
  id: string
  jobId: string
  customerId: string
  escrowId: string
  merchantOrderId: string
  paymentId?: string | null
  gateway: string
  amount: string
  currency: string
  status: string
  createdAt: string
  updatedAt: string
  paidAt?: string | null
  jobTitle: string
  countryCode: string
  jobStatus: string
  escrowStatus?: string | null
  paymentMethod?: string | null
  disputeStatus?: string | null
  providerTransactionId?: string | null
  providerOrderId?: string | null
  providerCaptureId?: string | null
  providerTransactionStatus?: string | null
  providerFee?: string | null
  netSettlement?: string | null
  reconciliationStatus?: string | null
  reconciliationReference?: string | null
  reconciledAt?: string | null
  providerEventCount: number
  providerFailedEventCount: number
  customer?: {
    id: string
    mxId?: string | null
    name?: string | null
    email?: string | null
  } | null
}

interface PaymentStat {
  status: string
  currency: string
  count: number
  total: string
}

interface Payload {
  payments: PaymentItem[]
  stats: PaymentStat[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  providers?: string[]
  actions: {
    refund: boolean
  }
}

function money(minor: string | number, currency: string) {
  const value = Number(minor || 0) / 100
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

function date(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function statusTone(status: string): CrmTone {
  if (['SUCCESS', 'REFUNDED'].includes(status)) return 'success'
  if (['FAILED', 'CHARGEDBACK'].includes(status)) return 'danger'
  if (['REFUND_REQUIRED', 'REFUND_PROCESSING', 'PENDING', 'CREATED'].includes(status)) return 'warning'
  if (['CANCELLED', 'EXPIRED'].includes(status)) return 'neutral'
  return 'info'
}

export default function PaymentOperationsPage() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [status, setStatus] = useState('ALL')
  const [provider, setProvider] = useState('ALL')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '30',
        status,
        provider,
      })
      const response = await fetch(`/api/admin/financial/payments?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))

      if (response.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      if (!response.ok) crmApiError(body, 'Unable to load payment operations')

      setPayload(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load payment operations')
    } finally {
      setLoading(false)
    }
  }, [page, provider, status])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [provider, status])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return payload?.payments || []

    return (payload?.payments || []).filter(item =>
      [
        item.id,
        item.merchantOrderId,
        item.paymentId,
        item.gateway,
        item.providerOrderId,
        item.providerCaptureId,
        item.reconciliationReference,
        item.jobId,
        item.jobTitle,
        item.customer?.name,
        item.customer?.email,
        item.customer?.mxId,
        item.countryCode,
      ].some(value => String(value || '').toLowerCase().includes(q))
    )
  }, [payload, query])

  const metrics = useMemo(() => {
    const currencies = [...new Set((payload?.stats || []).map(row => row.currency))].sort()

    return currencies.map(currency => {
      const total = (states: string[]) =>
        (payload?.stats || [])
          .filter(row => row.currency === currency && states.includes(row.status))
          .reduce((sum, row) => sum + Number(row.total || 0), 0)

      const count = (states: string[]) =>
        (payload?.stats || [])
          .filter(row => row.currency === currency && states.includes(row.status))
          .reduce((sum, row) => sum + row.count, 0)

      return {
        currency,
        captured: total(['SUCCESS']),
        pending: total(['CREATED', 'PENDING']),
        refundExposure: total(['REFUND_REQUIRED', 'REFUND_PROCESSING']),
        exceptions: count(['FAILED', 'CHARGEDBACK', 'REFUND_REQUIRED', 'REFUND_PROCESSING']),
      }
    })
  }, [payload])

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="Finance · Gateway operations"
        title="Payment Operations"
        description="Monitor payment intent, escrow linkage and gateway outcomes without exposing gateway payloads or allowing manual payment-status edits."
        actions={
          <CrmButton variant="secondary" onClick={load} disabled={loading}>
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </CrmButton>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/admin/financial"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-amber-700"
        >
          <FiArrowLeft size={13} />
          Finance Control Centre
        </Link>
        <Link
          href="/admin/financial/refunds"
          className="text-xs font-semibold text-amber-700 hover:text-amber-800"
        >
          Refund Queue
        </Link>
        <Link
          href="/admin/financial/escrow"
          className="text-xs font-semibold text-amber-700 hover:text-amber-800"
        >
          Escrow Operations
        </Link>
        <Link
          href="/admin/financial/providers"
          className="text-xs font-semibold text-amber-700 hover:text-amber-800"
        >
          Payment Providers
        </Link>
      </div>

      {metrics.length ? metrics.map(row => (
        <section key={row.currency} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CrmMetricCard
            label={`Captured · ${row.currency}`}
            value={money(row.captured, row.currency)}
            helper="Gateway-confirmed payment"
            icon={<FiCheckCircle size={16} />}
            tone="success"
          />
          <CrmMetricCard
            label={`Pending · ${row.currency}`}
            value={money(row.pending, row.currency)}
            helper="Created / awaiting gateway"
            icon={<FiClock size={16} />}
            tone="warning"
          />
          <CrmMetricCard
            label={`Refund exposure · ${row.currency}`}
            value={money(row.refundExposure, row.currency)}
            helper="Required / processing"
            icon={<FiCreditCard size={16} />}
            tone={row.refundExposure > 0 ? 'warning' : 'neutral'}
          />
          <CrmMetricCard
            label={`Exceptions · ${row.currency}`}
            value={row.exceptions}
            helper="Failed / chargeback / refund"
            icon={<FiAlertTriangle size={16} />}
            tone={row.exceptions > 0 ? 'danger' : 'neutral'}
          />
        </section>
      )) : null}

      <CrmFilterBar>
        <div className="relative min-w-0 flex-1">
          <FiSearch
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={15}
          />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            className={`${crmInputClass} pl-9`}
            placeholder="Search order, gateway ref, job or customer…"
          />
        </div>

        <select
          value={status}
          onChange={event => setStatus(event.target.value)}
          className={crmInputClass}
          aria-label="Payment status"
        >
          <option value="ALL">All payment states</option>
          <option value="CREATED">Created</option>
          <option value="PENDING">Pending</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired</option>
          <option value="REFUND_REQUIRED">Refund required</option>
          <option value="REFUND_PROCESSING">Refund processing</option>
          <option value="REFUNDED">Refunded</option>
          <option value="CHARGEDBACK">Chargeback</option>
        </select>
        <select
          value={provider}
          onChange={event => setProvider(event.target.value)}
          className={crmInputClass}
          aria-label="Payment provider"
        >
          <option value="ALL">All providers</option>
          <option value="PAYPAL">PayPal</option>
          <option value="PAYHERE">PayHere</option>
          <option value="MANUAL_BANK">Manual bank</option>
        </select>
      </CrmFilterBar>

      {loading ? (
        <CrmState
          type="loading"
          title="Loading payment operations"
          description="Loading country-scoped payment, escrow and dispute state."
        />
      ) : rows.length === 0 ? (
        <CrmState
          type="empty"
          title="No payments match this view"
          description="No payment intents match the current status and search filters."
        />
      ) : (
        <CrmTableFrame
          title="Payment intent operations"
          description="Provider secrets and raw gateway payloads stay hidden. This view joins canonical payment state to provider transaction economics, event health and reconciliation."
        >
          <table className={`${crmTableClass} min-w-[2050px]`}>
            <thead>
              <tr>
                <th className={crmThClass}>Payment</th>
                <th className={crmThClass}>Customer</th>
                <th className={crmThClass}>Job</th>
                <th className={crmThClass}>Amount</th>
                <th className={crmThClass}>Provider</th>
                <th className={crmThClass}>Payment</th>
                <th className={crmThClass}>Provider economics</th>
                <th className={crmThClass}>Reconciliation</th>
                <th className={crmThClass}>Events</th>
                <th className={crmThClass}>Escrow</th>
                <th className={crmThClass}>Risk</th>
                <th className={crmThClass}>Timeline</th>
                <th className={`${crmThClass} text-right`}>Controls</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(item => {
                const needsRefund = ['REFUND_REQUIRED', 'REFUND_PROCESSING'].includes(item.status)

                return (
                  <tr key={item.id} className="transition-colors hover:bg-[#fafbf9]">
                    <td className={crmTdClass}>
                      <Link
                        href={`/admin/financial/payments/${item.id}`}
                        className="font-mono text-xs font-semibold text-slate-800 hover:text-amber-700"
                      >
                        {item.merchantOrderId}
                      </Link>
                      <div className="mt-1 font-mono text-[10px] text-slate-400">
                        {item.paymentId || item.id}
                      </div>
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
                        <span className="text-slate-500">{item.customerId}</span>
                      )}
                      <div className="mt-1 max-w-[210px] truncate text-xs text-slate-400">
                        {item.customer?.email || item.customer?.mxId || '—'}
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <Link
                        href={`/admin/jobs/${item.jobId}`}
                        className="font-semibold text-slate-900 hover:text-amber-700"
                      >
                        {item.jobTitle || item.jobId}
                      </Link>
                      <div className="mt-1 text-xs text-slate-400">
                        {item.countryCode} · {item.jobStatus}
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <div className="font-semibold text-slate-900">
                        {money(item.amount, item.currency)}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">{item.currency}</div>
                    </td>

                    <td className={crmTdClass}>
                      <CrmBadge tone={item.gateway === 'PAYPAL' ? 'info' : item.gateway === 'PAYHERE' ? 'amber' : 'neutral'} dot>
                        {(item.gateway || 'UNKNOWN').replaceAll('_', ' ')}
                      </CrmBadge>
                      <div className="mt-1 max-w-[220px] truncate font-mono text-[10px] text-slate-400">
                        {item.providerOrderId || item.merchantOrderId}
                      </div>
                      {item.providerCaptureId && (
                        <div className="mt-0.5 max-w-[220px] truncate font-mono text-[10px] text-slate-400">
                          Capture {item.providerCaptureId}
                        </div>
                      )}
                    </td>

                    <td className={crmTdClass}>
                      <CrmBadge tone={statusTone(item.status)} dot>
                        {item.status.replaceAll('_', ' ')}
                      </CrmBadge>
                      <div className="mt-1 text-[10px] text-slate-400">
                        Method {item.paymentMethod || '—'}
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      {item.providerTransactionId ? (
                        <div className="space-y-1 text-[11px] text-slate-500">
                          <div className="font-semibold text-slate-800">
                            Gross {money(item.amount, item.currency)}
                          </div>
                          <div>Provider fee {item.providerFee ? money(item.providerFee, item.currency) : '—'}</div>
                          <div>Provider net {item.netSettlement ? money(item.netSettlement, item.currency) : '—'}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No provider transaction yet</span>
                      )}
                    </td>

                    <td className={crmTdClass}>
                      <CrmBadge
                        tone={
                          item.reconciliationStatus === 'MATCHED'
                            ? 'success'
                            : item.reconciliationStatus === 'MISMATCH'
                              ? 'danger'
                              : item.reconciliationStatus === 'MANUAL_REVIEW'
                                ? 'warning'
                                : 'neutral'
                        }
                        dot={Boolean(item.reconciliationStatus)}
                      >
                        {(item.reconciliationStatus || 'UNRECONCILED').replaceAll('_', ' ')}
                      </CrmBadge>
                      <div className="mt-1 max-w-[220px] truncate text-[10px] text-slate-400">
                        {item.reconciliationReference || (item.reconciledAt ? date(item.reconciledAt) : 'Awaiting reconciliation')}
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <div className="flex items-center gap-2">
                        <CrmBadge tone={item.providerFailedEventCount > 0 ? 'danger' : item.providerEventCount > 0 ? 'success' : 'neutral'}>
                          {item.providerEventCount} events
                        </CrmBadge>
                        {item.providerFailedEventCount > 0 && (
                          <CrmBadge tone="danger">{item.providerFailedEventCount} failed</CrmBadge>
                        )}
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <CrmBadge
                        tone={
                          item.escrowStatus === 'PROTECTED'
                            ? 'info'
                            : item.escrowStatus === 'ON_HOLD'
                              ? 'danger'
                              : item.escrowStatus === 'RELEASED'
                                ? 'success'
                                : 'neutral'
                        }
                      >
                        {(item.escrowStatus || 'NO ESCROW').replaceAll('_', ' ')}
                      </CrmBadge>
                    </td>

                    <td className={crmTdClass}>
                      {item.disputeStatus ? (
                        <CrmBadge
                          tone={item.disputeStatus === 'RESOLVED' ? 'success' : 'danger'}
                          dot
                        >
                          {item.disputeStatus.replaceAll('_', ' ')}
                        </CrmBadge>
                      ) : (
                        <CrmBadge>Normal</CrmBadge>
                      )}
                    </td>

                    <td className={crmTdClass}>
                      <div className="text-xs text-slate-600">
                        Updated {date(item.updatedAt)}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">
                        Paid {date(item.paidAt)}
                      </div>
                    </td>

                    <td className={`${crmTdClass} text-right`}>
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/jobs/${item.jobId}`}>
                          <CrmButton size="sm" variant="secondary">
                            Open Job 360
                          </CrmButton>
                        </Link>
                        {needsRefund && payload?.actions.refund && (
                          <Link href="/admin/financial/refunds">
                            <CrmButton size="sm" variant="primary">
                              Refund queue
                            </CrmButton>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
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

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <FiShield className="mt-0.5 shrink-0 text-amber-700" size={16} />
          <div>
            <div className="text-sm font-semibold text-amber-950">Payment control boundary</div>
            <p className="mt-1 text-xs leading-5 text-amber-900/75">
              CRM observes canonical payment state, provider transaction economics, verified webhook history and reconciliation status, while routing refund exceptions into governed workflows.
              There is intentionally no “mark paid” control. Payment success comes only from verified provider callbacks or canonical payment services.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
