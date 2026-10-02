'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiCreditCard,
  FiDollarSign,
  FiServer,
  FiShield,
  FiTool,
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import {
  CrmBadge,
  CrmCard,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  type CrmTone,
} from '@/components/crm/v2/CrmPrimitives'

interface DashboardStats {
  stats: {
    totalUsers: number
    totalTaskers: number
    totalCompanies: number
    pendingKYC: number
    verifiedKYC: number
    rejectedKYC: number
    bannedUsers: number
    pendingSettlements: number
    overdueSettlements: number
    totalCommissionOwed: number
    totalCommissionPaid: number
    pendingCheatingReports: number
    totalJobPostings: number
    openJobs: number
    completedJobs: number
    totalWalletBalance: number
    commissionRate: number
  }
  financeByCurrency?: Array<{
    currency: string
    pendingCommission: number
    paidCommission: number
    providerWalletBalance: number
  }>
  weeklySummary: {
    pendingCommission: number
    pendingCount: number
    overdueCommission: number
    overdueCount: number
  }
  capabilities: {
    jobs: boolean
    users: boolean
    taskers: boolean
    companies: boolean
    people: boolean
    kyc: boolean
    finance: boolean
    trust: boolean
    platform: boolean
  }
}

interface RecentJob {
  id: string
  title: string
  category: string
  budget: number
  status: string
  source: 'V1' | 'V2'
  customer: { name: string }
  provider?: { id: string; name: string; type: 'INDIVIDUAL' | 'COMPANY' } | null
  createdAt: string
}

interface AnalyticsPayload {
  visibility?: { finance?: boolean; disputes?: boolean }
  summary?: {
    totalJobs?: number
    openJobs?: number
    completedJobs?: number
    cancelledJobs?: number
    openDisputes?: number
    totalRevenue?: number | null
    totalCommission?: number | null
    staleJobs?: number
    avgTaskerResponseMin?: number
  }
  jobsByStatus?: {
    open?: number
    completed?: number
    cancelled?: number
    inProgress?: number
  }
  recentActivity?: Array<{
    id: string
    adminEmail: string
    action: string
    entityType?: string
    description?: string
    createdAt: string
  }>
  trend?: Array<{
    date: string
    jobs: number
    revenue: number | null
  }>
}

interface FinancialOverviewPayload {
  escrow?: Array<{
    status: string
    currency: string
    count: number
    total: string
  }>
  payouts?: Array<{
    status: string
    currency: string
    count: number
    amount: string
  }>
}

interface HealthPayload {
  status?: 'healthy' | 'degraded'
  database?: { status?: string; latencyMs?: number }
  queues?: { jobMatchPending?: number; offerMatchPending?: number }
  payments?: { pending?: number; paypalConfigured?: boolean; paypalWebhookConfigured?: boolean }
  notifications?: { createdLastHour?: number; expoPushAvailable?: boolean; mediaStorageConfigured?: boolean }
  cron?: { configured?: boolean }
}

function number(value?: number | null) {
  return Number(value || 0)
}

function formatCurrency(amount: number, currency = 'LKR') {
  try {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Number(amount || 0))
  } catch {
    return `${currency} ${Number(amount || 0).toLocaleString()}`
  }
}

function relativeTime(value?: string) {
  if (!value) return '—'
  const diff = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diff)) return '—'
  const minutes = Math.max(0, Math.round(diff / 60000))
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function statusTone(status?: string): CrmTone {
  const value = String(status || '').toUpperCase()
  if (['COMPLETED', 'SETTLED', 'PAID', 'APPROVED'].includes(value)) return 'success'
  if (['CANCELLED', 'FAILED', 'REJECTED', 'DISPUTED'].includes(value)) return 'danger'
  if (['IN_PROGRESS', 'ASSIGNED', 'QUOTE_ACCEPTED', 'UNDER_REVIEW'].includes(value)) return 'info'
  if (['OPEN', 'PENDING', 'CREATED'].includes(value)) return 'warning'
  return 'neutral'
}

