'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowUpRight,
  FiBriefcase,
  FiClock,
  FiFilter,
  FiSearch,
  FiTool,
  FiUsers,
} from 'react-icons/fi'
import {
  CrmBadge,
  CrmFilterBar,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  CrmTableFrame,
  CrmTabs,
  crmInputClass,
  crmTableClass,
  crmTdClass,
  crmThClass,
  type CrmTone,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmPagination } from '@/components/crm/v2/CrmOperational'
import { crmApiError } from '@/lib/crm/api-error'

interface Job {
  id: string
  title: string
  description: string
  category: string
  budget: number
  budgetType?: string
  location: string
  status: string
  urgency?: string
  source: 'V1' | 'V2'
  createdAt: string
  customer: {
    id: string
    mxId?: string | null
    name: string
    email: string
  }
}

interface JobsPayload {
  jobs: Job[]
  pagination: { page: number; limit: number; total: number; pages: number }
  summary: { totalV1: number; totalV2: number }
}

const STATUS_TABS = [
  { key: 'ALL', label: 'All jobs' },
  { key: 'OPEN', label: 'Open' },
  { key: 'QUOTE_ACCEPTED', label: 'Quote accepted' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
] as const

type StatusKey = (typeof STATUS_TABS)[number]['key']
type SourceKey = 'ALL' | 'V1' | 'V2'

function statusTone(status: string): CrmTone {
  const normalized = status.toUpperCase()
  if (normalized === 'COMPLETED') return 'success'
  if (normalized === 'CANCELLED') return 'danger'
  if (normalized === 'IN_PROGRESS') return 'warning'
  if (normalized === 'QUOTE_ACCEPTED') return 'amber'
  return 'info'
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function JobsCommandCentrePage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStatus, setActiveStatus] = useState<StatusKey>('ALL')
  const [source, setSource] = useState<SourceKey>('ALL')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 })
  const [summary, setSummary] = useState({ totalV1: 0, totalV2: 0 })
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        source,
      })
      if (activeStatus !== 'ALL') params.set('status', activeStatus)
      if (appliedQuery.trim()) params.set('q', appliedQuery.trim())

      const response = await fetch(`/api/admin/jobs?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw crmApiError(body, 'Failed to load jobs')
      }

      const data: JobsPayload = await response.json()
      setJobs(data.jobs || [])
      setPagination(data.pagination || { page: 1, limit: 25, total: 0, pages: 1 })
      setSummary(data.summary || { totalV1: 0, totalV2: 0 })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }, [activeStatus, appliedQuery, page, source])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setAppliedQuery(query)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [activeStatus, source])

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="Operations"
        title="Jobs Command Centre"
        description="Search, filter and open every booking into the Job 360 operations workspace."
        actions={
          <Link
            href="/admin/jobs/disputes"
            className="inline-flex h-10 items-center gap-2 rounded-[11px] border border-[var(--crm-border)] bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open dispute queue <FiArrowUpRight size={15} />
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CrmMetricCard
          icon={<FiBriefcase size={16} />}
          label="Matching jobs"
          value={pagination.total.toLocaleString()}
          helper="Current filters"
          tone="neutral"
        />
        <CrmMetricCard
          icon={<FiTool size={16} />}
          label="Marketplace"
          value={summary.totalV2.toLocaleString()}
          helper="V2 canonical jobs"
          tone="amber"
        />
        <CrmMetricCard
          icon={<FiClock size={16} />}
          label="Classic"
          value={summary.totalV1.toLocaleString()}
          helper="Legacy job postings"
          tone="info"
        />
        <CrmMetricCard
          icon={<FiUsers size={16} />}
          label="Visible page"
          value={jobs.length.toLocaleString()}
          helper={`Page ${pagination.page} of ${pagination.pages}`}
          tone="neutral"
        />
      </section>

      <div className="space-y-3">
        <CrmFilterBar>
          <div className="relative min-w-0 flex-1">
            <FiSearch
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search job ID, title, customer name, email or MX ID..."
              className={`${crmInputClass} pl-9`}
            />
          </div>

          <div className="flex items-center gap-2 md:w-[220px]">
            <FiFilter className="shrink-0 text-slate-400" size={16} />
            <select
              value={source}
              onChange={event => setSource(event.target.value as SourceKey)}
              className={crmInputClass}
              aria-label="Job source"
            >
              <option value="ALL">All sources</option>
              <option value="V2">Marketplace V2</option>
              <option value="V1">Classic V1</option>
            </select>
          </div>
        </CrmFilterBar>

        <CrmTabs
          items={STATUS_TABS.map(tab => ({ id: tab.key, label: tab.label }))}
          active={activeStatus}
          onChange={id => setActiveStatus(id as StatusKey)}
        />
      </div>

      {loading ? (
        <CrmState
          type="loading"
          title="Loading jobs"
          description="Loading the scoped job queue for your current market access."
        />
      ) : jobs.length === 0 ? (
        <CrmState
          type="empty"
          title="No jobs match this view"
          description="Change the filters or search for another record."
        />
      ) : (
        <CrmTableFrame
          title="Job queue"
          description={`${pagination.total.toLocaleString()} matching jobs across the allowed market scope.`}
        >
          <table className={`${crmTableClass} min-w-[1080px]`}>
            <thead>
              <tr>
                <th className={crmThClass}>Job</th>
                <th className={crmThClass}>Customer</th>
                <th className={crmThClass}>Category</th>
                <th className={crmThClass}>Location</th>
                <th className={crmThClass}>Amount</th>
                <th className={crmThClass}>Source</th>
                <th className={crmThClass}>Status</th>
                <th className={crmThClass}>Created</th>
                <th className={`${crmThClass} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id} className="transition-colors hover:bg-[#fafbf9]">
                  <td className={crmTdClass}>
                    <div className="max-w-[220px] truncate font-semibold text-slate-900">{job.title}</div>
                    <div className="mt-1 max-w-[220px] truncate font-mono text-[10px] text-slate-400">{job.id}</div>
                  </td>
                  <td className={crmTdClass}>
                    <Link
                      href={`/admin/users/${job.customer.id}`}
                      className="font-semibold text-slate-800 hover:text-amber-700"
                    >
                      {job.customer.name}
                    </Link>
                    <div className="mt-1 text-xs text-slate-400">{job.customer.mxId || job.customer.email}</div>
                  </td>
                  <td className={crmTdClass}>{job.category}</td>
                  <td className={`${crmTdClass} max-w-[170px] truncate text-slate-500`}>{job.location}</td>
                  <td className={`${crmTdClass} font-semibold text-slate-900`}>
                    {formatMoney(job.budget)}
                    {job.budgetType && job.budgetType !== 'FIXED' && (
                      <div className="mt-1 text-[10px] font-normal text-slate-400">
                        {job.budgetType.replaceAll('_', ' ')}
                      </div>
                    )}
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge tone={job.source === 'V2' ? 'amber' : 'neutral'}>
                      {job.source === 'V2' ? 'Marketplace' : 'Classic'}
                    </CrmBadge>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge tone={statusTone(job.status)} dot>
                      {job.status.replaceAll('_', ' ')}
                    </CrmBadge>
                  </td>
                  <td className={`${crmTdClass} whitespace-nowrap text-xs text-slate-400`}>
                    {formatDate(job.createdAt)}
                  </td>
                  <td className={`${crmTdClass} text-right`}>
                    <Link
                      href={`/admin/jobs/${job.id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-[var(--crm-border)] bg-white px-3 text-xs font-semibold text-slate-700 hover:border-slate-900 hover:bg-slate-900 hover:text-white"
                    >
                      Job 360 <FiArrowUpRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <CrmPagination
            page={pagination.page}
            totalPages={pagination.pages}
            total={pagination.total}
            pageSize={pagination.limit}
            onPageChange={setPage}
          />
        </CrmTableFrame>
      )}
    </div>
  )
}
