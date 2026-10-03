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
  FiXCircle,
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
import { CrmStepUpModal } from '@/components/crm/v2/CrmStepUpModal'
import { crmApiError } from '@/lib/crm/api-error'

interface PayoutItem {
  id: string
  userId: string
  amount: string
  description?: string | null
  status: string
  source: string
  sourceId?: string | null
  method?: string | null
  bankDetails?: string | null
  rejectedReason?: string | null
  currency: string
  countryCode: string
  createdAt: string
  clearedAt?: string | null
  provider?: {
    id: string
    name?: string | null
    mxId?: string | null
    email?: string | null
    identityStatus?: string | null
    verificationStatus?: string | null
    isVerified?: boolean
    isSuspended?: boolean
    isBanned?: boolean
  } | null
}

interface Stat {
  currency: string
  status: string
  count: number
  amount: string
}

interface Payload {
  payouts: PayoutItem[]
  stats: Stat[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  actions: {
    payout: boolean
  }
  emergency: {
    freezes: Array<{
      id: string
      market: string
      activatedAt: string
      expiresAt?: string | null
    }>
  }
}

type SaferAction = 'FAILED' | 'CANCELLED'

function money(minor: string | number, currency: string) {
  const raw = Number(minor || 0)
  const amount = Number.isFinite(raw) ? raw / 100 : 0
  return new Intl.NumberFormat(currency === 'CAD' ? 'en-CA' : 'en-LK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

function date(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function statusTone(status: string): CrmTone {
  if (status === 'SUCCEEDED') return 'success'
  if (['FAILED', 'CANCELLED', 'REVERSED'].includes(status)) return 'danger'
  if (status === 'PROCESSING') return 'info'
  return 'warning'
}

function newIdempotencyKey(item: PayoutItem) {
  const nonce =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `crm-payout-confirm:${item.id}:${nonce}`
}

export default function PayoutQueuePage() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [status, setStatus] = useState('ALL')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const [confirmTarget, setConfirmTarget] = useState<PayoutItem | null>(null)
  const [providerRef, setProviderRef] = useState('')

  const [reasonTarget, setReasonTarget] = useState<{
    item: PayoutItem
    action: SaferAction
  } | null>(null)
  const [reason, setReason] = useState('')
  const [stepUpTarget, setStepUpTarget] = useState<{
    item: PayoutItem
    action: SaferAction
    reason: string
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status,
        page: String(page),
        limit: '30',
      })

      const response = await fetch(
        `/api/admin/financial/payouts?${params.toString()}`,
        { credentials: 'include', cache: 'no-store' }
      )
      const body = await response.json().catch(() => ({}))

      if (response.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      if (!response.ok) crmApiError(body, 'Unable to load payout queue')

      setPayload(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load payout queue')
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
    const list = payload?.payouts || []
    const q = query.trim().toLowerCase()
    if (!q) return list

    return list.filter(item =>
      [
        item.id,
        item.userId,
        item.provider?.name,
        item.provider?.mxId,
        item.provider?.email,
        item.source,
        item.method,
        item.countryCode,
        item.currency,
      ].some(value => String(value || '').toLowerCase().includes(q))
    )
  }, [payload, query])

  const metrics = useMemo(() => {
    const stats = payload?.stats || []
    const currencies = [...new Set(stats.map(item => item.currency || 'LKR'))].sort()

    const amount = (currency: string, statuses: string[]) =>
      stats
        .filter(item => item.currency === currency && statuses.includes(item.status))
        .reduce((sum, item) => sum + Number(item.amount || 0), 0)

    const count = (currency: string, statuses: string[]) =>
      stats
        .filter(item => item.currency === currency && statuses.includes(item.status))
        .reduce((sum, item) => sum + Number(item.count || 0), 0)

    return currencies.map(currency => ({
      currency,
      awaitingAmount: amount(currency, ['REQUESTED', 'RESERVED']),
      processingAmount: amount(currency, ['PROCESSING']),
      completedAmount: amount(currency, ['SUCCEEDED']),
      exceptionCount: count(currency, ['FAILED', 'CANCELLED', 'REVERSED']),
    }))
  }, [payload])

  async function submitExternalConfirmation() {
    if (!confirmTarget || acting) return
    const ref = providerRef.trim()
    if (ref.length < 4) {
      toast.error('Enter the external bank/provider transfer reference')
      return
    }

    setActing(confirmTarget.id)
    try {
      const response = await fetch(
        `/api/admin/financial/payouts/${confirmTarget.id}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'CONFIRM_EXTERNAL',
            providerRef: ref,
            idempotencyKey: newIdempotencyKey(confirmTarget),
          }),
        }
      )
      const body = await response.json().catch(() => ({}))

      if (!response.ok && response.status !== 202) {
        crmApiError(body, 'Unable to submit payout approval')
      }

      toast.success(
        body?.approval?.status === 'ON_HOLD'
          ? 'Payout request created but held by live risk policy'
          : `Payout submitted for ${body?.approval?.tier || 'finance'} approval`
      )
      setConfirmTarget(null)
      setProviderRef('')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payout approval failed')
    } finally {
      setActing(null)
    }
  }

  function prepareSaferAction() {
    if (!reasonTarget) return
    if (reason.trim().length < 4) {
      toast.error('Enter a clear reason')
      return
    }

    setStepUpTarget({
      item: reasonTarget.item,
      action: reasonTarget.action,
      reason: reason.trim(),
    })
    setReasonTarget(null)
    setReason('')
  }

  async function executeSaferAction(proof: string) {
    if (!stepUpTarget || acting) return
    setActing(stepUpTarget.item.id)

    try {
      const response = await fetch(
        `/api/admin/financial/payouts/${stepUpTarget.item.id}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CRM-Step-Up': proof,
          },
          body: JSON.stringify({
            action: stepUpTarget.action,
            reason: stepUpTarget.reason,
          }),
        }
      )
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Payout action failed')

      toast.success(
        stepUpTarget.action === 'FAILED'
          ? 'Payout failed and reserved funds restored'
          : 'Payout cancelled and reserved funds restored'
      )
      setStepUpTarget(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payout action failed')
    } finally {
      setActing(null)
    }
  }

  const freezes = payload?.emergency?.freezes || []
  const hasAnyFreeze = freezes.length > 0
  const isMarketFrozen = (market: string) =>
    freezes.some(freeze => freeze.market === 'GLOBAL' || freeze.market === market)

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="Finance · External disbursements"
        title="Payout Queue"
        description="Review reserved provider funds, submit external-transfer evidence for maker-checker approval, and safely fail or cancel payouts back to the provider wallet."
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

      {hasAnyFreeze && (
        <div className="rounded-[12px] border border-red-200 bg-red-50 p-3.5">
          <div className="flex items-start gap-3">
            <FiShield className="mt-0.5 shrink-0 text-red-700" size={17} />
            <div>
              <div className="text-sm font-semibold text-red-950">
                Payout execution is frozen
              </div>
              <p className="mt-1 text-xs leading-5 text-red-800/80">
                A global or assigned-market emergency control is active. New payout execution and successful completion are blocked server-side. Failure/cancellation remains available to restore reserved funds safely.
              </p>
            </div>
          </div>
        </div>
      )}

      {metrics.map(row => (
        <section key={row.currency} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CrmMetricCard
            label={`Reserved · ${row.currency}`}
            value={money(row.awaitingAmount, row.currency)}
            helper="Awaiting external transfer"
            icon={<FiCreditCard size={16} />}
            tone="warning"
          />
          <CrmMetricCard
            label={`Processing · ${row.currency}`}
            value={money(row.processingAmount, row.currency)}
            helper="Transfer initiated"
            icon={<FiClock size={16} />}
            tone="info"
          />
          <CrmMetricCard
            label={`Completed · ${row.currency}`}
            value={money(row.completedAmount, row.currency)}
            helper="Cleared externally"
            icon={<FiCheckCircle size={16} />}
            tone="success"
          />
          <CrmMetricCard
            label={`Exceptions · ${row.currency}`}
            value={row.exceptionCount}
            helper="Failed / cancelled / reversed"
            icon={<FiAlertTriangle size={16} />}
            tone={row.exceptionCount > 0 ? 'danger' : 'neutral'}
          />
        </section>
      ))}

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
            placeholder="Search provider, MX ID, payout, source, market…"
          />
        </div>

        <select
          value={status}
          onChange={event => setStatus(event.target.value)}
          className={crmInputClass}
          aria-label="Payout status"
        >
          <option value="ALL">All payout states</option>
          <option value="RESERVED">Reserved</option>
          <option value="PROCESSING">Processing</option>
          <option value="SUCCEEDED">Succeeded</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REVERSED">Reversed</option>
        </select>
      </CrmFilterBar>

      {loading ? (
        <CrmState
          type="loading"
          title="Loading payout queue"
          description="Loading country-scoped payout and provider verification state."
        />
      ) : rows.length === 0 ? (
        <CrmState
          type="empty"
          title="No payouts match this view"
          description="No payout records match the current filters and search."
        />
      ) : (
        <CrmTableFrame
          title="Provider payout operations"
          description="Bank details are redacted. External completion creates a governed approval request; CRM never directly marks a payout successful."
        >
          <table className={`${crmTableClass} min-w-[1380px]`}>
            <thead>
              <tr>
                <th className={crmThClass}>Provider</th>
                <th className={crmThClass}>Payout</th>
                <th className={crmThClass}>Amount</th>
                <th className={crmThClass}>Verification</th>
                <th className={crmThClass}>Status</th>
                <th className={crmThClass}>Created</th>
                <th className={`${crmThClass} text-right`}>Controls</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(item => {
                const verified =
                  item.provider?.identityStatus === 'VERIFIED' &&
                  item.provider?.verificationStatus === 'VERIFIED' &&
                  item.provider?.isVerified === true

                return (
                  <tr key={item.id} className="transition-colors hover:bg-[#fafbf9]">
                    <td className={crmTdClass}>
                      <div className="font-semibold text-slate-900">
                        {item.provider?.name || item.userId}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {item.provider?.mxId || item.provider?.email || item.userId}
                      </div>
                    </td>
                    <td className={crmTdClass}>
                      <div className="font-mono text-xs font-semibold text-slate-800">
                        {item.id}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">
                        {item.source} · {item.method || '—'} · {item.countryCode}
                      </div>
                    </td>
                    <td className={crmTdClass}>
                      <div className="font-semibold text-slate-900">
                        {money(item.amount, item.currency)}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">{item.currency}</div>
                    </td>
                    <td className={crmTdClass}>
                      <CrmBadge tone={verified ? 'success' : 'warning'} dot>
                        {verified ? 'Verified' : 'Review required'}
                      </CrmBadge>
                      {(item.provider?.isSuspended || item.provider?.isBanned) && (
                        <div className="mt-2">
                          <CrmBadge tone="danger">Risk hold</CrmBadge>
                        </div>
                      )}
                    </td>
                    <td className={crmTdClass}>
                      <CrmBadge tone={statusTone(item.status)} dot>
                        {item.status}
                      </CrmBadge>
                    </td>
                    <td className={crmTdClass}>
                      <div className="text-xs text-slate-600">{date(item.createdAt)}</div>
                      {item.clearedAt && (
                        <div className="mt-1 text-[10px] text-slate-400">
                          Cleared {date(item.clearedAt)}
                        </div>
                      )}
                    </td>
                    <td className={`${crmTdClass} text-right`}>
                      <div className="flex items-center justify-end gap-2">
                        {isMarketFrozen(item.countryCode) &&
                          ['RESERVED', 'PROCESSING'].includes(item.status) && (
                            <CrmBadge tone="danger">Market frozen</CrmBadge>
                          )}

                        {payload?.actions?.payout &&
                          ['RESERVED', 'PROCESSING'].includes(item.status) && (
                            <>
                              <CrmButton
                                size="sm"
                                variant="primary"
                                disabled={acting === item.id || isMarketFrozen(item.countryCode)}
                                onClick={() => {
                                  setConfirmTarget(item)
                                  setProviderRef('')
                                }}
                              >
                                <FiCheckCircle size={13} />
                                Confirm transfer
                              </CrmButton>

                              <CrmButton
                                size="sm"
                                variant="secondary"
                                disabled={acting === item.id}
                                onClick={() => {
                                  setReasonTarget({ item, action: 'FAILED' })
                                  setReason('')
                                }}
                              >
                                <FiXCircle size={13} />
                                Fail
                              </CrmButton>

                              <CrmButton
                                size="sm"
                                variant="danger"
                                disabled={acting === item.id}
                                onClick={() => {
                                  setReasonTarget({ item, action: 'CANCELLED' })
                                  setReason('')
                                }}
                              >
                                Cancel
                              </CrmButton>
                            </>
                          )}

                        {!payload?.actions?.payout && <CrmBadge>Read only</CrmBadge>}
                        {item.status === 'SUCCEEDED' && (
                          <CrmBadge tone="success">Cleared</CrmBadge>
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

      <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3.5">
        <div className="flex items-start gap-3">
          <FiShield className="mt-0.5 shrink-0 text-amber-700" size={16} />
          <div>
            <div className="text-sm font-semibold text-amber-950">Payout safety model</div>
            <p className="mt-1 text-xs leading-5 text-amber-900/75">
              Amount, market, KYC, account risk and payout velocity are recalculated from live data.
              Confirmation requires an external transfer reference and T1–T4 approval. T2+ uses maker-checker separation.
              Failed/cancelled payouts require TOTP step-up and restore reserved funds through the canonical ledger.
            </p>
          </div>
        </div>
      </div>

      <CrmModal
        open={Boolean(confirmTarget)}
        onClose={() => {
          if (!acting) setConfirmTarget(null)
        }}
        title="Submit external payout confirmation"
        description={
          confirmTarget
            ? `${confirmTarget.provider?.name || confirmTarget.userId} · ${money(confirmTarget.amount, confirmTarget.currency)}`
            : undefined
        }
        maxWidth="max-w-lg"
        footer={
          <>
            <CrmButton
              variant="secondary"
              onClick={() => setConfirmTarget(null)}
              disabled={Boolean(acting)}
            >
              Cancel
            </CrmButton>
            <CrmButton
              variant="primary"
              onClick={submitExternalConfirmation}
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
              External transfer reference
            </label>
            <input
              value={providerRef}
              onChange={event => setProviderRef(event.target.value.slice(0, 500))}
              className={crmInputClass}
              placeholder="Bank / payment-provider transfer reference"
            />
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-3 text-xs leading-5 text-slate-500">
            This does not immediately mark the payout successful. It creates a governed approval request. The payout engine executes only after live risk checks and required approvals pass.
          </div>
        </div>
      </CrmModal>

      <CrmModal
        open={Boolean(reasonTarget)}
        onClose={() => {
          if (!acting) setReasonTarget(null)
        }}
        title={reasonTarget?.action === 'FAILED' ? 'Fail payout safely' : 'Cancel payout safely'}
        description="Reserved funds will be restored through the canonical payout ledger after TOTP verification."
        maxWidth="max-w-lg"
        footer={
          <>
            <CrmButton
              variant="secondary"
              onClick={() => setReasonTarget(null)}
              disabled={Boolean(acting)}
            >
              Back
            </CrmButton>
            <CrmButton variant="danger" onClick={prepareSaferAction}>
              Continue to verification
            </CrmButton>
          </>
        }
      >
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Reason
          </label>
          <textarea
            value={reason}
            onChange={event => setReason(event.target.value.slice(0, 2000))}
            rows={4}
            className="w-full resize-none rounded-[11px] border border-[var(--crm-border)] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            placeholder="Bank rejected destination, duplicate request, provider requested cancellation…"
          />
        </div>
      </CrmModal>

      <CrmStepUpModal
        open={Boolean(stepUpTarget)}
        actionId="finance.payout"
        title={
          stepUpTarget?.action === 'FAILED'
            ? 'Verify payout failure'
            : 'Verify payout cancellation'
        }
        description="Enter your authenticator code. This action restores reserved funds and is audited."
        onClose={() => {
          if (!acting) setStepUpTarget(null)
        }}
        onVerified={executeSaferAction}
      />
    </div>
  )
}
