'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowLeft,
  FiArrowUpRight,
  FiGrid,
  FiMapPin,
  FiRefreshCw,
  FiSettings,
  FiSmartphone,
} from 'react-icons/fi'

interface Payload {
  scope: { superAdmin: boolean; countries: string[] }
  catalog: {
    serviceTemplates: { active: number; inactive: number }
    recentTemplates: any[]
  }
  mobile: {
    marketConfigs: any[]
    devices: Array<{ platform: string; count: number }>
  }
}

function minor(value: string | number, currency: string) {
  const amount = Number(value || 0) / 100
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export default function MobileManagementPage() {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/platform/overview', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Unable to load mobile management')
      setData(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load mobile management')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="h-[520px] rounded-2xl border border-slate-200 bg-white animate-pulse" />

  const totalDevices = (data?.mobile.devices || []).reduce((sum, row) => sum + row.count, 0)

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/admin/platform" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
            <FiArrowLeft size={15}/> Platform management
          </Link>
          <div className="mt-3 text-xs uppercase tracking-[0.16em] text-amber-600 font-semibold">Mobile surfaces</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-slate-950">Mobile App Management</h1>
          <p className="mt-1.5 text-sm text-slate-500">Operational visibility for customer, tasker and company mobile experiences.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50">
          <FiRefreshCw size={15}/> Refresh
        </button>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric label="Active service templates" value={data?.catalog.serviceTemplates.active || 0} detail="Available to marketplace booking" />
        <Metric label="Inactive templates" value={data?.catalog.serviceTemplates.inactive || 0} detail="Hidden from marketplace" />
        <Metric label="Registered devices" value={totalDevices} detail="Stored user-device records" />
        <Metric label="Market configs" value={data?.mobile.marketConfigs.length || 0} detail={data?.scope.superAdmin ? 'All visible configs' : data?.scope.countries.join(', ') || 'No market'} />
      </section>

      <section className="grid xl:grid-cols-2 gap-5">
        <Panel title="Market configuration" subtitle="Canonical country-level limits consumed by marketplace logic.">
          {data?.mobile.marketConfigs.length ? (
            <div className="space-y-3">
              {data.mobile.marketConfigs.map(config => (
                <div key={config.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FiMapPin className="text-amber-600" size={15}/>
                      <div className="font-semibold text-slate-900">{config.countryCode}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-full border ${config.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                      {config.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <Info label="Currency" value={config.currency}/>
                    <Info label="Commission" value={`${config.commissionBps / 100}%`}/>
                    <Info label="Minimum job" value={minor(config.minJobAmountCents, config.currency)}/>
                    <Info label="Maximum job" value={minor(config.maxJobAmountCents, config.currency)}/>
                  </div>
                </div>
              ))}
              <Link href="/admin/pricing/market-config" className="inline-flex items-center gap-1 text-sm font-medium text-amber-700">
                Open market configuration <FiArrowUpRight size={14}/>
              </Link>
            </div>
          ) : <Empty text="No market configuration is visible for this staff scope."/>}
        </Panel>

        <Panel title="Device footprint" subtitle="Registered mobile devices by platform.">
          {data?.mobile.devices.length ? (
            <div className="grid grid-cols-2 gap-3">
              {data.mobile.devices.map(row => (
                <div key={row.platform} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <FiSmartphone className="text-slate-500" size={17}/>
                  <div className="mt-3 text-xl font-semibold text-slate-950">{row.count.toLocaleString()}</div>
                  <div className="mt-1 text-xs text-slate-400">{row.platform}</div>
                </div>
              ))}
            </div>
          ) : <Empty text="No registered mobile-device records are visible."/>}
        </Panel>
      </section>

      <Panel title="Recent marketplace service templates" subtitle="The booking templates actually powering the V2 service experience.">
        {data?.catalog.recentTemplates.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-[0.1em] text-slate-400 border-b border-slate-100">
                <th className="pb-3">Template</th><th className="pb-3">Category</th><th className="pb-3">Market</th><th className="pb-3">Pricing</th><th className="pb-3">Range</th><th className="pb-3">State</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.catalog.recentTemplates.map(template=>(
                  <tr key={template.id}>
                    <td className="py-3"><div className="font-medium text-slate-800">{template.name}</div><div className="text-xs text-slate-400">{template.slug}</div></td>
                    <td className="py-3 text-slate-600">{template.jobCategory?.name || '—'}</td>
                    <td className="py-3 text-slate-600">{template.countryCode}</td>
                    <td className="py-3 text-slate-600">{template.pricingMode.replaceAll('_',' ')}</td>
                    <td className="py-3 text-slate-600">{template.currency} {template.priceMin}–{template.priceMax}</td>
                    <td className="py-3"><span className={`text-[10px] px-2 py-1 rounded-full border ${template.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{template.isActive?'ACTIVE':'INACTIVE'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty text="No marketplace service templates are visible."/>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/admin/platform/catalog" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-950 text-white text-sm font-medium"><FiGrid/> Open catalog management</Link>
          <Link href="/admin/settings" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium"><FiSettings/> Platform settings</Link>
        </div>
      </Panel>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        Release-version switches are intentionally not shown here because the current mobile runtime does not expose a verified server-consumed version-control setting. The CRM does not pretend to control features the app does not actually read.
      </div>
    </div>
  )
}

function Metric({label,value,detail}:{label:string;value:number;detail:string}) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold text-slate-950">{value.toLocaleString()}</div><div className="mt-1 text-[11px] text-slate-400">{detail}</div></div>
}
function Panel({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">{title}</h2><p className="text-xs text-slate-400 mt-1 mb-4">{subtitle}</p>{children}</section>
}
function Info({label,value}:{label:string;value:React.ReactNode}) {
  return <div><div className="text-[11px] uppercase tracking-[0.1em] text-slate-400">{label}</div><div className="mt-1 text-slate-700">{value}</div></div>
}
function Empty({text}:{text:string}){return <div className="py-8 text-center text-sm text-slate-400">{text}</div>}
