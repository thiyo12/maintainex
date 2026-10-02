'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowUpRight,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiShield,
  FiTool,
  FiUserCheck,
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { useCrmShell } from '@/components/crm/v2/CrmShellContext'
import { CrmBadge, CrmState } from '@/components/crm/v2/CrmPrimitives'

interface DashboardData {
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
    openDisputes: number
    totalJobPostings: number
    openJobs: number
    completedJobs: number
    totalWalletBalance: number
    commissionRate: number
  }
  financeByCurrency: Array<{
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
  recentJobs: Array<{
    id: string
    source: 'V1' | 'V2'
    title: string
    customer: string
    provider: string
    amount: number
    currency: string
    status: string
    createdAt: string
  }>
  jobTrend: Array<{ date: string; jobsCreated: number }>
  capabilities: {
    jobs: boolean
    users: boolean
    taskers: boolean
    companies: boolean
    people: boolean
    kyc: boolean
    finance: boolean
    trust: boolean
    disputes: boolean
    platform: boolean
    health: boolean
  }
}

interface HealthData {
  status: string
  release: string
  database: { status: string; latencyMs: number }
  queues: { jobMatchPending: number; offerMatchPending: number }
  payments: { pending: number }
  notifications: { createdLastHour: number }
}

function money(value: number, currency = 'LKR') {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function timeAgo(value: string) {
  const ms = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.floor(ms / 60000))
  if (minutes < 60) return `${minutes || 1}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function statusTone(status: string) {
  const value = status.toUpperCase()
  if (['COMPLETED', 'PAID', 'RELEASED', 'VERIFIED'].includes(value)) return 'success' as const
  if (['CANCELLED', 'FAILED', 'DISPUTED', 'REJECTED'].includes(value)) return 'danger' as const
  if (['OPEN', 'PENDING', 'QUOTE_ACCEPTED'].includes(value)) return 'amber' as const
  if (['IN_PROGRESS', 'ASSIGNED', 'PROCESSING'].includes(value)) return 'info' as const
  return 'neutral' as const
}

function MetricCard({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  helper: string
  tone: 'green' | 'amber' | 'blue' | 'red'
}) {
  const toneClass = {
    green: 'bg-emerald-500 text-white',
    amber: 'bg-[#f3b81a] text-white',
    blue: 'bg-[#4a82ee] text-white',
    red: 'bg-[#ef4562] text-white',
  }[tone]

  return (
    <div className="crm-card p-3.5">
      <div className="flex items-center gap-2.5">
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${toneClass}`}>{icon}</div>
        <span className="text-[11px] font-semibold text-slate-600">{label}</span>
      </div>
      <div className="mt-3 text-[22px] font-extrabold tracking-[-0.035em] text-slate-950">{value}</div>
      <div className="mt-1.5 text-[10px] text-slate-400">{helper}</div>
    </div>
  )
}

