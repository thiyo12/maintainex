'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiDownload,
  FiRefreshCw,
  FiSearch,
} from 'react-icons/fi'
import {
  CrmBadge,
  CrmButton,
  CrmFilterBar,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  CrmTableFrame,
  crmInputClass,
  crmTableClass,
  crmTdClass,
  crmThClass,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmPagination } from '@/components/crm/v2/CrmOperational'
import { crmApiError } from '@/lib/crm/api-error'

interface Settlement {
  id: string
  providerId: string
  providerType: string
  weekStart: string
  weekEnd: string
  totalEarnings: number
  commissionRate: number
  commissionOwed: number
  commissionPaid: boolean
  paidAt?: string | null
  dueAt: string
  status: string
  currency: string
  countryCode: string
  provider?: {
    entityId: string
    userId: string
    name?: string | null
    mxId?: string | null
    countryCode?: string | null
  } | null
}

interface CurrencySummary {
  currency: string
  count: number
  gross: number
  commission: number
  net: number
}

interface Payload {
  settlements: Settlement[]
  summaryByCurrency: CurrencySummary[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === 'CAD' ? 'en-CA' : 'en-LK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function date(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-LK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

export default function SettlementsPage() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [providerType, setProviderType] = useState('ALL')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '30',
        providerType,
      })
      if (from) params.set('from', from)
      if (to) params.set('to', to)

      const response = await fetch(
        `/api/admin/financial/settlements?${params.toString()}`,
        { credentials: 'include', cache: 'no-store' }
      )
      const body = await response.json().catch(() => ({}))

      if (response.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      if (!response.ok) crmApiError(body, 'Unable to load settlement history')

      setPayload(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load settlement history')
    } finally {
      setLoading(false)
    }
  }, [from, page, providerType, to])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [from, to, providerType])

  const rows = useMemo(() => {
    const data = payload?.settlements || []
    const q = query.trim().toLowerCase()
    if (!q) return data

    return data.filter(item =>
      [
        item.id,
        item.providerId,
        item.provider?.name,
        item.provider?.mxId,
        item.providerType,
        item.countryCode,
        item.currency,
      ].some(value => String(value || '').toLowerCase().includes(q))
    )
  }, [payload, query])

  function exportCurrentPage() {
    if (!rows.length) {
      toast.error('No settlements on this page to export')
      return
    }

    const csvRows = [
      [
        'Settlement ID',
        'Paid At',
        'Week Start',
        'Week End',
        'Provider',
        'MX ID',
        'Provider Type',
        'Country',
        'Currency',
        'Gross Earnings',
        'Commission',
        'Net',
      ],
      ...rows.map(item => [
        item.id,
        item.paidAt || '',
        item.weekStart,
        item.weekEnd,
        item.provider?.name || item.providerId,
        item.provider?.mxId || '',
        item.providerType,
        item.countryCode,
        item.currency,
        item.totalEarnings,
        item.commissionOwed,
        item.totalEarnings - item.commissionOwed,
      ]),
    ]

    const csv = csvRows.map(row => row.map(escapeCsv).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `maintainex-settlement-history-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    toast.success('Current page exported')
  }

  const summaries = payload?.summaryByCurrency || []

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="Finance · Historical reconciliation"
        title="Settlement History"
        description="Read-only history of paid weekly commission obligations. Totals are currency-separated and scoped to the operator's allowed markets."
        actions={
          <>
            <CrmButton variant="secondary" onClick={load} disabled={loading}>
              <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </CrmButton>
            <CrmButton variant="primary" onClick={exportCurrentPage} disabled={!rows.length}>
              <FiDownload size={14} />
              Export current page
            </CrmButton>
          </>
        }
      />

      <div>
        <Link
          href="/admin/financial"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-amber-700"
        >
          <FiArrowLeft size={13} />
          Finance Control Centre
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CrmMetricCard
          label="Paid settlements"
          value={payload?.pagination.total || 0}
          helper="Matching current server filters"
          icon={<FiCheckCircle size={16} />}
          tone="success"
        />
        {summaries.slice(0, 3).map(summary => (
          <CrmMetricCard
            key={summary.currency}
            label={`${summary.currency} settled`}
            value={money(summary.gross, summary.currency)}
            helper={`Commission ${money(summary.commission, summary.currency)} · Net ${money(summary.net, summary.currency)}`}
            icon={<FiCalendar size={16} />}
            tone="neutral"
          />
        ))}
      </section>

      <CrmFilterBar>
        <div className="relative min-w-0 flex-1">
          <FiSearch
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={15}
          />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search provider, MX ID, settlement, market…"
            className={`${crmInputClass} pl-9`}
          />
        </div>

        <select
          value={providerType}
          onChange={event => setProviderType(event.target.value)}
          className={crmInputClass}
          aria-label="Provider type"
        >
          <option value="ALL">All providers</option>
          <option value="TASKER">Taskers</option>
          <option value="COMPANY">Companies</option>
        </select>

        <input
          type="date"
          value={from}
          onChange={event => setFrom(event.target.value)}
          className={crmInputClass}
          aria-label="Paid from"
        />

        <input
          type="date"
          value={to}
          onChange={event => setTo(event.target.value)}
          className={crmInputClass}
          aria-label="Paid to"
        />

        {(from || to || providerType !== 'ALL') && (
          <CrmButton
            variant="ghost"
            onClick={() => {
              setFrom('')
              setTo('')
              setProviderType('ALL')
            }}
          >
            Clear
          </CrmButton>
        )}
      </CrmFilterBar>

      {loading ? (
        <CrmState
          type="loading"
          title="Loading settlement history"
          description="Loading paid commission obligations from the allowed markets."
        />
      ) : rows.length === 0 ? (
        <CrmState
          type="empty"
          title="No paid settlements match this view"
          description="Adjust the paid-date, provider-type, or search filters."
        />
      ) : (
        <CrmTableFrame
          title="Paid weekly commission obligations"
          description="Historical records are read-only here. Payment evidence and enforcement actions live in Commission Control."
        >
          <table className={`${crmTableClass} min-w-[1220px]`}>
            <thead>
              <tr>
                <th className={crmThClass}>Paid</th>
                <th className={crmThClass}>Provider</th>
                <th className={crmThClass}>Type</th>
                <th className={crmThClass}>Week</th>
                <th className={crmThClass}>Gross</th>
                <th className={crmThClass}>Commission</th>
                <th className={crmThClass}>Net</th>
                <th className={crmThClass}>Market</th>
                <th className={crmThClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(item => (
                <tr key={item.id} className="transition-colors hover:bg-[#fafbf9]">
                  <td className={crmTdClass}>
                    <div className="font-medium text-slate-800">{date(item.paidAt)}</div>
                  </td>
                  <td className={crmTdClass}>
                    <div className="font-semibold text-slate-900">
                      {item.provider?.name || item.providerId}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {item.provider?.mxId || item.providerId}
                    </div>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge tone={item.providerType === 'COMPANY' ? 'amber' : 'info'}>
                      {item.providerType === 'COMPANY' ? 'Company' : 'Tasker'}
                    </CrmBadge>
                  </td>
                  <td className={crmTdClass}>
                    <div className="text-xs font-medium text-slate-700">{date(item.weekStart)}</div>
                    <div className="mt-1 text-[10px] text-slate-400">to {date(item.weekEnd)}</div>
                  </td>
                  <td className={crmTdClass}>
                    <div className="font-semibold text-slate-900">
                      {money(item.totalEarnings, item.currency)}
                    </div>
                  </td>
                  <td className={crmTdClass}>
                    <div className="font-semibold text-amber-700">
                      {money(item.commissionOwed, item.currency)}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">{item.commissionRate}%</div>
                  </td>
                  <td className={crmTdClass}>
                    <div className="font-semibold text-emerald-700">
                      {money(item.totalEarnings - item.commissionOwed, item.currency)}
                    </div>
                  </td>
                  <td className={crmTdClass}>
                    <div className="text-xs font-semibold text-slate-700">{item.countryCode}</div>
                    <div className="mt-1 text-[10px] text-slate-400">{item.currency}</div>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge tone="success" dot>
                      PAID
                    </CrmBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <CrmPagination
            page={payload?.pagination.page || page}
            totalPages={payload?.pagination.pages || 1}
            total={payload?.pagination.total || 0}
            pageSize={payload?.pagination.limit || 30}
            onPageChange={setPage}
          />
        </CrmTableFrame>
      )}

      <div className="rounded-2xl border border-[var(--crm-border)] bg-white p-4">
        <p className="text-xs leading-5 text-slate-500">
          This page is historical and read-only. It does not settle money, clear debt, or change provider access.
          Use Commission Control for payment evidence and enforcement workflows.
        </p>
      </div>
    </div>
  )
}
