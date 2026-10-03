'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { CrmBadge, CrmButton, CrmState, CrmTabs } from '@/components/crm/v2/CrmPrimitives'
import { CrmModal } from '@/components/crm/v2/CrmOverlays'
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
  FiRefreshCw,
  FiShield,
  FiTool,
  FiUnlock,
  FiUser,
  FiUserCheck,
  FiUsers,
  FiUserX,
} from 'react-icons/fi'
import { crmApiError } from '@/lib/crm/api-error'

type TabKey = 'overview' | 'workforce' | 'jobs' | 'finance' | 'trust' | 'audit'

interface Payload {
  permissions: {
    work: boolean
    finance: boolean
    trust: boolean
    audit: boolean
    actions: {
      suspend: boolean
      verify: boolean
    }
  }
  company: any
  documents: any[]
  ownerIdentityDocs: any[]
  jobs: any[]
  quotes: any[]
  assignments: any[]
  finance: {
    escrows: any[]
    settlements: any[]
    payouts: any[]
    wallet?: any
  }
  trust: {
    riskEvents: any[]
  }
  audit: {
    company: any[]
    admin: any[]
    activity: any[]
  }
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'workforce', label: 'Workforce' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'finance', label: 'Finance' },
  { key: 'trust', label: 'Trust & KYC' },
  { key: 'audit', label: 'Audit' },
]

function fmtDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })
}

