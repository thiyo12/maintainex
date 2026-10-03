'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiLock,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUnlock,
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

interface EscrowItem {
  id: string
  jobId: string
  quoteId: string
  customerId: string
  providerId: string
  amount: string
  serviceFee: string
  totalAmount: string
  paymentMethod: string
  currency: string
  status: string
  heldAt?: string | null
  releasedAt?: string | null
  refundedAt?: string | null
  cashConfirmedAt?: string | null
  createdAt: string
  updatedAt: string
  jobTitle: string
  countryCode: string
  jobStatus: string
  disputeStatus?: string | null
  resolutionAction?: string | null
  customer?: {
    id: string
    mxId?: string | null
    name?: string | null
    email?: string | null
  } | null
}

interface EscrowStat {
  status: string
  currency: string
  count: number
  total: string
}

interface Payload {
  escrows: EscrowItem[]
  stats: EscrowStat[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  actions: {
    manualRelease: boolean
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
  if (status === 'RELEASED') return 'success'
  if (status === 'REFUNDED' || status === 'CANCELLED') return 'neutral'
  if (status === 'ON_HOLD') return 'danger'
  if (status === 'PROTECTED' || status === 'CASH_CONFIRMED') return 'info'
  return 'warning'
}

function idempotencyKey(item: EscrowItem) {
  const nonce =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `crm-escrow-release:${item.id}:${nonce}`
}

function releaseEligible(item: EscrowItem) {
  if (!['PROTECTED', 'ON_HOLD'].includes(item.status)) return false
  if (item.paymentMethod === 'CASH') return false

  const disputeAllowsProviderRelease =
    ['RESOLVING', 'RESOLVED'].includes(item.disputeStatus || '') &&
    item.resolutionAction === 'RELEASE_PROVIDER'

  return item.jobStatus === 'COMPLETED' || disputeAllowsProviderRelease
}

export default function EscrowOperationsPage() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [status, setStatus] = useState('ALL')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [releaseTarget, setReleaseTarget] = useState<EscrowItem | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '30',
        status,
      })
      const response = await fetch(`/api/admin/financial/escrow?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      if (!response.ok) crmApiError(body, 'Unable to load escrow queue')
      setPayload(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load escrow queue')
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
    if (!q) return payload?.escrows || []

    return (payload?.escrows || []).filter(item =>
      [
        item.id,
        item.jobId,
        item.jobTitle,
        item.customer?.name,
        item.customer?.email,
        item.customer?.mxId,
        item.providerId,
        item.countryCode,
      ].some(value => String(value || '').toLowerCase().includes(q))
    )
  }, [payload, query])

  const metrics = useMemo(() => {
    const currencies = [...new Set((payload?.stats || []).map(row => row.currency))].sort()
    return currencies.map(currency => {
      const by = (state: string) =>
        (payload?.stats || [])
          .filter(row => row.currency === currency && row.status === state)
          .reduce((sum, row) => sum + Number(row.total || 0), 0)

      const count = (state: string) =>
        (payload?.stats || [])
          .filter(row => row.currency === currency && row.status === state)
          .reduce((sum, row) => sum + row.count, 0)

      return {
        currency,
        protectedAmount: by('PROTECTED'),
        heldAmount: by('ON_HOLD'),
        releasedAmount: by('RELEASED'),
        exceptionCount: count('ON_HOLD') + count('REFUNDED') + count('CANCELLED'),
      }
    })
  }, [payload])

  async function submitRelease() {
    if (!releaseTarget || acting) return
    if (!payload?.actions.manualRelease) {
      toast.error('Your live staff permissions do not allow manual escrow release')
      return
    }
    if (reason.trim().length < 8) {
      toast.error('Enter a clear reason for the manual release')
      return
    }

    setActing(true)
    try {
      const response = await fetch('/api/admin/financial/escrow', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escrowId: releaseTarget.id,
          reason: reason.trim(),
          idempotencyKey: idempotencyKey(releaseTarget),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok && response.status !== 202) {
        crmApiError(body, 'Unable to submit escrow release')
      }

      toast.success(
        `Escrow release sent to approval · ${body?.approval?.tier || 'review required'}`
      )
      setReleaseTarget(null)
      setReason('')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Escrow release failed')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="Finance · Protected funds"
        title="Escrow Operations"
        description="Monitor protected customer funds, dispute holds and releases. Manual release never edits escrow directly; it enters the maker-checker approval engine."
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

      {metrics.length ? metrics.map(row => (
        <section key={row.currency} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CrmMetricCard
            label={`Protected · ${row.currency}`}
            value={money(row.protectedAmount, row.currency)}
            helper="Held for active jobs"
            icon={<FiLock size={16} />}
            tone="info"
          />
          <CrmMetricCard
            label={`On hold · ${row.currency}`}
            value={money(row.heldAmount, row.currency)}
            helper="Dispute / risk protected"
            icon={<FiAlertTriangle size={16} />}
            tone={row.heldAmount > 0 ? 'danger' : 'neutral'}
          />
          <CrmMetricCard
            label={`Released · ${row.currency}`}
            value={money(row.releasedAmount, row.currency)}
            helper="Released through ledger"
            icon={<FiUnlock size={16} />}
            tone="success"
          />
          <CrmMetricCard
            label={`Exceptions · ${row.currency}`}
            value={row.exceptionCount}
            helper="Held / refunded / cancelled records"
            icon={<FiClock size={16} />}
            tone={row.exceptionCount > 0 ? 'warning' : 'neutral'}
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
            placeholder="Search job, customer, escrow or provider…"
          />
        </div>

        <select
          value={status}
          onChange={event => setStatus(event.target.value)}
          className={crmInputClass}
          aria-label="Escrow status"
        >
          <option value="ALL">All escrow states</option>
          <option value="PENDING">Pending</option>
          <option value="PENDING_PAYMENT">Pending payment</option>
          <option value="PROTECTED">Protected</option>
          <option value="ON_HOLD">On hold</option>
          <option value="RELEASED">Released</option>
          <option value="REFUNDED">Refunded</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="CASH_CONFIRMED">Cash confirmed</option>
        </select>
      </CrmFilterBar>

      {loading ? (
        <CrmState
          type="loading"
          title="Loading escrow operations"
          description="Loading protected funds and dispute state for your assigned markets."
        />
      ) : rows.length === 0 ? (
        <CrmState
          type="empty"
          title="No escrow records match"
          description="No country-scoped escrow records match the current filter."
        />
      ) : (
        <CrmTableFrame
          title="Escrow ledger operations"
          description="Amounts are canonical minor-unit values from JobEscrow. Manual release requires live state validation, T2+ approval and step-up authentication."
        >
          <table className={`${crmTableClass} min-w-[1460px]`}>
            <thead>
              <tr>
                <th className={crmThClass}>Job</th>
                <th className={crmThClass}>Customer</th>
                <th className={crmThClass}>Funds</th>
                <th className={crmThClass}>Method</th>
                <th className={crmThClass}>Escrow state</th>
                <th className={crmThClass}>Dispute</th>
                <th className={crmThClass}>Timeline</th>
                <th className={`${crmThClass} text-right`}>Controls</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(item => {
                const canRelease =
                  Boolean(payload?.actions.manualRelease) && releaseEligible(item)

                return (
                  <tr key={item.id} className="transition-colors hover:bg-[#fafbf9]">
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
                      <div className="mt-1 font-mono text-[10px] text-slate-400">
                        {item.id}
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
                      <div className="mt-1 max-w-[220px] truncate text-xs text-slate-400">
                        {item.customer?.email || item.customer?.mxId || '—'}
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <div className="font-semibold text-slate-900">
                        {money(item.totalAmount, item.currency)}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Provider {money(item.amount, item.currency)}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">
                        Fee {money(item.serviceFee, item.currency)}
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <CrmBadge tone={item.paymentMethod === 'CASH' ? 'warning' : 'neutral'}>
                        {item.paymentMethod}
                      </CrmBadge>
                    </td>

                    <td className={crmTdClass}>
                      <CrmBadge tone={statusTone(item.status)} dot>
                        {item.status.replaceAll('_', ' ')}
                      </CrmBadge>
                    </td>

                    <td className={crmTdClass}>
                      {item.disputeStatus ? (
                        <div className="space-y-1.5">
                          <CrmBadge
                            tone={item.disputeStatus === 'RESOLVED' ? 'success' : 'danger'}
                            dot
                          >
                            {item.disputeStatus.replaceAll('_', ' ')}
                          </CrmBadge>
                          <div className="text-[10px] text-slate-400">
                            {item.resolutionAction?.replaceAll('_', ' ') || 'No resolution'}
                          </div>
                        </div>
                      ) : (
                        <CrmBadge>None</CrmBadge>
                      )}
                    </td>

                    <td className={crmTdClass}>
                      <div className="text-xs text-slate-600">
                        Held {date(item.heldAt)}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">
                        Updated {date(item.updatedAt)}
                      </div>
                    </td>

                    <td className={`${crmTdClass} text-right`}>
                      {canRelease ? (
                        <CrmButton
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            setReleaseTarget(item)
                            setReason('')
                          }}
                        >
                          <FiDollarSign size={13} />
                          Request release
                        </CrmButton>
                      ) : item.status === 'RELEASED' ? (
                        <CrmBadge tone="success">
                          <FiCheckCircle size={12} />
                          Released
                        </CrmBadge>
                      ) : (
                        <CrmBadge>
                          {item.paymentMethod === 'CASH'
                            ? 'Cash flow'
                            : payload?.actions.manualRelease
                              ? 'Not eligible'
                              : 'Read only'}
                        </CrmBadge>
                      )}
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

      <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3.5">
        <div className="flex items-start gap-3">
          <FiShield className="mt-0.5 shrink-0 text-amber-700" size={16} />
          <div>
            <div className="text-sm font-semibold text-amber-950">Escrow safety model</div>
            <p className="mt-1 text-xs leading-5 text-amber-900/75">
              CRM cannot type a new escrow state. Release is available only for funded, eligible records.
              The server rechecks job completion, dispute resolution, market, currency and amount before approval and again before execution.
              Cash payments stay outside funded escrow release.
            </p>
          </div>
        </div>
      </div>

      <CrmModal
        open={Boolean(releaseTarget)}
        onClose={() => {
          if (!acting) setReleaseTarget(null)
        }}
        title="Request manual escrow release"
        description={
          releaseTarget
            ? `${releaseTarget.jobTitle} · ${money(releaseTarget.totalAmount, releaseTarget.currency)}`
            : undefined
        }
        maxWidth="max-w-lg"
        footer={
          <>
            <CrmButton
              variant="secondary"
              onClick={() => setReleaseTarget(null)}
              disabled={acting}
            >
              Cancel
            </CrmButton>
            <CrmButton
              variant="primary"
              onClick={submitRelease}
              disabled={acting}
            >
              {acting ? 'Submitting…' : 'Submit for approval'}
            </CrmButton>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-red-100 bg-red-50 p-3">
            <div className="flex items-start gap-2">
              <FiAlertTriangle className="mt-0.5 shrink-0 text-red-600" size={15} />
              <p className="text-xs leading-5 text-red-800">
                Releasing escrow creates provider/platform ledger entries and cannot be undone by changing a status back.
                Recovery requires a compensating financial workflow.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Release reason
            </label>
            <textarea
              value={reason}
              onChange={event => setReason(event.target.value.slice(0, 1000))}
              rows={4}
              className="w-full resize-none rounded-[11px] border border-[var(--crm-border)] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
              placeholder="Job completed and customer confirmation verified, or approved dispute resolution…"
            />
          </div>

          <div className="rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-3 text-xs leading-5 text-slate-500">
            This request begins at T2 approval. The initiator cannot approve their own release, and approval requires step-up authentication.
          </div>
        </div>
      </CrmModal>
    </div>
  )
}
