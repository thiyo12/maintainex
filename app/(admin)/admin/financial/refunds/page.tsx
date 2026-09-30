'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCreditCard,
  FiRefreshCw,
  FiRotateCw,
  FiSearch,
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'

interface RefundItem {
  id: string
  jobId: string
  escrowId: string
  merchantOrderId: string
  paymentId?: string | null
  amount: string
  currency: string
  status: string
  paidAt?: string | null
  createdAt: string
  updatedAt: string
  job?: {
    id: string
    title: string
    countryCode: string
    status: string
  } | null
  customer?: {
    id: string
    mxId?: string | null
    name?: string | null
    email?: string | null
  } | null
}

interface Payload {
  refunds: RefundItem[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

function money(minor: string, currency: string) {
  const amount = Number(minor || 0) / 100
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function date(value: string) {
  return new Date(value).toLocaleString('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function statusClass(status: string) {
  if (status === 'REFUNDED') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'REFUND_PROCESSING') return 'bg-blue-50 text-blue-700 border-blue-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

export default function RefundQueuePage() {
  const { user } = useAdminSession()
  const role = (user?.role || 'SUPPORT') as AdminRole
  const canManage = (ROLE_PERMISSIONS[role] || []).includes('wallets:manage')

  const [payload, setPayload] = useState<Payload | null>(null)
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      params.set('limit', '100')

      const response = await fetch(`/api/admin/financial/refunds?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Unable to load refund queue')
      setPayload(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load refund queue')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  async function act(item: RefundItem, action: 'RETRY' | 'RECONCILE') {
    if (!canManage) return
    setActing(item.id)
    try {
      const response = await fetch('/api/admin/financial/refunds', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId: item.id,
          action,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body?.result?.error || body?.error || 'Refund action failed')
      }
      toast.success(
        body?.result?.status === 'REFUNDED'
          ? 'PayHere refund confirmed'
          : 'Refund status updated'
      )
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Refund action failed')
    } finally {
      setActing(null)
    }
  }

  const q = query.trim().toLowerCase()
  const rows = (payload?.refunds || []).filter(item => {
    if (!q) return true
    return [
      item.merchantOrderId,
      item.paymentId,
      item.job?.title,
      item.job?.id,
      item.customer?.name,
      item.customer?.email,
      item.customer?.mxId,
    ].some(value => String(value || '').toLowerCase().includes(q))
  })

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/admin/financial" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
            <FiArrowLeft size={15} /> Finance Control Centre
          </Link>
          <div className="mt-3 text-xs uppercase tracking-[0.16em] text-amber-600 font-semibold">Payment recovery</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-slate-950">PayHere Refund Queue</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            External card refunds stay here until PayHere reports the payment as REFUNDED.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600"
        >
          <FiRefreshCw size={15} /> Refresh
        </button>
      </section>

      <section className="grid grid-cols-3 gap-4">
        <Metric label="Refund required" value={(payload?.refunds || []).filter(item => item.status === 'REFUND_REQUIRED').length} />
        <Metric label="Processing" value={(payload?.refunds || []).filter(item => item.status === 'REFUND_PROCESSING').length} />
        <Metric label="Confirmed" value={(payload?.refunds || []).filter(item => item.status === 'REFUNDED').length} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search order, payment, job or customer…"
              className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none"
            />
          </div>
          <select
            value={status}
            onChange={event => setStatus(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All refund states</option>
            <option value="REFUND_REQUIRED">Refund required</option>
            <option value="REFUND_PROCESSING">Refund processing</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 rounded-full border-[3px] border-amber-400 border-t-transparent animate-spin" />
          </div>
        ) : rows.length ? (
          <div className="divide-y divide-slate-100">
            {rows.map(item => (
              <div key={item.id} className="p-4 md:p-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <FiCreditCard className="text-slate-400" />
                    <span className="font-semibold text-slate-900">{item.job?.title || item.jobId}</span>
                    <span className={`text-[10px] rounded-full border px-2 py-1 font-semibold ${statusClass(item.status)}`}>
                      {item.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {item.customer?.name || item.customer?.mxId || item.customer?.email || item.customerId}
                    {' · '}
                    {item.job?.countryCode || '—'}
                    {' · '}
                    updated {date(item.updatedAt)}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400 break-all">
                    Order {item.merchantOrderId}
                    {item.paymentId ? ` · Payment ${item.paymentId}` : ''}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                  <div className="text-right mr-2">
                    <div className="text-sm font-semibold text-slate-900">{money(item.amount, item.currency)}</div>
                    <Link href={`/admin/jobs/${item.jobId}`} className="text-xs text-amber-700 hover:text-amber-800">
                      Open Job 360
                    </Link>
                  </div>

                  {canManage && item.status === 'REFUND_REQUIRED' && (
                    <button
                      type="button"
                      disabled={acting === item.id}
                      onClick={() => act(item, 'RETRY')}
                      className="inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-slate-950 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      <FiRotateCw size={13} /> Submit refund
                    </button>
                  )}

                  {canManage && item.status === 'REFUND_PROCESSING' && (
                    <button
                      type="button"
                      disabled={acting === item.id}
                      onClick={() => act(item, 'RECONCILE')}
                      className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-50"
                    >
                      <FiRefreshCw size={13} /> Reconcile
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <FiAlertTriangle className="mx-auto text-slate-300" size={28} />
            <div className="mt-3 text-sm font-semibold text-slate-700">No refunds in this view</div>
            <div className="mt-1 text-xs text-slate-400">PayHere refunds requiring attention will appear here.</div>
          </div>
        )}
      </section>

      {!canManage && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Your finance role can view refund status but cannot submit or reconcile gateway refunds.
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value.toLocaleString()}</div>
    </div>
  )
}
