'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowUpRight,
  FiBell,
  FiCreditCard,
  FiGrid,
  FiMonitor,
  FiMapPin,
  FiRefreshCw,
  FiSettings,
  FiShield,
  FiSliders,
  FiSmartphone,
  FiTag,
  FiUserCheck,
} from 'react-icons/fi'
import {
  CrmBadge,
  CrmButton,
  CrmCard,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
} from '@/components/crm/v2/CrmPrimitives'
import { crmApiError } from '@/lib/crm/api-error'

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
    marketConfigs: unknown[]
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
      if (!response.ok) crmApiError(body, 'Unable to load platform management')
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

  const moduleCards = useMemo(() => {
    const settings = data?.settings || {}
    const maintenance = Boolean(settings.maintenanceMode?.value)
    const deviceCount = (data?.mobile.devices || []).reduce((sum, row) => sum + row.count, 0)

    return [
      { title: 'Website management', description: 'Public booking, service visibility and operational website controls.', icon: FiMonitor, href: '/admin/platform/website', detail: maintenance ? 'Maintenance mode ON' : 'Public access active', alert: maintenance },
      { title: 'Mobile app management', description: 'Marketplace templates, market configuration and mobile footprint.', icon: FiSmartphone, href: '/admin/platform/mobile', detail: `${data?.catalog.serviceTemplates.active || 0} active templates · ${deviceCount} devices` },
      { title: 'Services & catalog', description: 'Canonical service categories, templates, skills and channel visibility.', icon: FiGrid, href: '/admin/platform/catalog', detail: `${data?.catalog.services.active || 0} services · ${data?.catalog.categories.active || 0} categories` },
      { title: 'Offers & promotions', description: 'Seasonal and flash campaigns with market/channel controls.', icon: FiTag, href: '/admin/platform/offers', detail: `${data?.offers.activeSeasonal || 0} seasonal · ${data?.offers.activeFlash || 0} flash` },
      { title: 'Subscriptions', description: 'Market-scoped company plans, lifecycle visibility and immutable price snapshots.', icon: FiCreditCard, href: '/admin/platform/subscriptions', detail: 'Company subscription control' },
      { title: 'Notifications', description: 'Operational alerts, user messaging and controlled broadcasts.', icon: FiBell, href: '/admin/platform/notifications', detail: 'Notification operations' },
      { title: 'Market & pricing', description: 'Country availability, currencies, limits and pricing configuration.', icon: FiSliders, href: '/admin/pricing/market-config', detail: `${data?.mobile.marketConfigs.length || 0} market configs` },
      { title: 'Locations & coverage', description: 'Canonical countries, provinces, cities and service areas used by booking.', icon: FiMapPin, href: '/admin/platform/locations', detail: 'Database-backed location hierarchy' },
      { title: 'Staff control', description: 'Staff accounts, granular permissions, sessions and market scope.', icon: FiUserCheck, href: '/admin/admins', detail: 'Governed staff administration' },
      { title: 'Platform settings', description: 'Privileged operational configuration with audit protection.', icon: FiSettings, href: '/admin/settings', detail: 'Audited configuration' },
    ]
  }, [data])

  if (loading) {
    return <CrmState type="loading" title="Loading App & Web control plane" description="Loading canonical settings, catalog, offers, market configuration and mobile state." />
  }

  if (!data) {
    return (
      <CrmState
        type="error"
        title="App & Web controls unavailable"
        description="The platform control plane could not be loaded for this staff session."
        action={<CrmButton variant="secondary" onClick={load}><FiRefreshCw size={14} />Retry</CrmButton>}
      />
    )
  }

  const maintenance = Boolean(data.settings.maintenanceMode?.value)
  const activeOffers = data.offers.activeSeasonal + data.offers.activeFlash

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="Control plane"
        title="App & Web"
        description="Operate the website, mobile marketplace and shared platform configuration from one governed control surface."
        actions={<CrmButton variant="secondary" onClick={load}><FiRefreshCw size={14} />Refresh state</CrmButton>}
        context={
          <>
            <CrmBadge tone="success" dot>3-layer protected</CrmBadge>
            <CrmBadge tone={maintenance ? 'danger' : 'success'} dot>{maintenance ? 'Maintenance mode' : 'Public access active'}</CrmBadge>
            <CrmBadge tone="info">{data.scope.superAdmin ? 'All markets' : data.scope.countries.join(', ') || 'No market assigned'}</CrmBadge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CrmMetricCard label="Active website services" value={data.catalog.services.active.toLocaleString()} helper={`${data.catalog.services.trending} trending`} icon={<FiMonitor size={16} />} tone="success" />
        <CrmMetricCard label="Marketplace templates" value={data.catalog.serviceTemplates.active.toLocaleString()} helper={`${data.catalog.serviceTemplates.inactive} inactive`} icon={<FiSmartphone size={16} />} tone="info" />
        <CrmMetricCard label="Active offers" value={activeOffers.toLocaleString()} helper="Seasonal + flash" icon={<FiTag size={16} />} tone="amber" />
        <CrmMetricCard label="Product backlog" value={data.backlog.activeWishlist.toLocaleString()} helper="Planned / in progress" icon={<FiGrid size={16} />} tone="neutral" />
      </section>

      <CrmCard title="Management modules" description="Each module controls or observes a real runtime-backed MaintainEX capability." action={<FiShield size={18} className="text-emerald-600" />} padding="md">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {moduleCards.map(module => (
            <Link key={module.title} href={module.href} className="group h-full">
              <div className="crm-subtle-card h-full p-4 transition-all group-hover:border-[var(--crm-border-strong)] group-hover:bg-white group-hover:shadow-[var(--crm-shadow-card)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#17191b] text-[var(--crm-accent)]"><module.icon size={17} /></div>
                  <FiArrowUpRight className="text-slate-300 transition-colors group-hover:text-slate-700" size={15} />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-950">{module.title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-slate-500">{module.description}</p>
                <div className="mt-4 border-t border-[var(--crm-border)] pt-3">
                  <CrmBadge tone={module.alert ? 'danger' : 'neutral'} dot={Boolean(module.alert)}>{module.detail}</CrmBadge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CrmCard>
    </div>
  )
}
