'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import {
  CrmBadge,
  CrmButton,
  CrmCard,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  CrmTableFrame,
  crmTableClass,
  crmTdClass,
  crmThClass,
} from '@/components/crm/v2/CrmPrimitives'
import PlatformRuntimeControls from '@/components/crm/v2/PlatformRuntimeControls'
import { crmApiError } from '@/lib/crm/api-error'

interface MarketRow {
  id: string
  countryCode: string
  currency: string
  commissionBps: number
  minJobAmountCents: string | number
  maxJobAmountCents: string | number
}

interface TemplateRow {
  id: string
  name: string
  slug: string
  countryCode: string
  isActive: boolean
  pricingMode: string
  priceMin?: number | null
  priceMax?: number | null
  currency?: string | null
  jobCategory?: { id: string; name: string } | null
}

interface Payload {
  scope: { superAdmin: boolean; countries: string[] }
  catalog: {
    serviceTemplates: { active: number; inactive: number }
    recentTemplates: TemplateRow[]
  }
  mobile: {
    marketConfigs: MarketRow[]
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
  const { user } = useAdminSession()
  const canViewPlatform = Boolean(user?.permissions?.includes('platform:settings:view'))
  const canViewCatalog = Boolean(user?.permissions?.includes('catalog:view'))
  const canViewMarkets = Boolean(user?.permissions?.includes('markets:view'))

  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!canViewPlatform) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/platform/overview', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Unable to load mobile management')
      setData(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load mobile management')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [canViewPlatform])

  useEffect(() => {
    load()
  }, [load])

  const totalDevices = useMemo(
    () => (data?.mobile.devices || []).reduce((sum, row) => sum + row.count, 0),
    [data]
  )

  if (!canViewPlatform && user) {
    return (
      <CrmState
        type="permission"
        title="Mobile operations access required"
        description="Your current staff permissions do not allow the App & Web operational overview."
      />
    )
  }

  if (loading) {
    return (
      <CrmState
        type="loading"
        title="Loading mobile operations"
        description="Loading marketplace templates, mobile device footprint and market configuration."
      />
    )
  }

  if (!data) {
    return (
      <CrmState
        type="error"
        title="Mobile operations unavailable"
        description="The operational overview could not be loaded for the current staff session."
        action={
          <CrmButton variant="secondary" onClick={load}>
            <FiRefreshCw size={14} />
            Retry
          </CrmButton>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="App & Web · Mobile surfaces"
        title="Mobile app management"
        description="Operational visibility for customer, tasker and company app experiences using server-consumed catalog and market data."
        actions={
          <CrmButton variant="secondary" onClick={load}>
            <FiRefreshCw size={14} />
            Refresh
          </CrmButton>
        }
        context={
          <>
            <Link
              href="/admin/platform"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              <FiArrowLeft size={12} />
              App & Web
            </Link>
            <CrmBadge tone="success" dot>Observed runtime data</CrmBadge>
            <CrmBadge tone="info">
              {data.scope.superAdmin ? 'All markets' : data.scope.countries.join(', ') || 'No market scope'}
            </CrmBadge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CrmMetricCard
          label="Active templates"
          value={data.catalog.serviceTemplates.active.toLocaleString()}
          helper="Available to marketplace booking"
          icon={<FiGrid size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="Inactive templates"
          value={data.catalog.serviceTemplates.inactive.toLocaleString()}
          helper="Not currently active"
          icon={<FiGrid size={16} />}
          tone="neutral"
        />
        <CrmMetricCard
          label="Registered devices"
          value={totalDevices.toLocaleString()}
          helper="Stored user-device records"
          icon={<FiSmartphone size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="Market configs"
          value={data.mobile.marketConfigs.length.toLocaleString()}
          helper="Visible canonical configs"
          icon={<FiMapPin size={16} />}
          tone="amber"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <CrmCard
          title="Market configuration"
          description="Country-level pricing and marketplace limits consumed by server-side marketplace logic."
          action={canViewMarkets ? <CrmBadge tone="success">Market access</CrmBadge> : <CrmBadge>Read only</CrmBadge>}
        >
          {data.mobile.marketConfigs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No market configuration is visible for this staff scope.
            </div>
          ) : (
            <div className="space-y-3">
              {data.mobile.marketConfigs.map(config => (
                <div
                  key={config.id}
                  className="rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FiMapPin className="text-amber-600" size={15} />
                      <div className="text-sm font-semibold text-slate-900">{config.countryCode}</div>
                    </div>
                    <CrmBadge tone="success" dot>CONFIGURED</CrmBadge>
                  </div>

                  <div className="mt-3.5 grid grid-cols-2 gap-3 text-sm">
                    <Info label="Currency" value={config.currency} />
                    <Info label="Commission" value={`${config.commissionBps / 100}%`} />
                    <Info label="Minimum job" value={minor(config.minJobAmountCents, config.currency)} />
                    <Info label="Maximum job" value={minor(config.maxJobAmountCents, config.currency)} />
                  </div>
                </div>
              ))}

              {canViewMarkets && (
                <Link
                  href="/admin/pricing/market-config"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
                >
                  Open market configuration
                  <FiArrowUpRight size={13} />
                </Link>
              )}
            </div>
          )}
        </CrmCard>

        <CrmCard
          title="Device footprint"
          description="Registered user-device records grouped by platform."
          action={<FiSmartphone size={17} className="text-slate-400" />}
        >
          {data.mobile.devices.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No registered mobile-device records are visible.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {data.mobile.devices.map(row => (
                <div
                  key={row.platform}
                  className="rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-4"
                >
                  <FiSmartphone className="text-slate-500" size={17} />
                  <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    {row.count.toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{row.platform}</div>
                </div>
              ))}
            </div>
          )}
        </CrmCard>
      </section>

      {data.catalog.recentTemplates.length === 0 ? (
        <CrmState
          type="empty"
          title="No service templates"
          description="No marketplace service templates are visible to this staff scope."
        />
      ) : (
        <CrmTableFrame
          title="Recent marketplace service templates"
          description="Booking templates that power the V2 marketplace experience."
          action={<CrmBadge tone="neutral">{data.catalog.recentTemplates.length} shown</CrmBadge>}
        >
          <table className={crmTableClass}>
            <thead>
              <tr>
                <th className={crmThClass}>Template</th>
                <th className={crmThClass}>Category</th>
                <th className={crmThClass}>Market</th>
                <th className={crmThClass}>Pricing</th>
                <th className={crmThClass}>Range</th>
                <th className={crmThClass}>State</th>
              </tr>
            </thead>
            <tbody>
              {data.catalog.recentTemplates.map(template => (
                <tr key={template.id} className="hover:bg-slate-50/70">
                  <td className={crmTdClass}>
                    <div className="font-semibold text-slate-900">{template.name}</div>
                    <div className="mt-1 text-[11px] text-slate-400">{template.slug}</div>
                  </td>
                  <td className={crmTdClass}>{template.jobCategory?.name || '—'}</td>
                  <td className={crmTdClass}><CrmBadge tone="info">{template.countryCode}</CrmBadge></td>
                  <td className={crmTdClass}>{template.pricingMode.replaceAll('_', ' ')}</td>
                  <td className={crmTdClass}>
                    {template.currency || '—'} {template.priceMin ?? '—'}–{template.priceMax ?? '—'}
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge tone={template.isActive ? 'success' : 'neutral'} dot>
                      {template.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </CrmBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CrmTableFrame>
      )}

      <PlatformRuntimeControls surface="mobile" />

      <CrmCard
        title="Runtime-control boundary"
        description="The CRM only exposes mobile controls that the application actually consumes."
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="max-w-3xl text-sm leading-6 text-slate-500">
            Release-version switches and arbitrary feature toggles are intentionally absent because the current mobile runtime has no verified server-consumed control for them. Source-code defects and new mobile capabilities remain deployment work.
          </p>
          <div className="flex flex-wrap gap-2">
            {canViewCatalog && (
              <Link
                href="/admin/platform/catalog"
                className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-[var(--crm-accent)] px-4 text-sm font-semibold text-[#151719] hover:bg-[#ffc84a]"
              >
                <FiGrid size={14} />
                Catalog
              </Link>
            )}
            <Link
              href="/admin/settings"
              className="inline-flex h-10 items-center gap-2 rounded-[11px] border border-[var(--crm-border)] bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FiSettings size={14} />
              Platform settings
            </Link>
          </div>
        </div>
      </CrmCard>
    </div>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-700">{value}</div>
    </div>
  )
}
