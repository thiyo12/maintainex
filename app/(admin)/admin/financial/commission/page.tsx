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
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUserX,
} from 'react-icons/fi'
import {
  CrmBadge,
  CrmButton,
  CrmFilterBar,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  CrmTableFrame,
  CrmTabs,
  crmInputClass,
  crmTableClass,
  crmTdClass,
  crmThClass,
  type CrmTone,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmPagination } from '@/components/crm/v2/CrmOperational'
import { CrmStepUpModal } from '@/components/crm/v2/CrmStepUpModal'
import { crmApiError } from '@/lib/crm/api-error'

interface Settlement {
  id: string
  providerId: string
  providerType: string
  weekStart: string
  weekEnd: string
  totalEarnings: number
  commissionRate: number
  commissionOwed: number
  commissionPaid: boolean
  paidAt?: string | null
  dueAt: string
  status: string
  currency: string
  countryCode: string
  suspendedAt?: string | null
  provider?: {
    id?: string
    name?: string | null
    email?: string | null
    mxId?: string | null
    isSuspended?: boolean
    suspensionReason?: string | null
  } | null
}

interface CurrencySummary {
  currency: string
  totalCommissionOwed: number
  totalCommissionPaid: number
  pendingThisWeek: number
  overdueCount: number
  suspendedCount: number
  pendingCount: number
  paidCount: number
}