function fmtMoneyMinor(value: unknown, currency = 'LKR') {
  const raw = Number(value || 0)
  const amount = Number.isFinite(raw) ? raw / 100 : 0
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

function fmtMoneyMajor(value: unknown, currency = 'LKR') {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function Badge({ value }: { value?: string | null }) {
  const raw = String(value || '—').toUpperCase()
  const tone =
    ['ACTIVE', 'VERIFIED', 'APPROVED', 'COMPLETED', 'CLEARED', 'SETTLED'].includes(raw)
      ? 'success'
      : ['SUSPENDED', 'PAST_DUE', 'PENDING', 'PROCESSING', 'HIGH'].includes(raw)
        ? 'warning'
        : ['REJECTED', 'FAILED', 'CANCELLED', 'CRITICAL'].includes(raw)
          ? 'danger'
          : 'neutral'

  return <CrmBadge tone={tone as any} dot>{raw.replaceAll('_', ' ')}</CrmBadge>
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
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

export default function Company360Page() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('overview')
  const [actionLoading, setActionLoading] = useState(false)
  const [companyActionModal, setCompanyActionModal] = useState<{
    action: 'suspend' | 'reactivate' | 'approve' | 'reject'
  } | null>(null)
  const [actionReason, setActionReason] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/companies/${encodeURIComponent(id)}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Unable to load company')
      setData(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load Company 360')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const company = data?.company
  const visibleTabs = TABS.filter(item =>
    item.key === 'overview' ||
    item.key === 'workforce' ||
    (item.key === 'jobs' && data?.permissions.work) ||
    (item.key === 'finance' && data?.permissions.finance) ||
    (item.key === 'trust' && data?.permissions.trust) ||
    (item.key === 'audit' && data?.permissions.audit)
  )

  const jobCount = useMemo(() => data?.jobs?.length || 0, [data])
  const activeWorkers = useMemo(
    () => company?.teamMembers?.filter((member: any) => member.status === 'ACTIVE').length || 0,
    [company]
  )

  async function submitCompanyAction() {
    if (!company || !companyActionModal || actionLoading) return

    const action = companyActionModal.action
    const needsReason = action === 'suspend' || action === 'reject'
    if (needsReason && actionReason.trim().length < 3) {
      toast.error('Enter a reason of at least 3 characters')
      return
    }

    setActionLoading(true)
    try {
      let response: Response
      if (action === 'suspend' || action === 'reactivate') {
        response = await fetch(`/api/admin/companies/${company.id}/${action}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: actionReason.trim() || 'Reactivated by admin',
          }),
        })
      } else {
        response = await fetch(`/api/admin/companies/${company.id}/verification`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: action === 'approve' ? 'APPROVE' : 'REJECT',
            reviewNote: actionReason.trim() || undefined,
          }),
        })
      }

      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Company action failed')

      toast.success(
        action === 'suspend'
          ? 'Company suspended'
          : action === 'reactivate'
            ? 'Company reactivated'
            : action === 'approve'
              ? 'Company verification approved'
              : 'Company verification rejected'
      )
      setCompanyActionModal(null)
      setActionReason('')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Company action failed')
    } finally {
      setActionLoading(false)
    }
  }


  if (loading) {
    return (
      <CrmState
        type="loading"
        title="Loading Company 360"
        description="Loading workforce, marketplace, finance, trust and audit context."
      />
    )
  }

  if (!data || !company) {
    return (
      <CrmState
        type="error"
        title="Company unavailable"
        description="The company is missing or outside your assigned market."
        action={
          <Link href="/admin/users/companies" className="text-sm font-semibold text-amber-700">
            Back to companies
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="p-5 md:p-6">
          <Link href="/admin/users/companies" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
            <FiArrowLeft size={15} /> Back to companies
          </Link>

          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-slate-950 text-amber-300 flex items-center justify-center text-xl font-semibold shrink-0">
                {(company.companyName?.[0] || 'C').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-950">{company.companyName}</h1>
                  <Badge value={company.verificationStatus} />
                  <Badge value={company.subscriptionStatus} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>{company.mxId || company.id}</span>
                  <span>{company.registrationNo || 'No registration number'}</span>
                  <span>{company.countryCode}</span>
                </div>
              </div>
            </div>

            <CrmButton variant="secondary" onClick={load}>
              <FiRefreshCw size={15} /> Refresh
            </CrmButton>
          </div>

          <div className="mt-6 grid grid-cols-2 xl:grid-cols-4 gap-3">
            <Summary icon={FiUsers} label="Active staff" value={String(activeWorkers)} />
            <Summary icon={FiBriefcase} label="Marketplace jobs" value={data.permissions.work ? String(jobCount) : 'Restricted'} />
            <Summary icon={FiCheckCircle} label="Completed projects" value={String(company.completedProjects || 0)} />
            <Summary icon={FiShield} label="Rating" value={String(company.rating || 0)} />
          </div>
        </div>

        <div className="border-t border-[var(--crm-border)] px-4 py-3">
          <CrmTabs
            items={visibleTabs.map(item => ({ id: item.key, label: item.label }))}
            active={tab}
            onChange={id => setTab(id as TabKey)}
          />
        </div>
      </section>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        <div className="space-y-5">
          {tab === 'overview' && <Overview data={data} />}
          {tab === 'workforce' && <Workforce data={data} />}
          {tab === 'jobs' && data.permissions.work && <Jobs data={data} />}
          {tab === 'finance' && data.permissions.finance && <Finance data={data} />}
          {tab === 'trust' && data.permissions.trust && <Trust data={data} />}
          {tab === 'audit' && data.permissions.audit && <Audit data={data} />}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-[92px]">
          <Card title="Company controls" subtitle="Permission-gated and audited">
            <div className="space-y-2">
              {data.permissions.actions.suspend && (
                company.verificationStatus === 'SUSPENDED'
                  ? <Action disabled={actionLoading} icon={FiUnlock} label="Reactivate company" onClick={() => { setActionReason(''); setCompanyActionModal({ action: 'reactivate' }) }} />
                  : <Action disabled={actionLoading} icon={FiUserX} label="Suspend company" tone="red" onClick={() => { setActionReason(''); setCompanyActionModal({ action: 'suspend' }) }} />
              )}
              {data.permissions.actions.verify && (
                <>
                  <Action disabled={actionLoading} icon={FiCheckCircle} label="Approve verification" onClick={() => { setActionReason(''); setCompanyActionModal({ action: 'approve' }) }} />
                  <Action disabled={actionLoading} icon={FiAlertTriangle} label="Reject verification" tone="amber" onClick={() => { setActionReason(''); setCompanyActionModal({ action: 'reject' }) }} />
                </>
              )}
            </div>
          </Card>

          <Card title="Owner account">
            <Link href={`/admin/users/${company.user.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{company.user.name}</div>
                <div className="text-xs text-slate-400 truncate">{company.user.mxId || company.user.email}</div>
              </div>
              <FiArrowUpRight size={14} className="text-slate-400" />
            </Link>
          </Card>

          <Card title="Operational state">
            <div className="space-y-3">
              <KV label="Verification" value={company.verificationStatus} />
              <KV label="Subscription" value={company.subscriptionStatus} />
              <KV label="Staff requirement" value={`${company.staffCount} / ${company.minStaffCount}`} />
              <KV label="Owner suspended" value={company.user.isSuspended ? 'Yes' : 'No'} />
            </div>
          </Card>
        </aside>
      </div>

      <CrmModal
        open={Boolean(companyActionModal)}
        onClose={() => {
          if (!actionLoading) setCompanyActionModal(null)
        }}
        title={
          companyActionModal?.action === 'suspend'
            ? 'Suspend company'
            : companyActionModal?.action === 'reactivate'
              ? 'Reactivate company'
              : companyActionModal?.action === 'approve'
                ? 'Approve company verification'
                : 'Reject company verification'
        }
        description={company.companyName}
        maxWidth="max-w-lg"
        footer={
          <>
            <CrmButton
              variant="secondary"
              onClick={() => setCompanyActionModal(null)}
              disabled={actionLoading}
            >
              Cancel
            </CrmButton>
            <CrmButton
              variant={
                companyActionModal?.action === 'suspend' ||
                companyActionModal?.action === 'reject'
                  ? 'danger'
                  : 'primary'
              }
              onClick={submitCompanyAction}
              disabled={actionLoading}
            >
              {actionLoading ? 'Working…' : 'Confirm action'}
            </CrmButton>
          </>
        }
      >
        <div className="space-y-4">
          {(companyActionModal?.action === 'suspend' ||
            companyActionModal?.action === 'reject') && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Reason
              </label>
              <textarea
                value={actionReason}
                onChange={event => setActionReason(event.target.value)}
                rows={4}
                maxLength={1000}
                className="w-full resize-none rounded-[11px] border border-[var(--crm-border)] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                placeholder="Explain why this company action is required…"
              />
            </div>
          )}

          <div className="rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-3 text-xs leading-5 text-slate-500">
            The server will re-check your live permission, market scope and the company&apos;s current lifecycle state before applying this action. The mutation is audited.
          </div>
        </div>
      </CrmModal>
    </div>
  )
}

function Overview({ data }: { data: Payload }) {
  const c = data.company
  return (
    <>
      <Card title="Company profile" subtitle="Legal, service and marketplace information">
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          <Field label="Company name" value={c.companyName} />
          <Field label="Registration number" value={c.registrationNo} />
          <Field label="Tax ID" value={c.taxId} />
          <Field label="Country" value={c.countryCode} />
          <Field label="Services" value={c.services} />
          <Field label="Service areas" value={c.serviceAreas} />
          <Field label="Commission" value={`${c.commissionRate || 10}%`} />
          <Field label="Verification" value={<Badge value={c.verificationStatus} />} />
          <Field label="Subscription" value={<Badge value={c.subscriptionStatus} />} />
        </div>
        {c.description && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <Field label="Description" value={c.description} />
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Owner" subtitle="Primary account controlling this company">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" value={c.user.name} />
            <Field label="MX ID" value={c.user.mxId} />
            <Field label="Email" value={c.user.email} />
            <Field label="Phone" value={c.user.phone} />
            <Field label="Identity" value={c.user.identityStatus} />
            <Field label="Member since" value={fmtDate(c.user.createdAt)} />
          </div>
        </Card>

        <Card title="Contracts" subtitle="Company contract workload">
          {c.contracts?.length ? (
            <div className="space-y-2">
              {c.contracts.slice(0, 8).map((contract: any) => (
                <div key={contract.id} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{contract.title}</div>
                    <div className="text-xs text-slate-400 mt-1">{contract.clientName} · {contract.progress}%</div>
                  </div>
                  <Badge value={contract.status} />
                </div>
              ))}
            </div>
          ) : <Empty icon={FiBriefcase} title="No contracts" text="No company contracts are recorded." />}
        </Card>
      </div>
    </>
  )
}

function Workforce({ data }: { data: Payload }) {
  const members = data.company.teamMembers || []
  return (
    <Card title="Company workforce" subtitle="Owners, managers, dispatchers, finance staff and workers">
      {members.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-slate-400 border-b border-slate-100">
                <th className="pb-3">Member</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Jobs</th>
                <th className="pb-3">Rating</th>
                <th className="pb-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member: any) => (
                <tr key={member.id}>
                  <td className="py-3">
                    {member.user?.id ? (
                      <Link href={`/admin/users/${member.user.id}`} className="font-medium text-slate-800 hover:text-amber-700">{member.name}</Link>
                    ) : <span className="font-medium text-slate-800">{member.name}</span>}
                    <div className="text-xs text-slate-400 mt-1">{member.user?.mxId || member.user?.email || 'Invite/member record'}</div>
                  </td>
                  <td className="py-3 text-slate-600">{member.role.replaceAll('_', ' ')}</td>
                  <td className="py-3"><Badge value={member.status} /></td>
                  <td className="py-3 text-slate-600">{member.completedJobs}</td>
                  <td className="py-3 text-slate-600">{member.rating}</td>
                  <td className="py-3 text-xs text-slate-400">{fmtDate(member.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty icon={FiUsers} title="No team members" text="The company has no workforce members recorded." />}
    </Card>
  )
}

function Jobs({ data }: { data: Payload }) {
  const quoteByJob = new Map(data.quotes.map(quote => [quote.jobId, quote]))
  return (
    <>
      <Card title="Marketplace jobs" subtitle="Jobs reached by company quote or formal workforce assignment">
        {data.jobs.length ? (
          <div className="space-y-2">
            {data.jobs.map(job => {
              const quote = quoteByJob.get(job.id)
              const assignment = data.assignments.find(item => item.jobId === job.id)
              return (
                <Link key={job.id} href={`/admin/jobs/${job.id}`} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-4 hover:bg-slate-50">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{job.title}</div>
                    <div className="text-xs text-slate-400 mt-1">{fmtDate(job.createdAt)} · {job.countryCode}</div>
                  </div>
                  <div className="text-right">
                    <Badge value={job.status} />
                    <div className="text-[11px] text-slate-400 mt-1">{quote ? `Quote: ${quote.status}` : assignment ? `Assignment: ${assignment.status}` : 'Linked'}</div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : <Empty icon={FiTool} title="No marketplace jobs" text="No jobs are linked to this company." />}
      </Card>

      <Card title="Workforce assignments" subtitle="Jobs dispatched to company workers">
        {data.assignments.length ? (
          <div className="space-y-2">
            {data.assignments.map(assignment => (
              <Link key={assignment.id} href={`/admin/jobs/${assignment.jobId}`} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-4 hover:bg-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-800">{assignment.job?.title || 'Job assignment'}</div>
                  <div className="text-xs text-slate-400 mt-1">Worker: {assignment.worker?.name || 'Unknown'} · {fmtDate(assignment.assignedAt)}</div>
                </div>
                <Badge value={assignment.status} />
              </Link>
            ))}
          </div>
        ) : <Empty icon={FiUsers} title="No workforce assignments" text="No jobs have been dispatched to workers." />}
      </Card>
    </>
  )
}

function Finance({ data }: { data: Payload }) {
  const f = data.finance
  const currencyTotals = new Map<string, { escrow: number; commission: number }>()

  for (const escrow of f.escrows) {
    const currency = escrow.currency || 'LKR'
    const current = currencyTotals.get(currency) || { escrow: 0, commission: 0 }
    current.escrow += Number(escrow.totalAmount || 0)
    currencyTotals.set(currency, current)
  }

  for (const settlement of f.settlements) {
    if (settlement.status !== 'PENDING') continue
    const currency = settlement.currency || 'LKR'
    const current = currencyTotals.get(currency) || { escrow: 0, commission: 0 }
    current.commission += Number(settlement.commissionAmount || 0)
    currencyTotals.set(currency, current)
  }

  const financeRows = [...currencyTotals.entries()].sort(([a], [b]) => a.localeCompare(b))

  return (
    <>
      <div className="space-y-3">
        {financeRows.map(([currency, totals]) => (
          <div key={currency} className="grid md:grid-cols-2 gap-4">
            <Metric label={`Escrow linked · ${currency}`} value={fmtMoneyMinor(totals.escrow, currency)} />
            <Metric label={`Pending commission · ${currency}`} value={fmtMoneyMinor(totals.commission, currency)} />
          </div>
        ))}
        <div className="grid md:grid-cols-1 gap-4">
          <Metric label="Provider wallet" value={f.wallet ? fmtMoneyMajor(f.wallet.availableBalance, f.wallet.currency) : '—'} />
        </div>
      </div>

      <Card title="Commission settlements" subtitle="Per-job MaintainEX commission records">
        {f.settlements.length ? (
          <div className="space-y-2">
            {f.settlements.map(item => (
              <Link key={item.id} href={`/admin/jobs/${item.jobId}`} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-4 hover:bg-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-800">Job {item.jobId}</div>
                  <div className="text-xs text-slate-400 mt-1">{item.commissionRate}% · {fmtDate(item.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">{fmtMoneyMinor(item.commissionAmount, item.currency)}</div>
                  <div className="mt-1"><Badge value={item.status} /></div>
                </div>
              </Link>
            ))}
          </div>
        ) : <Empty icon={FiDollarSign} title="No commission records" text="No commission settlements are linked to this company." />}
      </Card>

      <Card title="Payouts" subtitle="Owner-account payout history">
        {f.payouts.length ? (
          <div className="space-y-2">
            {f.payouts.map(item => (
              <div key={item.id} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-800">{item.description || item.source}</div>
                  <div className="text-xs text-slate-400 mt-1">{fmtDate(item.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">{fmtMoneyMinor(item.amount, item.currency)}</div>
                  <div className="mt-1"><Badge value={item.status} /></div>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty icon={FiCreditCard} title="No payouts" text="No payouts are recorded for the company owner account." />}
      </Card>
    </>
  )
}

function Trust({ data }: { data: Payload }) {
  return (
    <>
      <Card title="Company documents" subtitle="Private provider verification documents">
        {data.documents.length ? (
          <div className="grid md:grid-cols-2 gap-3">
            {data.documents.map(doc => (
              <div key={doc.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{doc.documentType}</div>
                    <div className="text-xs text-slate-400 mt-1">{doc.fileName}</div>
                  </div>
                  <Badge value={doc.verificationStatus} />
                </div>
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                  View protected document <FiArrowUpRight size={12} />
                </a>
              </div>
            ))}
          </div>
        ) : <Empty icon={FiFileText} title="No company documents" text="No provider documents are attached to this company." />}
      </Card>

      <Card title="Owner identity" subtitle="KYC documents on the company owner account">
        {data.ownerIdentityDocs.length ? (
          <div className="grid md:grid-cols-2 gap-3">
            {data.ownerIdentityDocs.map(doc => (
              <div key={doc.id} className="rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{doc.docType} · {doc.side}</div>
                  <div className="text-xs text-slate-400 mt-1">{fmtDate(doc.createdAt)}</div>
                </div>
                <Badge value={doc.status} />
              </div>
            ))}
          </div>
        ) : <Empty icon={FiShield} title="No owner KYC" text="No owner identity documents are recorded." />}
      </Card>

      <Card title="Marketplace risk events" subtitle="Risk events attached to company-linked jobs">
        {data.trust.riskEvents.length ? (
          <div className="space-y-2">
            {data.trust.riskEvents.map(event => (
              <Link key={event.id} href={event.jobId ? `/admin/jobs/${event.jobId}` : '#'} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-4 hover:bg-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-800">{event.eventType.replaceAll('_', ' ')}</div>
                  <div className="text-xs text-slate-400 mt-1">{fmtDate(event.createdAt)}</div>
                </div>
                <Badge value={event.severity} />
              </Link>
            ))}
          </div>
        ) : <Empty icon={FiShield} title="No risk events" text="No marketplace risk events are linked to this company’s jobs." />}
      </Card>
    </>
  )
}

function Audit({ data }: { data: Payload }) {
  const rows = [
    ...data.audit.company.map(row => ({ id: `company-${row.id}`, action: row.action, description: row.description, actor: row.actorRole, createdAt: row.createdAt })),
    ...data.audit.admin.map(row => ({ id: `admin-${row.id}`, action: row.action, description: row.targetLabel || row.targetTable, actor: row.adminEmail, createdAt: row.createdAt })),
    ...data.audit.activity.map(row => ({ id: `activity-${row.id}`, action: row.action, description: row.description, actor: row.adminEmail, createdAt: row.createdAt })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <Card title="Company audit history" subtitle="Company-domain, admin and CRM activity">
      {rows.length ? (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.id} className="rounded-xl border border-slate-200 p-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-800">{String(row.action).replaceAll('_', ' ')}</div>
                <div className="text-sm text-slate-500 mt-1">{row.description || 'Recorded company action'}</div>
                <div className="text-xs text-slate-400 mt-1">{row.actor || 'System'}</div>
              </div>
              <div className="text-xs text-slate-400 whitespace-nowrap">{fmtDate(row.createdAt)}</div>
            </div>
          ))}
        </div>
      ) : <Empty icon={FiActivity} title="No audit history" text="No company audit entries are available." />}
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-400">{label}</span><span className="font-semibold text-slate-700 text-right">{String(value).replaceAll('_', ' ')}</span></div>
}

function Action({ icon: Icon, label, onClick, tone = 'default', disabled }: { icon: any; label: string; onClick: () => void; tone?: 'default' | 'amber' | 'red'; disabled?: boolean }) {
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

function Empty({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="py-8 text-center">
      <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400"><Icon size={19} /></div>
      <div className="mt-3 text-sm font-semibold text-slate-800">{title}</div>
      <div className="mt-1 text-xs text-slate-400 max-w-md mx-auto">{text}</div>
    </div>
  )
}
