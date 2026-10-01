'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiAlertTriangle,
  FiArrowUpRight,
  FiCheckCircle,
  FiCreditCard,
  FiDollarSign,
  FiRefreshCw,
  FiShield,
} from 'react-icons/fi'

interface Group {
  status: string
  currency: string
  count: number
  total?: string
  amount?: string
  commissionAmount?: string
  jobAmount?: string
}

interface FinancePayload {
  commission: Group[]
  payouts: Group[]
  escrow: Group[]
  payments: Group[]
  recentSettlements: any[]
  recentPayouts: any[]
}

function minor(value: unknown, currency = 'LKR') {
  const raw = Number(value || 0)
  const amount = Number.isFinite(raw) ? raw / 100 : 0
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

function date(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })
}

function badge(status: string) {
  const s = status.toUpperCase()
  if (['CLEARED', 'SETTLED', 'SUCCESS', 'RELEASED', 'PROTECTED', 'REFUNDED'].includes(s)) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (['FAILED', 'REJECTED', 'CHARGEDBACK'].includes(s)) return 'bg-red-50 text-red-700 border-red-200'
  if (['PENDING', 'PROCESSING', 'ON_HOLD', 'CREATED', 'REFUND_REQUIRED', 'REFUND_PROCESSING'].includes(s)) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-50 text-slate-600 border-slate-200'
}

