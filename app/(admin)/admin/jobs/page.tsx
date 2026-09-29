'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowUpRight, FiBriefcase, FiChevronLeft, FiChevronRight,
  FiClock, FiFilter, FiSearch, FiTool, FiUsers
} from 'react-icons/fi'

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

function statusClasses(status: string) {
  const normalized = status.toUpperCase()
  if (normalized === 'COMPLETED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (normalized === 'CANCELLED') return 'bg-red-50 text-red-700 border-red-200'
  if (normalized === 'IN_PROGRESS') return 'bg-amber-50 text-amber-700 border-amber-200'
  if (normalized === 'QUOTE_ACCEPTED') return 'bg-violet-50 text-violet-700 border-violet-200'
  return 'bg-blue-50 text-blue-700 border-blue-200'
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
        throw new Error(body?.error?.message || body?.error || 'Failed to load jobs')
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
    <div className="space-y-5">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-amber-600 font-semibold">Operations</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-slate-950">Jobs Command Centre</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Search, filter and open every booking into the Job 360 operations workspace.
          </p>
        </div>
        <Link
          href="/admin/jobs/disputes"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Open dispute queue <FiArrowUpRight size={15} />
        </Link>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard icon={FiBriefcase} label="Matching jobs" value={pagination.total} detail="Current filters" />
        <MetricCard icon={FiTool} label="Marketplace" value={summary.totalV2} detail="V2 canonical jobs" />
        <MetricCard icon={FiClock} label="Classic" value={summary.totalV1} detail="Legacy job postings" />
        <MetricCard icon={FiUsers} label="Visible page" value={jobs.length} detail={`Page ${pagination.page} of ${pagination.pages}`} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search job ID, title, customer name, email or MX ID..."
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
              />
            </div>
            <div className="flex items-center gap-2">
              <FiFilter className="text-slate-400" size={16} />
              <select
                value={source}
                onChange={event => setSource(event.target.value as SourceKey)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                <option value="ALL">All sources</option>
                <option value="V2">Marketplace V2</option>
                <option value="V1">Classic V1</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveStatus(tab.key)}
                className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${
                  activeStatus === tab.key
                    ? 'bg-slate-950 text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <div className="w-8 h-8 border-[3px] border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <FiSearch size={20} />
            </div>
            <h2 className="mt-3 text-sm font-semibold text-slate-800">No jobs match this view</h2>
            <p className="mt-1 text-xs text-slate-400">Change the filters or search for another record.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-100">
                  <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-slate-400">
                    <th className="px-5 py-3.5 font-semibold">Job</th>
                    <th className="px-4 py-3.5 font-semibold">Customer</th>
                    <th className="px-4 py-3.5 font-semibold">Category</th>
                    <th className="px-4 py-3.5 font-semibold">Location</th>
                    <th className="px-4 py-3.5 font-semibold">Amount</th>
                    <th className="px-4 py-3.5 font-semibold">Source</th>
                    <th className="px-4 py-3.5 font-semibold">Status</th>
                    <th className="px-4 py-3.5 font-semibold">Created</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.map(job => (
                    <tr key={job.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 max-w-[220px] truncate">{job.title}</div>
                        <div className="mt-1 font-mono text-[11px] text-slate-400 max-w-[220px] truncate">{job.id}</div>
                      </td>
                      <td className="px-4 py-4">
                        <Link href={`/admin/users/${job.customer.id}`} className="font-medium text-slate-800 hover:text-amber-700">
                          {job.customer.name}
                        </Link>
                        <div className="text-xs text-slate-400 mt-1">{job.customer.mxId || job.customer.email}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{job.category}</td>
                      <td className="px-4 py-4 text-slate-500 max-w-[160px] truncate">{job.location}</td>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {formatMoney(job.budget)}
                        {job.budgetType && job.budgetType !== 'FIXED' && (
                          <div className="text-[10px] text-slate-400 font-normal mt-1">{job.budgetType.replaceAll('_', ' ')}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${
                          job.source === 'V2'
                            ? 'bg-violet-50 text-violet-700 border-violet-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {job.source === 'V2' ? 'Marketplace' : 'Classic'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClasses(job.status)}`}>
                          {job.status.replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-400 whitespace-nowrap">{formatDate(job.createdAt)}</td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/admin/jobs/${job.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-950 hover:text-white hover:border-slate-950 transition"
                        >
                          Job 360 <FiArrowUpRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-400">
                {pagination.total.toLocaleString()} matching jobs · page {pagination.page} of {pagination.pages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(current => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                >
                  <FiChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(current => Math.min(pagination.pages, current + 1))}
                  disabled={page >= pagination.pages}
                  className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30"
                >
                  <FiChevronRight size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: any; label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{value.toLocaleString()}</div>
          <div className="mt-1 text-[11px] text-slate-400">{detail}</div>
        </div>
        <div className="w-9 h-9 rounded-xl bg-slate-950 text-amber-300 flex items-center justify-center">
          <Icon size={16} />
        </div>
      </div>
    </div>
  )
}
