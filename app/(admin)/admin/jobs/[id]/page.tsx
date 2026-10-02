'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
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
  FiArrowUpRight,
  FiCalendar,
  FiCheck,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiExternalLink,
  FiFileText,
  FiFlag,
  FiMail,
  FiMapPin,
  FiMessageSquare,
  FiPhone,
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
        throw new Error(body?.error?.message || body?.error || 'Unable to cancel job')
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
    <div className="space-y-3.5">
      <section className="crm-card overflow-hidden">
        <div className="px-4 pt-3.5">
          <div className="flex items-center justify-between gap-3">
            <Link href="/admin/jobs" className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 hover:text-slate-900">
              <FiArrowLeft size={12} />
              Back to Jobs
            </Link>
            <CrmButton variant="secondary" size="sm" onClick={load}>
              <FiRefreshCw size={12} />
              Refresh
            </CrmButton>
          </div>

          <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-mono text-[21px] font-extrabold tracking-[-0.025em] text-slate-950">
                  {job.id}
                </h1>
                <StatusBadge value={job.status} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                <span className="font-semibold text-slate-700">{job.title}</span>
                <span>•</span>
                <span>{payload.source === 'V2' ? 'Marketplace' : 'Classic'}</span>
                <span>•</span>
                <span>Created {formatDate(job.createdAt)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
              <TopFact label="Customer" icon={FiUser} value={customer?.name || 'Unknown'} />
              <TopFact label="Provider" icon={FiTool} value={provider?.companyName || provider?.name || 'Unassigned'} />
              <TopFact label="Location" icon={FiMapPin} value={location || 'Not specified'} />
              <TopFact label="Amount" icon={FiDollarSign} value={formatMoney(amount, currency)} />
            </div>
          </div>
        </div>

        <div className="mt-2 px-4">
          <CrmTabs
            variant="underline"
            items={visibleTabs.map(tab => ({
              id: tab.key,
              label: tab.label === 'Dispute / Risk' ? 'Dispute' : tab.label,
              count: tab.key === 'dispute' && riskEvents.length > 0 ? riskEvents.length : undefined,
            }))}
            active={activeTab}
            onChange={id => setActiveTab(id as TabKey)}
          />
        </div>
      </section>

      <div className="grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_270px]">
        <div className="space-y-3.5">
          {activeTab === 'overview' && (
            <OverviewTab
              payload={payload}
              location={location}
              provider={provider}
              providerLink={providerLink}
              currency={currency}
              amount={amount}
            />
          )}
          {activeTab === 'lifecycle' && <LifecycleTab payload={payload} />}
          {activeTab === 'quotes' && <QuotesTab payload={payload} currency={currency} />}
          {activeTab === 'workspace' && <WorkspaceTab payload={payload} />}
          {activeTab === 'finance' && payload.permissions.finance && <FinanceTab payload={payload} currency={currency} />}
          {activeTab === 'dispute' && payload.permissions.trust && <RiskTab payload={payload} />}
          {activeTab === 'audit' && payload.permissions.audit && <AuditTab rows={auditRows} />}
        </div>

        <aside className="space-y-3.5 xl:sticky xl:top-[76px]">
          <ReferenceCard title="Quick Actions">
            <div className="space-y-2">
              <button type="button" onClick={() => setActiveTab('workspace')} className="flex h-8 w-full items-center gap-2 rounded-md border border-[#e2b200] bg-[#ffca18] px-3 text-[10px] font-bold text-[#111827] hover:bg-[#ffd642]">
                <FiMessageSquare size={12} />
                Message / Workspace
              </button>
              {customer?.id && <RailLink href={`/admin/users/${customer.id}`} icon={FiUser} label="Open customer" />}
              {providerLink && <RailLink href={providerLink} icon={FiTool} label="Open provider" />}
              {payload.permissions.finance && (
                <button type="button" onClick={() => setActiveTab('finance')} className="flex h-8 w-full items-center gap-2 rounded-md border border-[#dfe4e8] bg-white px-3 text-left text-[10px] font-semibold text-slate-700 hover:bg-[#f8fafb]">
                  <FiCreditCard size={12} className="text-slate-500" />
                  Finance details
                </button>
              )}
              {payload.permissions.trust && (
                <button type="button" onClick={() => setActiveTab('dispute')} className="flex h-8 w-full items-center gap-2 rounded-md border border-[#dfe4e8] bg-white px-3 text-left text-[10px] font-semibold text-slate-700 hover:bg-[#f8fafb]">
                  <FiFlag size={12} className="text-slate-500" />
                  Dispute / Risk
                </button>
              )}
              {payload.permissions.cancel && !['COMPLETED', 'CANCELLED'].includes(job.status) && (
                <CrmButton variant="danger" size="sm" className="w-full" disabled={actionLoading} onClick={() => setCancelConfirmOpen(true)}>
                  <FiXCircle size={12} />
                  Cancel job
                </CrmButton>
              )}
            </div>
          </ReferenceCard>

          {payload.permissions.finance && (
            <ReferenceCard title="Payment / Escrow">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fff4c2] text-[#b87500]">
                  <FiCreditCard size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-extrabold text-slate-950">{formatMoney(finance.escrow?.totalAmount ?? amount, finance.escrow?.currency || currency)}</div>
                  <div className="mt-0.5 text-[9px] text-slate-500">{label(finance.escrow?.status || 'Not funded')}</div>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <RailState label="Payment" value={finance.paymentIntents?.[0]?.status || 'No payment intent'} />
                <RailState label="Escrow" value={finance.escrow?.status || 'Not funded'} />
                <RailState label="Payout" value={finance.payouts?.[0]?.status || 'Not created'} />
              </div>
            </ReferenceCard>
          )}

          {payload.permissions.finance && (
            <ReferenceCard title="Financials">
              <div className="space-y-2">
                <KeyValue label="Service amount" value={formatMoney(amount, currency)} />
                <KeyValue label="Commission" value={finance.settlements?.[0]?.commissionAmount ? formatMoney(finance.settlements[0].commissionAmount, finance.settlements[0].currency || currency) : `${job.commissionRate || 10}% configured`} />
                <KeyValue label="Payout" value={finance.payouts?.[0]?.amount ? formatMoney(finance.payouts[0].amount, finance.payouts[0].currency || currency) : 'Pending'} />
              </div>
            </ReferenceCard>
          )}

          <div className="grid grid-cols-2 gap-2">
            <ReferenceCard title="Risk">
              <CrmBadge tone={riskEvents.length ? 'warning' : 'success'} dot>
                {riskEvents.length ? `${riskEvents.length} flags` : 'Low risk'}
              </CrmBadge>
            </ReferenceCard>
            <ReferenceCard title="SLA">
              <CrmBadge tone={['COMPLETED', 'CANCELLED'].includes(job.status) ? 'neutral' : 'success'} dot>
                {['COMPLETED', 'CANCELLED'].includes(job.status) ? 'Closed' : 'On track'}
              </CrmBadge>
            </ReferenceCard>
          </div>

          <ReferenceCard title="Verification">
            <div className="space-y-2">
              <KeyValue label="PIN" value={operations.verificationPin?.status || 'Not generated'} />
              <KeyValue label="Arrival" value={operations.verificationPin?.arrivalVerifiedAt ? 'Verified' : 'Pending'} />
              <KeyValue label="Work start" value={operations.verificationPin?.workStartVerifiedAt ? 'Verified' : 'Pending'} />
              <KeyValue label="Completion" value={operations.verificationPin?.completionVerifiedAt ? 'Verified' : 'Pending'} />
            </div>
          </ReferenceCard>
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

function TopFact({ icon: Icon, label: factLabel, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f3f5f7] text-slate-500"><Icon size={12} /></span>
      <div className="min-w-0">
        <div className="text-[8px] font-semibold text-slate-400">{factLabel}</div>
        <div className="max-w-[126px] truncate text-[10px] font-bold text-slate-800">{value}</div>
      </div>
    </div>
  )
}

function ReferenceCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="crm-card overflow-hidden">
      <div className="border-b border-[#e9edf0] px-3.5 py-2.5 text-[11px] font-bold text-slate-900">{title}</div>
      <div className="p-3.5">{children}</div>
    </section>
  )
}

function RailState({ label: railLabel, value }: { label: string; value: string }) {
  const tone = statusTone(value)
  return (
    <div className="flex items-center justify-between gap-2 text-[9px]">
      <span className="text-slate-500">{railLabel}</span>
      <CrmBadge tone={tone} dot>{label(value)}</CrmBadge>
    </div>
  )
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

function OverviewTab({
  payload,
  location,
  provider,
  providerLink,
  currency,
  amount,
}: {
  payload: Job360Payload
  location: string
  provider: any
  providerLink: string | null
  currency: string
  amount: unknown
}) {
  const job = payload.job
  const customer = job.customer
  const isV2 = payload.source === 'V2'
  const operations = payload.operations || {}
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
    <>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <ReferenceCard title="Customer">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#eef2f5] text-sm font-extrabold text-slate-600">
              {(customer?.name?.[0] || 'C').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[12px] font-bold text-slate-900">{customer?.name || 'Unknown customer'}</div>
                {!customer?.isBanned && !customer?.isSuspended && <CrmBadge tone="success">Active</CrmBadge>}
              </div>
              {customer?.phone && <div className="mt-2 flex items-center gap-2 text-[9px] text-slate-500"><FiPhone size={10} />{customer.phone}</div>}
              {customer?.email && <div className="mt-1 flex items-center gap-2 truncate text-[9px] text-slate-500"><FiMail size={10} />{customer.email}</div>}
              {customer?.id && (
                <Link href={`/admin/users/${customer.id}`} className="mt-3 inline-flex items-center gap-1 text-[9px] font-bold text-[#3478d4]">
                  View profile <FiArrowUpRight size={10} />
                </Link>
              )}
            </div>
          </div>
        </ReferenceCard>

        <ReferenceCard title="Provider / Company / Worker">
          {provider ? (
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#eef2f5] text-sm font-extrabold text-slate-600">
                {(provider?.companyName?.[0] || provider?.name?.[0] || 'P').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-bold text-slate-900">{provider?.companyName || provider?.name || 'Assigned provider'}</div>
                <div className="mt-1 text-[9px] text-slate-500">{provider?.mxId || label(provider?.role || 'Provider')}</div>
                {providerLink && (
                  <Link href={providerLink} className="mt-3 inline-flex items-center gap-1 text-[9px] font-bold text-[#3478d4]">
                    View provider <FiArrowUpRight size={10} />
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="py-3 text-center text-[10px] text-slate-400">No provider assigned yet.</div>
          )}
        </ReferenceCard>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[1.35fr_.65fr]">
        <ReferenceCard title="Location">
          <div className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef2f5] text-slate-600"><FiMapPin size={13} /></span>
            <div>
              <div className="text-[11px] font-bold text-slate-800">{location || 'Not specified'}</div>
              <div className="mt-1 text-[9px] text-slate-400">{job.countryCode || customer?.countryCode || '—'}</div>
            </div>
          </div>
          {job.latitude && job.longitude ? (
            <div className="relative mt-3 h-[112px] overflow-hidden rounded-lg border border-[#e2e7ea] bg-[linear-gradient(135deg,#edf2f6_25%,#f8fafb_25%,#f8fafb_50%,#edf2f6_50%,#edf2f6_75%,#f8fafb_75%)] bg-[length:24px_24px]">
              <div className="absolute inset-0 grid place-items-center">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ef4562] text-white shadow-lg"><FiMapPin size={14} /></span>
              </div>
            </div>
          ) : null}
        </ReferenceCard>

        <ReferenceCard title="Schedule">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#eef2f5] text-slate-600"><FiCalendar size={11} /></span>
              <div>
                <div className="text-[9px] text-slate-400">Preferred date</div>
                <div className="text-[10px] font-bold text-slate-800">{formatDate(job.preferredDate || job.scheduledDate)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#eef2f5] text-slate-600"><FiClock size={11} /></span>
              <div>
                <div className="text-[9px] text-slate-400">Time slot</div>
                <div className="text-[10px] font-bold text-slate-800">{label(job.preferredTimeSlot || 'Not specified')}</div>
              </div>
            </div>
            <CrmBadge tone={['COMPLETED', 'CANCELLED'].includes(job.status) ? 'neutral' : 'success'} dot>
              {['COMPLETED', 'CANCELLED'].includes(job.status) ? 'Closed' : 'On schedule'}
            </CrmBadge>
          </div>
        </ReferenceCard>
      </div>

      <ReferenceCard title="Service Details">
        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            <Field label="Service" value={job.title} />
            <Field label="Priority" value={label(job.urgency || 'normal')} />
            <Field label="Category" value={isV2 ? job.category?.name || job.categoryId : job.category} />
            <Field label="Job type" value={payload.source === 'V2' ? 'Marketplace' : 'Classic'} />
            <Field label="Amount" value={formatMoney(amount, currency)} />
            <Field label="Workers" value={String(job.workersCount || operations.assignments?.length || 1)} />
          </div>
          <div>
            <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400">Verification</div>
            <div className="mt-2 space-y-1.5">
              <RailState label="PIN" value={operations.verificationPin?.status || 'Not generated'} />
              <RailState label="Arrival" value={operations.verificationPin?.arrivalVerifiedAt ? 'Verified' : 'Pending'} />
            </div>
          </div>
        </div>
        <div className="mt-4 border-t border-[#edf0f2] pt-3">
          <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400">Description</div>
          <p className="mt-1.5 whitespace-pre-wrap text-[10px] leading-5 text-slate-600">{job.description || 'No description provided.'}</p>
        </div>
      </ReferenceCard>

      <ReferenceCard title="Job Lifecycle">
        {events.length ? (
          <div className="relative">
            <div className="absolute bottom-3 left-[12px] top-3 w-px bg-[#dfe4e8]" />
            <div className="space-y-3">
              {events.slice(0, 7).map((event: any, index: number) => (
                <div key={event.id || index} className="relative flex gap-3">
                  <span className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-white text-white ${index === events.length - 1 ? 'bg-[#4a82ee]' : 'bg-[#31b86b]'}`}>
                    <FiCheck size={10} />
                  </span>
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold text-slate-800">{label(event.action)}</div>
                      <div className="mt-0.5 text-[8px] text-slate-400">{event.toState ? label(event.toState) : label(event.actorType)}</div>
                    </div>
                    <div className="shrink-0 text-right text-[8px] text-slate-400">{formatDate(event.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-[10px] text-slate-400">No lifecycle events recorded.</div>
        )}
      </ReferenceCard>
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
