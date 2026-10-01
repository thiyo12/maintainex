'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { CrmBadge, CrmButton, CrmCard, CrmMetricCard, CrmPageHeader, CrmState } from '@/components/crm/v2/CrmPrimitives'
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
      <CrmState
        type="loading"
        title="Loading finance control centre"
        description="Loading escrow, payments, commission and payout state for your current market scope."
      />
    )
  }

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="Finance operations"
        title="Finance Control Centre"
        description="Escrow, payments, commission and payout queues in one view. All values come from canonical finance state; gateway secrets are never exposed."
        actions={
          <CrmButton variant="secondary" onClick={load}>
            <FiRefreshCw size={15} /> Refresh
          </CrmButton>
        }
      />

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
          <div className="mt-4 flex flex-col gap-2">
            <Link href="/admin/financial/escrow" className="inline-flex items-center gap-1 text-sm font-medium text-amber-700">
              Open escrow operations <FiArrowUpRight size={14} />
            </Link>
            <Link href="/admin/financial/wallets" className="inline-flex items-center gap-1 text-sm font-medium text-amber-700">
              Open wallet controls <FiArrowUpRight size={14} />
            </Link>
            <Link href="/admin/financial/payouts" className="inline-flex items-center gap-1 text-sm font-medium text-amber-700">
              Open payout queue <FiArrowUpRight size={14} />
            </Link>
          </div>
        </Panel>

        <Panel title="Payment state" subtitle="PaymentIntent status distribution">
          <StatusRows rows={data?.payments || []} amountField="total" />
          <div className="mt-4 flex flex-col gap-2">
            <Link href="/admin/financial/payments" className="inline-flex items-center gap-1 text-sm font-medium text-amber-700">
              Open payment operations <FiArrowUpRight size={14} />
            </Link>
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
          <Link href="/admin/financial/payouts" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-700">
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
                    <div className="mt-1"><FinanceStatus value={item.status} /></div>
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
                    <div className="mt-1"><FinanceStatus value={item.status} /></div>
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
    <CrmMetricCard
      label={label}
      value={value}
      helper={detail}
      icon={<Icon size={16} />}
      tone={danger ? 'danger' : 'neutral'}
    />
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <CrmCard title={title} description={subtitle}>
      {children}
    </CrmCard>
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
            <FinanceStatus value={row.status} />
            <span className="text-xs text-slate-400">{row.currency} · {row.count}</span>
          </div>
          <span className="text-sm font-semibold text-slate-900">{minor(row[amountField], row.currency)}</span>
        </div>
      ))}
    </div>
  )
}

function FinanceStatus({ value }: { value: string }) {
  const status = String(value || '').toUpperCase()
  const tone =
    ['CLEARED', 'SETTLED', 'SUCCESS', 'RELEASED', 'PROTECTED', 'REFUNDED'].includes(status)
      ? 'success'
      : ['FAILED', 'REJECTED', 'CHARGEDBACK'].includes(status)
        ? 'danger'
        : ['PENDING', 'PROCESSING', 'ON_HOLD', 'CREATED', 'REFUND_REQUIRED', 'REFUND_PROCESSING'].includes(status)
          ? 'warning'
          : 'neutral'

  return <CrmBadge tone={tone as any} dot>{status.replaceAll('_', ' ') || '—'}</CrmBadge>
}

function Empty({ text }: { text: string }) {
  return <div className="py-6 text-center text-sm text-slate-400">{text}</div>
}
