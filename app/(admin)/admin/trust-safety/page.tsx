'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiAlertTriangle,
  FiArrowUpRight,
  FiFlag,
  FiRefreshCw,
  FiShield,
  FiUserCheck,
} from 'react-icons/fi'
import {
  CrmBadge,
  CrmButton,
  CrmCard,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  type CrmTone,
} from '@/components/crm/v2/CrmPrimitives'
import { crmApiError } from '@/lib/crm/api-error'

interface Payload {
  permissions: {
    kyc: boolean
    disputes: boolean
    risk: boolean
    cheating: boolean
    security: boolean
  }
  metrics: {
    pendingKyc: number
    rejectedKyc: number
    openDisputes: number
    pendingCheating: number
    pendingRisk: number
    highRisk: number
    pendingIntegrity: number
    criticalIntegrity: number
    suspiciousLogins: number
  }
  recent: {
    risk: any[]
    disputes: any[]
    cheating: any[]
    kyc: any[]
  }
}

function date(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function statusTone(value?: string): CrmTone {
  const status = String(value || '').toUpperCase()
  if (['HIGH', 'CRITICAL', 'OPEN', 'REJECTED', 'CONFIRMED'].includes(status)) return 'danger'
  if (['PENDING', 'UNDER_REVIEW', 'MEDIUM'].includes(status)) return 'warning'
  if (['APPROVED', 'RESOLVED', 'DISMISSED', 'LOW'].includes(status)) return 'success'
  return 'neutral'
}

function Status({ value }: { value: string }) {
  return (
    <CrmBadge tone={statusTone(value)} dot>
      {String(value).replaceAll('_', ' ')}
    </CrmBadge>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-xs text-slate-400">{text}</div>
}

export default function TrustSafetyControlCentrePage() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/trust-safety/overview', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Unable to load trust & safety')
      setData(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load trust & safety')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const urgent = useMemo(() => {
    if (!data) return 0
    return (
      data.metrics.highRisk +
      data.metrics.criticalIntegrity +
      data.metrics.openDisputes +
      data.metrics.pendingCheating +
      data.metrics.suspiciousLogins
    )
  }, [data])

  if (loading) {
    return (
      <CrmState
        type="loading"
        title="Loading Trust & Safety"
        description="Loading KYC, disputes, marketplace risk and account-security signals."
      />
    )
  }

  if (!data) {
    return (
      <CrmState
        type="error"
        title="Trust & Safety unavailable"
        description="The control centre could not be loaded for this staff session."
        action={
          <CrmButton variant="secondary" onClick={load}>
            <FiRefreshCw size={14} />
            Retry
          </CrmButton>
        }
      />
    )
  }

  const quickLinks = [
    data.permissions.kyc && { href: '/admin/kyc', icon: FiUserCheck, label: 'KYC queue' },
    data.permissions.disputes && { href: '/admin/jobs/disputes', icon: FiFlag, label: 'Dispute queue' },
    data.permissions.risk && { href: '/admin/trust-safety/risk-events', icon: FiShield, label: 'Risk events' },
    data.permissions.risk && { href: '/admin/trust-safety/integrity', icon: FiShield, label: 'Provider integrity' },
    data.permissions.cheating && { href: '/admin/cheating', icon: FiAlertTriangle, label: 'Off-platform reports' },
    data.permissions.security && { href: '/admin/analytics/security-monitor', icon: FiShield, label: 'Security monitor' },
  ].filter(Boolean) as Array<{ href: string; icon: any; label: string }>

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="Marketplace protection"
        title="Trust & Safety"
        description="KYC, disputes, fraud signals, off-platform behavior and account security in one operator workspace."
        actions={
          <CrmButton variant="secondary" onClick={load}>
            <FiRefreshCw size={14} />
            Refresh
          </CrmButton>
        }
        context={
          <>
            <CrmBadge tone={urgent > 0 ? 'danger' : 'success'} dot>
              {urgent > 0 ? `${urgent} urgent signal${urgent === 1 ? '' : 's'}` : 'No urgent signals'}
            </CrmBadge>
            <CrmBadge tone="info">Market scoped</CrmBadge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <CrmMetricCard
          label="Urgent signals"
          value={urgent.toLocaleString()}
          helper="Risk, disputes, cheating, suspicious logins"
          icon={<FiAlertTriangle size={16} />}
          tone={urgent > 0 ? 'danger' : 'success'}
        />
        <CrmMetricCard
          label="Pending KYC"
          value={data.metrics.pendingKyc.toLocaleString()}
          helper={`${data.metrics.rejectedKyc} rejected documents`}
          icon={<FiUserCheck size={16} />}
          tone="warning"
        />
        <CrmMetricCard
          label="Open disputes"
          value={data.metrics.openDisputes.toLocaleString()}
          helper="Open / under review"
          icon={<FiFlag size={16} />}
          tone={data.metrics.openDisputes > 0 ? 'danger' : 'success'}
        />
        <CrmMetricCard
          label="Provider integrity"
          value={data.metrics.pendingIntegrity.toLocaleString()}
          helper={`${data.metrics.criticalIntegrity} critical identity / financial signal${data.metrics.criticalIntegrity === 1 ? '' : 's'}`}
          icon={<FiShield size={16} />}
          tone={data.metrics.criticalIntegrity > 0 ? 'danger' : data.metrics.pendingIntegrity > 0 ? 'warning' : 'success'}
        />
        <CrmMetricCard
          label="Pending risk events"
          value={data.metrics.pendingRisk.toLocaleString()}
          helper={`${data.metrics.highRisk} high or critical`}
          icon={<FiShield size={16} />}
          tone={data.metrics.highRisk > 0 ? 'danger' : 'info'}
        />
      </section>

      {quickLinks.length > 0 && (
        <CrmCard
          title="Operator queues"
          description="Open a queue permitted by your current staff role and market scope."
          padding="md"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {quickLinks.map(item => (
              <Link key={item.href} href={item.href} className="group">
                <div className="crm-subtle-card flex h-full items-center justify-between gap-3 p-3 transition-colors group-hover:bg-white group-hover:border-[var(--crm-border-strong)]">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-700">
                    <item.icon size={15} className="shrink-0 text-slate-400" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <FiArrowUpRight size={13} className="shrink-0 text-slate-300 group-hover:text-slate-700" />
                </div>
              </Link>
            ))}
          </div>
        </CrmCard>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        {data.permissions.risk && (
          <CrmCard title="Recent marketplace risk" description="Anti-bypass and abnormal-behavior signals" padding="none">
            {data.recent.risk.length ? (
              <div className="divide-y divide-[var(--crm-border)]">
                {data.recent.risk.map(item => (
                  <Link
                    key={item.id}
                    href={item.job?.id ? `/admin/jobs/${item.job.id}` : '/admin/trust-safety/risk-events'}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#fafbf9]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">
                        {String(item.eventType || 'Risk event').replaceAll('_', ' ')}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-400">
                        {item.job?.title || 'No job link'} · {date(item.createdAt)}
                      </div>
                    </div>
                    <Status value={item.severity} />
                  </Link>
                ))}
              </div>
            ) : <Empty text="No risk events are available in this market." />}
          </CrmCard>
        )}

        {data.permissions.disputes && (
          <CrmCard title="Recent disputes" description="Customer and provider dispute workload" padding="none">
            {data.recent.disputes.length ? (
              <div className="divide-y divide-[var(--crm-border)]">
                {data.recent.disputes.map(item => (
                  <Link
                    key={item.id}
                    href={item.job?.id ? `/admin/jobs/${item.job.id}` : '/admin/jobs/disputes'}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#fafbf9]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">{item.reason}</div>
                      <div className="mt-1 truncate text-xs text-slate-400">
                        {item.raisedBy?.name || 'User'} · {date(item.createdAt)}
                      </div>
                    </div>
                    <Status value={item.status} />
                  </Link>
                ))}
              </div>
            ) : <Empty text="No disputes are available in this market." />}
          </CrmCard>
        )}

        {data.permissions.cheating && (
          <CrmCard title="Off-platform reports" description="Marketplace bypass and cheating reports" padding="none">
            {data.recent.cheating.length ? (
              <div className="divide-y divide-[var(--crm-border)]">
                {data.recent.cheating.map(item => (
                  <Link
                    key={item.id}
                    href="/admin/cheating"
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#fafbf9]"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{item.againstUserType} report</div>
                      <div className="mt-1 truncate text-xs text-slate-400">
                        {String(item.evidence || '').slice(0, 90)}
                        {String(item.evidence || '').length > 90 ? '…' : ''}
                      </div>
                    </div>
                    <Status value={item.status} />
                  </Link>
                ))}
              </div>
            ) : <Empty text="No off-platform reports are available." />}
          </CrmCard>
        )}

        {data.permissions.kyc && (
          <CrmCard title="Recent KYC" description="Latest identity document submissions" padding="none">
            {data.recent.kyc.length ? (
              <div className="divide-y divide-[var(--crm-border)]">
                {data.recent.kyc.map(item => (
                  <Link
                    key={item.id}
                    href={`/admin/users/${item.userId}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#fafbf9]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">
                        {item.user?.name || item.fullName || 'User'}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-400">
                        {item.docType} · {item.side} · {date(item.createdAt)}
                      </div>
                    </div>
                    <Status value={item.status} />
                  </Link>
                ))}
              </div>
            ) : <Empty text="No identity-document activity is available." />}
          </CrmCard>
        )}
      </section>

      {data.permissions.security && (
        <CrmCard
          title="Security posture"
          description="Credential and device monitoring for suspicious access behavior."
          action={<CrmBadge tone={data.metrics.suspiciousLogins > 0 ? 'danger' : 'success'} dot>{data.metrics.suspiciousLogins} suspicious / 24h</CrmBadge>}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#17191b] text-[var(--crm-accent)]">
                <FiShield size={18} />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Admin security monitor</div>
                <p className="mt-1 text-xs text-slate-500">
                  Review failed logins, security events and response actions.
                </p>
              </div>
            </div>
            <Link href="/admin/analytics/security-monitor">
              <CrmButton variant="secondary">
                Open monitor
                <FiArrowUpRight size={13} />
              </CrmButton>
            </Link>
          </div>
        </CrmCard>
      )}
    </div>
  )
}
