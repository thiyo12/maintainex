'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowLeft,
  FiBriefcase,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiCopy,
  FiCreditCard,
  FiDollarSign,
  FiExternalLink,
  FiFileText,
  FiFlag,
  FiMapPin,
  FiMessageSquare,
  FiRefreshCw,
  FiShield,
  FiTool,
  FiUser,
  FiUsers,
  FiXCircle,
} from 'react-icons/fi'

type TabKey = 'overview' | 'lifecycle' | 'quotes' | 'workspace' | 'finance' | 'dispute' | 'audit'

interface Job360Payload {
  source: 'V1' | 'V2'
  job: any
  quotes?: any[]
  workspace?: any
  lifecycle?: any[]
  finance?: {
    escrow?: any
    paymentIntents?: any[]
    settlements?: any[]
    payouts?: any[]
    ledger?: any[]
  }
  operations?: {
    inspections?: any[]
    changeOrders?: any[]
    evidence?: any[]
    assignments?: any[]
    verificationPin?: any
    conversation?: any
  }
  trust?: {
    riskEvents?: any[]
  }
  reviews?: {
    customer?: any[]
    provider?: any[]
  }
  audit?: {
    canonical?: any[]
    activity?: any[]
  }
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'lifecycle', label: 'Lifecycle' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'finance', label: 'Finance' },
  { key: 'dispute', label: 'Dispute / Risk' },
  { key: 'audit', label: 'Audit' },
]

