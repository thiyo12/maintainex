'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiArrowUpRight,
  FiGlobe,
  FiGrid,
  FiRefreshCw,
  FiTag,
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import {
  CrmBadge,
  CrmButton,
  CrmCard,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
} from '@/components/crm/v2/CrmPrimitives'
import PlatformRuntimeControls from '@/components/crm/v2/PlatformRuntimeControls'

interface Overview {
  catalog: {
    categories: { active: number; inactive: number }
    services: { active: number; inactive: number; trending: number }
  }
  offers: {
    activeSeasonal: number
    activeFlash: number
  }
  scope: {
    superAdmin: boolean
    countries: string[]
  }
}

export default function WebsiteManagementPage() {
  const { user } = useAdminSession()
  const canViewPlatform = Boolean(user?.permissions?.includes('platform:settings:view'))
  const canViewCatalog = Boolean(user?.permissions?.includes('catalog:view'))
  const canViewPromotions = Boolean(user?.permissions?.includes('promotions:view'))

  const [overview, setOverview] = useState<Overview | null>(null)
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
      if (!response.ok) throw new Error(body?.error || 'Unable to load website operations')
      setOverview(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load website operations')
      setOverview(null)
    } finally {
      setLoading(false)
    }
  }, [canViewPlatform])

  useEffect(() => {
    load()
  }, [load])

  if (!canViewPlatform && user) {
    return (
      <CrmState
        type="permission"
        title="Website operations access required"
        description="Your current staff permissions do not allow the App & Web operational overview."
      />
    )
  }

  if (loading) {
    return (
      <CrmState
        type="loading"
        title="Loading website operations"
        description="Loading real catalog and promotion state used by MaintainEX public surfaces."
      />
    )
  }

  if (!overview) {
    return (
      <CrmState
        type="error"
        title="Website operations unavailable"
        description="The public-surface operational overview could not be loaded."
        action={
          <CrmButton variant="secondary" onClick={load}>
            <FiRefreshCw size={14} />
            Retry
          </CrmButton>
        }
      />
    )
  }

  const totalActive =
    overview.catalog.categories.active +
    overview.catalog.services.active +
    overview.offers.activeSeasonal +
    overview.offers.activeFlash

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="App & Web · Public surface"
        title="Website management"
        description="Operate public catalog and promotion data that the platform actually stores and serves. Unsupported runtime switches are intentionally excluded."
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
            <CrmBadge tone="success" dot>Real operational data</CrmBadge>
            <CrmBadge tone="info">
              {overview.scope.superAdmin
                ? 'All markets'
                : overview.scope.countries.join(', ') || 'No market scope'}
            </CrmBadge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CrmMetricCard
          label="Active categories"
          value={overview.catalog.categories.active.toLocaleString()}
          helper={`${overview.catalog.categories.inactive} inactive`}
          icon={<FiGrid size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="Active services"
          value={overview.catalog.services.active.toLocaleString()}
          helper={`${overview.catalog.services.trending} trending`}
          icon={<FiGlobe size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="Seasonal offers"
          value={overview.offers.activeSeasonal.toLocaleString()}
          helper="Currently active"
          icon={<FiTag size={16} />}
          tone="amber"
        />
        <CrmMetricCard
          label="Public active items"
          value={totalActive.toLocaleString()}
          helper={`${overview.offers.activeFlash} active flash offers`}
          icon={<FiArrowUpRight size={16} />}
          tone="neutral"
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <CrmCard
          title="Services & categories"
          description="Create drafts and publish market-scoped catalog entries through the governed catalog workspace."
          action={<FiGrid size={18} className="text-amber-600" />}
        >
          <div className="grid grid-cols-2 gap-3">
            <Summary
              label="Categories"
              primary={overview.catalog.categories.active}
              secondary={overview.catalog.categories.inactive}
            />
            <Summary
              label="Services"
              primary={overview.catalog.services.active}
              secondary={overview.catalog.services.inactive}
            />
          </div>

          {canViewCatalog && (
            <Link
              href="/admin/platform/catalog"
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-[11px] bg-[var(--crm-accent)] px-4 text-sm font-semibold text-[#151719] hover:bg-[#ffc84a]"
            >
              Open catalog
              <FiArrowUpRight size={14} />
            </Link>
          )}
        </CrmCard>

        <CrmCard
          title="Offers & promotions"
          description="Manage real seasonal and flash promotion records with market and owner controls."
          action={<FiTag size={18} className="text-amber-600" />}
        >
          <div className="grid grid-cols-2 gap-3">
            <Summary
              label="Seasonal"
              primary={overview.offers.activeSeasonal}
              secondary={0}
              secondaryLabel="active"
            />
            <Summary
              label="Flash"
              primary={overview.offers.activeFlash}
              secondary={0}
              secondaryLabel="live"
            />
          </div>

          {canViewPromotions && (
            <Link
              href="/admin/platform/offers"
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-[11px] border border-[var(--crm-border)] bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open promotions
              <FiArrowUpRight size={14} />
            </Link>
          )}
        </CrmCard>
      </section>

      <PlatformRuntimeControls surface="website" />

      <CrmCard
        title="Website booking runtime boundary"
        description="Website availability, maintenance, catalog, offers, operational banners and market availability are wired to the live public runtime. Public booking remains separately design-gated."
        action={<CrmBadge tone="warning">Phase 10</CrmBadge>}
      >
        <div className="flex gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--crm-warning-soft)] text-[var(--crm-warning)]">
            <FiAlertTriangle size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">
              No fake maintenance or website-booking switch
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              The public website now consumes the approved runtime controls for availability, maintenance, catalog visibility, offers, operational banners and market availability. Public booking is intentionally hard-locked off until the website-booking UX gate is approved; no CRM switch can bypass that gate.
            </p>
          </div>
        </div>
      </CrmCard>
    </div>
  )
}

function Summary({
  label,
  primary,
  secondary,
  secondaryLabel = 'inactive',
}: {
  label: string
  primary: number
  secondary: number
  secondaryLabel?: string
}) {
  return (
    <div className="rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
        {primary.toLocaleString()}
      </div>
      <div className="mt-1 text-[11px] text-slate-400">
        {secondary.toLocaleString()} {secondaryLabel}
      </div>
    </div>
  )
}
