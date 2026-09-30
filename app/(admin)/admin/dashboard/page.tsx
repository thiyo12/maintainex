'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiAlertTriangle,
  FiArrowUpRight,
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiShield,
  FiTool,
  FiUserCheck,
  FiUsers,
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'

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
  isSuperAdmin?: boolean
}

function formatCurrency(amount: number, currency = 'LKR') {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))
}

function number(value?: number) {
  return Number(value || 0)
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  detail: string
  icon: any
  tone: 'amber' | 'blue' | 'green' | 'red'
}) {
  const tones = {
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-red-50 text-red-700 border-red-100',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
          <div className="mt-1 text-xs text-slate-400">{detail}</div>
        </div>
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${tones[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}

function ProgressRow({
  label,
  value,
  total,
  tone = 'bg-amber-400',
}: {
  label: string
  value: number
  total: number
  tone?: string
}) {
  const percentage = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">{value.toLocaleString()}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { user } = useAdminSession()
  const role = (user?.role || 'SUPPORT') as AdminRole
  const permissions = ROLE_PERMISSIONS[role] || []
  const can = (permission: string) => permissions.includes(permission)
  const [data, setData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadDashboard() {
      try {
        const response = await fetch('/api/dashboard', { credentials: 'include' })

        if (response.status === 401) {
          window.location.href = '/admin/login'
          return
        }

        if (!response.ok) throw new Error('Dashboard request failed')

        const payload = await response.json()
        if (payload.error) throw new Error(payload.error)
        if (mounted) setData(payload)
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
  const financeRows = data?.financeByCurrency || []
  const primaryFinance = financeRows.length === 1 ? financeRows[0] : null

  const totals = useMemo(() => {
    const jobs = number(stats?.totalJobPostings)
    const completed = number(stats?.completedJobs)
    const open = number(stats?.openJobs)
    const otherJobs = Math.max(0, jobs - completed - open)

    return { jobs, completed, open, otherJobs }
  }, [stats])

  const attentionItems = [
    can('kyc:view') && {
      label: 'KYC waiting for review',
      value: number(stats?.pendingKYC),
      href: '/admin/kyc',
      severity: number(stats?.pendingKYC) > 0 ? 'amber' : 'green',
    },
    can('commission:view') && {
      label: 'Overdue settlements',
      value: number(stats?.overdueSettlements),
      href: '/admin/financial/settlements',
      severity: number(stats?.overdueSettlements) > 0 ? 'red' : 'green',
    },
    can('cheating:view') && {
      label: 'Cheating reports',
      value: number(stats?.pendingCheatingReports),
      href: '/admin/cheating',
      severity: number(stats?.pendingCheatingReports) > 0 ? 'red' : 'green',
    },
    can('users:view') && {
      label: 'Banned users',
      value: number(stats?.bannedUsers),
      href: '/admin/users/customers',
      severity: 'slate',
    },
  ].filter(Boolean) as Array<{ label: string; value: number; href: string; severity: 'red' | 'amber' | 'green' | 'slate' }>

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-20 rounded-2xl bg-white border border-slate-200" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(item => <div key={item} className="h-32 rounded-2xl bg-white border border-slate-200" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-80 rounded-2xl bg-white border border-slate-200" />
          <div className="h-80 rounded-2xl bg-white border border-slate-200" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-amber-600 font-semibold">Operations overview</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-slate-950">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name || 'Admin'}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Marketplace, people, finance and trust queues in one operational view.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/jobs"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-950 text-white text-sm font-medium hover:bg-slate-800"
          >
            Open job queue
            <FiArrowUpRight size={15} />
          </Link>
          {can('settings:view') && (
            <Link
              href="/admin/platform"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
            >
              Platform management
            </Link>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Open jobs"
          value={number(stats?.openJobs).toLocaleString()}
          detail={`${number(stats?.totalJobPostings).toLocaleString()} jobs recorded`}
          icon={FiTool}
          tone="green"
        />
        <StatCard
          label="Pending commission"
          value={primaryFinance
            ? formatCurrency(primaryFinance.pendingCommission, primaryFinance.currency)
            : financeRows.length > 1
              ? `${financeRows.length} currencies`
              : formatCurrency(0)}
          detail={financeRows.length > 1
            ? financeRows.map(row => `${row.currency} ${formatCurrency(row.pendingCommission, row.currency)}`).join(' · ')
            : `${number(data?.weeklySummary?.pendingCount)} settlement items`}
          icon={FiDollarSign}
          tone="amber"
        />
        <StatCard
          label="Active taskers"
          value={number(stats?.totalTaskers).toLocaleString()}
          detail={`${number(stats?.totalCompanies).toLocaleString()} companies onboarded`}
          icon={FiUserCheck}
          tone="blue"
        />
        <StatCard
          label="Items needing attention"
          value={(
            number(stats?.pendingKYC) +
            number(stats?.overdueSettlements) +
            number(stats?.pendingCheatingReports)
          ).toLocaleString()}
          detail="KYC, settlement and trust queues"
          icon={FiAlertTriangle}
          tone="red"
        />
      </section>

      <section className="grid xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Marketplace operations</h2>
              <p className="text-xs text-slate-400 mt-1">Current job and verification workload</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              Live data
            </span>
          </div>

          <div className="p-5 grid md:grid-cols-2 gap-7">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-500">Jobs recorded</div>
                  <div className="mt-1 text-3xl font-semibold text-slate-950">{totals.jobs.toLocaleString()}</div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-slate-950 text-amber-300 flex items-center justify-center">
                  <FiBriefcase size={20} />
                </div>
              </div>
              <ProgressRow label="Open" value={totals.open} total={Math.max(1, totals.jobs)} tone="bg-amber-400" />
              <ProgressRow label="Completed" value={totals.completed} total={Math.max(1, totals.jobs)} tone="bg-emerald-500" />
              <ProgressRow label="Other states" value={totals.otherJobs} total={Math.max(1, totals.jobs)} tone="bg-blue-500" />
            </div>

            <div className="space-y-5">
              <div>
                <div className="text-sm font-medium text-slate-800">Verification pipeline</div>
                <div className="text-xs text-slate-400 mt-1">Identity document status across the marketplace</div>
              </div>
              <ProgressRow
                label="Verified"
                value={number(stats?.verifiedKYC)}
                total={Math.max(1, number(stats?.verifiedKYC) + number(stats?.pendingKYC) + number(stats?.rejectedKYC))}
                tone="bg-emerald-500"
              />
              <ProgressRow
                label="Pending review"
                value={number(stats?.pendingKYC)}
                total={Math.max(1, number(stats?.verifiedKYC) + number(stats?.pendingKYC) + number(stats?.rejectedKYC))}
                tone="bg-amber-400"
              />
              <ProgressRow
                label="Rejected"
                value={number(stats?.rejectedKYC)}
                total={Math.max(1, number(stats?.verifiedKYC) + number(stats?.pendingKYC) + number(stats?.rejectedKYC))}
                tone="bg-red-500"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Pending actions</h2>
            <p className="text-xs text-slate-400 mt-1">Queues that need an operator</p>
          </div>
          <div className="divide-y divide-slate-100">
            {attentionItems.map(item => {
              const dotClass =
                item.severity === 'red' ? 'bg-red-500' :
                item.severity === 'amber' ? 'bg-amber-400' :
                item.severity === 'green' ? 'bg-emerald-500' : 'bg-slate-400'

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                    <span className="text-sm text-slate-600">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{item.value.toLocaleString()}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">People</h2>
              <p className="text-xs text-slate-400 mt-1">Marketplace account footprint</p>
            </div>
            <FiUsers className="text-slate-400" size={19} />
          </div>
          <div className="mt-5 grid grid-cols-3 divide-x divide-slate-100">
            <div className="pr-3">
              <div className="text-xl font-semibold text-slate-950">{number(stats?.totalUsers).toLocaleString()}</div>
              <div className="text-xs text-slate-400 mt-1">Users</div>
            </div>
            <div className="px-3">
              <div className="text-xl font-semibold text-slate-950">{number(stats?.totalTaskers).toLocaleString()}</div>
              <div className="text-xs text-slate-400 mt-1">Taskers</div>
            </div>
            <div className="pl-3">
              <div className="text-xl font-semibold text-slate-950">{number(stats?.totalCompanies).toLocaleString()}</div>
              <div className="text-xs text-slate-400 mt-1">Companies</div>
            </div>
          </div>
          {can('users:view') && (
            <Link href="/admin/users/customers" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800">
              Open people management <FiArrowUpRight size={14} />
            </Link>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Finance</h2>
              <p className="text-xs text-slate-400 mt-1">Commission and provider wallet position</p>
            </div>
            <FiCreditCard className="text-slate-400" size={19} />
          </div>
          <div className="mt-5 space-y-3">
            {financeRows.length ? financeRows.map(row => (
              <div key={row.currency} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-400">{row.currency}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Commission collected</span>
                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(row.paidCommission, row.currency)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Commission pending</span>
                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(row.pendingCommission, row.currency)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Provider wallet balance</span>
                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(row.providerWalletBalance, row.currency)}</span>
                </div>
              </div>
            )) : (
              <div className="text-sm text-slate-400">No finance balances are available for this market.</div>
            )}
          </div>
          {can('wallets:view') && (
            <Link href="/admin/financial/wallets" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800">
              Open finance operations <FiArrowUpRight size={14} />
            </Link>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-[#10151d] text-white p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold">Control centre</h2>
              <p className="text-xs text-slate-400 mt-1">CRM foundation status</p>
            </div>
            <FiShield className="text-amber-300" size={19} />
          </div>

          <div className="mt-5 space-y-3">
            {[
              ['Admin session', true],
              ['Marketplace data API', Boolean(data)],
              ['Role-aware navigation', true],
              ['Job 360 workspace', true],
            ].map(([label, ready]) => (
              <div key={String(label)} className="flex items-center justify-between">
                <span className="text-sm text-slate-300">{String(label)}</span>
                <span className={`inline-flex items-center gap-1.5 text-xs ${ready ? 'text-emerald-300' : 'text-slate-500'}`}>
                  {ready ? <FiCheckCircle size={13} /> : <FiClock size={13} />}
                  {ready ? 'Ready' : 'Pending'}
                </span>
              </div>
            ))}
          </div>

          {can('settings:view') && (
            <Link
              href="/admin/platform"
              className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-amber-300 hover:text-amber-200"
            >
              Open platform controls <FiArrowUpRight size={14} />
            </Link>
          )}
        </div>
      </section>
    </div>
  )
}
