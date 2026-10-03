'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiActivity,
  FiBriefcase,
  FiDollarSign,
  FiRefreshCw,
  FiTool,
  FiTrendingUp,
  FiUserCheck,
  FiUsers,
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
import { CrmActivityFeed } from '@/components/crm/v2/CrmOperational'
import { crmApiError } from '@/lib/crm/api-error'

interface AnalyticsData {
  visibility: {
    finance: boolean
    realEstate: boolean
    disputes: boolean
  }
  summary: {
    totalUsers: number
    activeTaskers: number
    activeCompanies: number
    totalJobs: number
    openJobs: number
    completedJobs: number
    cancelledJobs: number
    staleJobs: number
    completionRate: number
    openDisputes: number
    realEstateTotal: number
    realEstatePending: number
    avgTaskerResponseMin: number
    totalRevenue: number | null
    totalCommission: number | null
    commissionCount: number | null
  }
  jobsByStatus: {
    open: number
    completed: number
    cancelled: number
    inProgress: number
  }
  usersByRole: Record<string, number>
  recentActivity: Array<{
    id: string
    adminEmail: string
    action: string
    entityType: string
    entityId: string | null
    description: string
    createdAt: string
  }>
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

function formatCurrency(value: number | null) {
  if (value === null) return 'Restricted'
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

const jobTone: Record<string, CrmTone> = {
  open: 'warning',
  completed: 'success',
  inProgress: 'info',
  cancelled: 'danger',
}

export default function AnalyticsOverview() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/analytics', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (response.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Failed to load analytics')
      setData(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  const maxJobStatus = useMemo(() => {
    if (!data) return 1
    return Math.max(
      data.jobsByStatus.open,
      data.jobsByStatus.completed,
      data.jobsByStatus.inProgress,
      data.jobsByStatus.cancelled,
      1
    )
  }, [data])

  if (loading) {
    return (
      <CrmState
        type="loading"
        title="Loading analytics"
        description="Loading marketplace, people, finance and operator activity metrics."
      />
    )
  }

  if (!data) {
    return (
      <CrmState
        type="error"
        title="Analytics unavailable"
        description="Analytics could not be loaded for the current staff session."
        action={
          <CrmButton variant="secondary" onClick={fetchAnalytics}>
            <FiRefreshCw size={14} />
            Retry
          </CrmButton>
        }
      />
    )
  }

  const totalJobsForPercent = Math.max(data.summary.totalJobs, 1)
  const maxRole = Math.max(...Object.values(data.usersByRole), 1)

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="Intelligence"
        title="Analytics"
        description="Marketplace performance, people growth, finance position and recent operator activity in one consistent view."
        actions={
          <>
            <Link href="/admin/analytics/audit"><CrmButton variant="secondary">Audit</CrmButton></Link>
            <Link href="/admin/analytics/security-monitor"><CrmButton variant="secondary">Security</CrmButton></Link>
            <Link href="/admin/analytics/health"><CrmButton variant="secondary">System health</CrmButton></Link>
            <CrmButton variant="secondary" onClick={fetchAnalytics}>
              <FiRefreshCw size={14} />
              Refresh
            </CrmButton>
          </>
        }
        context={
          <>
            <CrmBadge tone="success" dot>Live operational data</CrmBadge>
            <CrmBadge tone="info">Market scoped</CrmBadge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 2xl:grid-cols-8">
        <CrmMetricCard label="Total users" value={formatNumber(data.summary.totalUsers)} icon={<FiUsers size={16} />} tone="info" />
        <CrmMetricCard label="Active taskers" value={formatNumber(data.summary.activeTaskers)} helper={`${data.summary.avgTaskerResponseMin}m avg response`} icon={<FiUserCheck size={16} />} tone="success" />
        <CrmMetricCard label="Active companies" value={formatNumber(data.summary.activeCompanies)} icon={<FiBriefcase size={16} />} tone="neutral" />
        <CrmMetricCard label="Total jobs" value={formatNumber(data.summary.totalJobs)} icon={<FiTool size={16} />} tone="amber" />
        <CrmMetricCard label="Completion" value={`${data.summary.completionRate.toFixed(1)}%`} helper={`${data.summary.staleJobs} SLA-risk jobs`} icon={<FiTrendingUp size={16} />} tone={data.summary.staleJobs>0?'warning':'success'} />
        <CrmMetricCard label="Open disputes" value={data.visibility.disputes?formatNumber(data.summary.openDisputes):'Restricted'} helper="Unresolved cases" icon={<FiActivity size={16} />} tone="warning" />
        <CrmMetricCard label="Revenue" value={formatCurrency(data.summary.totalRevenue)} helper={data.visibility.finance?'Authorized finance view':'Finance permission required'} icon={<FiDollarSign size={16} />} tone={data.visibility.finance?'success':'neutral'} />
        <CrmMetricCard label="Real Estate" value={data.visibility.realEstate?formatNumber(data.summary.realEstateTotal):'Restricted'} helper={data.visibility.realEstate?`${data.summary.realEstatePending} pending review`:'Real-estate permission required'} icon={<FiBriefcase size={16} />} tone="info" />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <CrmCard title="Jobs by status" description="Current distribution across the job lifecycle" action={<CrmBadge tone="neutral">{formatNumber(data.summary.totalJobs)} jobs</CrmBadge>}>
          <div className="space-y-4">
            {Object.entries(data.jobsByStatus).map(([status, count]) => {
              const width = Math.max(2, (count / maxJobStatus) * 100)
              const percentage = ((count / totalJobsForPercent) * 100).toFixed(1)
              const tone = jobTone[status] || 'neutral'
              const barClass = {
                neutral: 'bg-slate-400',
                amber: 'bg-[var(--crm-accent)]',
                success: 'bg-[var(--crm-success)]',
                warning: 'bg-[var(--crm-warning)]',
                danger: 'bg-[var(--crm-danger)]',
                info: 'bg-[var(--crm-info)]',
              }[tone]

              return (
                <div key={status}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <CrmBadge tone={tone} dot>{status.replace(/([A-Z])/g, ' $1').trim()}</CrmBadge>
                    <span className="text-xs font-semibold text-slate-700">{formatNumber(count)} · {percentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${barClass}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </CrmCard>

        <CrmCard title="Users by role" description="Current account distribution" action={<FiUsers size={17} className="text-slate-400" />}>
          {Object.keys(data.usersByRole).length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No user-role data available.</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(data.usersByRole).map(([role, count]) => (
                <div key={role}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-700">{role}</span>
                    <span className="text-xs font-semibold text-slate-900">{formatNumber(count)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[var(--crm-accent)]" style={{ width: `${Math.max(2, (count / maxRole) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CrmCard>
      </section>

      <CrmCard title="Recent operator activity" description="Recent audited actions surfaced for operational awareness" action={<FiActivity size={17} className="text-slate-400" />} padding="none">
        <CrmActivityFeed
          items={data.recentActivity.map(activity => ({
            id: activity.id,
            title: `${activity.action} · ${activity.entityType}`,
            description: activity.description,
            actor: activity.adminEmail,
            time: new Date(activity.createdAt).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' }),
            tone: 'amber',
          }))}
          emptyLabel="No recent operator activity"
        />
      </CrmCard>
    </div>
  )
}
