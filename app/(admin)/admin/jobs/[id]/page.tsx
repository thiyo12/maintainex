'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { crmApiError } from '@/lib/crm/api-error'
import {
  CrmBadge,
  CrmButton,
  CrmCard,
  CrmState,
  CrmTabs,
  type CrmTone,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmConfirmDialog } from '@/components/crm/v2/CrmOverlays'
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
  permissions: {
    finance: boolean
    trust: boolean
    audit: boolean
    cancel: boolean
  }
  job: any
  quotes?: any[]
  workspace?: any
  lifecycle?: any[]
  finance?: {
    escrow?: any
    paymentIntents?: any[]
    providerTransactions?: any[]
    providerRefunds?: any[]
    providerEvents?: any[]
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

function statusTone(status?: string | null): CrmTone {
  const normalized = String(status || '').toUpperCase()
  if (['COMPLETED', 'CLEARED', 'SETTLED', 'SUCCESS', 'VERIFIED', 'RELEASED', 'APPROVED'].includes(normalized)) {
    return 'success'
  }
  if (['DISPUTED', 'FAILED', 'REJECTED', 'CANCELLED', 'CHARGEDBACK', 'CRITICAL'].includes(normalized)) {
    return 'danger'
  }
  if (['IN_PROGRESS', 'PROCESSING', 'PROTECTED', 'ON_HOLD', 'UNDER_REVIEW', 'HIGH'].includes(normalized)) {
    return 'warning'
  }
  if (['OPEN', 'PENDING', 'CREATED', 'QUOTE_ACCEPTED', 'MEDIUM'].includes(normalized)) {
    return 'info'
  }
  return 'neutral'
}

function StatusBadge({ value }: { value?: string | null }) {
  return <CrmBadge tone={statusTone(value)} dot>{label(value)}</CrmBadge>
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
    <CrmCard title={title} description={subtitle} action={action}>
      {children}
    </CrmCard>
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
  const [payload, setPayload] = useState<Job360Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [actionLoading, setActionLoading] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

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
        throw crmApiError(body, 'Unable to load job')
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
  const visibleTabs = TABS.filter(tab =>
    tab.key !== 'finance' || payload?.permissions.finance
  ).filter(tab =>
    tab.key !== 'dispute' || payload?.permissions.trust
  ).filter(tab =>
    tab.key !== 'audit' || payload?.permissions.audit
  )
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

    setActionLoading(true)
    try {
      const response = await fetch('/api/admin/jobs', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          jobId: job.id,
          source: payload?.source,
          status: 'CANCELLED',
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw crmApiError(body, 'Unable to cancel job')
      }

      if (response.status === 202 || body?.approvalRequired) {
        toast.success(`Cancellation sent for ${body?.approval?.tier || 'approval'} review`)
        setCancelConfirmOpen(false)
        await load()
        return
      }

      toast.success('Job cancelled')
      setCancelConfirmOpen(false)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Cancel failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <CrmState type="loading" title="Loading Job 360" description="Loading lifecycle, finance, risk and operational context." />
  }

  if (!payload || !job) {
    return (
      <CrmState
        type="error"
        title="Job unavailable"
        description="The record could not be loaded or is outside your assigned market."
        action={
          <Link href="/admin/jobs" className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700">
            <FiArrowLeft /> Back to jobs
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[14px] border border-[var(--crm-border)] bg-white shadow-[var(--crm-shadow-card)]">
        <div className="px-4 pt-3.5 md:px-5 md:pt-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <Link href="/admin/jobs" className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900">
                <FiArrowLeft size={14} />
                Back to Jobs
              </Link>

              <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(job.id)
                    toast.success('Job ID copied')
                  }}
                  className="inline-flex items-center gap-2 text-left"
                >
                  <h1 className="text-[22px] font-bold tracking-[-0.025em] text-slate-950 md:text-[24px]">{job.id}</h1>
                  <FiCopy size={13} className="text-slate-300" />
                </button>
                <StatusBadge value={job.status} />
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{job.title}</span>
                <span>•</span>
                <span>{payload.source === 'V2' ? 'Marketplace' : 'Classic'}</span>
                <span>•</span>
                <span>Created {formatDate(job.createdAt)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <CrmButton variant="secondary" onClick={load}>
                <FiRefreshCw size={14} />
                Refresh
              </CrmButton>
              {payload.permissions.cancel && !['COMPLETED', 'CANCELLED'].includes(job.status) && (
                <CrmButton
                  variant="danger"
                  disabled={actionLoading}
                  onClick={() => setCancelConfirmOpen(true)}
                >
                  <FiXCircle size={14} />
                  Cancel job
                </CrmButton>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-2.5 border-t border-[var(--crm-border)] py-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryTile icon={FiUser} label="Customer" value={customer?.name || 'Unknown'} meta={customer?.mxId || customer?.email} href={customer?.id ? `/admin/users/${customer.id}` : undefined} />
            <SummaryTile icon={FiTool} label="Provider" value={provider?.companyName || provider?.name || 'Not assigned'} meta={acceptedQuote ? `${label(acceptedQuote.providerType)} provider` : 'Awaiting accepted quote'} href={providerLink || undefined} />
            <SummaryTile icon={FiMapPin} label="Location" value={location || 'Not specified'} meta={job.countryCode || customer?.countryCode || '—'} />
            <SummaryTile icon={FiDollarSign} label="Amount" value={formatMoney(amount, currency)} meta={acceptedQuote ? 'Accepted / authorized value' : 'Budget value'} />
          </div>
        </div>

        <div className="px-3 md:px-4">
          <CrmTabs
            items={visibleTabs.map(tab => ({
              id: tab.key,
              label: tab.label,
              count: tab.key === 'dispute' && riskEvents.length > 0 ? riskEvents.length : undefined,
            }))}
            active={activeTab}
            onChange={id => setActiveTab(id as TabKey)}
          />
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_286px]">
        <div className="space-y-4">
          {activeTab === 'overview' && <OverviewTab payload={payload} location={location} />}
          {activeTab === 'lifecycle' && <LifecycleTab payload={payload} />}
          {activeTab === 'quotes' && <QuotesTab payload={payload} currency={currency} />}
          {activeTab === 'workspace' && <WorkspaceTab payload={payload} />}
          {activeTab === 'finance' && payload.permissions.finance && <FinanceTab payload={payload} currency={currency} />}
          {activeTab === 'dispute' && payload.permissions.trust && <RiskTab payload={payload} />}
          {activeTab === 'audit' && payload.permissions.audit && <AuditTab rows={auditRows} />}
        </div>

        <aside className="space-y-3.5 xl:sticky xl:top-[72px]">
          <Card title="Quick Actions" subtitle="Operational controls for this job">
            <div className="space-y-2">
              {customer?.id && (
                <RailLink href={`/admin/users/${customer.id}`} icon={FiUser} label="Open customer 360" primary />
              )}
              {providerLink && <RailLink href={providerLink} icon={FiTool} label="Open provider 360" />}
              {payload.permissions.finance && (
                <RailLink href="/admin/financial/wallets" icon={FiCreditCard} label="Finance operations" />
              )}
              {payload.permissions.trust && (
                <RailLink href="/admin/jobs/disputes" icon={FiFlag} label="Create / review dispute" />
              )}
              {payload.permissions.trust && (
                <RailLink href="/admin/trust-safety/risk-events" icon={FiShield} label="Trust & safety" />
              )}
            </div>
          </Card>

          {payload.permissions.finance && (
            <Card title="Payment / Escrow" subtitle="Canonical financial state">
              <div className="rounded-[10px] border border-amber-100 bg-amber-50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700">Amount</div>
                <div className="mt-1 text-xl font-bold text-slate-950">{formatMoney(amount, currency)}</div>
              </div>
              <div className="mt-4 space-y-3">
                <KeyValue label="Escrow" value={finance.escrow?.status || 'Not funded'} />
                <KeyValue label="Payment" value={finance.paymentIntents?.[0]?.status || 'No payment intent'} />
                <KeyValue label="Commission" value={finance.settlements?.[0]?.status || 'Not created'} />
                <KeyValue label="Payout" value={finance.payouts?.[0]?.status || 'Not created'} />
              </div>
            </Card>
          )}

          {payload.permissions.finance && (
            <Card title="Financials" subtitle="Service value and settlement split">
              <div className="space-y-3">
                <KeyValue label="Service amount" value={formatMoney(amount, currency)} />
                <KeyValue
                  label="MaintainEX commission"
                  value={finance.settlements?.[0]
                    ? formatMoney(finance.settlements[0].commissionAmount, finance.settlements[0].currency || currency)
                    : '—'}
                />
                <KeyValue
                  label="Provider amount"
                  value={finance.settlements?.[0]
                    ? formatMoney(finance.settlements[0].jobAmount, finance.settlements[0].currency || currency)
                    : '—'}
                />
              </div>
            </Card>
          )}

          <Card title="Risk Assessment" subtitle="Safety and verification signals">
            <div className="space-y-3">
              {payload.permissions.trust && <KeyValue label="Risk events" value={String(riskEvents.length)} />}
              <KeyValue label="PIN status" value={operations.verificationPin?.status || 'Not generated'} />
              <KeyValue label="Arrival verified" value={operations.verificationPin?.arrivalVerifiedAt ? 'Yes' : 'No'} />
              <KeyValue label="Work started" value={operations.verificationPin?.workStartVerifiedAt ? 'Yes' : 'No'} />
              <KeyValue label="Completion" value={operations.verificationPin?.completionVerifiedAt ? 'Verified' : 'Pending'} />
            </div>
          </Card>

          <Card title="Schedule / SLA" subtitle="Timing and service urgency">
            <div className="space-y-3">
              <KeyValue label="Service date" value={formatDate(job.preferredDate || job.scheduledDate)} />
              <KeyValue label="Time slot" value={job.preferredTimeSlot || 'Not set'} />
              <KeyValue label="Urgency" value={job.urgency || 'Normal'} />
              <KeyValue label="Job type" value={job.jobType || job.serviceType || 'On-site'} />
            </div>
          </Card>

          {payload.permissions.audit && auditRows.length > 0 && (
            <Card title="Internal Activity" subtitle="Latest staff-visible job note">
              <div className="text-xs leading-5 text-slate-600">
                {auditRows[0].description || label(auditRows[0].action)}
              </div>
              <div className="mt-2 text-[10px] text-slate-400">
                {auditRows[0].actor || 'System'} · {formatDate(auditRows[0].createdAt)}
              </div>
            </Card>
          )}
        </aside>
      </div>

      <CrmConfirmDialog
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={cancelJob}
        title="Cancel this job?"
        description="This will change the job lifecycle and may affect provider assignments or financial state. The server will re-check your permission, market scope and allowed transition before applying the cancellation."
        confirmLabel="Cancel job"
        dangerous
        busy={actionLoading}
      />
    </div>
  )
}

function SummaryTile({ icon: Icon, label: tileLabel, value, meta, href }: { icon: any; label: string; value: string; meta?: string; href?: string }) {
  const body = (
    <div className="flex h-full items-center gap-3 rounded-[10px] border border-[var(--crm-border)] bg-[#fbfcfd] px-3 py-2.5">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-slate-500 shadow-sm">
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-medium text-slate-400">{tileLabel}</div>
        <div className="mt-0.5 line-clamp-1 text-[12px] font-semibold text-slate-900">{value}</div>
        {meta && <div className="mt-0.5 truncate text-[10px] text-slate-400">{meta}</div>}
      </div>
    </div>
  )
  return href ? <Link href={href} className="hover:opacity-80 transition">{body}</Link> : body
}

function RailLink({ href, icon: Icon, label: linkLabel, primary = false }: { href: string; icon: any; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
        primary
          ? 'border-[var(--crm-accent)] bg-[var(--crm-accent)] text-[#111315] hover:bg-[#ffc443]'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <span className="flex items-center gap-2.5">
        <Icon size={15} className={primary ? 'text-[#111315]' : 'text-slate-400'} />
        {linkLabel}
      </span>
      <FiExternalLink size={13} className={primary ? 'text-[#111315]/60' : 'text-slate-300'} />
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
  const acceptedQuote = payload.quotes?.find((quote: any) => quote.status === 'ACCEPTED')
  const provider = job.acceptedProvider || operations?.assignments?.[0]?.company || operations?.assignments?.[0]?.worker

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Customer" subtitle="Customer attached to this job">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" value={customer?.name} />
            <Field label="MX ID" value={customer?.mxId} mono />
            <Field label="Email" value={customer?.email} />
            <Field label="Phone" value={customer?.phone} />
            <Field label="Account" value={customer?.isBanned ? 'Banned' : customer?.isSuspended ? 'Suspended' : 'Active'} />
            <Field label="Type" value={customer?.customerProfile?.customerType || '—'} />
          </div>
        </Card>

        <Card title="Provider / Company / Worker" subtitle="Accepted provider and assignment">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Provider" value={provider?.companyName || provider?.name || 'Not assigned'} />
            <Field label="Provider type" value={acceptedQuote?.providerType ? label(acceptedQuote.providerType) : '—'} />
            <Field label="Quote" value={acceptedQuote?.total ?? acceptedQuote?.price ? formatMoney(acceptedQuote?.total ?? acceptedQuote?.price, job.currency || 'LKR') : '—'} />
            <Field label="Assignment state" value={operations?.assignments?.[0]?.status ? label(operations.assignments[0].status) : 'Not assigned'} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <Card title="Location" subtitle="Service destination">
          <div className="rounded-xl border border-[var(--crm-border)] bg-[#f8faf9] p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-slate-500 shadow-sm">
                <FiMapPin size={15} />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">{location || 'Not specified'}</div>
                <div className="mt-1 text-xs text-slate-400">{job.countryCode || customer?.countryCode || 'Country unavailable'}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Schedule" subtitle="Requested service timing">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Preferred date" value={formatDate(job.preferredDate || job.scheduledDate)} />
            <Field label="Time slot" value={label(job.preferredTimeSlot)} />
            <Field label="Urgency" value={label(job.urgency)} />
            <Field label="Job type" value={label(job.jobType || job.serviceType)} />
          </div>
        </Card>
      </div>

      <Card title="Service Details" subtitle="Request scope and operational notes">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Service / category" value={isV2 ? job.category?.name || job.categoryId : job.category} />
          <Field label="Priority" value={label(job.urgency)} />
          <Field label="Source" value={payload.source === 'V2' ? 'Marketplace' : 'Classic'} />
        </div>
        <div className="mt-5 border-t border-slate-100 pt-5">
          <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Description</div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{job.description || 'No description provided.'}</p>
        </div>
      </Card>

      <Card title="Job Lifecycle" subtitle="Most recent canonical lifecycle events">
        {payload.lifecycle?.length ? (
          <div className="space-y-0">
            {payload.lifecycle.slice(0, 7).map((event: any, index: number) => (
              <div key={event.id || `${event.event || event.status}-${index}`} className="relative grid grid-cols-[24px_minmax(0,1fr)_auto] gap-3 pb-4 last:pb-0">
                {index < Math.min(payload.lifecycle?.length ?? 0, 7) - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-slate-200" />}
                <span className="relative mt-1.5 h-3 w-3 rounded-full bg-[var(--crm-success)] ring-4 ring-white" />
                <div>
                  <div className="text-xs font-semibold text-slate-800">{label(event.event || event.status || event.action)}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">{event.description || event.note || 'Lifecycle update'}</div>
                </div>
                <div className="text-[10px] text-slate-400">{formatDate(event.createdAt || event.occurredAt)}</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={FiActivity} title="No lifecycle events" text="Canonical lifecycle events will appear here as the job progresses." />
        )}
      </Card>
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
          <div className="space-y-4">
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
            <div key={quote.id} className={`rounded-[12px] border p-4 ${quote.status === 'ACCEPTED' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
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
        <div className="grid gap-4 md:grid-cols-2">
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
      <div className="grid gap-4 lg:grid-cols-2">
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
    return (
      <Card title="Finance" subtitle="Classic job financial context">
        <EmptyState
          icon={FiCreditCard}
          title="No ledger records"
          text="No canonical financial ledger entries are linked to this classic job."
        />
      </Card>
    )
  }

  const latestPayment = finance.paymentIntents?.[0]
  const latestTransaction = finance.providerTransactions?.[0]
  const latestSettlement = finance.settlements?.[0]
  const latestPayout = finance.payouts?.[0]
  const providerFee = latestTransaction?.providerFee
  const providerNet = latestTransaction?.netSettlement

  const timeline = [
    ...(finance.paymentIntents || []).map((item: any) => ({
      id: `payment-${item.id}`,
      time: item.paidAt || item.updatedAt || item.createdAt,
      title: `Payment intent · ${label(item.status)}`,
      detail: `${item.gateway || 'Gateway'} · ${item.merchantOrderId}`,
      status: item.status,
      type: 'Payment',
    })),
    ...(finance.providerTransactions || []).map((item: any) => ({
      id: `provider-transaction-${item.id}`,
      time: item.reconciledAt || item.updatedAt || item.createdAt,
      title: `${item.provider} transaction · ${label(item.status)}`,
      detail: item.providerCaptureId || item.providerOrderId || item.id,
      status: item.reconciliationStatus || item.status,
      type: 'Provider',
    })),
    ...(finance.providerRefunds || []).map((item: any) => ({
      id: `provider-refund-${item.id}`,
      time: item.completedAt || item.updatedAt || item.createdAt,
      title: `${item.provider} refund · ${label(item.status)}`,
      detail: item.providerRefundId || item.reason || item.id,
      status: item.status,
      type: 'Refund',
    })),
    ...(finance.providerEvents || []).map((item: any) => ({
      id: `provider-event-${item.id}`,
      time: item.occurredAt || item.processedAt || item.createdAt,
      title: label(item.eventType),
      detail: `${item.provider} · ${item.externalEventId}`,
      status: item.processingStatus,
      type: 'Event',
    })),
    ...(finance.settlements || []).map((item: any) => ({
      id: `settlement-${item.id}`,
      time: item.settledAt || item.updatedAt || item.createdAt,
      title: `Commission · ${label(item.status)}`,
      detail: `${formatMoney(item.commissionAmount, item.currency || currency)} MaintainEX commission`,
      status: item.status,
      type: 'Commission',
    })),
    ...(finance.payouts || []).map((item: any) => ({
      id: `payout-${item.id}`,
      time: item.clearedAt || item.createdAt,
      title: `Payout · ${label(item.status)}`,
      detail: formatMoney(item.amount, item.currency || currency),
      status: item.status,
      type: 'Payout',
    })),
  ].sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime())

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceMetric
          label="Escrow"
          value={finance.escrow?.status || 'None'}
          amount={finance.escrow ? formatMoney(finance.escrow.totalAmount, finance.escrow.currency || currency) : '—'}
        />
        <FinanceMetric
          label="Payment"
          value={latestPayment?.status || 'None'}
          amount={latestPayment ? formatMoney(latestPayment.amount, latestPayment.currency || currency) : '—'}
        />
        <FinanceMetric
          label="Commission"
          value={latestSettlement?.status || 'None'}
          amount={latestSettlement ? formatMoney(latestSettlement.commissionAmount, latestSettlement.currency || currency) : '—'}
        />
        <FinanceMetric
          label="Payout"
          value={latestPayout?.status || 'None'}
          amount={latestPayout ? formatMoney(latestPayout.amount, latestPayout.currency || currency) : '—'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <Card
          title="Payment & provider"
          subtitle="Canonical intent mapped to the external provider transaction"
          action={
            <Link href="/admin/financial/payments" className="text-xs font-semibold text-amber-700 hover:text-amber-800">
              Open Payments →
            </Link>
          }
        >
          {latestPayment ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Provider" value={<StatusBadge value={latestPayment.gateway || 'UNKNOWN'} />} />
                <Field label="Payment state" value={<StatusBadge value={latestPayment.status} />} />
                <Field label="Provider order" value={latestTransaction?.providerOrderId || latestPayment.merchantOrderId} mono />
                <Field label="Capture / payment ID" value={latestTransaction?.providerCaptureId || latestPayment.paymentId || '—'} mono />
                <Field label="Authorized / captured" value={formatMoney(latestPayment.amount, latestPayment.currency || currency)} />
                <Field label="Paid at" value={formatDate(latestPayment.paidAt)} />
              </div>
              {latestTransaction && (
                <div className="grid gap-3 rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-4 sm:grid-cols-3">
                  <Field
                    label="Provider fee"
                    value={providerFee == null ? '—' : formatMoney(providerFee, latestTransaction.currency || currency)}
                  />
                  <Field
                    label="Provider net"
                    value={providerNet == null ? '—' : formatMoney(providerNet, latestTransaction.currency || currency)}
                  />
                  <Field
                    label="Reconciliation"
                    value={<StatusBadge value={latestTransaction.reconciliationStatus || 'UNRECONCILED'} />}
                  />
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={FiCreditCard}
              title="No payment intent"
              text="A payment has not been created for this job."
            />
          )}
        </Card>

        <Card title="Protected payment" subtitle="Escrow, commission and provider settlement split">
          {finance.escrow ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Escrow state" value={<StatusBadge value={finance.escrow.status} />} />
                <Field label="Payment method" value={label(finance.escrow.paymentMethod)} />
                <Field label="Gross protected" value={formatMoney(finance.escrow.totalAmount, finance.escrow.currency || currency)} />
                <Field label="Service fee" value={formatMoney(finance.escrow.serviceFee, finance.escrow.currency || currency)} />
                <Field
                  label="MaintainEX commission"
                  value={latestSettlement ? formatMoney(latestSettlement.commissionAmount, latestSettlement.currency || currency) : '—'}
                />
                <Field
                  label="Tasker / company amount"
                  value={latestSettlement ? formatMoney(latestSettlement.jobAmount, latestSettlement.currency || currency) : '—'}
                />
              </div>
              <div className="border-t border-slate-100 pt-3 text-[11px] leading-5 text-slate-400">
                Provider fees are tracked separately from MaintainEX commission and do not overwrite canonical escrow or ledger values.
              </div>
            </div>
          ) : (
            <EmptyState icon={FiShield} title="No escrow" text="No canonical escrow record is linked to this job." />
          )}
        </Card>
      </div>

      <Card title="Payment intents" subtitle="All checkout attempts, including provider and canonical state">
        {finance.paymentIntents?.length ? (
          <div className="space-y-2">
            {finance.paymentIntents.map((intent: any) => (
              <div key={intent.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CrmBadge tone={intent.gateway === 'PAYPAL' ? 'info' : intent.gateway === 'PAYHERE' ? 'amber' : 'neutral'} dot>
                      {label(intent.gateway || 'UNKNOWN')}
                    </CrmBadge>
                    <StatusBadge value={intent.status} />
                  </div>
                  <div className="mt-2 truncate font-mono text-xs font-semibold text-slate-700">{intent.merchantOrderId}</div>
                  <div className="mt-1 text-xs text-slate-400">{formatDate(intent.createdAt)}</div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-sm font-semibold text-slate-900">{formatMoney(intent.amount, intent.currency)}</div>
                  <div className="mt-1 font-mono text-[10px] text-slate-400">{intent.paymentId || intent.id}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={FiCreditCard} title="No payment intents" text="A gateway payment has not been created for this job." />
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Provider transactions" subtitle="Order / capture references, fees and reconciliation">
          {finance.providerTransactions?.length ? (
            <div className="space-y-3">
              {finance.providerTransactions.map((transaction: any) => (
                <div key={transaction.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CrmBadge tone={transaction.provider === 'PAYPAL' ? 'info' : 'amber'} dot>
                        {label(transaction.provider)}
                      </CrmBadge>
                      <StatusBadge value={transaction.status} />
                    </div>
                    <StatusBadge value={transaction.reconciliationStatus || 'UNRECONCILED'} />
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Order ID" value={transaction.providerOrderId || '—'} mono />
                    <Field label="Capture ID" value={transaction.providerCaptureId || '—'} mono />
                    <Field label="Gross" value={formatMoney(transaction.grossAmount, transaction.currency)} />
                    <Field label="Provider fee" value={transaction.providerFee == null ? '—' : formatMoney(transaction.providerFee, transaction.currency)} />
                    <Field label="Provider net" value={transaction.netSettlement == null ? '—' : formatMoney(transaction.netSettlement, transaction.currency)} />
                    <Field label="Reconciled" value={transaction.reconciledAt ? formatDate(transaction.reconciledAt) : 'Not yet'} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={FiCreditCard} title="No provider transaction" text="No external provider capture has been recorded yet." />
          )}
        </Card>

        <Card title="Refund history" subtitle="Provider-side refund records and governed reconciliation">
          {finance.providerRefunds?.length ? (
            <div className="space-y-3">
              {finance.providerRefunds.map((refund: any) => (
                <div key={refund.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-xs font-semibold text-slate-700">{refund.providerRefundId || refund.id}</div>
                      <div className="mt-1 text-xs text-slate-400">{refund.provider} · {formatDate(refund.createdAt)}</div>
                    </div>
                    <StatusBadge value={refund.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-500">{refund.reason || 'Provider refund'}</span>
                    <span className="text-sm font-semibold text-slate-900">{formatMoney(refund.amount, refund.currency)}</span>
                  </div>
                  {refund.approvalRequestId && (
                    <div className="mt-2 text-[10px] text-slate-400">Approval {refund.approvalRequestId}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={FiRefreshCw} title="No provider refunds" text="No provider-side refund is recorded for this job." />
          )}
        </Card>
      </div>

      <Card title="Provider event timeline" subtitle="Verified webhook and provider events; raw sensitive payloads remain hidden">
        {finance.providerEvents?.length ? (
          <div className="space-y-2">
            {finance.providerEvents.map((event: any) => (
              <div key={event.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800">{label(event.eventType)}</div>
                  <div className="mt-1 truncate font-mono text-[10px] text-slate-400">{event.externalEventId}</div>
                  {event.errorMessage && <div className="mt-2 text-xs text-red-700">{event.errorMessage}</div>}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                  <StatusBadge value={event.processingStatus} />
                  <div className="text-[10px] text-slate-400">{formatDate(event.occurredAt || event.createdAt)}</div>
                  <div className="text-[10px] text-slate-400">
                    Signature {event.signatureVerified ? 'verified' : 'not verified'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={FiActivity} title="No provider events" text="No provider webhook events are linked to this payment yet." />
        )}
      </Card>

      <Card title="Settlement & payout" subtitle="MaintainEX commission and provider/tasker settlement state">
        {(finance.settlements?.length || finance.payouts?.length) ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Commission settlements</div>
              {(finance.settlements || []).map((settlement: any) => (
                <div key={settlement.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <StatusBadge value={settlement.status} />
                    <span className="text-xs text-slate-400">{formatDate(settlement.createdAt)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Commission" value={formatMoney(settlement.commissionAmount, settlement.currency)} />
                    <Field label="Provider amount" value={formatMoney(settlement.jobAmount, settlement.currency)} />
                  </div>
                </div>
              ))}
              {!finance.settlements?.length && <div className="text-xs text-slate-400">No settlement recorded.</div>}
            </div>
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Payouts</div>
              {(finance.payouts || []).map((payout: any) => (
                <div key={payout.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <StatusBadge value={payout.status} />
                    <span className="text-sm font-semibold text-slate-900">{formatMoney(payout.amount, payout.currency)}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">{label(payout.method)} · {formatDate(payout.clearedAt || payout.createdAt)}</div>
                </div>
              ))}
              {!finance.payouts?.length && <div className="text-xs text-slate-400">No payout recorded.</div>}
            </div>
          </div>
        ) : (
          <EmptyState icon={FiDollarSign} title="No settlement or payout" text="No commission settlement or payout has been recorded yet." />
        )}
      </Card>

      <Card title="Unified financial timeline" subtitle="Payment → provider → escrow → commission → refund/payout events in one place">
        {timeline.length ? (
          <div className="relative space-y-0 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-slate-200">
            {timeline.slice(0, 80).map(item => (
              <div key={item.id} className="relative flex gap-4 py-3">
                <div className="z-10 mt-1 h-[23px] w-[23px] shrink-0 rounded-full border-4 border-white bg-amber-400 shadow-sm" />
                <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-[#fafbf9] px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-800">{item.title}</div>
                    <StatusBadge value={item.status} />
                  </div>
                  <div className="mt-1 break-all text-[11px] text-slate-500">{item.detail}</div>
                  <div className="mt-1 text-[10px] text-slate-400">{item.type} · {formatDate(item.time)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={FiActivity} title="No financial timeline" text="No financial lifecycle events have been recorded for this job." />
        )}
      </Card>

      <Card title="Financial ledger" subtitle="Immutable accounting entries related to this job">
        {finance.ledger?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
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
                    <td className="whitespace-nowrap py-3 text-xs text-slate-400">{formatDate(entry.createdAt)}</td>
                    <td className="py-3 text-slate-700">{label(entry.accountType)}</td>
                    <td className="py-3"><StatusBadge value={entry.entryType} /></td>
                    <td className="py-3 text-xs text-slate-500">{label(entry.referenceType)}</td>
                    <td className="py-3 text-right font-semibold text-slate-900">{formatMoney(entry.amount, entry.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={FiDollarSign} title="No ledger entries" text="No immutable ledger postings are linked to this job." />
        )}
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
            {payload.permissions.finance && <Field label="Escrow" value={label(payload.finance?.escrow?.status)} />}
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
    <div className="rounded-[12px] border border-[var(--crm-border)] bg-white p-4 shadow-[var(--crm-shadow-card)]">
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
