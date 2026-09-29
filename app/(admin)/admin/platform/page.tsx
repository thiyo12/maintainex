'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowUpRight,
  FiBell,
  FiGlobe,
  FiGrid,
  FiMonitor,
  FiRefreshCw,
  FiSettings,
  FiShield,
  FiSliders,
  FiSmartphone,
  FiTag,
  FiUserCheck,
} from 'react-icons/fi'

interface PlatformPayload {
  scope: { superAdmin: boolean; countries: string[] }
  settings: Record<string, { value: unknown }>
  catalog: {
    categories: { active: number; inactive: number }
    services: { active: number; inactive: number; trending: number }
    serviceTemplates: { active: number; inactive: number }
  }
  offers: {
    seasonal: number
    activeSeasonal: number
    activeFlash: number
  }
  mobile: {
    marketConfigs: any[]
    devices: Array<{ platform: string; count: number }>
  }
  backlog: { activeWishlist: number }
}

export default function PlatformManagementPage() {
  const [data, setData] = useState<PlatformPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/platform/overview', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Unable to load platform management')
      setData(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load platform management')
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
        <div className="h-40 rounded-2xl bg-[#10151d]" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[0,1,2,3].map(item => <div key={item} className="h-28 rounded-2xl bg-white border border-slate-200" />)}
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0,1,2,3,4,5,6,7].map(item => <div key={item} className="h-48 rounded-2xl bg-white border border-slate-200" />)}
        </div>
      </div>
    )
  }

  const settings = data?.settings || {}
  const maintenance = Boolean(settings.maintenanceMode?.value)
  const deviceCount = (data?.mobile.devices || []).reduce((sum, row) => sum + row.count, 0)

  const modules = [
    {
      title: 'Website management',
      description: 'Public-site operational settings, services and promotional content.',
      icon: FiMonitor,
      href: '/admin/platform/website',
      detail: maintenance ? 'Maintenance mode ON' : 'Public access active',
      alert: maintenance,
    },
    {
      title: 'Mobile app management',
      description: 'Marketplace templates, country configs and connected mobile footprint.',
      icon: FiSmartphone,
      href: '/admin/platform/mobile',
      detail: `${data?.catalog.serviceTemplates.active || 0} active templates · ${deviceCount} devices`,
    },
    {
      title: 'Services & categories',
      description: 'Website service catalog and marketplace service-template inventory.',
      icon: FiGrid,
      href: '/admin/platform/catalog',
      detail: `${data?.catalog.services.active || 0} services · ${data?.catalog.categories.active || 0} categories`,
    },
    {
      title: 'Offers & promotions',
      description: 'Seasonal and flash promotion inventory across MaintainEX surfaces.',
      icon: FiTag,
      href: '/admin/platform/offers',
      detail: `${data?.offers.activeSeasonal || 0} seasonal · ${data?.offers.activeFlash || 0} flash`,
    },
    {
      title: 'Notifications',
      description: 'Staff notifications and operational attention signals.',
      icon: FiBell,
      href: '/admin/platform/notifications',
      detail: 'Admin notification centre',
    },
    {
      title: 'Market & pricing',
      description: 'Country-level limits, currencies, pricing and marketplace operation.',
      icon: FiSliders,
      href: '/admin/pricing/market-config',
      detail: `${data?.mobile.marketConfigs.length || 0} market configs`,
    },
    {
      title: 'Admins & staff',
      description: 'Staff accounts, role permissions, country assignments and activity.',
      icon: FiUserCheck,
      href: '/admin/admins',
      detail: 'Role-aware staff administration',
    },
    {
      title: 'Platform settings',
      description: 'Commission, settlement, KYC, support and maintenance configuration.',
      icon: FiSettings,
      href: '/admin/settings',
      detail: 'Audited privileged settings',
    },
  ]

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-[#10151d] text-white overflow-hidden">
        <div className="p-6 md:p-7 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-amber-300 font-semibold">
              <FiGlobe size={14} />
              Platform management
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
              Website, mobile app and marketplace controls
            </h1>
            <p className="mt-2 text-sm md:text-base leading-6 text-slate-400">
              Live operational inventory backed by the same settings, catalog, offer and market configuration models used by MaintainEX.
            </p>
          </div>

          <div className="flex flex-col gap-2 min-w-[240px]">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <FiShield className="text-emerald-300" size={18} />
              <div>
                <div className="text-sm font-medium">3-layer protected</div>
                <div className="text-xs text-slate-500 mt-0.5">Writes are permission-gated and audited</div>
              </div>
            </div>
            <button onClick={load} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.08]">
              <FiRefreshCw size={14} /> Refresh platform state
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric label="Active website services" value={data?.catalog.services.active || 0} detail={`${data?.catalog.services.trending || 0} trending`} />
        <Metric label="Marketplace templates" value={data?.catalog.serviceTemplates.active || 0} detail={`${data?.catalog.serviceTemplates.inactive || 0} inactive`} />
        <Metric label="Active offers" value={(data?.offers.activeSeasonal || 0) + (data?.offers.activeFlash || 0)} detail="Seasonal + flash" />
        <Metric label="Product backlog" value={data?.backlog.activeWishlist || 0} detail="New / planned / in progress" />
      </section>

      <section>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Management modules</h2>
            <p className="text-sm text-slate-500 mt-1">Every module below now opens a real CRM management surface.</p>
          </div>
          <div className="text-xs text-slate-400">
            Scope: {data?.scope.superAdmin ? 'All markets' : data?.scope.countries.join(', ') || 'No market'}
          </div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {modules.map(module => (
            <Link key={module.title} href={module.href} className="group h-full">
              <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 transition-all group-hover:border-slate-300 group-hover:shadow-[0_12px_36px_-28px_rgba(15,23,42,0.35)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="w-11 h-11 rounded-xl bg-slate-950 text-amber-300 flex items-center justify-center">
                    <module.icon size={19} />
                  </div>
                  <FiArrowUpRight className="text-slate-300 group-hover:text-slate-600" size={16} />
                </div>
                <h3 className="mt-5 font-semibold text-slate-950">{module.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">{module.description}</p>
                <div className={`mt-4 pt-4 border-t border-slate-100 text-xs font-medium ${module.alert ? 'text-red-600' : 'text-slate-400'}`}>
                  {module.detail}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value.toLocaleString()}</div>
      <div className="mt-1 text-[11px] text-slate-400">{detail}</div>
    </div>
  )
}
