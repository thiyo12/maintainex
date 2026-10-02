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
import {
  CrmBadge,
  CrmCard,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
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

function ProgressRow({
  label,
  value,
  total,
  tone,
}: {
  label: string
  value: number
  total: number
  tone: 'amber' | 'success' | 'danger' | 'info'
}) {
  const percentage = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  const toneClass = {
    amber: 'bg-[var(--crm-accent)]',
    success: 'bg-[var(--crm-success)]',
    danger: 'bg-[var(--crm-danger)]',
    info: 'bg-[var(--crm-info)]',
  }[tone]

  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">{value.toLocaleString()}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${toneClass}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { user } = useAdminSession()
  const [data, setData] = useState<DashboardStats | null>(null)
  const [approvalCount, setApprovalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadDashboard() {
      try {
        const [dashboardResponse, approvalsResponse] = await Promise.all([
          fetch('/api/dashboard', {
            credentials: 'include',
            cache: 'no-store',
          }),
          fetch('/api/admin/approvals', {
            credentials: 'include',
            cache: 'no-store',
          }),
        ])

        if (dashboardResponse.status === 401) {
          window.location.href = '/admin/login'
          return
        }

        if (!dashboardResponse.ok) throw new Error('Dashboard request failed')
        const payload = await dashboardResponse.json()
        if (payload.error) throw new Error(payload.error)

        let approvals = 0
        if (approvalsResponse.ok) {
          const approvalPayload = await approvalsResponse.json().catch(() => ({}))
          approvals = Number(approvalPayload?.total || 0)
        }

        if (mounted) {
          setData(payload)
          setApprovalCount(approvals)
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
  const financeRows = data?.financeByCurrency || []
  const primaryFinance = financeRows.length === 1 ? financeRows[0] : null

  const totals = useMemo(() => {
    const jobs = number(stats?.totalJobPostings)
    const completed = number(stats?.completedJobs)
    const open = number(stats?.openJobs)
    const otherJobs = Math.max(0, jobs - completed - open)
    return { jobs, completed, open, otherJobs }
  }, [stats])

  const attentionItems = useMemo(() => {
    if (!data) return []

    return [
      approvalCount > 0 && {
        label: 'Governed approvals',
        value: approvalCount,
        href: '/admin/approvals',
        severity: 'red' as const,
      },
      caps?.kyc && {
        label: 'KYC waiting for review',
        value: number(stats?.pendingKYC),
        href: '/admin/kyc',
        severity: number(stats?.pendingKYC) > 0 ? 'amber' as const : 'green' as const,
      },
      caps?.finance && {
        label: 'Overdue settlements',
        value: number(stats?.overdueSettlements),
        href: '/admin/financial/settlements',
        severity: number(stats?.overdueSettlements) > 0 ? 'red' as const : 'green' as const,
      },
      caps?.trust && {
        label: 'Trust reports',
        value: number(stats?.pendingCheatingReports),
        href: '/admin/trust-safety',
        severity: number(stats?.pendingCheatingReports) > 0 ? 'red' as const : 'green' as const,
      },
      caps?.users && {
        label: 'Banned users',
        value: number(stats?.bannedUsers),
        href: '/admin/users/customers',
        severity: 'slate' as const,
      },
    ].filter(Boolean) as Array<{
      label: string
      value: number
      href: string
      severity: 'red' | 'amber' | 'green' | 'slate'
    }>
  }, [approvalCount, caps, data, stats])

  if (loading) {
    return (
      <CrmState
        type="loading"
        title="Loading operations overview"
        description="Loading scoped jobs, people, finance, trust and approval queues."
      />
    )
  }

  if (!data || !caps) {
    return (
      <CrmState
        type="error"
        title="Dashboard unavailable"
        description="The CRM dashboard could not be loaded for the current staff session."
      />
    )
  }

  const attentionTotal = attentionItems.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="Operations overview"
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${user?.name || 'Admin'}`}
        description="Marketplace, people, finance, trust and governed actions in one operational view."
        actions={
          <div className="flex flex-wrap gap-2">
            {caps.jobs && (
              <Link
                href="/admin/jobs"
                className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-[#17191b] px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Open job queue
                <FiArrowUpRight size={15} />
              </Link>
            )}
            {approvalCount > 0 && (
              <Link
                href="/admin/approvals"
                className="inline-flex h-10 items-center gap-2 rounded-[11px] border border-amber-300 bg-[var(--crm-accent-soft)] px-4 text-sm font-semibold text-amber-900 hover:bg-amber-100"
              >
                Review approvals
                <CrmBadge tone="amber">{approvalCount}</CrmBadge>
              </Link>
            )}
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {caps.jobs && (
          <CrmMetricCard
            label="Open jobs"
            value={number(stats?.openJobs).toLocaleString()}
            helper={`${number(stats?.totalJobPostings).toLocaleString()} jobs recorded`}
            icon={<FiTool size={16} />}
            tone="success"
          />
        )}

        {caps.finance && (
          <CrmMetricCard
            label="Pending commission"
            value={
              primaryFinance
                ? formatCurrency(primaryFinance.pendingCommission, primaryFinance.currency)
                : financeRows.length > 1
                  ? `${financeRows.length} currencies`
                  : formatCurrency(0)
            }
            helper={
              financeRows.length > 1
                ? 'Multi-market finance position'
                : `${number(data.weeklySummary?.pendingCount)} settlement items`
            }
            icon={<FiDollarSign size={16} />}
            tone="amber"
          />
        )}

        {(caps.taskers || caps.companies) && (
          <CrmMetricCard
            label="Provider network"
            value={number(stats?.totalTaskers).toLocaleString()}
            helper={`${number(stats?.totalCompanies).toLocaleString()} companies onboarded`}
            icon={<FiUserCheck size={16} />}
            tone="info"
          />
        )}

        <CrmMetricCard
          label="Items needing attention"
          value={attentionTotal.toLocaleString()}
          helper="Authorized operator queues"
          icon={<FiAlertTriangle size={16} />}
          tone={attentionTotal > 0 ? 'danger' : 'success'}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        {(caps.jobs || caps.kyc) && (
          <CrmCard
            className="xl:col-span-2"
            title="Marketplace operations"
            description="Current job and verification workload"
            action={<CrmBadge tone="success" dot>Live data</CrmBadge>}
          >
            <div className="grid gap-7 md:grid-cols-2">
              {caps.jobs && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-slate-500">Jobs recorded</div>
                      <div className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                        {totals.jobs.toLocaleString()}
                      </div>
                    </div>
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#17191b] text-[var(--crm-accent)]">
                      <FiBriefcase size={19} />
                    </div>
                  </div>

                  <ProgressRow label="Open" value={totals.open} total={Math.max(1, totals.jobs)} tone="amber" />
                  <ProgressRow label="Completed" value={totals.completed} total={Math.max(1, totals.jobs)} tone="success" />
                  <ProgressRow label="Other states" value={totals.otherJobs} total={Math.max(1, totals.jobs)} tone="info" />

                  <Link
                    href="/admin/jobs"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
                  >
                    Open Job Command Centre <FiArrowUpRight size={12} />
                  </Link>
                </div>
              )}

              {caps.kyc && (
                <div className="space-y-5">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Verification pipeline</div>
                    <div className="mt-1 text-xs text-slate-400">
                      Identity document status across your assigned market scope
                    </div>
                  </div>
                  <ProgressRow
                    label="Verified"
                    value={number(stats?.verifiedKYC)}
                    total={Math.max(1, number(stats?.verifiedKYC) + number(stats?.pendingKYC) + number(stats?.rejectedKYC))}
                    tone="success"
                  />
                  <ProgressRow
                    label="Pending review"
                    value={number(stats?.pendingKYC)}
                    total={Math.max(1, number(stats?.verifiedKYC) + number(stats?.pendingKYC) + number(stats?.rejectedKYC))}
                    tone="amber"
                  />
                  <ProgressRow
                    label="Rejected"
                    value={number(stats?.rejectedKYC)}
                    total={Math.max(1, number(stats?.verifiedKYC) + number(stats?.pendingKYC) + number(stats?.rejectedKYC))}
                    tone="danger"
                  />
                </div>
              )}
            </div>
          </CrmCard>
        )}

        <CrmCard
          title="Pending actions"
          description="Queues that need an authorized operator"
          padding="none"
        >
          {attentionItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No pending actions.</div>
          ) : (
            <div className="divide-y divide-[var(--crm-border)]">
              {attentionItems.map(item => {
                const tone =
                  item.severity === 'red' ? 'danger' :
                  item.severity === 'amber' ? 'warning' :
                  item.severity === 'green' ? 'success' : 'neutral'

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#fafbf9]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <CrmBadge tone={tone} dot>{item.label}</CrmBadge>
                    </div>
                    <span className="text-sm font-semibold text-slate-950">
                      {item.value.toLocaleString()}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </CrmCard>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {caps.people && (
          <CrmCard
            title="People"
            description="Marketplace account footprint"
            action={<FiUsers size={18} className="text-slate-400" />}
          >
            <div className="grid grid-cols-3 divide-x divide-[var(--crm-border)]">
              <div className="pr-3">
                <div className="text-xl font-semibold text-slate-950">{number(stats?.totalUsers).toLocaleString()}</div>
                <div className="mt-1 text-xs text-slate-400">Users</div>
              </div>
              <div className="px-3">
                <div className="text-xl font-semibold text-slate-950">{number(stats?.totalTaskers).toLocaleString()}</div>
                <div className="mt-1 text-xs text-slate-400">Taskers</div>
              </div>
              <div className="pl-3">
                <div className="text-xl font-semibold text-slate-950">{number(stats?.totalCompanies).toLocaleString()}</div>
                <div className="mt-1 text-xs text-slate-400">Companies</div>
              </div>
            </div>

            {caps.users && (
              <Link
                href="/admin/users/customers"
                className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
              >
                Open people management <FiArrowUpRight size={12} />
              </Link>
            )}
          </CrmCard>
        )}

        {caps.finance && (
          <CrmCard
            title="Finance"
            description="Commission and provider wallet position"
            action={<FiCreditCard size={18} className="text-slate-400" />}
          >
            <div className="space-y-3">
              {financeRows.length ? financeRows.map(row => (
                <div key={row.currency} className="rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{row.currency}</div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">Commission collected</span>
                    <span className="text-xs font-semibold text-slate-900">{formatCurrency(row.paidCommission, row.currency)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">Commission pending</span>
                    <span className="text-xs font-semibold text-slate-900">{formatCurrency(row.pendingCommission, row.currency)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">Provider wallet balance</span>
                    <span className="text-xs font-semibold text-slate-900">{formatCurrency(row.providerWalletBalance, row.currency)}</span>
                  </div>
                </div>
              )) : (
                <div className="text-xs text-slate-400">No finance balances are available for this market.</div>
              )}
            </div>

            <Link
              href="/admin/financial/wallets"
              className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
            >
              Open finance operations <FiArrowUpRight size={12} />
            </Link>
          </CrmCard>
        )}

        <CrmCard className="bg-[#10151d] text-white" padding="md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Control centre</h2>
              <p className="mt-1 text-xs text-slate-400">CRM V2 operational foundation</p>
            </div>
            <FiShield className="text-[var(--crm-accent)]" size={18} />
          </div>

          <div className="mt-5 space-y-3">
            {[
              ['Live admin session', true],
              ['Scoped marketplace data', true],
              ['Server-issued permissions', true],
              ['Job 360 workspace', true],
              ['Governed approval queue', true],
            ].map(([label, ready]) => (
              <div key={String(label)} className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-300">{String(label)}</span>
                <span className={`inline-flex items-center gap-1.5 text-[11px] ${ready ? 'text-emerald-300' : 'text-slate-500'}`}>
                  {ready ? <FiCheckCircle size={12} /> : <FiClock size={12} />}
                  {ready ? 'Ready' : 'Pending'}
                </span>
              </div>
            ))}
          </div>

          {caps.platform && (
            <Link
              href="/admin/platform"
              className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--crm-accent)] hover:text-amber-200"
            >
              Open platform controls <FiArrowUpRight size={12} />
            </Link>
          )}
        </CrmCard>
      </section>
    </div>
  )
}