function TrendChart({
  points,
  showRevenue,
}: {
  points: Array<{ date: string; jobs: number; revenue: number | null }>
  showRevenue: boolean
}) {
  const safePoints = points.length ? points : Array.from({ length: 30 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (29 - index))
    return { date: date.toISOString().slice(0, 10), jobs: 0, revenue: showRevenue ? 0 : null }
  })
  const width = 720
  const height = 220
  const left = 34
  const right = 14
  const top = 18
  const bottom = 32
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const step = safePoints.length > 1 ? plotWidth / (safePoints.length - 1) : plotWidth
  const maxJobs = Math.max(1, ...safePoints.map(point => point.jobs))
  const maxRevenue = Math.max(1, ...safePoints.map(point => Number(point.revenue || 0)))
  const barWidth = Math.max(5, Math.min(12, plotWidth / Math.max(1, safePoints.length) - 5))
  const linePoints = safePoints
    .map((point, index) => {
      const x = left + index * step
      const y = top + plotHeight - (Number(point.revenue || 0) / maxRevenue) * plotHeight
      return `${x},${y}`
    })
    .join(' ')
  const labelIndexes = new Set([0, 7, 14, 21, safePoints.length - 1])

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-5 text-[11px] font-medium text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--crm-accent)]" />
          Jobs created
        </span>
        {showRevenue && (
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-5 rounded-full bg-slate-800" />
            Revenue
          </span>
        )}
      </div>
      <div className="crm-scrollbar overflow-x-auto">
        <svg
          role="img"
          aria-label="30 day jobs and revenue trend"
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[620px] w-full"
        >
          {[0, 0.25, 0.5, 0.75, 1].map(level => {
            const y = top + plotHeight * level
            return (
              <line
                key={level}
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                stroke="#e8ebe7"
                strokeWidth="1"
              />
            )
          })}
          {safePoints.map((point, index) => {
            const x = left + index * step
            const barHeight = Math.max(point.jobs > 0 ? 3 : 0, (point.jobs / maxJobs) * plotHeight)
            const y = top + plotHeight - barHeight
            return (
              <g key={point.date}>
                <rect
                  x={x - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="3"
                  fill="var(--crm-accent)"
                  opacity="0.92"
                />
                {labelIndexes.has(index) && (
                  <text
                    x={x}
                    y={height - 9}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#94a3b8"
                  >
                    {new Date(`${point.date}T00:00:00Z`).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                  </text>
                )}
              </g>
            )
          })}
          {showRevenue && (
            <>
              <polyline
                points={linePoints}
                fill="none"
                stroke="#1f2937"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {safePoints.map((point, index) => {
                if (index % 4 !== 0 && index !== safePoints.length - 1) return null
                const x = left + index * step
                const y = top + plotHeight - (Number(point.revenue || 0) / maxRevenue) * plotHeight
                return <circle key={point.date} cx={x} cy={y} r="3" fill="#1f2937" />
              })}
            </>
          )}
        </svg>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { user } = useAdminSession()
  const [data, setData] = useState<DashboardStats | null>(null)
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null)
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [financeOverview, setFinanceOverview] = useState<FinancialOverviewPayload | null>(null)
  const [approvalCount, setApprovalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadDashboard() {
      try {
        const [dashboardResult, approvalsResult, jobsResult, analyticsResult, healthResult, financeResult] =
          await Promise.allSettled([
            fetch('/api/dashboard', { credentials: 'include', cache: 'no-store' }),
            fetch('/api/admin/approvals', { credentials: 'include', cache: 'no-store' }),
            fetch('/api/admin/jobs?limit=5&page=1', { credentials: 'include', cache: 'no-store' }),
            fetch('/api/admin/analytics', { credentials: 'include', cache: 'no-store' }),
            fetch('/api/admin/health', { credentials: 'include', cache: 'no-store' }),
            fetch('/api/admin/financial/overview', { credentials: 'include', cache: 'no-store' }),
          ])

        if (dashboardResult.status !== 'fulfilled') throw new Error('Dashboard request failed')
        if (dashboardResult.value.status === 401) {
          window.location.href = '/admin/login'
          return
        }
        if (!dashboardResult.value.ok) throw new Error('Dashboard request failed')

        const dashboardPayload = await dashboardResult.value.json()
        if (!mounted) return

        setData(dashboardPayload)

        if (approvalsResult.status === 'fulfilled' && approvalsResult.value.ok) {
          const body = await approvalsResult.value.json().catch(() => ({}))
          setApprovalCount(Number(body?.total || 0))
        }

        if (jobsResult.status === 'fulfilled' && jobsResult.value.ok) {
          const body = await jobsResult.value.json().catch(() => ({}))
          setRecentJobs(Array.isArray(body?.jobs) ? body.jobs.slice(0, 5) : [])
        }

        if (analyticsResult.status === 'fulfilled' && analyticsResult.value.ok) {
          setAnalytics(await analyticsResult.value.json().catch(() => null))
        }

        if (healthResult.status === 'fulfilled' && healthResult.value.ok) {
          setHealth(await healthResult.value.json().catch(() => null))
        }

        if (financeResult.status === 'fulfilled' && financeResult.value.ok) {
          setFinanceOverview(await financeResult.value.json().catch(() => null))
        }
      } catch (error) {
        console.error('CRM dashboard error:', error)
        toast.error('Failed to load CRM dashboard')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadDashboard()
    return () => { mounted = false }
  }, [])

  const stats = data?.stats
  const caps = data?.capabilities
  const jobStatus = useMemo(() => {
    const total = number(analytics?.summary?.totalJobs) || number(stats?.totalJobPostings)
    const open = number(analytics?.jobsByStatus?.open) || number(stats?.openJobs)
    const completed = number(analytics?.jobsByStatus?.completed) || number(stats?.completedJobs)
    const cancelled = number(analytics?.jobsByStatus?.cancelled)
    const inProgress = number(analytics?.jobsByStatus?.inProgress)
    const accounted = open + completed + cancelled + inProgress
    const other = Math.max(0, total - accounted)
    return { total, open, completed, cancelled, inProgress, other }
  }, [analytics, stats])

  const attentionItems = useMemo(() => {
    if (!data) return []
    return [
      approvalCount > 0 && { label: 'Jobs awaiting approval', value: approvalCount, href: '/admin/approvals', tone: 'danger' as CrmTone },
      caps?.finance && number(stats?.overdueSettlements) > 0 && { label: 'Payment releases pending', value: number(stats?.overdueSettlements), href: '/admin/financial/settlements', tone: 'warning' as CrmTone },
      caps?.trust && number(analytics?.summary?.openDisputes) > 0 && { label: 'Disputes requiring attention', value: number(analytics?.summary?.openDisputes), href: '/admin/jobs/disputes', tone: 'danger' as CrmTone },
      caps?.kyc && number(stats?.pendingKYC) > 0 && { label: 'New verification reviews', value: number(stats?.pendingKYC), href: '/admin/kyc', tone: 'info' as CrmTone },
    ].filter(Boolean) as Array<{ label: string; value: number; href: string; tone: CrmTone }>
  }, [approvalCount, analytics, caps, data, stats])

  if (loading) {
    return <CrmState type="loading" title="Loading CRM dashboard" description="Preparing the live operational workspace." />
  }

  if (!data || !caps) {
    return <CrmState type="error" title="Dashboard unavailable" description="The CRM dashboard could not be loaded for this staff session." />
  }

  const revenueValue = analytics?.visibility?.finance
    ? number(analytics?.summary?.totalCommission)
    : null
  const openDisputes = analytics?.visibility?.disputes
    ? number(analytics?.summary?.openDisputes)
    : number(stats?.pendingCheatingReports)
  const protectedEscrowRows = (financeOverview?.escrow || []).filter(row =>
    ['PROTECTED', 'ON_HOLD'].includes(String(row.status || '').toUpperCase())
  )
  const escrowByCurrency = new Map<string, number>()
  let escrowHeldCount = 0
  for (const row of protectedEscrowRows) {
    escrowHeldCount += Number(row.count || 0)
    escrowByCurrency.set(
      row.currency,
      (escrowByCurrency.get(row.currency) || 0) + Number(row.total || 0) / 100
    )
  }
  const escrowEntries = [...escrowByCurrency.entries()]
  const escrowHeldValue = !financeOverview
    ? 'Restricted'
    : escrowEntries.length === 0
      ? formatCurrency(0)
      : escrowEntries.length === 1
        ? formatCurrency(escrowEntries[0][1], escrowEntries[0][0])
        : `${escrowEntries.length} currencies`

  const completedPayoutRows = (financeOverview?.payouts || []).filter(row =>
    ['SUCCEEDED', 'CLEARED', 'SETTLED', 'PAID'].includes(String(row.status || '').toUpperCase())
  )
  const payoutsByCurrency = new Map<string, number>()
  let processedPayoutCount = 0
  for (const row of completedPayoutRows) {
    processedPayoutCount += Number(row.count || 0)
    payoutsByCurrency.set(
      row.currency,
      (payoutsByCurrency.get(row.currency) || 0) + Number(row.amount || 0) / 100
    )
  }
  const payoutEntries = [...payoutsByCurrency.entries()]
  const payoutsProcessedValue = !financeOverview
    ? 'Restricted'
    : payoutEntries.length === 0
      ? formatCurrency(0)
      : payoutEntries.length === 1
        ? formatCurrency(payoutEntries[0][1], payoutEntries[0][0])
        : `${payoutEntries.length} currencies`

  const totalForDonut = Math.max(1, jobStatus.total)
  const progressPct = (jobStatus.inProgress / totalForDonut) * 100
  const openPct = (jobStatus.open / totalForDonut) * 100
  const completedPct = (jobStatus.completed / totalForDonut) * 100
  const cancelledPct = ((jobStatus.cancelled + jobStatus.other) / totalForDonut) * 100

  return (
    <div className="space-y-4">
      <CrmPageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${user?.name || 'Admin'} 👋`}
        description="Here’s what’s happening with your marketplace today."
        actions={
          <div className="rounded-xl border border-[var(--crm-border)] bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
            {new Date().toLocaleDateString('en-LK', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <CrmMetricCard
          label="Total Jobs"
          value={jobStatus.total.toLocaleString()}
          helper={`${jobStatus.open.toLocaleString()} currently open`}
          icon={<FiTool size={16} />}
          tone="neutral"
        />
        <CrmMetricCard
          label="In Progress"
          value={jobStatus.inProgress.toLocaleString()}
          helper="Active marketplace work"
          icon={<FiActivity size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="Completed"
          value={jobStatus.completed.toLocaleString()}
          helper="Jobs completed in this scope"
          icon={<FiCheckCircle size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="Disputes"
          value={openDisputes.toLocaleString()}
          helper="Open operational cases"
          icon={<FiShield size={16} />}
          tone={openDisputes > 0 ? 'danger' : 'success'}
        />
        <CrmMetricCard
          label="Total Revenue"
          value={revenueValue === null ? 'Restricted' : formatCurrency(revenueValue)}
          helper={revenueValue === null ? 'Finance permission required' : 'MaintainEX commission revenue'}
          icon={<FiCreditCard size={16} />}
          tone="amber"
        />
        <CrmMetricCard
          label="Payouts Processed"
          value={payoutsProcessedValue}
          helper={financeOverview ? `${processedPayoutCount} cleared payouts` : 'Finance permission required'}
          icon={<FiDollarSign size={16} />}
          tone="neutral"
        />
      </section>

      {financeOverview && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--crm-border)] bg-white px-4 py-2.5 text-xs text-slate-500 shadow-sm">
          <FiShield className="text-amber-600" />
          <span className="font-semibold text-slate-700">Protected escrow</span>
          <span>{escrowHeldValue}</span>
          <span className="text-slate-300">·</span>
          <span>{escrowHeldCount} held / protected records</span>
          <Link href="/admin/financial/escrow" className="ml-auto font-semibold text-amber-700 hover:text-amber-800">
            Escrow operations →
          </Link>
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <CrmCard
          title="Jobs & Revenue Trend"
          description="Last 30 days in the selected market"
          action={<CrmBadge tone="success" dot>Live data</CrmBadge>}
        >
          <TrendChart
            points={analytics?.trend || []}
            showRevenue={analytics?.visibility?.finance === true}
          />
        </CrmCard>

        <CrmCard title="Job Status" description="Current marketplace workload">
          <div className="flex flex-col items-center">
            <div
              className="relative grid h-40 w-40 place-items-center rounded-full"
              style={{
                background: `conic-gradient(
                  var(--crm-success) 0 ${progressPct}%,
                  var(--crm-accent) ${progressPct}% ${progressPct + openPct}%,
                  var(--crm-info) ${progressPct + openPct}% ${progressPct + openPct + completedPct}%,
                  var(--crm-danger) ${progressPct + openPct + completedPct}% ${progressPct + openPct + completedPct + cancelledPct}%,
                  #cbd5e1 ${progressPct + openPct + completedPct + cancelledPct}% 100%
                )`,
              }}
            >
              <div className="grid h-[108px] w-[108px] place-items-center rounded-full bg-white text-center shadow-inner">
                <div>
                  <div className="text-2xl font-bold text-slate-950">{jobStatus.total.toLocaleString()}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Total jobs</div>
                </div>
              </div>
            </div>

            <div className="mt-5 w-full space-y-2.5">
              {[
                ['In progress', jobStatus.inProgress, 'bg-[var(--crm-success)]'],
                ['Pending / open', jobStatus.open, 'bg-[var(--crm-accent)]'],
                ['Completed', jobStatus.completed, 'bg-[var(--crm-info)]'],
                ['Cancelled / other', jobStatus.cancelled + jobStatus.other, 'bg-[var(--crm-danger)]'],
              ].map(([label, value, dot]) => {
                const amount = Number(value)
                const pct = jobStatus.total > 0 ? Math.round((amount / jobStatus.total) * 100) : 0
                return (
                  <div key={String(label)} className="flex items-center justify-between gap-4 text-xs">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                      {String(label)}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {amount.toLocaleString()} <span className="font-normal text-slate-400">({pct}%)</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </CrmCard>
      </section>

      <CrmCard
        title="Recent Jobs"
        description="Latest jobs in the selected market scope"
        padding="none"
        action={<Link href="/admin/jobs" className="text-xs font-semibold text-amber-700">View all →</Link>}
      >
        <div className="crm-scrollbar overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-[var(--crm-border)] bg-[#fafbf9]">
                {['ID', 'Service', 'Customer', 'Provider', 'Amount', 'Status', 'Created'].map(head => (
                  <th key={head} className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentJobs.length ? recentJobs.map(job => (
                <tr key={job.id} className="border-b border-[var(--crm-border)] last:border-0 hover:bg-[#fafbf9]">
                  <td className="px-4 py-3 text-xs font-mono text-slate-500">
                    <Link href={`/admin/jobs/${job.id}`} className="hover:text-amber-700">{job.id.slice(0, 14)}</Link>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-800">{job.category || job.title}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{job.customer?.name || 'Unknown'}</td>
                  <td className="px-4 py-3 text-xs font-medium text-slate-700">{job.provider?.name || 'Unassigned'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-800">{formatCurrency(job.budget)}</td>
                  <td className="px-4 py-3"><CrmBadge tone={statusTone(job.status)} dot>{job.status.replaceAll('_', ' ')}</CrmBadge></td>
                  <td className="px-4 py-3 text-xs text-slate-400">{relativeTime(job.createdAt)}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-xs text-slate-400">No recent jobs available for this scope.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CrmCard>

      <section className="grid gap-4 xl:grid-cols-3">
        <CrmCard
          title="Alerts / Pending Actions"
          description="Authorized queues requiring attention"
          action={attentionItems.length > 0 ? <CrmBadge tone="danger">{attentionItems.length}</CrmBadge> : <CrmBadge tone="success">Clear</CrmBadge>}
          padding="none"
        >
          <div className="divide-y divide-[var(--crm-border)]">
            {attentionItems.length ? attentionItems.map(item => (
              <Link key={item.label} href={item.href} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-[#fafbf9]">
                <span className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <FiAlertTriangle className={item.tone === 'danger' ? 'text-red-500' : item.tone === 'warning' ? 'text-amber-500' : 'text-blue-500'} />
                  {item.label}
                </span>
                <span className="text-xs font-semibold text-slate-900">{item.value}</span>
              </Link>
            )) : (
              <div className="px-5 py-8 text-center text-xs text-slate-400">No urgent actions.</div>
            )}
          </div>
        </CrmCard>

        <CrmCard
          title="Live Activity"
          description="Recent administrative events"
          action={<FiActivity className="text-slate-400" />}
          padding="none"
        >
          <div className="divide-y divide-[var(--crm-border)]">
            {(analytics?.recentActivity || []).slice(0, 5).map(activity => (
              <div key={activity.id} className="flex gap-3 px-4 py-3">
                <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600">
                  <FiActivity size={12} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-slate-700">{activity.action.replaceAll('_', ' ')}</div>
                  <div className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">{activity.description || activity.entityType || 'Administrative action'}</div>
                  <div className="mt-1 text-[10px] text-slate-400">{relativeTime(activity.createdAt)}</div>
                </div>
              </div>
            ))}
            {!analytics?.recentActivity?.length && (
              <div className="px-5 py-8 text-center text-xs text-slate-400">No activity visible for this role.</div>
            )}
          </div>
        </CrmCard>

        <CrmCard
          title="System Health"
          description="Live production services"
          action={<FiServer className="text-slate-400" />}
        >
          {health ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-3">
                <span className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                  <FiCheckCircle /> {health.status === 'healthy' ? 'All systems operational' : 'System degraded'}
                </span>
                <CrmBadge tone={health.status === 'healthy' ? 'success' : 'warning'}>{health.status || 'unknown'}</CrmBadge>
              </div>
              {[
                ['Database', health.database?.status || 'unknown', health.database?.latencyMs !== undefined ? `${health.database.latencyMs}ms` : '—'],
                ['Job queue', number(health.queues?.jobMatchPending) === 0 ? 'healthy' : 'pending', String(number(health.queues?.jobMatchPending))],
                ['Payments', number(health.payments?.pending) === 0 ? 'healthy' : 'pending', String(number(health.payments?.pending))],
                ['PayPal', health.payments?.paypalConfigured && health.payments?.paypalWebhookConfigured ? 'healthy' : 'check', health.payments?.paypalConfigured ? (health.payments?.paypalWebhookConfigured ? 'API + webhook' : 'Webhook missing') : 'Not configured'],
                ['Notifications', health.notifications?.expoPushAvailable ? 'healthy' : 'check', `${number(health.notifications?.createdLastHour)} / hr`],
                ['Cron', health.cron?.configured ? 'configured' : 'check', ''],
              ].map(([name, state, meta]) => (
                <div key={name} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${state === 'healthy' || state === 'configured' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className="text-xs font-medium text-slate-600">{name}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">{meta}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs leading-6 text-slate-500">Health details are restricted for this staff role.</div>
          )}
        </CrmCard>
      </section>
    </div>
  )
}
