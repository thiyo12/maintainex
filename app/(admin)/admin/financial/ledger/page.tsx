'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowLeft,
  FiBookOpen,
  FiCheckCircle,
  FiCornerUpLeft,
  FiDollarSign,
  FiRefreshCw,
  FiSearch,
  FiShield,
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

interface LedgerEntry {
  id: string
  groupId?: string | null
  accountId: string
  accountType: string
  entryType: 'DEBIT' | 'CREDIT' | string
  amount: string
  currency: string
  referenceType: string
  referenceId: string
  description?: string | null
  createdBy: string
  createdAt: string
  countryCode?: string | null
}

interface LedgerStat {
  currency: string
  entryType: string
  count: number
  total: string
}

interface Payload {
  entries: LedgerEntry[]
  stats: LedgerStat[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  scope: {
    markets: string[]
    unknownReferencesVisible: boolean
  }
}

const REFERENCE_TYPES = [
  '',
  'ESCROW_DEPOSIT',
  'ESCROW_RELEASE',
  'ESCROW_REFUND',
  'ESCROW_EXTERNAL_REFUND',
  'PAYMENT_REFUND_SUSPENSE',
  'PAYMENT_EXTERNAL_REFUND',
  'WITHDRAWAL_RESERVED',
  'PAYOUT_SUCCEEDED',
  'WITHDRAWAL_RELEASED',
  'REVERSAL',
]

function money(minor: string | number, currency: string) {
  const value = Number(minor || 0) / 100
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

function date(value: string) {
  return new Date(value).toLocaleString('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function short(value?: string | null, head = 8, tail = 5) {
  if (!value) return '—'
  if (value.length <= head + tail + 2) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

function owningWorkspace(referenceType: string) {
  if (referenceType.startsWith('ESCROW_')) return '/admin/financial/escrow'
  if (referenceType.startsWith('PAYMENT_')) return '/admin/financial/payments'
  if (
    referenceType.startsWith('PAYOUT_') ||
    referenceType.startsWith('WITHDRAWAL_')
  ) {
    return '/admin/financial/payouts'
  }
  return null
}

export default function FinancialLedgerPage() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [entryType, setEntryType] = useState('ALL')
  const [currency, setCurrency] = useState('ALL')
  const [referenceType, setReferenceType] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        entryType,
        currency,
      })
      if (referenceType) params.set('referenceType', referenceType)

      const response = await fetch(`/api/admin/financial/ledger?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))

      if (response.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      if (!response.ok) crmApiError(body, 'Unable to load financial ledger')

      setPayload(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load financial ledger')
    } finally {
      setLoading(false)
    }
  }, [page, entryType, currency, referenceType])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [entryType, currency, referenceType])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return payload?.entries || []

    return (payload?.entries || []).filter(item =>
      [
        item.id,
        item.groupId,
        item.accountType,
        item.accountId,
        item.referenceType,
        item.referenceId,
        item.description,
        item.createdBy,
        item.countryCode,
      ].some(value => String(value || '').toLowerCase().includes(q))
    )
  }, [payload, query])

  const currencies = useMemo(
    () => [...new Set((payload?.stats || []).map(row => row.currency))].sort(),
    [payload]
  )

  const metrics = useMemo(() => {
    return currencies.map(code => {
      const debit = (payload?.stats || [])
        .filter(row => row.currency === code && row.entryType === 'DEBIT')
        .reduce((sum, row) => sum + Number(row.total || 0), 0)
      const credit = (payload?.stats || [])
        .filter(row => row.currency === code && row.entryType === 'CREDIT')
        .reduce((sum, row) => sum + Number(row.total || 0), 0)
      const entries = (payload?.stats || [])
        .filter(row => row.currency === code)
        .reduce((sum, row) => sum + row.count, 0)

      return { currency: code, debit, credit, entries, balanced: debit === credit }
    })
  }, [payload, currencies])

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="Finance · Accounting truth"
        title="Financial Ledger"
        description="Immutable double-entry accounting records mapped to your authorized markets. Historical entries are never edited or deleted from CRM."
        actions={
          <CrmButton variant="secondary" onClick={load} disabled={loading}>
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </CrmButton>
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

      {metrics.map(row => (
        <section key={row.currency} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <CrmMetricCard
            label={`Debits · ${row.currency}`}
            value={money(row.debit, row.currency)}
            helper="Scoped ledger debit volume"
            icon={<FiCornerUpLeft size={16} />}
            tone="neutral"
          />
          <CrmMetricCard
            label={`Credits · ${row.currency}`}
            value={money(row.credit, row.currency)}
            helper="Scoped ledger credit volume"
            icon={<FiDollarSign size={16} />}
            tone="neutral"
          />
          <CrmMetricCard
            label={`Entries · ${row.currency}`}
            value={row.entries}
            helper="Immutable accounting rows"
            icon={<FiBookOpen size={16} />}
            tone="info"
          />
          <CrmMetricCard
            label={`Balance check · ${row.currency}`}
            value={row.balanced ? 'Balanced' : 'Review'}
            helper="Debit and credit totals"
            icon={<FiCheckCircle size={16} />}
            tone={row.balanced ? 'success' : 'danger'}
          />
        </section>
      ))}

      <CrmFilterBar>
        <div className="relative min-w-0 flex-1">
          <FiSearch
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={15}
          />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            className={`${crmInputClass} pl-9`}
            placeholder="Search group, account, reference or actor…"
          />
        </div>

        <select
          value={entryType}
          onChange={event => setEntryType(event.target.value)}
          className={crmInputClass}
          aria-label="Ledger entry type"
        >
          <option value="ALL">Debit + credit</option>
          <option value="DEBIT">Debit only</option>
          <option value="CREDIT">Credit only</option>
        </select>

        <select
          value={currency}
          onChange={event => setCurrency(event.target.value)}
          className={crmInputClass}
          aria-label="Ledger currency"
        >
          <option value="ALL">All currencies</option>
          {currencies.map(code => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>

        <select
          value={referenceType}
          onChange={event => setReferenceType(event.target.value)}
          className={crmInputClass}
          aria-label="Ledger reference type"
        >
          {REFERENCE_TYPES.map(value => (
            <option key={value || 'ALL'} value={value}>
              {value ? value.replaceAll('_', ' ') : 'All reference types'}
            </option>
          ))}
        </select>
      </CrmFilterBar>

      {loading ? (
        <CrmState
          type="loading"
          title="Loading financial ledger"
          description="Resolving immutable entries to your authorized markets."
        />
      ) : rows.length === 0 ? (
        <CrmState
          type="empty"
          title="No ledger entries match"
          description="No market-scoped ledger entries match the current filters."
        />
      ) : (
        <CrmTableFrame
          title="Immutable accounting entries"
          description="Account and reference identifiers are internal operational references, not gateway credentials."
        >
          <table className={`${crmTableClass} min-w-[1500px]`}>
            <thead>
              <tr>
                <th className={crmThClass}>Time / market</th>
                <th className={crmThClass}>Group</th>
                <th className={crmThClass}>Account</th>
                <th className={crmThClass}>Entry</th>
                <th className={crmThClass}>Amount</th>
                <th className={crmThClass}>Reference</th>
                <th className={crmThClass}>Description</th>
                <th className={crmThClass}>Actor</th>
                <th className={`${crmThClass} text-right`}>Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(item => {
                const workspace = owningWorkspace(item.referenceType)
                return (
                  <tr key={item.id} className="transition-colors hover:bg-[#fafbf9]">
                    <td className={crmTdClass}>
                      <div className="text-xs font-medium text-slate-700">{date(item.createdAt)}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-slate-400">
                        {item.countryCode || 'Unscoped'}
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <div className="font-mono text-xs text-slate-700" title={item.groupId || undefined}>
                        {short(item.groupId)}
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <div className="font-semibold text-slate-800">{item.accountType}</div>
                      <div className="mt-1 font-mono text-[10px] text-slate-400" title={item.accountId}>
                        {short(item.accountId)}
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <CrmBadge tone={item.entryType === 'CREDIT' ? 'success' : 'neutral'} dot>
                        {item.entryType}
                      </CrmBadge>
                    </td>

                    <td className={crmTdClass}>
                      <div className="font-semibold text-slate-900">
                        {money(item.amount, item.currency)}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">{item.currency}</div>
                    </td>

                    <td className={crmTdClass}>
                      <div className="text-xs font-semibold text-slate-700">
                        {item.referenceType.replaceAll('_', ' ')}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-slate-400" title={item.referenceId}>
                        {short(item.referenceId)}
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <div className="max-w-[280px] text-xs leading-5 text-slate-500">
                        {item.description || '—'}
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <div className="font-mono text-xs text-slate-500" title={item.createdBy}>
                        {short(item.createdBy)}
                      </div>
                    </td>

                    <td className={`${crmTdClass} text-right`}>
                      {workspace ? (
                        <Link href={workspace}>
                          <CrmButton size="sm" variant="secondary">
                            Open workflow
                          </CrmButton>
                        </Link>
                      ) : (
                        <CrmBadge>{item.referenceType === 'REVERSAL' ? 'Compensating' : 'Ledger only'}</CrmBadge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <CrmPagination
            page={payload?.pagination.page || page}
            totalPages={payload?.pagination.pages || 1}
            total={payload?.pagination.total || 0}
            pageSize={payload?.pagination.limit || 50}
            onPageChange={setPage}
          />
        </CrmTableFrame>
      )}

      <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3.5">
        <div className="flex items-start gap-3">
          <FiShield className="mt-0.5 shrink-0 text-amber-700" size={16} />
          <div>
            <div className="text-sm font-semibold text-amber-950">Immutable by design</div>
            <p className="mt-1 text-xs leading-5 text-amber-900/75">
              CRM has no edit or delete action for historical ledger entries. Corrections must be new compensating entries through a canonical finance workflow.
              Non-owner staff only receive ledger references that resolve to their assigned markets; unknown reference types fail closed.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
