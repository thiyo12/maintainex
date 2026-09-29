'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiAlertTriangle,
  FiArrowUpRight,
  FiFileText,
  FiFlag,
  FiRefreshCw,
  FiShield,
  FiUserCheck,
} from 'react-icons/fi'

interface Payload {
  permissions: {
    kyc: boolean
    disputes: boolean
    risk: boolean
    cheating: boolean
    security: boolean
  }
  metrics: {
    pendingKyc: number
    rejectedKyc: number
    openDisputes: number
    pendingCheating: number
    pendingRisk: number
    highRisk: number
    suspiciousLogins: number
  }
  recent: {
    risk: any[]
    disputes: any[]
    cheating: any[]
    kyc: any[]
  }
}

function date(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })
}

function badge(value?: string) {
  const v = String(value || '').toUpperCase()
  if (['HIGH', 'CRITICAL', 'OPEN', 'REJECTED', 'CONFIRMED'].includes(v)) return 'bg-red-50 text-red-700 border-red-200'
  if (['PENDING', 'UNDER_REVIEW', 'MEDIUM'].includes(v)) return 'bg-amber-50 text-amber-700 border-amber-200'
  if (['APPROVED', 'RESOLVED', 'DISMISSED', 'LOW'].includes(v)) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  return 'bg-slate-50 text-slate-600 border-slate-200'
}

