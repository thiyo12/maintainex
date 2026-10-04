'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiAlertTriangle,
  FiCheck,
  FiRefreshCw,
  FiShield,
  FiSlash,
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import {
  CrmBadge,
  CrmButton,
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
import { crmApiError } from '@/lib/crm/api-error'

type IntegritySignal = {
  id: string
  providerIdentityId?: string | null
  userId?: string | null
  jobId?: string | null
  signalType: string
  severity: string
  source?: string | null
  status: string
  metadata?: Record<string, any> | null
  reviewedAt?: string | null
  reviewedBy?: string | null
  resolution?: string | null
  createdAt: string
  identity?: null | {
    id: string
    identityType: string
    currentUserId?: string | null
    countryCode: string
    kycStatus: string
    standingStatus: string
    verifiedDisplayName?: string | null
    closedAt?: string | null
    financialAccounts: Array<{
      currency: string
      commissionDueMinor: string
      status: string
      cashJobsAllowed: boolean
      onlineJobsAllowed: boolean
      manualReviewRequired: boolean
    }>
  }
  user?: null | {
    id: string
    mxId?: string | null
    name: string
    email: string
    role: string
    isActive: boolean
    isSuspended: boolean
    isBanned: boolean
    identityStatus: string
    countryCode: string
  }
}

type Payload = {
  signals: IntegritySignal[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function severityTone(value: string): CrmTone {
  if (value === 'CRITICAL' || value === 'HIGH') return 'danger'
  if (value === 'MEDIUM') return 'warning'
  if (value === 'LOW') return 'info'
  return 'neutral'
}

function statusTone(value: string): CrmTone {
  if (value === 'CONFIRMED') return 'danger'
  if (value === 'DISMISSED' || value === 'REVIEWED') return 'success'
  if (value === 'ESCALATED') return 'warning'
  if (value === 'OPEN') return 'warning'
  return 'neutral'
}

function money(minor: string, currency: string) {
  const amount = Number(minor || 0) / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function signalSummary(signal: IntegritySignal) {
  const meta = signal.metadata || {}
  if (signal.signalType === 'STRONG_IDENTITY_MATCH_WITH_FINANCIAL_LIABILITY') {
    const matches = Array.isArray(meta.matchedProviderIdentityIds)
      ? meta.matchedProviderIdentityIds.length
      : 0
    return `Strong verified identity matches ${matches} other provider identity${matches === 1 ? '' : 'ies'} with historical financial risk.`
  }
  if (signal.signalType === 'STRONG_IDENTITY_REUSE') {
    const matches = Array.isArray(meta.matchedProviderIdentityIds)
      ? meta.matchedProviderIdentityIds.length
      : 0
    return `Strong verified identity was reused across ${matches} other provider identity${matches === 1 ? '' : 'ies'}.`
  }
  if (signal.signalType === 'CUSTOMER_WORKER_IDENTITY_MISMATCH') {
    return 'Customer reported that the arriving person did not match the verified worker profile.'
  }
  if (signal.signalType === 'ACCOUNT_CLOSED_WITH_BALANCE') {
    return 'Provider closed login access while MaintainEX commission remained outstanding.'
  }
  if (signal.signalType === 'PROVIDER_FINANCIAL_REVIEW_REQUIRED') {
    return 'Provider financial standing reached a manual-review condition.'
  }
  if (signal.signalType === 'VERIFIED_PHOTO_CHANGE_REQUESTED') {
    return 'Provider requested a new identity-controlled public worker photo.'
  }
  return String(signal.signalType).replaceAll('_', ' ')
}

export default function ProviderIntegrityPage() {
  const { user: admin } = useAdminSession()
  const canResolve = Boolean(
    admin?.permissions?.includes('risk_events:resolve') ||
    admin?.permissions?.includes('risk:resolve'),
  )

  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [reviewing, setReviewing] = useState<{
    signal: IntegritySignal
    status: 'CONFIRMED' | 'DISMISSED' | 'REVIEWED' | 'ESCALATED'
  } | null>(null)
  const [resolution, setResolution] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status,
        page: String(page),
        pageSize: '20',
      })
      const response = await fetch(`/api/admin/trust-safety/integrity?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw crmApiError(body, 'Unable to load provider integrity signals')
      setPayload(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load provider integrity signals')
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => {
    load()
  }, [load])

  const metrics = useMemo(() => {
    const signals = payload?.signals || []
    return {
      visible: payload?.total || 0,
      critical: signals.filter(signal => signal.severity === 'CRITICAL').length,
      strongIdentity: signals.filter(signal => signal.signalType.startsWith('STRONG_IDENTITY')).length,
      withDebt: signals.filter(signal =>
        signal.identity?.financialAccounts.some(account => Number(account.commissionDueMinor) > 0),
      ).length,
    }
  }, [payload])

  const submitReview = async () => {
    if (!reviewing || !resolution.trim()) return
    setSaving(true)
    try {
      const response = await fetch('/api/admin/trust-safety/integrity', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signalId: reviewing.signal.id,
          status: reviewing.status,
          resolution: resolution.trim(),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw crmApiError(body, 'Unable to review integrity signal')

      toast.success('Integrity signal reviewed')
      setReviewing(null)
      setResolution('')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to review integrity signal')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="Trust & Safety · Identity integrity"
        title="Provider integrity"
        description="Review strong-identity reuse, closed-with-balance accounts, financial-risk holds and customer-reported worker identity mismatches. Shared device/IP signals alone never prove identity or debt ownership."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/trust-safety"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Trust & Safety
            </Link>
            <CrmButton variant="secondary" onClick={load} disabled={loading}>
              <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </CrmButton>
          </div>
        }
        context={
          <>
            <CrmBadge tone={canResolve ? 'success' : 'neutral'} dot>
              {canResolve ? 'Resolution access' : 'Read only'}
            </CrmBadge>
            <CrmBadge tone="info">Market scoped</CrmBadge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CrmMetricCard
          label="Signals"
          value={metrics.visible.toLocaleString()}
          helper="Current filtered queue"
          icon={<FiShield size={16} />}
        />
        <CrmMetricCard
          label="Critical on page"
          value={metrics.critical.toLocaleString()}
          helper="High-confidence financial / identity risk"
          icon={<FiAlertTriangle size={16} />}
          tone={metrics.critical > 0 ? 'danger' : 'success'}
        />
        <CrmMetricCard
          label="Strong-ID signals"
          value={metrics.strongIdentity.toLocaleString()}
          helper="Peppered identifier matches"
          icon={<FiShield size={16} />}
          tone={metrics.strongIdentity > 0 ? 'warning' : 'neutral'}
        />
        <CrmMetricCard
          label="Identity with debt"
          value={metrics.withDebt.toLocaleString()}
          helper="Outstanding MaintainEX commission"
          icon={<FiAlertTriangle size={16} />}
          tone={metrics.withDebt > 0 ? 'danger' : 'success'}
        />
      </section>

      <CrmTabs
        active={status}
        onChange={value => {
          setStatus(value)
          setPage(1)
        }}
        items={[
          { id: 'pending', label: 'Pending review' },
          { id: 'reviewed', label: 'Reviewed' },
          { id: 'all', label: 'All' },
        ]}
      />

      <CrmTableFrame
        title="Identity integrity queue"
        description="Strong identity claims are hashed with a server-side pepper. Raw NIC/passport numbers are never exposed in this workspace."
      >
        <table className={`${crmTableClass} min-w-[1320px]`}>
          <thead>
            <tr>
              <th className={crmThClass}>Signal</th>
              <th className={crmThClass}>Provider</th>
              <th className={crmThClass}>Market / identity</th>
              <th className={crmThClass}>Financial standing</th>
              <th className={crmThClass}>Status</th>
              <th className={crmThClass}>Created</th>
              <th className={`${crmThClass} text-right`}>Review</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-5">
                  <CrmState type="loading" title="Loading identity integrity signals" />
                </td>
              </tr>
            ) : !(payload?.signals || []).length ? (
              <tr>
                <td colSpan={7} className="p-5">
                  <CrmState
                    type="empty"
                    title="No integrity signals"
                    description="No provider identity signals match the selected queue."
                  />
                </td>
              </tr>
            ) : (
              payload!.signals.map(signal => {
                const accounts = signal.identity?.financialAccounts || []
                const debtAccounts = accounts.filter(account => Number(account.commissionDueMinor) > 0)

                return (
                  <tr key={signal.id} className="align-top transition-colors hover:bg-[#fafbf9]">
                    <td className={crmTdClass}>
                      <div className="flex items-center gap-2">
                        <CrmBadge tone={severityTone(signal.severity)} dot>
                          {signal.severity}
                        </CrmBadge>
                        <span className="font-mono text-[11px] text-slate-400">
                          {signal.id.slice(0, 8)}
                        </span>
                      </div>
                      <div className="mt-2 max-w-[350px] text-sm font-semibold text-slate-900">
                        {signal.signalType.replaceAll('_', ' ')}
                      </div>
                      <p className="mt-1 max-w-[390px] text-xs leading-5 text-slate-500">
                        {signalSummary(signal)}
                      </p>
                      {signal.jobId && (
                        <Link
                          href={`/admin/jobs/${signal.jobId}`}
                          className="mt-2 inline-flex text-xs font-semibold text-amber-700"
                        >
                          Open linked Job 360
                        </Link>
                      )}
                    </td>
                    <td className={crmTdClass}>
                      {signal.user ? (
                        <>
                          <Link
                            href={`/admin/users/${signal.user.id}`}
                            className="font-semibold text-slate-900 hover:text-amber-700"
                          >
                            {signal.user.name}
                          </Link>
                          <div className="mt-1 text-[11px] text-slate-400">
                            {signal.user.mxId || signal.user.email}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <CrmBadge tone={signal.user.isActive ? 'success' : 'neutral'}>
                              {signal.user.isActive ? 'ACTIVE LOGIN' : 'LOGIN CLOSED'}
                            </CrmBadge>
                            {signal.user.isSuspended && <CrmBadge tone="warning">SUSPENDED</CrmBadge>}
                            {signal.user.isBanned && <CrmBadge tone="danger">BANNED</CrmBadge>}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Detached durable identity</span>
                      )}
                    </td>
                    <td className={crmTdClass}>
                      <div className="flex flex-wrap gap-1">
                        <CrmBadge tone="info">{signal.identity?.countryCode || '—'}</CrmBadge>
                        <CrmBadge>{signal.identity?.identityType || '—'}</CrmBadge>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        KYC {signal.identity?.kycStatus || '—'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Standing {signal.identity?.standingStatus?.replaceAll('_', ' ') || '—'}
                      </div>
                    </td>
                    <td className={crmTdClass}>
                      {debtAccounts.length ? (
                        <div className="space-y-2">
                          {debtAccounts.map(account => (
                            <div key={account.currency}>
                              <div className="font-semibold text-red-700">
                                {money(account.commissionDueMinor, account.currency)}
                              </div>
                              <div className="mt-1 text-[11px] text-slate-400">
                                Cash {account.cashJobsAllowed ? 'allowed' : 'blocked'}
                                {' · '}
                                Online {account.onlineJobsAllowed ? 'allowed' : 'blocked'}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <CrmBadge tone="success">No commission due</CrmBadge>
                      )}
                    </td>
                    <td className={crmTdClass}>
                      <CrmBadge tone={statusTone(signal.status)} dot>
                        {signal.status.replaceAll('_', ' ')}
                      </CrmBadge>
                      {signal.resolution && (
                        <p className="mt-2 max-w-[250px] text-xs leading-5 text-slate-500">
                          {signal.resolution}
                        </p>
                      )}
                    </td>
                    <td className={crmTdClass}>
                      <div className="text-xs text-slate-600">
                        {new Date(signal.createdAt).toLocaleString('en-LK', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </div>
                      {signal.source && (
                        <div className="mt-1 text-[11px] text-slate-400">{signal.source}</div>
                      )}
                    </td>
                    <td className={`${crmTdClass} text-right`}>
                      {!signal.reviewedAt && canResolve ? (
                        <div className="flex justify-end gap-1.5">
                          <CrmButton
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setReviewing({ signal, status: 'DISMISSED' })
                              setResolution('')
                            }}
                          >
                            <FiSlash size={12} />
                            Dismiss
                          </CrmButton>
                          <CrmButton
                            size="sm"
                            onClick={() => {
                              setReviewing({ signal, status: 'CONFIRMED' })
                              setResolution('')
                            }}
                          >
                            <FiCheck size={12} />
                            Confirm
                          </CrmButton>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {signal.reviewedAt ? 'Reviewed' : 'Read only'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {payload && payload.totalPages > 1 && (
          <CrmPagination
            page={payload.page}
            totalPages={payload.totalPages}
            total={payload.total}
            pageSize={payload.pageSize}
            onPageChange={setPage}
          />
        )}
      </CrmTableFrame>

      {reviewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            if (!saving) setReviewing(null)
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-[var(--crm-border)] bg-white p-6 shadow-xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600">
                <FiShield size={18} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {reviewing.status === 'CONFIRMED' ? 'Confirm integrity signal' : 'Dismiss integrity signal'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {reviewing.signal.signalType.replaceAll('_', ' ')}
                </p>
              </div>
            </div>

            <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Review resolution
            </label>
            <textarea
              className={`${crmInputClass} mt-2 min-h-[120px] py-2.5`}
              value={resolution}
              onChange={event => setResolution(event.target.value)}
              placeholder="Record the evidence considered and the reason for this outcome…"
            />

            <div className="mt-5 flex justify-end gap-2">
              <CrmButton
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  setReviewing(null)
                  setResolution('')
                }}
              >
                Cancel
              </CrmButton>
              <CrmButton
                variant={reviewing.status === 'CONFIRMED' ? 'danger' : 'primary'}
                disabled={saving || resolution.trim().length < 4}
                onClick={submitReview}
              >
                {saving ? 'Saving…' : reviewing.status === 'CONFIRMED' ? 'Confirm signal' : 'Dismiss signal'}
              </CrmButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