function label(value: unknown) {
  return String(value || '—').replaceAll('_', ' ')
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatMoney(value: unknown, currency = 'LKR') {
  const amount = typeof value === 'number' ? value : Number(value || 0)
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function statusClasses(status?: string) {
  const normalized = String(status || '').toUpperCase()
  if (['COMPLETED', 'CLEARED', 'SETTLED', 'SUCCESS', 'VERIFIED', 'RELEASED', 'APPROVED'].includes(normalized)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
  if (['DISPUTED', 'FAILED', 'REJECTED', 'CANCELLED', 'CHARGEDBACK', 'CRITICAL'].includes(normalized)) {
    return 'bg-red-50 text-red-700 border-red-200'
  }
  if (['IN_PROGRESS', 'PROCESSING', 'PROTECTED', 'ON_HOLD', 'UNDER_REVIEW', 'HIGH'].includes(normalized)) {
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }
  if (['OPEN', 'PENDING', 'CREATED', 'QUOTE_ACCEPTED', 'MEDIUM'].includes(normalized)) {
    return 'bg-blue-50 text-blue-700 border-blue-200'
  }
  return 'bg-slate-50 text-slate-600 border-slate-200'
}

function StatusBadge({ value }: { value?: string | null }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusClasses(value || '')}`}>
      {label(value)}
    </span>
  )
}

function Card({
  title,
  subtitle,
  children,
  action,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Field({ label: fieldLabel, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{fieldLabel}</div>
      <div className={`mt-1 text-sm text-slate-800 break-words ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
    </div>
  )
}

export default function Job360Page() {
  const params = useParams<{ id: string }>()
  const jobId = params?.id
  const { user: admin } = useAdminSession()
  const adminRole = (admin?.role || 'SUPPORT') as AdminRole
  const canManageJob = (ROLE_PERMISSIONS[adminRole] || []).includes('jobs:manage')
  const [payload, setPayload] = useState<Job360Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    if (!jobId) return
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/jobs/${encodeURIComponent(jobId)}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error || 'Unable to load job')
      }
      setPayload(await response.json())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load Job 360')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    load()
  }, [load])

  const job = payload?.job
  const isV2 = payload?.source === 'V2'
  const currency = job?.currency || 'LKR'

  const customer = isV2 ? job?.customer : job?.customer
  const provider = isV2 ? job?.acceptedProvider : payload?.job?.assignments?.[0]?.tasker?.user
  const acceptedQuote = payload?.quotes?.find(quote => quote.status === 'ACCEPTED')
  const providerLink = useMemo(() => {
    if (!provider) return null
    if (acceptedQuote?.providerType === 'COMPANY' && provider.id) return `/admin/companies/${provider.id}`
    const id = provider.userId || provider.id
    return id ? `/admin/users/${id}` : null
  }, [provider, acceptedQuote])

  const amount = isV2
    ? acceptedQuote?.total ?? acceptedQuote?.price ?? job?.finalAuthorizedAmount ?? job?.budgetAmount
    : job?.budget

  const location = isV2
    ? [job?.area?.name, job?.area?.city?.name, job?.area?.city?.state?.name].filter(Boolean).join(', ') || 'Not specified'
    : job?.location

  const riskEvents = payload?.trust?.riskEvents || []
  const finance = payload?.finance || {}
  const operations = payload?.operations || {}
  const lifecycle = payload?.lifecycle || []
  const auditRows = [
    ...(payload?.audit?.canonical || []).map(row => ({
      id: `audit-${row.id}`,
      action: row.action,
      description: row.targetLabel || row.targetTable || 'Administrative action',
      actor: row.adminEmail,
      createdAt: row.createdAt,
    })),
    ...(payload?.audit?.activity || []).map(row => ({
      id: `activity-${row.id}`,
      action: row.action,
      description: row.description,
      actor: row.adminEmail,
      createdAt: row.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  async function cancelJob() {
    if (!job || ['COMPLETED', 'CANCELLED'].includes(job.status)) return
    if (!window.confirm('Cancel this job? This action will be audited.')) return

    setActionLoading(true)
    try {
      const response = await fetch('/api/admin/jobs', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          source: payload?.source,
          status: 'CANCELLED',
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body?.error?.message || body?.error || 'Unable to cancel job')
      }
      toast.success('Job cancelled')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Cancel failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-32 rounded-2xl bg-white border border-slate-200" />
        <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-5">
          <div className="h-[620px] rounded-2xl bg-white border border-slate-200" />
          <div className="h-[520px] rounded-2xl bg-white border border-slate-200" />
        </div>
      </div>
    )
  }

  if (!payload || !job) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <FiAlertTriangle className="mx-auto text-amber-500" size={34} />
        <h1 className="mt-3 text-xl font-semibold text-slate-900">Job unavailable</h1>
        <p className="mt-1 text-sm text-slate-500">The record could not be loaded or is outside your assigned market.</p>
        <Link href="/admin/jobs" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-700">
          <FiArrowLeft /> Back to jobs
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="p-5 md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <Link href="/admin/jobs" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
                <FiArrowLeft size={15} />
                Back to jobs
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-950">{job.title}</h1>
                <StatusBadge value={job.status} />
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                  {payload.source === 'V2' ? 'Marketplace' : 'Classic'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(job.id)
                    toast.success('Job ID copied')
                  }}
                  className="inline-flex items-center gap-1.5 font-mono hover:text-slate-700"
                >
                  {job.id}
                  <FiCopy size={12} />
                </button>
                <span>Created {formatDate(job.createdAt)}</span>
                {job.urgency && <span>Urgency: {label(job.urgency)}</span>}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <FiRefreshCw size={15} />
                Refresh
              </button>
              {canManageJob && !['COMPLETED', 'CANCELLED'].includes(job.status) && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={cancelJob}
                  className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border border-red-200 bg-red-50 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  <FiXCircle size={15} />
                  {actionLoading ? 'Cancelling…' : 'Cancel job'}
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryTile icon={FiUser} label="Customer" value={customer?.name || 'Unknown'} meta={customer?.mxId || customer?.email} href={customer?.id ? `/admin/users/${customer.id}` : undefined} />
            <SummaryTile icon={FiTool} label="Provider" value={provider?.companyName || provider?.name || 'Not assigned'} meta={acceptedQuote ? `${label(acceptedQuote.providerType)} provider` : 'Awaiting accepted quote'} href={providerLink || undefined} />
            <SummaryTile icon={FiMapPin} label="Location" value={location || 'Not specified'} meta={job.countryCode || customer?.countryCode || '—'} />
            <SummaryTile icon={FiDollarSign} label="Amount" value={formatMoney(amount, currency)} meta={acceptedQuote ? 'Accepted / authorized value' : 'Budget value'} />
          </div>
        </div>

        <div className="border-t border-slate-100 px-3 md:px-5 overflow-x-auto">
          <div className="flex min-w-max">
            {TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3.5 py-3.5 text-sm font-medium border-b-2 transition ${
                  activeTab === tab.key
                    ? 'border-amber-400 text-slate-950'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
                {tab.key === 'dispute' && riskEvents.length > 0 && (
                  <span className="ml-2 rounded-full bg-red-50 text-red-700 px-1.5 py-0.5 text-[10px]">{riskEvents.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        <div className="space-y-5">
          {activeTab === 'overview' && <OverviewTab payload={payload} location={location} />}
          {activeTab === 'lifecycle' && <LifecycleTab payload={payload} />}
          {activeTab === 'quotes' && <QuotesTab payload={payload} currency={currency} />}
          {activeTab === 'workspace' && <WorkspaceTab payload={payload} />}
          {activeTab === 'finance' && <FinanceTab payload={payload} currency={currency} />}
          {activeTab === 'dispute' && <RiskTab payload={payload} />}
          {activeTab === 'audit' && <AuditTab rows={auditRows} />}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-[92px]">
          <Card title="Operations rail" subtitle="Current job controls">
            <div className="space-y-2">
              {customer?.id && (
                <RailLink href={`/admin/users/${customer.id}`} icon={FiUser} label="Open customer 360" />
              )}
              {providerLink && <RailLink href={providerLink} icon={FiTool} label="Open provider 360" />}
              <RailLink href="/admin/financial/wallets" icon={FiCreditCard} label="Finance operations" />
              <RailLink href="/admin/jobs/disputes" icon={FiFlag} label="Dispute queue" />
              <RailLink href="/admin/trust-safety/risk-events" icon={FiShield} label="Trust & safety" />
            </div>
          </Card>

          <Card title="Payment / escrow" subtitle="Canonical financial state">
            <div className="space-y-3">
              <KeyValue label="Escrow" value={finance.escrow?.status || 'Not funded'} />
              <KeyValue label="Payment" value={finance.paymentIntents?.[0]?.status || 'No payment intent'} />
              <KeyValue label="Commission" value={finance.settlements?.[0]?.status || 'Not created'} />
              <KeyValue label="Payout" value={finance.payouts?.[0]?.status || 'Not created'} />
            </div>
          </Card>

          <Card title="Risk & verification" subtitle="Operator safety signals">
            <div className="space-y-3">
              <KeyValue label="Risk events" value={String(riskEvents.length)} />
              <KeyValue label="PIN status" value={operations.verificationPin?.status || 'Not generated'} />
              <KeyValue label="Arrival verified" value={operations.verificationPin?.arrivalVerifiedAt ? 'Yes' : 'No'} />
              <KeyValue label="Work start verified" value={operations.verificationPin?.workStartVerifiedAt ? 'Yes' : 'No'} />
              <KeyValue label="Completion verified" value={operations.verificationPin?.completionVerifiedAt ? 'Yes' : 'No'} />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function SummaryTile({ icon: Icon, label: tileLabel, value, meta, href }: { icon: any; label: string; value: string; meta?: string; href?: string }) {
  const body = (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 h-full">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
        <Icon size={14} />
        {tileLabel}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-900 line-clamp-2">{value}</div>
      {meta && <div className="mt-1 text-xs text-slate-400 truncate">{meta}</div>}
    </div>
  )
  return href ? <Link href={href} className="hover:opacity-80 transition">{body}</Link> : body
}

function RailLink({ href, icon: Icon, label: linkLabel }: { href: string; icon: any; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
      <span className="flex items-center gap-2.5">
        <Icon size={15} className="text-slate-400" />
        {linkLabel}
      </span>
      <FiExternalLink size={13} className="text-slate-300" />
    </Link>
  )
}

function KeyValue({ label: keyLabel, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-400">{keyLabel}</span>
      <span className="text-xs font-semibold text-slate-700 text-right">{label(value)}</span>
    </div>
  )
}

function OverviewTab({ payload, location }: { payload: Job360Payload; location: string }) {
  const job = payload.job
  const customer = job.customer
  const isV2 = payload.source === 'V2'
  const operations = payload.operations

  return (
    <>
      <Card title="Job overview" subtitle="Core request, customer and scheduling information">
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          <Field label="Service / category" value={isV2 ? job.category?.name || job.categoryId : job.category} />
          <Field label="Location" value={location} />
          <Field label="Country" value={job.countryCode || customer?.countryCode} />
          <Field label="Preferred date" value={formatDate(job.preferredDate || job.scheduledDate)} />
          <Field label="Time slot" value={label(job.preferredTimeSlot)} />
          <Field label="Urgency" value={label(job.urgency)} />
        </div>
        <div className="mt-5 pt-5 border-t border-slate-100">
          <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Description</div>
          <p className="mt-2 text-sm leading-6 text-slate-700 whitespace-pre-wrap">{job.description || 'No description provided.'}</p>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Customer" subtitle="Customer attached to this job">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" value={customer?.name} />
            <Field label="MX ID" value={customer?.mxId} mono />
            <Field label="Email" value={customer?.email} />
            <Field label="Phone" value={customer?.phone} />
            <Field label="Account state" value={customer?.isBanned ? 'Banned' : customer?.isSuspended ? 'Suspended' : 'Active'} />
            <Field label="Customer type" value={customer?.customerProfile?.customerType || '—'} />
          </div>
        </Card>

        <Card title="Work assignment" subtitle="Provider, company and worker state">
          {payload.source === 'V2' ? (
            operations?.assignments?.length ? (
              <div className="space-y-3">
                {operations.assignments.map((assignment: any) => (
                  <div key={assignment.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{assignment.company?.companyName || assignment.worker?.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{assignment.worker?.name ? `Worker: ${assignment.worker.name}` : assignment.company?.mxId}</div>
                      </div>
                      <StatusBadge value={assignment.status} />
                    </div>
                    <div className="mt-3 text-xs text-slate-400">Assigned {formatDate(assignment.assignedAt)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={FiUsers} title="No workforce assignment" text="The accepted provider has not assigned a company worker." />
            )
          ) : payload.job.assignments?.length ? (
            <div className="space-y-3">
              {payload.job.assignments.map((assignment: any) => (
                <div key={assignment.id} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{assignment.tasker?.user?.name || 'Tasker'}</div>
                    <div className="text-xs text-slate-400">{formatDate(assignment.createdAt)}</div>
                  </div>
                  <StatusBadge value={assignment.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={FiUsers} title="No assignment" text="No provider has been assigned to this classic job." />
          )}
        </Card>
      </div>
    </>
  )
}

function LifecycleTab({ payload }: { payload: Job360Payload }) {
  const events = payload.source === 'V2'
    ? payload.lifecycle || []
    : [
        { id: 'created', action: 'JOB_CREATED', toState: 'OPEN', createdAt: payload.job.createdAt, actorType: 'CUSTOMER' },
        ...(payload.job.assignments || []).map((item: any) => ({
          id: `assignment-${item.id}`,
          action: 'TASKER_ASSIGNMENT',
          toState: item.status,
          createdAt: item.createdAt,
          actorType: 'SYSTEM',
        })),
      ]

  return (
    <Card title="Lifecycle timeline" subtitle="Canonical state transitions in chronological order">
      {events.length === 0 ? (
        <EmptyState icon={FiClock} title="No lifecycle events" text="No lifecycle events have been recorded yet." />
      ) : (
        <div className="relative">
          <div className="absolute left-[17px] top-4 bottom-4 w-px bg-slate-200" />
          <div className="space-y-5">
            {events.map((event: any, index: number) => (
              <div key={event.id || index} className="relative flex gap-4">
                <div className="relative z-10 w-9 h-9 shrink-0 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                  <FiCheck size={14} className="text-emerald-600" />
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">{label(event.action)}</div>
                    {event.toState && <StatusBadge value={event.toState} />}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {formatDate(event.createdAt)} · {label(event.actorType)}
                  </div>
                  {event.fromState && (
                    <div className="mt-2 text-xs text-slate-500">{label(event.fromState)} → {label(event.toState)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function QuotesTab({ payload, currency }: { payload: Job360Payload; currency: string }) {
  if (payload.source === 'V1') {
    const bids = payload.job.bids || []
    return (
      <Card title="Classic job bids" subtitle="Provider bids recorded against the legacy job">
        {bids.length === 0 ? (
          <EmptyState icon={FiFileText} title="No bids" text="No provider bids have been submitted." />
        ) : (
          <div className="space-y-3">
            {bids.map((bid: any) => (
              <div key={bid.id} className="rounded-xl border border-slate-200 p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900">{bid.tasker?.user?.name || 'Tasker'}</div>
                  <div className="text-sm text-slate-500 mt-1">{bid.message || 'No bid message.'}</div>
                  <div className="text-xs text-slate-400 mt-2">{formatDate(bid.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900">{formatMoney(bid.amount, currency)}</div>
                  <div className="mt-1"><StatusBadge value={bid.status} /></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    )
  }

  const quotes = payload.quotes || []
  return (
    <Card title="Quote history" subtitle="All quote revisions, provider identities and line items">
      {quotes.length === 0 ? (
        <EmptyState icon={FiFileText} title="No quotes received" text="Providers have not submitted a quote yet." />
      ) : (
        <div className="space-y-4">
          {quotes.map((quote: any) => (
            <div key={quote.id} className={`rounded-2xl border p-4 ${quote.status === 'ACCEPTED' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold text-slate-900">{quote.provider?.companyName || quote.provider?.name || quote.providerId}</div>
                    <StatusBadge value={quote.status} />
                    <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-600">Revision {quote.revisionNumber || 1}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{label(quote.providerType)} · {formatDate(quote.createdAt)}</div>
                </div>
                <div className="text-xl font-semibold text-slate-950">{formatMoney(quote.total ?? quote.price, quote.currency || currency)}</div>
              </div>

              {quote.message && <p className="mt-4 text-sm text-slate-600">{quote.message}</p>}

              {quote.lineItems?.length > 0 && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="divide-y divide-slate-100">
                    {quote.lineItems.map((line: any) => (
                      <div key={line.id} className="px-3 py-2.5 flex items-center justify-between gap-3 text-sm">
                        <div>
                          <span className="font-medium text-slate-700">{line.description}</span>
                          <span className="ml-2 text-xs text-slate-400">{label(line.type)} · {line.quantity} {line.unit || ''}</span>
                        </div>
                        <span className="font-medium text-slate-800">{formatMoney(line.totalAmount, line.currency || currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function WorkspaceTab({ payload }: { payload: Job360Payload }) {
  if (payload.source === 'V1') {
    return (
      <Card title="Classic workspace" subtitle="Assignment and dispute context for this legacy job">
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Assignments</h3>
            <div className="mt-3 space-y-2">
              {(payload.job.assignments || []).map((assignment: any) => (
                <div key={assignment.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="text-sm font-medium text-slate-800">{assignment.tasker?.user?.name}</div>
                  <div className="mt-1"><StatusBadge value={assignment.status} /></div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Disputes</h3>
            <div className="mt-3 space-y-2">
              {(payload.job.disputes || []).map((dispute: any) => (
                <div key={dispute.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="text-sm font-medium text-slate-800">{dispute.reason}</div>
                  <div className="mt-1"><StatusBadge value={dispute.status} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    )
  }

  const operations = payload.operations || {}
  const messages = operations.conversation?.messages || []

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Workspace state" subtitle="Progress and verification controls">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Progress" value={label(payload.workspace?.progressStatus)} />
            <Field label="Completion requested" value={formatDate(payload.workspace?.completionRequestedAt)} />
            <Field label="PIN state" value={label(operations.verificationPin?.status)} />
            <Field label="Failed PIN attempts" value={String(operations.verificationPin?.failedAttempts || 0)} />
          </div>
        </Card>

        <Card title="Inspections & change orders" subtitle="Scope changes and field evidence">
          <div className="grid grid-cols-3 gap-3">
            <Metric value={operations.inspections?.length || 0} label="Inspections" />
            <Metric value={operations.changeOrders?.length || 0} label="Change orders" />
            <Metric value={operations.evidence?.length || 0} label="Evidence" />
          </div>
        </Card>
      </div>

      <Card title="Inspection history" subtitle="On-site diagnosis and scope">
        {operations.inspections?.length ? (
          <div className="space-y-3">
            {operations.inspections.map((inspection: any) => (
              <div key={inspection.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{label(inspection.providerType)} inspection</div>
                    <div className="text-xs text-slate-400 mt-1">{formatDate(inspection.createdAt)}</div>
                  </div>
                  <StatusBadge value={inspection.status} />
                </div>
                {(inspection.diagnosisSummary || inspection.scopeSummary) && (
                  <div className="mt-4 grid md:grid-cols-2 gap-4">
                    <Field label="Diagnosis" value={inspection.diagnosisSummary} />
                    <Field label="Recommended scope" value={inspection.scopeSummary} />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={FiTool} title="No inspections" text="No inspection record is attached to this job." />
        )}
      </Card>

      <Card title="Change orders" subtitle="Customer-authorized scope or price changes">
        {operations.changeOrders?.length ? (
          <div className="space-y-3">
            {operations.changeOrders.map((order: any) => (
              <div key={order.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{order.reason}</div>
                    <div className="text-xs text-slate-400 mt-1">{formatDate(order.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">{formatMoney(order.amountDelta, order.currency)}</div>
                    <div className="mt-1"><StatusBadge value={order.status} /></div>
                  </div>
                </div>
                {order.scopeDelta && <p className="mt-3 text-sm text-slate-600">{order.scopeDelta}</p>}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={FiFileText} title="No change orders" text="The accepted scope has not been amended." />
        )}
      </Card>

      <Card title="Conversation" subtitle="Latest customer/provider job conversation">
        {messages.length ? (
          <div className="space-y-3 max-h-[520px] overflow-y-auto">
            {messages.map((message: any) => (
              <div key={message.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-800">{message.sender?.name || 'User'}</div>
                  <div className="text-xs text-slate-400">{formatDate(message.createdAt)}</div>
                </div>
                <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{message.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={FiMessageSquare} title="No messages" text="No conversation messages were found for this job." />
        )}
      </Card>
    </>
  )
}

function FinanceTab({ payload, currency }: { payload: Job360Payload; currency: string }) {
  const finance = payload.finance || {}
  if (payload.source === 'V1' && !(finance.ledger || []).length) {
    return <Card title="Finance" subtitle="Classic job financial context"><EmptyState icon={FiCreditCard} title="No ledger records" text="No canonical financial ledger entries are linked to this classic job." /></Card>
  }

  return (
    <>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <FinanceMetric label="Escrow" value={finance.escrow?.status || 'None'} amount={finance.escrow ? formatMoney(finance.escrow.totalAmount, finance.escrow.currency || currency) : '—'} />
        <FinanceMetric label="Payment" value={finance.paymentIntents?.[0]?.status || 'None'} amount={finance.paymentIntents?.[0] ? formatMoney(finance.paymentIntents[0].amount, finance.paymentIntents[0].currency || currency) : '—'} />
        <FinanceMetric label="Commission" value={finance.settlements?.[0]?.status || 'None'} amount={finance.settlements?.[0] ? formatMoney(finance.settlements[0].commissionAmount, finance.settlements[0].currency || currency) : '—'} />
        <FinanceMetric label="Payout" value={finance.payouts?.[0]?.status || 'None'} amount={finance.payouts?.[0] ? formatMoney(finance.payouts[0].amount, finance.payouts[0].currency || currency) : '—'} />
      </div>

      <Card title="Payment intents" subtitle="Gateway request state without raw gateway secrets">
        {finance.paymentIntents?.length ? (
          <div className="space-y-2">
            {finance.paymentIntents.map((intent: any) => (
              <div key={intent.id} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-800">{intent.merchantOrderId}</div>
                  <div className="text-xs text-slate-400 mt-1">{formatDate(intent.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">{formatMoney(intent.amount, intent.currency)}</div>
                  <div className="mt-1"><StatusBadge value={intent.status} /></div>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={FiCreditCard} title="No payment intents" text="A gateway payment has not been created for this job." />}
      </Card>

      <Card title="Financial ledger" subtitle="Immutable accounting entries related to this job">
        {finance.ledger?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-slate-400">
                  <th className="pb-3">Time</th>
                  <th className="pb-3">Account</th>
                  <th className="pb-3">Entry</th>
                  <th className="pb-3">Reference</th>
                  <th className="pb-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {finance.ledger.map((entry: any) => (
                  <tr key={entry.id}>
                    <td className="py-3 text-xs text-slate-400 whitespace-nowrap">{formatDate(entry.createdAt)}</td>
                    <td className="py-3 text-slate-700">{label(entry.accountType)}</td>
                    <td className="py-3"><StatusBadge value={entry.entryType} /></td>
                    <td className="py-3 text-xs text-slate-500">{label(entry.referenceType)}</td>
                    <td className="py-3 text-right font-semibold text-slate-900">{formatMoney(entry.amount, entry.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={FiDollarSign} title="No ledger entries" text="No immutable ledger postings are linked to this job." />}
      </Card>
    </>
  )
}

function RiskTab({ payload }: { payload: Job360Payload }) {
  const risks = payload.trust?.riskEvents || []
  const classicDisputes = payload.source === 'V1' ? payload.job.disputes || [] : []

  return (
    <>
      <Card title="Risk events" subtitle="Anti-bypass and marketplace safety signals">
        {risks.length ? (
          <div className="space-y-3">
            {risks.map((risk: any) => (
              <div key={risk.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{label(risk.eventType)}</div>
                    <div className="text-xs text-slate-400 mt-1">{formatDate(risk.createdAt)}</div>
                  </div>
                  <StatusBadge value={risk.severity} />
                </div>
                <div className="mt-3 text-sm text-slate-500">
                  {risk.reviewedAt ? `Reviewed: ${label(risk.resolution)}` : 'Awaiting trust & safety review'}
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={FiShield} title="No risk events" text="No job-linked risk events have been detected." />}
      </Card>

      <Card title="Dispute state" subtitle="Formal dispute or workspace hold status">
        {payload.source === 'V1' ? (
          classicDisputes.length ? (
            <div className="space-y-3">
              {classicDisputes.map((dispute: any) => (
                <div key={dispute.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{dispute.reason}</div>
                      <div className="text-xs text-slate-400 mt-1">Raised by {dispute.raisedBy?.name || 'User'} · {formatDate(dispute.createdAt)}</div>
                    </div>
                    <StatusBadge value={dispute.status} />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{dispute.description}</p>
                  {dispute.resolution && <p className="mt-3 text-sm text-emerald-700">Resolution: {dispute.resolution}</p>}
                </div>
              ))}
            </div>
          ) : <EmptyState icon={FiFlag} title="No dispute" text="No formal dispute exists for this classic job." />
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Workspace" value={label(payload.workspace?.progressStatus)} />
            <Field label="Escrow" value={label(payload.finance?.escrow?.status)} />
            <Field label="Risk events" value={String(risks.length)} />
          </div>
        )}
      </Card>
    </>
  )
}

function AuditTab({ rows }: { rows: any[] }) {
  return (
    <Card title="Audit history" subtitle="Administrative and operational changes connected to this job">
      {rows.length ? (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.id} className="rounded-xl border border-slate-200 p-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-800">{label(row.action)}</div>
                <div className="text-sm text-slate-500 mt-1">{row.description || 'Recorded administrative action'}</div>
                <div className="text-xs text-slate-400 mt-1">{row.actor || 'System'}</div>
              </div>
              <div className="text-xs text-slate-400 whitespace-nowrap">{formatDate(row.createdAt)}</div>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={FiActivity} title="No admin audit entries" text="No staff action has been recorded against this job yet." />}
    </Card>
  )
}

function FinanceMetric({ label: metricLabel, value, amount }: { label: string; value: string; amount: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-400">{metricLabel}</div>
      <div className="mt-2"><StatusBadge value={value} /></div>
      <div className="mt-3 text-sm font-semibold text-slate-900">{amount}</div>
    </div>
  )
}

function Metric({ value, label: metricLabel }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
      <div className="text-xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{metricLabel}</div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="py-8 text-center">
      <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
        <Icon size={19} />
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-800">{title}</div>
      <div className="mt-1 text-xs text-slate-400 max-w-md mx-auto">{text}</div>
    </div>
  )
}