export default function TrustSafetyControlCentrePage() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/trust-safety/overview', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Unable to load trust & safety')
      setData(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load trust & safety')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-24 rounded-2xl bg-white border border-slate-200" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[0,1,2,3].map(item => <div key={item} className="h-28 rounded-2xl bg-white border border-slate-200" />)}
        </div>
        <div className="h-[500px] rounded-2xl bg-white border border-slate-200" />
      </div>
    )
  }

  if (!data) return null

  const urgent =
    data.metrics.highRisk +
    data.metrics.openDisputes +
    data.metrics.pendingCheating +
    data.metrics.suspiciousLogins

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-amber-600 font-semibold">Marketplace protection</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-slate-950">Trust & Safety Control Centre</h1>
          <p className="mt-1.5 text-sm text-slate-500">KYC, disputes, risk, off-platform behavior and account security in one operator workspace.</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50">
          <FiRefreshCw size={15} /> Refresh
        </button>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric icon={FiAlertTriangle} label="Urgent signals" value={urgent} detail="High risk, disputes, cheating, suspicious logins" danger={urgent > 0} />
        <Metric icon={FiUserCheck} label="Pending KYC" value={data.metrics.pendingKyc} detail={`${data.metrics.rejectedKyc} rejected documents`} />
        <Metric icon={FiFlag} label="Open disputes" value={data.metrics.openDisputes} detail="Open / under review" />
        <Metric icon={FiShield} label="Pending risk events" value={data.metrics.pendingRisk} detail={`${data.metrics.highRisk} high or critical`} danger={data.metrics.highRisk > 0} />
      </section>

      <section className="grid md:grid-cols-2 xl:grid-cols-5 gap-3">
        {data.permissions.kyc && <Quick href="/admin/kyc" icon={FiUserCheck} label="KYC queue" />}
        {data.permissions.disputes && <Quick href="/admin/jobs/disputes" icon={FiFlag} label="Dispute queue" />}
        {data.permissions.risk && <Quick href="/admin/trust-safety/risk-events" icon={FiShield} label="Risk events" />}
        {data.permissions.cheating && <Quick href="/admin/cheating" icon={FiAlertTriangle} label="Off-platform reports" />}
        {data.permissions.security && <Quick href="/admin/analytics/security-monitor" icon={FiShield} label="Security monitor" />}
      </section>

      <section className="grid xl:grid-cols-2 gap-5">
        {data.permissions.risk && (
          <Panel title="Recent marketplace risk" subtitle="Anti-bypass and abnormal-behavior signals">
            {data.recent.risk.length ? data.recent.risk.map(item => (
              <Link key={item.id} href={item.job?.id ? `/admin/jobs/${item.job.id}` : '/admin/trust-safety/risk-events'} className="mb-2 last:mb-0 flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-800">{item.eventType.replaceAll('_', ' ')}</div>
                  <div className="text-xs text-slate-400 mt-1">{item.job?.title || 'No job link'} · {date(item.createdAt)}</div>
                </div>
                <Status value={item.severity} />
              </Link>
            )) : <Empty text="No risk events are available in this market." />}
          </Panel>
        )}

        {data.permissions.disputes && (
          <Panel title="Recent disputes" subtitle="Customer/provider dispute workload">
            {data.recent.disputes.length ? data.recent.disputes.map(item => (
              <Link key={item.id} href={item.job?.id ? `/admin/jobs/${item.job.id}` : '/admin/jobs/disputes'} className="mb-2 last:mb-0 flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-800">{item.reason}</div>
                  <div className="text-xs text-slate-400 mt-1">{item.raisedBy?.name || 'User'} · {date(item.createdAt)}</div>
                </div>
                <Status value={item.status} />
              </Link>
            )) : <Empty text="No disputes are available in this market." />}
          </Panel>
        )}

        {data.permissions.cheating && (
          <Panel title="Off-platform reports" subtitle="Cheating / bypass reports">
            {data.recent.cheating.length ? data.recent.cheating.map(item => (
              <Link key={item.id} href="/admin/cheating" className="mb-2 last:mb-0 flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-800">{item.againstUserType} report</div>
                  <div className="text-xs text-slate-400 mt-1">{item.evidence.slice(0, 80)}{item.evidence.length > 80 ? '…' : ''}</div>
                </div>
                <Status value={item.status} />
              </Link>
            )) : <Empty text="No off-platform reports are available." />}
          </Panel>
        )}

        {data.permissions.kyc && (
          <Panel title="Recent KYC" subtitle="Latest identity document submissions">
            {data.recent.kyc.length ? data.recent.kyc.map(item => (
              <Link key={item.id} href={`/admin/users/${item.userId}`} className="mb-2 last:mb-0 flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-800">{item.user?.name || item.fullName || 'User'}</div>
                  <div className="text-xs text-slate-400 mt-1">{item.docType} · {item.side} · {date(item.createdAt)}</div>
                </div>
                <Status value={item.status} />
              </Link>
            )) : <Empty text="No identity-document activity is available." />}
          </Panel>
        )}
      </section>

      {data.permissions.security && (
        <section className="rounded-2xl border border-slate-200 bg-[#10151d] text-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.14em] text-amber-300 font-semibold">Security posture</div>
              <h2 className="mt-1 text-lg font-semibold">Suspicious logins in last 24 hours</h2>
              <p className="mt-1 text-sm text-slate-400">Credential and device monitoring remains available in the dedicated security monitor.</p>
            </div>
            <div className="text-3xl font-semibold text-amber-300">{data.metrics.suspiciousLogins}</div>
          </div>
          <Link href="/admin/analytics/security-monitor" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-300">
            Open security monitor <FiArrowUpRight size={14} />
          </Link>
        </section>
      )}
    </div>
  )
}

function Metric({ icon: Icon, label, value, detail, danger = false }: { icon: any; label: string; value: number; detail: string; danger?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">{label}</div>
          <div className={`mt-2 text-2xl font-semibold ${danger ? 'text-red-700' : 'text-slate-950'}`}>{value.toLocaleString()}</div>
          <div className="mt-1 text-[11px] text-slate-400">{detail}</div>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${danger ? 'bg-red-50 text-red-600' : 'bg-slate-950 text-amber-300'}`}>
          <Icon size={16} />
        </div>
      </div>
    </div>
  )
}

function Quick({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <Link href={href} className="rounded-xl border border-slate-200 bg-white px-3 py-3 flex items-center justify-between gap-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
      <span className="flex items-center gap-2"><Icon size={15} className="text-slate-400" />{label}</span>
      <FiArrowUpRight size={13} className="text-slate-400" />
    </Link>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="text-xs text-slate-400 mt-1 mb-4">{subtitle}</p>
      {children}
    </section>
  )
}

function Status({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge(value)}`}>{String(value).replaceAll('_', ' ')}</span>
}

function Empty({ text }: { text: string }) {
  return <div className="py-6 text-center text-sm text-slate-400">{text}</div>
}