interface SettlementPayload {
  settlements: Settlement[]
  summaryByCurrency: CurrencySummary[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  actions: {
    enforce: boolean
    remind: boolean
  }
}

interface CommissionPayment {
  id: string
  providerId: string
  weeklySettlementId: string
  referenceNumber: string
  amountDue: number
  method: string
  status: string
  confirmedAt?: string | null
  currency: string
  countryCode: string
  createdAt: string
  weeklySettlement: {
    id: string
    providerId: string
    weekStart: string
    weekEnd: string
    commissionOwed: number
    commissionPaid: boolean
    status: string
    currency: string
    countryCode: string
    dueAt: string
  }
}

interface PaymentPayload {
  payments: CommissionPayment[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  actions: {
    reconcile: boolean
  }
}

type StepUpTarget =
  | { type: 'settlement'; id: string; action: 'SUSPEND' | 'UNSUSPEND' }
  | { type: 'payment'; id: string; action: 'CONFIRM' }

function money(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === 'CAD' ? 'en-CA' : 'en-LK', {
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

function settlementTone(status: string): CrmTone {
  if (status === 'PAID') return 'success'
  if (status === 'OVERDUE') return 'danger'
  if (status === 'SUSPENDED') return 'warning'
  return 'info'
}

function paymentTone(status: string): CrmTone {
  return status === 'CONFIRMED' ? 'success' : 'warning'
}

export default function CommissionPage() {
  const [tab, setTab] = useState<'obligations' | 'payments'>('obligations')
  const [settlements, setSettlements] = useState<SettlementPayload | null>(null)
  const [payments, setPayments] = useState<PaymentPayload | null>(null)
  const [status, setStatus] = useState('ALL')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [stepUpTarget, setStepUpTarget] = useState<StepUpTarget | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'obligations') {
        const params = new URLSearchParams({
          status,
          page: String(page),
          limit: '30',
        })
        const response = await fetch(
          `/api/admin/financial/commission?${params.toString()}`,
          { credentials: 'include', cache: 'no-store' }
        )
        const body = await response.json().catch(() => ({}))
        if (response.status === 401) {
          window.location.href = '/admin/login'
          return
        }
        if (!response.ok) crmApiError(body, 'Unable to load commission obligations')
        setSettlements(body)
      } else {
        const params = new URLSearchParams({
          status: status === 'ALL' ? 'ALL' : status,
          page: String(page),
          limit: '30',
        })
        const response = await fetch(
          `/api/admin/financial/commission/payments?${params.toString()}`,
          { credentials: 'include', cache: 'no-store' }
        )
        const body = await response.json().catch(() => ({}))
        if (response.status === 401) {
          window.location.href = '/admin/login'
          return
        }
        if (!response.ok) crmApiError(body, 'Unable to load commission payments')
        setPayments(body)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load commission data')
    } finally {
      setLoading(false)
    }
  }, [page, status, tab])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
    setStatus('ALL')
    setQuery('')
  }, [tab])

  const obligationRows = useMemo(() => {
    const rows = settlements?.settlements || []
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(item =>
      [
        item.provider?.name,
        item.provider?.email,
        item.provider?.mxId,
        item.providerId,
        item.id,
      ].some(value => String(value || '').toLowerCase().includes(q))
    )
  }, [query, settlements])

  const paymentRows = useMemo(() => {
    const rows = payments?.payments || []
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(item =>
      [
        item.referenceNumber,
        item.providerId,
        item.weeklySettlementId,
        item.id,
      ].some(value => String(value || '').toLowerCase().includes(q))
    )
  }, [payments, query])

  async function settlementAction(
    settlementId: string,
    action: 'SEND_REMINDER' | 'SUSPEND' | 'UNSUSPEND',
    proof?: string
  ) {
    if (acting) return
    setActing(settlementId)
    try {
      const response = await fetch('/api/admin/financial/commission', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(proof ? { 'X-CRM-Step-Up': proof } : {}),
        },
        body: JSON.stringify({ settlementId, action }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Commission action failed')

      toast.success(
        action === 'SEND_REMINDER'
          ? 'Commission reminder sent'
          : action === 'SUSPEND'
            ? 'Provider suspended for overdue commission'
            : 'Commission suspension reactivated; debt remains'
      )
      setStepUpTarget(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Commission action failed')
    } finally {
      setActing(null)
    }
  }

  async function confirmPayment(paymentId: string, proof: string) {
    if (acting) return
    setActing(paymentId)
    try {
      const response = await fetch('/api/admin/financial/commission/payments', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Step-Up': proof,
        },
        body: JSON.stringify({ paymentId }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Payment confirmation failed')

      toast.success('Commission payment confirmed and settlement reconciled')
      setStepUpTarget(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payment confirmation failed')
    } finally {
      setActing(null)
    }
  }

  const metrics = settlements?.summaryByCurrency || []

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="Finance · Provider obligations"
        title="Commission Control"
        description="Monitor weekly provider commission debt, enforce overdue obligations, and reconcile recorded payments. CRM never clears commission debt without a matching payment record."
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

      {metrics.length > 0 && (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {metrics.flatMap(summary => [
            <CrmMetricCard
              key={`${summary.currency}-owed`}
              label={`Commission owed · ${summary.currency}`}
              value={money(summary.totalCommissionOwed, summary.currency)}
              helper={`${summary.pendingCount} pending · ${summary.overdueCount} overdue`}
              icon={<FiDollarSign size={16} />}
              tone={summary.overdueCount > 0 ? 'warning' : 'neutral'}
            />,
            <CrmMetricCard
              key={`${summary.currency}-paid`}
              label={`Commission paid · ${summary.currency}`}
              value={money(summary.totalCommissionPaid, summary.currency)}
              helper={`${summary.paidCount} settled`}
              icon={<FiCheckCircle size={16} />}
              tone="success"
            />,
            <CrmMetricCard
              key={`${summary.currency}-week`}
              label={`Pending this week · ${summary.currency}`}
              value={money(summary.pendingThisWeek, summary.currency)}
              helper="Current collection cycle"
              icon={<FiClock size={16} />}
              tone="info"
            />,
            <CrmMetricCard
              key={`${summary.currency}-risk`}
              label={`Enforcement cases · ${summary.currency}`}
              value={summary.overdueCount + summary.suspendedCount}
              helper={`${summary.suspendedCount} currently suspended`}
              icon={<FiAlertTriangle size={16} />}
              tone={summary.overdueCount + summary.suspendedCount > 0 ? 'danger' : 'neutral'}
            />,
          ])}
        </section>
      )}

      <CrmTabs
        active={tab}
        onChange={id => setTab(id as 'obligations' | 'payments')}
        items={[
          {
            id: 'obligations',
            label: 'Weekly obligations',
            count: settlements?.pagination.total,
          },
          {
            id: 'payments',
            label: 'Payment confirmations',
            count: payments?.pagination.total,
          },
        ]}
      />

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
            placeholder={
              tab === 'obligations'
                ? 'Search provider, MX ID or settlement…'
                : 'Search reference, provider or settlement…'
            }
          />
        </div>

        <select
          value={status}
          onChange={event => {
            setStatus(event.target.value)
            setPage(1)
          }}
          className={crmInputClass}
          aria-label="Commission status"
        >
          {tab === 'obligations' ? (
            <>
              <option value="ALL">All obligations</option>
              <option value="PENDING">Pending</option>
              <option value="OVERDUE">Overdue</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="PAID">Paid</option>
            </>
          ) : (
            <>
              <option value="ALL">All payment records</option>
              <option value="PENDING">Pending confirmation</option>
              <option value="CONFIRMED">Confirmed</option>
            </>
          )}
        </select>
      </CrmFilterBar>

      {loading ? (
        <CrmState
          type="loading"
          title="Loading commission controls"
          description="Loading country-scoped commission obligations and payment evidence."
        />
      ) : tab === 'obligations' ? (
        obligationRows.length === 0 ? (
          <CrmState
            type="empty"
            title="No commission obligations match this view"
            description="No provider settlements match the current status and search filters."
          />
        ) : (
          <CrmTableFrame
            title="Weekly commission obligations"
            description="Suspension/reactivation requires one-time TOTP step-up. Debt can only be cleared by confirming a recorded commission payment."
          >
            <table className={`${crmTableClass} min-w-[1260px]`}>
              <thead>
                <tr>
                  <th className={crmThClass}>Provider</th>
                  <th className={crmThClass}>Week</th>
                  <th className={crmThClass}>Earnings</th>
                  <th className={crmThClass}>Commission</th>
                  <th className={crmThClass}>Status</th>
                  <th className={crmThClass}>Due</th>
                  <th className={`${crmThClass} text-right`}>Controls</th>
                </tr>
              </thead>
              <tbody>
                {obligationRows.map(item => {
                  const overdue = new Date(item.dueAt).getTime() < Date.now()
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-[#fafbf9]">
                      <td className={crmTdClass}>
                        <div className="font-semibold text-slate-900">
                          {item.provider?.name || item.providerId}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {item.provider?.mxId || item.provider?.email || item.providerId}
                        </div>
                      </td>
                      <td className={crmTdClass}>
                        <div className="text-xs font-medium text-slate-700">{date(item.weekStart)}</div>
                        <div className="mt-1 text-[10px] text-slate-400">to {date(item.weekEnd)}</div>
                      </td>
                      <td className={crmTdClass}>
                        <div className="font-semibold text-slate-900">
                          {money(item.totalEarnings, item.currency)}
                        </div>
                      </td>
                      <td className={crmTdClass}>
                        <div className="font-semibold text-slate-900">
                          {money(item.commissionOwed, item.currency)}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400">
                          {item.commissionRate}% · {item.currency}
                        </div>
                      </td>
                      <td className={crmTdClass}>
                        <CrmBadge tone={settlementTone(item.status)} dot>
                          {item.status}
                        </CrmBadge>
                      </td>
                      <td className={crmTdClass}>
                        <div className={overdue && !item.commissionPaid ? 'font-semibold text-red-700' : 'text-slate-700'}>
                          {date(item.dueAt)}
                        </div>
                      </td>
                      <td className={`${crmTdClass} text-right`}>
                        <div className="flex items-center justify-end gap-2">
                          {!item.commissionPaid && settlements?.actions.remind && (
                            <CrmButton
                              size="sm"
                              variant="secondary"
                              disabled={acting === item.id}
                              onClick={() => settlementAction(item.id, 'SEND_REMINDER')}
                            >
                              Remind
                            </CrmButton>
                          )}

                          {overdue &&
                            !item.commissionPaid &&
                            item.status !== 'SUSPENDED' &&
                            settlements?.actions.enforce && (
                              <CrmButton
                                size="sm"
                                variant="danger"
                                disabled={acting === item.id}
                                onClick={() =>
                                  setStepUpTarget({
                                    type: 'settlement',
                                    id: item.id,
                                    action: 'SUSPEND',
                                  })
                                }
                              >
                                <FiUserX size={13} />
                                Suspend
                              </CrmButton>
                            )}

                          {item.status === 'SUSPENDED' && settlements?.actions.enforce && (
                            <CrmButton
                              size="sm"
                              variant="secondary"
                              disabled={acting === item.id}
                              onClick={() =>
                                setStepUpTarget({
                                  type: 'settlement',
                                  id: item.id,
                                  action: 'UNSUSPEND',
                                })
                              }
                            >
                              Reactivate · debt stays
                            </CrmButton>
                          )}

                          {item.status === 'PAID' && (
                            <CrmBadge tone="success">Reconciled</CrmBadge>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <CrmPagination
              page={settlements?.pagination.page || page}
              totalPages={settlements?.pagination.pages || 1}
              total={settlements?.pagination.total || 0}
              pageSize={settlements?.pagination.limit || 30}
              onPageChange={setPage}
            />
          </CrmTableFrame>
        )
      ) : paymentRows.length === 0 ? (
        <CrmState
          type="empty"
          title="No commission payment records match this view"
          description="A provider payment must be recorded before Finance can confirm and clear the matching commission debt."
        />
      ) : (
        <CrmTableFrame
          title="Recorded commission payments"
          description="Confirmation checks provider, settlement, market, currency and exact amount, then atomically reconciles the settlement."
        >
          <table className={`${crmTableClass} min-w-[1180px]`}>
            <thead>
              <tr>
                <th className={crmThClass}>Reference</th>
                <th className={crmThClass}>Provider</th>
                <th className={crmThClass}>Method</th>
                <th className={crmThClass}>Amount</th>
                <th className={crmThClass}>Settlement</th>
                <th className={crmThClass}>Status</th>
                <th className={`${crmThClass} text-right`}>Control</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.map(item => (
                <tr key={item.id} className="transition-colors hover:bg-[#fafbf9]">
                  <td className={crmTdClass}>
                    <div className="font-mono text-xs font-semibold text-slate-900">
                      {item.referenceNumber}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">{date(item.createdAt)}</div>
                  </td>
                  <td className={crmTdClass}>
                    <div className="font-mono text-xs text-slate-700">{item.providerId}</div>
                    <div className="mt-1 text-[10px] text-slate-400">{item.countryCode}</div>
                  </td>
                  <td className={crmTdClass}>{item.method}</td>
                  <td className={crmTdClass}>
                    <div className="font-semibold text-slate-900">
                      {money(item.amountDue, item.currency)}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">{item.currency}</div>
                  </td>
                  <td className={crmTdClass}>
                    <div className="font-mono text-xs text-slate-700">
                      {item.weeklySettlement.id}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      Owed: {money(item.weeklySettlement.commissionOwed, item.weeklySettlement.currency)}
                    </div>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge tone={paymentTone(item.status)} dot>
                      {item.status}
                    </CrmBadge>
                  </td>
                  <td className={`${crmTdClass} text-right`}>
                    {item.status === 'PENDING' && payments?.actions.reconcile ? (
                      <CrmButton
                        size="sm"
                        variant="primary"
                        disabled={acting === item.id}
                        onClick={() =>
                          setStepUpTarget({
                            type: 'payment',
                            id: item.id,
                            action: 'CONFIRM',
                          })
                        }
                      >
                        <FiCheckCircle size={13} />
                        Confirm payment
                      </CrmButton>
                    ) : (
                      <CrmBadge tone={item.status === 'CONFIRMED' ? 'success' : 'neutral'}>
                        {item.status === 'CONFIRMED' ? 'Confirmed' : 'Read only'}
                      </CrmBadge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <CrmPagination
            page={payments?.pagination.page || page}
            totalPages={payments?.pagination.pages || 1}
            total={payments?.pagination.total || 0}
            pageSize={payments?.pagination.limit || 30}
            onPageChange={setPage}
          />
        </CrmTableFrame>
      )}

      <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3.5">
        <div className="flex items-start gap-3">
          <FiShield className="mt-0.5 shrink-0 text-amber-700" size={16} />
          <div>
            <div className="text-sm font-semibold text-amber-950">Commission safety model</div>
            <p className="mt-1 text-xs leading-5 text-amber-900/75">
              CRM cannot directly mark weekly debt paid. Finance confirms an existing payment reference after
              server-side provider, amount, currency and market checks. Suspension/reactivation uses a one-time
              TOTP proof and never clears the debt itself.
            </p>
          </div>
        </div>
      </div>

      <CrmStepUpModal
        open={Boolean(stepUpTarget)}
        actionId={
          stepUpTarget?.type === 'payment'
            ? 'finance.commission.reconcile'
            : 'finance.commission.enforce'
        }
        title={
          stepUpTarget?.type === 'payment'
            ? 'Verify commission payment confirmation'
            : stepUpTarget?.action === 'SUSPEND'
              ? 'Verify provider suspension'
              : 'Verify provider reactivation'
        }
        description={
          stepUpTarget?.type === 'payment'
            ? 'Confirming payment clears the matching commission debt and may reactivate the provider. Enter your authenticator code.'
            : 'This changes provider marketplace access. The commission debt itself is not edited.'
        }
        onClose={() => {
          if (!acting) setStepUpTarget(null)
        }}
        onVerified={async proof => {
          if (!stepUpTarget) return
          if (stepUpTarget.type === 'payment') {
            await confirmPayment(stepUpTarget.id, proof)
          } else {
            await settlementAction(stepUpTarget.id, stepUpTarget.action, proof)
          }
        }}
      />
    </div>
  )
}