function TrendChart({ rows }: { rows: Array<{ date: string; jobsCreated: number }> }) {
  const [range, setRange] = useState<7 | 30>(30)
  const data = rows.slice(-range)
  const max = Math.max(1, ...data.map(row => row.jobsCreated))
  const width = 640
  const height = 176
  const plotTop = 14
  const plotBottom = 144
  const plotHeight = plotBottom - plotTop
  const cell = data.length ? width / data.length : width
  const moving = data.map((row, index) => {
    const start = Math.max(0, index - 6)
    const sample = data.slice(start, index + 1)
    return sample.reduce((sum, item) => sum + item.jobsCreated, 0) / sample.length
  })
  const points = moving.map((value, index) => {
    const x = cell * index + cell / 2
    const y = plotBottom - (value / max) * plotHeight
    return `${x},${y}`
  }).join(' ')

  return (
    <section className="crm-card overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <div>
          <h2 className="text-[12px] font-bold text-slate-900">Jobs Trend</h2>
          <div className="mt-1 flex items-center gap-4 text-[9px] text-slate-500">
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#f3b81a]" />Jobs created</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#263343]" />7-day average</span>
          </div>
        </div>
        <div className="flex rounded-md border border-[#dfe4e8] bg-[#f8fafb] p-0.5">
          {[7, 30].map(value => (
            <button key={value} type="button" onClick={() => setRange(value as 7 | 30)} className={`h-6 rounded px-2 text-[9px] font-bold ${range === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>
              {value}D
            </button>
          ))}
        </div>
      </div>
      <div className="px-3 pb-3 pt-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[176px] w-full" role="img" aria-label="Jobs created trend">
          {[0, 1, 2, 3].map(line => {
            const y = plotTop + (plotHeight / 3) * line
            return <line key={line} x1="0" x2={width} y1={y} y2={y} stroke="#e7ebef" strokeWidth="1" />
          })}
          {data.map((row, index) => {
            const barHeight = (row.jobsCreated / max) * plotHeight
            return (
              <rect
                key={row.date}
                x={cell * index + Math.max(2, cell * 0.18)}
                y={plotBottom - barHeight}
                width={Math.max(3, cell * 0.52)}
                height={Math.max(row.jobsCreated ? 3 : 0, barHeight)}
                rx="2"
                fill="#f3b81a"
              />
            )
          })}
          {points && <polyline points={points} fill="none" stroke="#263343" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
          {range === 7 && data.map((row, index) => (
            <text key={row.date} x={cell * index + cell / 2} y="166" textAnchor="middle" fontSize="8" fill="#94a3b8">
              {new Date(row.date + 'T00:00:00Z').toLocaleDateString('en', { weekday: 'short' })}
            </text>
          ))}
          {range === 30 && [0, 7, 14, 21, 29].map(index => data[index] && (
            <text key={data[index].date} x={cell * index + cell / 2} y="166" textAnchor="middle" fontSize="8" fill="#94a3b8">
              {new Date(data[index].date + 'T00:00:00Z').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
            </text>
          ))}
        </svg>
      </div>
    </section>
  )
}

function StatusDonut({ total, open, completed }: { total: number; open: number; completed: number }) {
  const other = Math.max(0, total - open - completed)
  const safe = Math.max(1, total)
  const openPct = (open / safe) * 100
  const completedPct = (completed / safe) * 100
  const first = openPct
  const second = openPct + completedPct
  const background = `conic-gradient(#31b86b 0 ${first}%, #4a82ee ${first}% ${second}%, #f3b81a ${second}% 100%)`

  return (
    <section className="crm-card h-full p-4">
      <h2 className="text-[12px] font-bold text-slate-900">Job Status</h2>
      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-[112px] w-[112px] shrink-0 rounded-full" style={{ background }}>
          <div className="absolute inset-[19px] grid place-items-center rounded-full bg-white text-center">
            <div>
              <div className="text-[19px] font-extrabold text-slate-950">{total}</div>
              <div className="text-[8px] text-slate-400">Total Jobs</div>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          {[
            ['Open', open, '#31b86b'],
            ['Completed', completed, '#4a82ee'],
            ['Other states', other, '#f3b81a'],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="flex items-center justify-between gap-3 text-[10px]">
              <span className="inline-flex items-center gap-2 text-slate-600"><i className="h-2 w-2 rounded-full" style={{ background: String(color) }} />{label}</span>
              <span className="font-bold text-slate-900">{Number(value).toLocaleString()} <span className="font-medium text-slate-400">({Math.round((Number(value) / safe) * 100)}%)</span></span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function AdminDashboard() {
  const { user } = useAdminSession()
  const { market } = useCrmShell()
  const [data, setData] = useState<DashboardData | null>(null)
  const [health, setHealth] = useState<HealthData | null>(null)
  const [approvalCount, setApprovalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const [dashboardResponse, approvalsResponse, healthResponse] = await Promise.all([
          fetch(`/api/dashboard?market=${encodeURIComponent(market)}`, { credentials: 'include', cache: 'no-store' }),
          fetch('/api/admin/approvals', { credentials: 'include', cache: 'no-store' }),
          fetch('/api/admin/health', { credentials: 'include', cache: 'no-store' }),
        ])

        if (dashboardResponse.status === 401) {
          window.location.href = '/admin/login'
          return
        }
        if (!dashboardResponse.ok) throw new Error('Dashboard request failed')
        const dashboard = await dashboardResponse.json()
        const approvals = approvalsResponse.ok ? await approvalsResponse.json().catch(() => ({})) : {}
        const healthPayload = healthResponse.ok ? await healthResponse.json().catch(() => null) : null
        if (mounted) {
          setData(dashboard)
          setApprovalCount(Number(approvals?.total || 0))
          setHealth(healthPayload)
        }
      } catch (error) {
        console.error('CRM dashboard error:', error)
        toast.error('Failed to load CRM dashboard')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [market])

  const primaryFinance = data?.financeByCurrency?.length === 1 ? data.financeByCurrency[0] : null
  const attentionItems = useMemo(() => {
    if (!data) return []
    return [
      approvalCount > 0 && { label: 'Governed approvals awaiting review', value: approvalCount, href: '/admin/approvals', tone: 'danger' as const },
      data.capabilities.kyc && data.stats.pendingKYC > 0 && { label: 'KYC verifications pending', value: data.stats.pendingKYC, href: '/admin/kyc', tone: 'amber' as const },
      data.capabilities.finance && data.stats.overdueSettlements > 0 && { label: 'Overdue settlements', value: data.stats.overdueSettlements, href: '/admin/financial/settlements', tone: 'danger' as const },
      data.capabilities.disputes && data.stats.openDisputes > 0 && { label: 'Open disputes need attention', value: data.stats.openDisputes, href: '/admin/jobs/disputes', tone: 'danger' as const },
      data.capabilities.trust && data.stats.pendingCheatingReports > 0 && { label: 'Trust & Safety reports', value: data.stats.pendingCheatingReports, href: '/admin/trust-safety', tone: 'amber' as const },
    ].filter(Boolean) as Array<{ label: string; value: number; href: string; tone: 'danger' | 'amber' }>
  }, [approvalCount, data])

  if (loading && !data) return <CrmState type="loading" title="Loading CRM dashboard" description="Loading scoped marketplace operations." />
  if (!data) return <CrmState type="error" title="Dashboard unavailable" description="The CRM dashboard could not be loaded for this staff session." />

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-3.5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-[-0.035em] text-slate-950">{greeting}, {user?.name || 'Admin'} 👋</h1>
          <p className="mt-1 text-[11px] text-slate-500">Here&apos;s what&apos;s happening with your marketplace today.</p>
        </div>
        <div className="inline-flex h-9 items-center gap-2 self-start rounded-lg border border-[#dfe4e8] bg-white px-3 text-[10px] font-semibold text-slate-600">
          <FiCalendar size={13} />
          {now.toLocaleDateString('en-LK', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<FiActivity size={15} />} label="Active Jobs" value={data.stats.openJobs.toLocaleString()} helper={`${data.stats.totalJobPostings.toLocaleString()} total jobs`} tone="green" />
        <MetricCard icon={<FiDollarSign size={15} />} label="Commission Pending" value={primaryFinance ? money(primaryFinance.pendingCommission, primaryFinance.currency) : data.financeByCurrency.length > 1 ? `${data.financeByCurrency.length} currencies` : money(0)} helper={`${data.weeklySummary.pendingCount} settlement items`} tone="amber" />
        <MetricCard icon={<FiCreditCard size={15} />} label="Commission Collected" value={primaryFinance ? money(primaryFinance.paidCommission, primaryFinance.currency) : data.financeByCurrency.length > 1 ? `${data.financeByCurrency.length} currencies` : money(0)} helper={`${data.stats.commissionRate}% configured commission`} tone="blue" />
        <MetricCard icon={<FiShield size={15} />} label="Open Disputes" value={data.stats.openDisputes.toLocaleString()} helper="Formal unresolved disputes" tone="red" />
      </section>

      <section className="grid gap-3.5 xl:grid-cols-[minmax(0,1.9fr)_minmax(300px,.8fr)]">
        <TrendChart rows={data.jobTrend || []} />
        <StatusDonut total={data.stats.totalJobPostings} open={data.stats.openJobs} completed={data.stats.completedJobs} />
      </section>

      <section className="crm-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e5e9ed] px-4 py-3">
          <h2 className="text-[12px] font-bold text-slate-900">Recent Jobs</h2>
          <Link href="/admin/jobs" className="inline-flex items-center gap-1 text-[10px] font-bold text-[#3478d4] hover:text-[#245da7]">
            View all <FiArrowUpRight size={11} />
          </Link>
        </div>
        <div className="crm-scrollbar overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="bg-[#f8fafb] text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
                <th className="px-4 py-2.5">ID</th>
                <th className="px-4 py-2.5">Service</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Provider</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.recentJobs?.length ? data.recentJobs.map(job => (
                <tr key={job.id} className="border-t border-[#edf0f2] text-[10px] hover:bg-[#fbfcfd]">
                  <td className="px-4 py-2.5 font-mono text-[9px] text-slate-500">
                    <Link href={`/admin/jobs/${job.id}`} className="hover:text-slate-900">{job.id.slice(0, 14)}</Link>
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{job.title}</td>
                  <td className="px-4 py-2.5 text-slate-600">{job.customer}</td>
                  <td className="px-4 py-2.5 text-slate-600">{job.provider}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-800">{money(job.amount, job.currency)}</td>
                  <td className="px-4 py-2.5"><CrmBadge tone={statusTone(job.status)} dot>{job.status.replaceAll('_', ' ')}</CrmBadge></td>
                  <td className="px-4 py-2.5 text-right text-slate-400">{timeAgo(job.createdAt)}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-400">No jobs are visible in this market.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3.5 xl:grid-cols-3">
        <div className="crm-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e5e9ed] px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[12px] font-bold text-slate-900">Alerts / Pending Actions</h2>
              {attentionItems.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#ef4562] px-1 text-[9px] font-bold text-white">{attentionItems.length}</span>}
            </div>
            <Link href="/admin/approvals" className="text-[10px] font-bold text-[#3478d4]">View all</Link>
          </div>
          <div className="divide-y divide-[#edf0f2]">
            {attentionItems.length ? attentionItems.slice(0, 5).map(item => (
              <Link key={item.label} href={item.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#fbfcfd]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${item.tone === 'danger' ? 'bg-red-50 text-[#d9364f]' : 'bg-amber-50 text-[#b87500]'}`}>
                    <FiAlertTriangle size={11} />
                  </span>
                  <span className="truncate text-[10px] font-medium text-slate-700">{item.value} {item.label}</span>
                </div>
                <FiArrowUpRight size={11} className="text-slate-300" />
              </Link>
            )) : (
              <div className="p-6 text-center text-[10px] text-slate-400">No pending actions for this market.</div>
            )}
          </div>
        </div>

        <div className="crm-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e5e9ed] px-4 py-3">
            <h2 className="text-[12px] font-bold text-slate-900">Live Activity</h2>
            <Link href="/admin/jobs" className="text-[10px] font-bold text-[#3478d4]">View all</Link>
          </div>
          <div className="divide-y divide-[#edf0f2]">
            {data.recentJobs?.slice(0, 5).map((job, index) => (
              <Link key={job.id} href={`/admin/jobs/${job.id}`} className="flex gap-3 px-4 py-3 hover:bg-[#fbfcfd]">
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${index % 3 === 0 ? 'bg-emerald-50 text-emerald-600' : index % 3 === 1 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                  <FiBriefcase size={11} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-semibold text-slate-800">{job.title}</div>
                  <div className="mt-0.5 truncate text-[9px] text-slate-400">{job.customer} · {job.status.replaceAll('_', ' ')} · {timeAgo(job.createdAt)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="crm-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e5e9ed] px-4 py-3">
            <h2 className="text-[12px] font-bold text-slate-900">System Health</h2>
            {health && <CrmBadge tone={health.status === 'healthy' ? 'success' : 'warning'} dot>{health.status === 'healthy' ? 'Operational' : 'Degraded'}</CrmBadge>}
          </div>
          <div className="space-y-3 p-4">
            {health ? (
              <>
                {[
                  ['Database', health.database.status === 'healthy' ? `${health.database.latencyMs} ms` : health.database.status, health.database.status === 'healthy'],
                  ['Job queue', health.queues.jobMatchPending.toLocaleString(), true],
                  ['Offer queue', health.queues.offerMatchPending.toLocaleString(), true],
                  ['Payment work', health.payments.pending.toLocaleString(), true],
                  ['Notifications / hour', health.notifications.createdLastHour.toLocaleString(), true],
                ].map(([label, value, ok]) => (
                  <div key={String(label)} className="flex items-center justify-between text-[10px]">
                    <span className="inline-flex items-center gap-2 text-slate-600"><i className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />{label}</span>
                    <span className="font-bold text-slate-800">{String(value)}</span>
                  </div>
                ))}
                <div className="border-t border-[#edf0f2] pt-2 text-[8px] text-slate-400">Release {health.release?.slice(0, 12) || 'unknown'}</div>
              </>
            ) : (
              <div className="py-5 text-center text-[10px] text-slate-400">
                <FiCheckCircle className="mx-auto mb-2 text-emerald-500" size={18} />
                Health details are restricted for this staff role.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
