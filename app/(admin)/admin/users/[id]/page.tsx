'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowLeft,
  FiArrowUpRight,
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiLock,
  FiMapPin,
  FiRefreshCw,
  FiShield,
  FiTool,
  FiUnlock,
  FiUser,
  FiUserCheck,
  FiUserX,
  FiUsers,
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import {
  CrmBadge,
  CrmButton,
  CrmCard,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  CrmTabs,
  type CrmTone,
} from '@/components/crm/v2/CrmPrimitives'

type TabKey = 'overview' | 'work' | 'finance' | 'trust' | 'activity'

interface Payload {
  permissions: {
    work: boolean
    finance: boolean
    trust: boolean
    audit: boolean
    security: boolean
  }
  user: any
  jobs: {
    marketplace: any[]
    classic: any[]
    providerQuotes: any[]
    classicAssignments: any[]
    companyAssignments: any[]
  }
  finance: {
    payouts: any[]
    payoutRequests: any[]
    providerWallet?: any
    customerWallet?: any
  }
  reviews: {
    jobReviews: any[]
    providerReviews: any[]
  }
  audit: {
    admin: any[]
    activity: any[]
    security: any[]
  }
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'work', label: 'Jobs & Work' },
  { key: 'finance', label: 'Finance' },
  { key: 'trust', label: 'Trust & KYC' },
  { key: 'activity', label: 'Activity' },
]

function fmtDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })
}

function fmtMoney(value: unknown, currency = 'LKR') {
  const number = Number(value || 0)
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0)
}

function statusTone(value?: string | null): CrmTone {
  const v = String(value || '').toUpperCase()
  if (['ACTIVE', 'VERIFIED', 'APPROVED', 'COMPLETED', 'CLEARED', 'SUCCESS'].includes(v)) return 'success'
  if (['BANNED', 'REJECTED', 'FAILED', 'CRITICAL', 'SUSPICIOUS'].includes(v)) return 'danger'
  if (['SUSPENDED', 'PENDING', 'PROCESSING', 'HIGH'].includes(v)) return 'warning'
  if (['TASKER', 'COMPANY', 'CUSTOMER', 'USER'].includes(v)) return 'info'
  return 'neutral'
}

function Badge({ value }: { value?: string | null }) {
  return (
    <CrmBadge tone={statusTone(value)} dot>
      {String(value || '—').replaceAll('_', ' ')}
    </CrmBadge>
  )
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <CrmCard title={title} description={subtitle}>
      {children}
    </CrmCard>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm text-slate-800 break-words">{value || '—'}</div>
    </div>
  )
}