export default function FinanceControlCentrePage() {
  const [data, setData] = useState<FinancePayload | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/financial/overview', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Unable to load finance overview')
      setData(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load finance overview')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const metrics = useMemo(() => {
    const sources = [
      ...(data?.escrow || []),
      ...(data?.commission || []),
      ...(data?.payouts || []),
      ...(data?.payments || []),
    ]
    const currencies = [...new Set(sources.map(row => row.currency || 'LKR'))].sort()

    const sum = (rows: Group[], statuses: string[], field: keyof Group, currency: string) =>
      rows
        .filter(row => statuses.includes(row.status) && (row.currency || 'LKR') === currency)
        .reduce((total, row) => total + Number(row[field] || 0), 0)

    const count = (rows: Group[], statuses: string[], currency: string) =>
      rows
        .filter(row => statuses.includes(row.status) && (row.currency || 'LKR') === currency)
        .reduce((total, row) => total + Number(row.count || 0), 0)

    return currencies.map(currency => ({
      currency,
      protectedEscrow: sum(data?.escrow || [], ['PROTECTED', 'ON_HOLD'], 'total', currency),
      pendingCommission: sum(data?.commission || [], ['PENDING'], 'commissionAmount', currency),
      pendingPayouts: sum(data?.payouts || [], ['PENDING', 'PROCESSING'], 'amount', currency),
      paymentFailures: count(data?.payments || [], ['FAILED', 'CHARGEDBACK', 'REFUND_REQUIRED', 'REFUND_PROCESSING'], currency),
    }))
  }, [data])

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-24 rounded-2xl bg-white border border-slate-200" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[0,1,2,3].map(item => <div key={item} className="h-28 rounded-2xl bg-white border border-slate-200" />)}
        </div>
        <div className="h-[480px] rounded-2xl bg-white border border-slate-200" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-amber-600 font-semibold">Finance operations</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-slate-950">Finance Control Centre</h1>
          <p className="mt-1.5 text-sm text-slate-500">Escrow, payments, commission and payout queues in one view.</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50">
          <FiRefreshCw size={15} /> Refresh
        </button>
      </section>

      <section className="space-y-4">
        {metrics.length ? metrics.map(row => (
          <div key={row.currency} className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Metric icon={FiShield} label={`Protected / held escrow · ${row.currency}`} value={minor(row.protectedEscrow, row.currency)} detail="Customer funds protected" />
            <Metric icon={FiDollarSign} label={`Pending commission · ${row.currency}`} value={minor(row.pendingCommission, row.currency)} detail="MaintainEX receivable" />
            <Metric icon={FiCreditCard} label={`Pending payouts · ${row.currency}`} value={minor(row.pendingPayouts, row.currency)} detail="Provider payouts awaiting clearing" />
            <Metric icon={FiAlertTriangle} label={`Payment exceptions · ${row.currency}`} value={String(row.paymentFailures)} detail="Failed / chargeback / refund queue" danger={row.paymentFailures > 0} />
          </div>
        )) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-400">
            No financial records are available for the assigned markets.
          </div>
        )}
      </section>

      <section className="grid xl:grid-cols-2 gap-5">
        <Panel title="Escrow state" subtitle="Canonical JobEscrow status distribution">
          <StatusRows rows={data?.escrow || []} amountField="total" />
          <Link href="/admin/financial/wallets" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-700">
            Open wallets & payouts <FiArrowUpRight size={14} />
          </Link>
        </Panel>

        <Panel title="Payment state" subtitle="PaymentIntent status distribution">
          <StatusRows rows={data?.payments || []} amountField="total" />
          <div className="mt-4 flex flex-col gap-2">
            <Link href="/admin/financial/refunds" className="inline-flex items-center gap-1 text-sm font-medium text-amber-700">
              Open PayHere refund queue <FiArrowUpRight size={14} />
            </Link>
            <div className="text-xs text-slate-400">Gateway payloads and secrets are intentionally excluded from CRM responses.</div>
          </div>
        </Panel>

        <Panel title="Commission state" subtitle="Commission settlements by state">
          <StatusRows rows={data?.commission || []} amountField="commissionAmount" />
          <Link href="/admin/financial/commission" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-700">
            Open commission operations <FiArrowUpRight size={14} />
          </Link>
        </Panel>

        <Panel title="Payout state" subtitle="Provider payouts by state">
          <StatusRows rows={data?.payouts || []} amountField="amount" />
          <Link href="/admin/financial/wallets" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-700">
            Open payout queue <FiArrowUpRight size={14} />
          </Link>
        </Panel>
      </section>

      <section className="grid xl:grid-cols-2 gap-5">
        <Panel title="Recent settlements" subtitle="Latest commission settlement records">
          {data?.recentSettlements?.length ? (
            <div className="space-y-2">
              {data.recentSettlements.map(item => (
                <Link key={item.id} href={`/admin/jobs/${item.jobId}`} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                  <div>
                    <div className="text-sm font-medium text-slate-800">Job {item.jobId}</div>
                    <div className="text-xs text-slate-400 mt-1">{item.countryCode} · {date(item.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">{minor(item.commissionAmount, item.currency)}</div>
                    <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge(item.status)}`}>{item.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : <Empty text="No settlement records are available for this market." />}
        </Panel>

        <Panel title="Recent payouts" subtitle="Latest payout records">
          {data?.recentPayouts?.length ? (
            <div className="space-y-2">
              {data.recentPayouts.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{item.user?.name || item.userId}</div>
                    <div className="text-xs text-slate-400 mt-1">{item.source} · {date(item.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">{minor(item.amount, item.currency)}</div>
                    <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge(item.status)}`}>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty text="No payout records are available for this market." />}
        </Panel>
      </section>
    </div>
  )
}

function Metric({ icon: Icon, label, value, detail, danger = false }: { icon: any; label: string; value: string; detail: string; danger?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">{label}</div>
          <div className={`mt-2 text-xl md:text-2xl font-semibold ${danger ? 'text-red-700' : 'text-slate-950'}`}>{value}</div>
          <div className="mt-1 text-[11px] text-slate-400">{detail}</div>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${danger ? 'bg-red-50 text-red-600' : 'bg-slate-950 text-amber-300'}`}>
          <Icon size={16} />
        </div>
      </div>
    </div>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="text-xs text-slate-400 mt-1 mb-4">{subtitle}</p>}
      {children}
    </section>
  )
}

function StatusRows({ rows, amountField }: { rows: Group[]; amountField: keyof Group }) {
  if (!rows.length) return <Empty text="No records are available for this state group." />
  return (
    <div className="space-y-2">
      {rows.map(row => (
        <div key={`${row.status}-${row.currency}`} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
          <div className="flex items-center gap-2">
            {['FAILED', 'REJECTED', 'CHARGEDBACK'].includes(row.status) ? <FiAlertTriangle className="text-red-500" size={14} /> : <FiCheckCircle className="text-slate-400" size={14} />}
            <span className="text-sm text-slate-700">{row.status.replaceAll('_', ' ')} · {row.currency}</span>
            <span className="text-xs text-slate-400">({row.count})</span>
          </div>
          <span className="text-sm font-semibold text-slate-900">{minor(row[amountField], row.currency)}</span>
        </div>
      ))}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="py-6 text-center text-sm text-slate-400">{text}</div>
}