export default function User360Page() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const { user: admin } = useAdminSession()
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('overview')
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Unable to load user')
      setData(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load User 360')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const account = data?.user
  const permissions = admin?.permissions || []
  const canSuspendAccount = account?.role === 'TASKER'
    ? permissions.includes('taskers:edit')
    : account?.role === 'COMPANY'
      ? permissions.includes('companies:edit')
      : permissions.includes('users:suspend')
  const canBanAccount = account?.role === 'TASKER'
    ? permissions.includes('taskers:ban')
    : account?.role === 'COMPANY'
      ? permissions.includes('companies:ban')
      : permissions.includes('users:ban')
  const companyIsSuspended = account?.role === 'COMPANY' &&
    account?.companyProfile?.verificationStatus === 'SUSPENDED'
  const companyHasSeparateOwnerSuspension = account?.role === 'COMPANY' &&
    account?.isSuspended &&
    !companyIsSuspended
  const visibleTabs = TABS.filter(item =>
    item.key === 'overview' ||
    (item.key === 'work' && data?.permissions.work) ||
    (item.key === 'finance' && data?.permissions.finance) ||
    (item.key === 'trust' && data?.permissions.trust) ||
    (item.key === 'activity' && data?.permissions.audit)
  )

  const accountState = account?.isBanned
    ? 'BANNED'
    : account?.isSuspended
      ? 'SUSPENDED'
      : account?.isActive
        ? 'ACTIVE'
        : 'INACTIVE'

  const workCount = useMemo(() => {
    if (!data) return 0
    return data.jobs.marketplace.length +
      data.jobs.classic.length +
      data.jobs.providerQuotes.length +
      data.jobs.classicAssignments.length +
      data.jobs.companyAssignments.length
  }, [data])

  async function accountAction(action: string, needsReason = false) {
    if (!account) return
    let reason: string | null = null
    if (needsReason) {
      reason = window.prompt(`Reason for ${action.replaceAll('_', ' ')}:`)?.trim() || null
      if (!reason || reason.length < 3) {
        toast.error('Please enter a reason of at least 3 characters')
        return
      }
    }

    if (!window.confirm(`Confirm ${action.replaceAll('_', ' ')} for ${account.name}?`)) return

    setActionLoading(true)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: account.id, action, reason }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error?.message || body?.error || 'Action failed')
      toast.success('Account updated')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <CrmState
        type="loading"
        title="Loading User 360"
        description="Loading profile, marketplace work, finance, trust and audit context."
      />
    )
  }

  if (!data || !account) {
    return (
      <CrmState
        type="error"
        title="User unavailable"
        description="The record is missing or outside your assigned access scope."
      />
    )
  }

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="People · User 360"
        title={account.name || account.mxId || 'User'}
        description={`${account.mxId || account.id} · ${account.email || 'No email'} · ${account.countryCode || 'No market'}`}
        context={
          <>
            <Badge value={account.role} />
            <Badge value={accountState} />
            <CrmBadge tone={account.identityStatus === 'APPROVED' ? 'success' : 'neutral'}>
              Identity {String(account.identityStatus || 'NOT SUBMITTED').replaceAll('_', ' ')}
            </CrmBadge>
          </>
        }
        actions={
          <CrmButton variant="secondary" onClick={load} disabled={actionLoading}>
            <FiRefreshCw size={15} />
            Refresh
          </CrmButton>
        }
      />

      <div>
        <Link
          href={account.role === 'TASKER' ? '/admin/users/taskers' : account.role === 'COMPANY' ? '/admin/users/companies' : '/admin/users/customers'}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-amber-700"
        >
          <FiArrowLeft size={13} />
          Back to people
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CrmMetricCard
          label="Identity"
          value={String(account.identityStatus || 'NOT SUBMITTED').replaceAll('_', ' ')}
          helper="Canonical identity status"
          icon={<FiShield size={16} />}
          tone={account.identityStatus === 'APPROVED' ? 'success' : 'neutral'}
        />
        <CrmMetricCard
          label="Work records"
          value={data.permissions.work ? workCount : 'Restricted'}
          helper="Jobs, quotes and assignments"
          icon={<FiBriefcase size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="Market"
          value={account.countryCode || '—'}
          helper="Account country scope"
          icon={<FiMapPin size={16} />}
          tone="amber"
        />
        <CrmMetricCard
          label="Member since"
          value={new Date(account.createdAt).toLocaleDateString('en-LK')}
          helper="Account creation date"
          icon={<FiClock size={16} />}
          tone="neutral"
        />
      </section>

      <CrmCard padding="none">
        <div className="px-4 pt-2">
          <CrmTabs
            items={visibleTabs.map(item => ({ id: item.key, label: item.label }))}
            active={tab}
            onChange={id => setTab(id as TabKey)}
          />
        </div>
      </CrmCard>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        <div className="space-y-5">
          {tab === 'overview' && <Overview data={data} />}
          {tab === 'work' && data.permissions.work && <Work data={data} />}
          {tab === 'finance' && data.permissions.finance && <Finance data={data} />}
          {tab === 'trust' && data.permissions.trust && <Trust data={data} />}
          {tab === 'activity' && data.permissions.audit && <Activity data={data} />}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-[92px]">
          <Card title="Account controls" subtitle="Role-gated and audited actions">
            <div className="space-y-2">
              {canSuspendAccount && account.role === 'COMPANY' && (
                companyIsSuspended ? (
                  !account.isBanned && (
                    <ActionButton disabled={actionLoading} icon={FiUnlock} label="Reactivate company" onClick={() => accountAction('unsuspend')} />
                  )
                ) : companyHasSeparateOwnerSuspension ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                    Owner account is suspended by another workflow. Resolve that suspension before suspending or reactivating the company.
                  </div>
                ) : !account.isBanned ? (
                  <ActionButton disabled={actionLoading} icon={FiLock} label="Suspend company" tone="amber" onClick={() => accountAction('suspend', true)} />
                ) : null
              )}
              {canSuspendAccount && account.role !== 'COMPANY' && (
                account.isSuspended ? (
                  <ActionButton disabled={actionLoading} icon={FiUnlock} label="Unsuspend account" onClick={() => accountAction('unsuspend')} />
                ) : (
                  <ActionButton disabled={actionLoading} icon={FiLock} label="Suspend account" tone="amber" onClick={() => accountAction('suspend', true)} />
                )
              )}
              {canBanAccount && (
                account.isBanned ? (
                  <ActionButton disabled={actionLoading} icon={FiUserCheck} label="Remove ban" onClick={() => accountAction('unban')} />
                ) : (
                  <ActionButton disabled={actionLoading} icon={FiUserX} label="Ban account" tone="red" onClick={() => accountAction('ban', true)} />
                )
              )}
              {account.role === 'TASKER' && permissions.includes('taskers:verify') && (
                <>
                  <ActionButton disabled={actionLoading} icon={FiCheckCircle} label="Verify tasker" onClick={() => accountAction('verify_tasker')} />
                  <ActionButton disabled={actionLoading} icon={FiXActionIcon} label="Reject tasker" tone="red" onClick={() => accountAction('reject_tasker', true)} />
                </>
              )}
              {account.role === 'COMPANY' && permissions.includes('companies:verify') && (
                <>
                  <ActionButton disabled={actionLoading} icon={FiCheckCircle} label="Verify company" onClick={() => accountAction('verify_company')} />
                  <ActionButton disabled={actionLoading} icon={FiXActionIcon} label="Reject company" tone="red" onClick={() => accountAction('reject_company', true)} />
                </>
              )}
            </div>
          </Card>

          {account.companyProfile?.id && (
            <Card title="Company workspace" subtitle="This account owns a company profile">
              <Link
                href={`/admin/companies/${account.companyProfile.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2"><FiBriefcase size={15} /> Open Company 360</span>
                <FiArrowUpRight size={14} />
              </Link>
            </Card>
          )}

          <Card title="Account state">
            <div className="space-y-3">
              <KV label="Email verified" value={account.emailVerified ? 'Yes' : 'No'} />
              <KV label="Phone verified" value={account.phoneVerified ? 'Yes' : 'No'} />
              <KV label="Suspended" value={account.isSuspended ? 'Yes' : 'No'} />
              <KV label="Banned" value={account.isBanned ? 'Yes' : 'No'} />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function Overview({ data }: { data: Payload }) {
  const u = data.user
  return (
    <>
      <Card title="Profile" subtitle="Canonical account and marketplace profile">
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          <Field label="Full name" value={u.name} />
          <Field label="Email" value={u.email} />
          <Field label="Phone" value={u.phone} />
          <Field label="Role" value={u.role} />
          <Field label="Country" value={u.countryCode} />
          <Field label="Updated" value={fmtDate(u.updatedAt)} />
        </div>
      </Card>

      {u.customerProfile && (
        <Card title="Customer 360" subtitle="Customer value, segmentation and CRM notes">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Metric label="Bookings" value={u.customerProfile.totalBookings || 0} />
            <Metric label="Total spent" value={fmtMoney(u.customerProfile.totalSpent)} />
            <Metric label="Lifetime value" value={fmtMoney(u.customerProfile.lifetimeValue)} />
            <Metric label="Customer type" value={u.customerProfile.customerType} />
          </div>

          {u.customerProfile.tags?.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {u.customerProfile.tags.map((tag: any) => (
                <span key={tag.id} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">{tag.name}</span>
              ))}
            </div>
          )}

          {u.customerProfile.notes?.length > 0 && (
            <div className="mt-5 pt-5 border-t border-slate-100">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Recent notes</div>
              <div className="mt-3 space-y-2">
                {u.customerProfile.notes.slice(0, 5).map((note: any) => (
                  <div key={note.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="text-sm text-slate-700">{note.content}</div>
                    <div className="mt-1 text-xs text-slate-400">{note.createdByName || 'Staff'} · {fmtDate(note.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {u.taskerProfile && (
        <Card title="Tasker 360" subtitle="Provider quality and availability">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Metric label="Rating" value={u.taskerProfile.rating?.toFixed?.(1) || u.taskerProfile.rating || 0} />
            <Metric label="Completed jobs" value={u.taskerProfile.completedJobs || 0} />
            <Metric label="Composite score" value={u.taskerProfile.compositeScore || 0} />
            <Metric label="Completion rate" value={`${u.taskerProfile.completionRate || 0}%`} />
          </div>
          <div className="mt-5 grid md:grid-cols-2 gap-4">
            <Field label="Verification" value={<Badge value={u.taskerProfile.verificationStatus} />} />
            <Field label="Online" value={u.taskerProfile.isOnline ? 'Yes' : 'No'} />
            <Field label="Skills" value={u.taskerProfile.skills} />
            <Field label="Service areas" value={u.taskerProfile.serviceAreas} />
            <Field label="Hourly rate" value={fmtMoney(u.taskerProfile.hourlyRate)} />
            <Field label="Avg response" value={`${u.taskerProfile.avgResponseMin || 0} min`} />
          </div>
        </Card>
      )}

      {u.companyProfile && (
        <Card title="Company owner profile" subtitle="Company summary attached to this account">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Field label="Company" value={u.companyProfile.companyName} />
            <Field label="Company MX ID" value={u.companyProfile.mxId} />
            <Field label="Verification" value={<Badge value={u.companyProfile.verificationStatus} />} />
            <Field label="Staff" value={`${u.companyProfile.staffCount} / minimum ${u.companyProfile.minStaffCount}`} />
            <Field label="Subscription" value={u.companyProfile.subscriptionStatus} />
            <Field label="Rating" value={u.companyProfile.rating} />
          </div>
        </Card>
      )}
    </>
  )
}

function Work({ data }: { data: Payload }) {
  const customerJobs = [
    ...data.jobs.marketplace.map(job => ({ ...job, source: 'V2' })),
    ...data.jobs.classic.map(job => ({ ...job, source: 'V1' })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <>
      <Card title="Customer jobs" subtitle="Jobs this account created">
        {customerJobs.length ? (
          <div className="space-y-2">
            {customerJobs.map(job => (
              <Link key={`${job.source}-${job.id}`} href={`/admin/jobs/${job.id}`} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{job.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{job.source} · {fmtDate(job.createdAt)}</div>
                </div>
                <Badge value={job.status} />
              </Link>
            ))}
          </div>
        ) : <Empty icon={FiBriefcase} title="No customer jobs" text="This account has not created a job." />}
      </Card>

      <Card title="Provider work" subtitle="Quotes and assignments where this account acts as provider/worker">
        {data.jobs.providerQuotes.length || data.jobs.classicAssignments.length || data.jobs.companyAssignments.length ? (
          <div className="space-y-3">
            {data.jobs.providerQuotes.map(quote => (
              <Link key={`quote-${quote.id}`} href={`/admin/jobs/${quote.jobId}`} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-800">Marketplace quote</div>
                  <div className="text-xs text-slate-400 mt-1">{fmtDate(quote.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">{fmtMoney(Number(quote.price) / 100, quote.currency)}</div>
                  <div className="mt-1"><Badge value={quote.status} /></div>
                </div>
              </Link>
            ))}
            {data.jobs.companyAssignments.map(assignment => (
              <Link key={`company-${assignment.id}`} href={`/admin/jobs/${assignment.jobId}`} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-800">{assignment.job?.title || 'Company job assignment'}</div>
                  <div className="text-xs text-slate-400 mt-1">{assignment.company?.companyName || 'Company'} · {fmtDate(assignment.assignedAt)}</div>
                </div>
                <Badge value={assignment.status} />
              </Link>
            ))}
            {data.jobs.classicAssignments.map(assignment => (
              <Link key={`classic-${assignment.id}`} href={`/admin/jobs/${assignment.jobId}`} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-800">{assignment.job?.title || 'Classic assignment'}</div>
                  <div className="text-xs text-slate-400 mt-1">{fmtDate(assignment.createdAt)}</div>
                </div>
                <Badge value={assignment.status} />
              </Link>
            ))}
          </div>
        ) : <Empty icon={FiTool} title="No provider work" text="No quotes or provider assignments are linked to this account." />}
      </Card>
    </>
  )
}

function Finance({ data }: { data: Payload }) {
  const finance = data.finance
  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Customer wallet">
          {finance.customerWallet ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Balance" value={fmtMoney(finance.customerWallet.balance, finance.customerWallet.currency)} />
              <Field label="Frozen" value={finance.customerWallet.isFrozen ? 'Yes' : 'No'} />
            </div>
          ) : <Empty icon={FiCreditCard} title="No customer wallet" text="No customer wallet exists for this account." />}
        </Card>
        <Card title="Provider wallet">
          {finance.providerWallet ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Available" value={fmtMoney(finance.providerWallet.availableBalance, finance.providerWallet.currency)} />
              <Field label="Pending" value={fmtMoney(finance.providerWallet.pendingBalance, finance.providerWallet.currency)} />
              <Field label="Frozen" value={finance.providerWallet.isFrozen ? 'Yes' : 'No'} />
            </div>
          ) : <Empty icon={FiDollarSign} title="No provider wallet" text="No provider wallet exists for this account." />}
        </Card>
      </div>

      <Card title="Payout history" subtitle="Job payouts and withdrawal requests">
        {finance.payouts.length || finance.payoutRequests.length ? (
          <div className="space-y-2">
            {finance.payouts.map(payout => (
              <div key={payout.id} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-800">{payout.description || payout.source}</div>
                  <div className="text-xs text-slate-400 mt-1">{fmtDate(payout.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">{fmtMoney(Number(payout.amount) / 100, payout.currency)}</div>
                  <div className="mt-1"><Badge value={payout.status} /></div>
                </div>
              </div>
            ))}
            {finance.payoutRequests.map(payout => (
              <div key={`request-${payout.id}`} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-800">Withdrawal request · {payout.method}</div>
                  <div className="text-xs text-slate-400 mt-1">{fmtDate(payout.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">{fmtMoney(payout.amount, payout.currency)}</div>
                  <div className="mt-1"><Badge value={payout.status} /></div>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty icon={FiDollarSign} title="No payouts" text="No payout or withdrawal history is attached to this account." />}
      </Card>
    </>
  )
}

function Trust({ data }: { data: Payload }) {
  const u = data.user
  return (
    <>
      <Card title="Identity documents" subtitle="KYC documents and review status">
        {u.identityDocs?.length ? (
          <div className="grid md:grid-cols-2 gap-3">
            {u.identityDocs.map((doc: any) => (
              <div key={doc.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{doc.docType} · {doc.side}</div>
                    <div className="text-xs text-slate-400 mt-1">{fmtDate(doc.createdAt)}</div>
                  </div>
                  <Badge value={doc.status} />
                </div>
                {doc.imageUrl && (
                  <a href={doc.imageUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                    View protected document <FiArrowUpRight size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : <Empty icon={FiFileText} title="No KYC documents" text="This account has not submitted identity documents." />}
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Fraud / risk events">
          {u.fraudEvents?.length ? u.fraudEvents.map((event: any) => (
            <div key={event.id} className="mb-2 last:mb-0 rounded-xl border border-slate-200 p-3">
              <div className="text-sm font-medium text-slate-800">{event.type}</div>
              <div className="text-xs text-slate-400 mt-1">{event.detail || 'No detail'} · {fmtDate(event.createdAt)}</div>
            </div>
          )) : <Empty icon={FiShield} title="No fraud events" text="No account-level fraud events were found." />}
        </Card>

        <Card title="Admin flags">
          {u.adminFlags?.length ? u.adminFlags.map((flag: any) => (
            <div key={flag.id} className="mb-2 last:mb-0 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-800">{flag.reason}</div>
                <Badge value={flag.status} />
              </div>
              <div className="text-xs text-slate-400 mt-1">{fmtDate(flag.createdAt)}</div>
            </div>
          )) : <Empty icon={FiAlertTriangle} title="No admin flags" text="Staff have not flagged this account." />}
        </Card>
      </div>

      {data.permissions.security && (
              <Card title="Recent login security" subtitle="Device/IP changes and suspicious login signals">
                {u.loginActivities?.length ? (
                  <div className="space-y-2">
                    {u.loginActivities.map((activity: any) => (
                      <div key={activity.id} className="rounded-xl border border-slate-200 p-3 flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-medium text-slate-800">{activity.location || activity.ipAddress}</div>
                          <div className="text-xs text-slate-400 mt-1">{activity.userAgent || 'Unknown device'}</div>
                        </div>
                        <div className="text-right">
                          <Badge value={activity.isSuspicious ? 'SUSPICIOUS' : 'NORMAL'} />
                          <div className="text-xs text-slate-400 mt-1">{fmtDate(activity.createdAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <Empty icon={FiShield} title="No login history" text="No recent login activity is available." />}
              </Card>
      )}
    </>
  )
}

function Activity({ data }: { data: Payload }) {
  const customerActivities = data.user.customerProfile?.activities || []
  const rows = [
    ...customerActivities.map((row: any) => ({
      id: `customer-${row.id}`,
      title: row.title || row.type,
      description: row.description,
      actor: row.createdByEmail || row.createdByName,
      createdAt: row.createdAt,
    })),
    ...data.audit.admin.map((row: any) => ({
      id: `admin-${row.id}`,
      title: row.action,
      description: row.targetLabel || row.targetTable,
      actor: row.adminEmail,
      createdAt: row.createdAt,
    })),
    ...data.audit.activity.map((row: any) => ({
      id: `activity-${row.id}`,
      title: row.action,
      description: row.description,
      actor: row.adminEmail,
      createdAt: row.createdAt,
    })),
    ...data.audit.security.map((row: any) => ({
      id: `security-${row.id}`,
      title: `Security · ${row.action}`,
      description: row.description,
      actor: row.userEmail,
      createdAt: row.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <Card title="Activity & audit timeline" subtitle="CRM, admin and security events for this account">
      {rows.length ? (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.id} className="rounded-xl border border-slate-200 p-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-800">{String(row.title).replaceAll('_', ' ')}</div>
                <div className="text-sm text-slate-500 mt-1">{row.description || 'Recorded account activity'}</div>
                <div className="text-xs text-slate-400 mt-1">{row.actor || 'System'}</div>
              </div>
              <div className="text-xs text-slate-400 whitespace-nowrap">{fmtDate(row.createdAt)}</div>
            </div>
          ))}
        </div>
      ) : <Empty icon={FiActivity} title="No activity" text="No CRM or administrative activity is recorded for this account." />}
    </Card>
  )
}

function Summary({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center gap-2 text-xs text-slate-400"><Icon size={14} />{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900 truncate">{value}</div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-400">{label}</span><span className="font-semibold text-slate-700">{value}</span></div>
}

function ActionButton({ icon: Icon, label, onClick, tone = 'default', disabled }: { icon: any; label: string; onClick: () => void; tone?: 'default' | 'amber' | 'red'; disabled?: boolean }) {
  const classes = tone === 'red'
    ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
    : tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`w-full flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium disabled:opacity-50 ${classes}`}>
      <Icon size={15} /> {label}
    </button>
  )
}

function FiXActionIcon(props: { size?: number; className?: string }) {
  return <FiUserX {...props} />
}

function Empty({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="py-8 text-center">
      <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400"><Icon size={19} /></div>
      <div className="mt-3 text-sm font-semibold text-slate-800">{title}</div>
      <div className="mt-1 text-xs text-slate-400 max-w-md mx-auto">{text}</div>
    </div>
  )
}
