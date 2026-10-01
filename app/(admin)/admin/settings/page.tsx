'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiDollarSign,
  FiGlobe,
  FiRefreshCw,
  FiSettings,
  FiShield,
  FiTool,
  FiUsers,
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

interface SettingsPayload {
  settings: Record<string, string | number | boolean>
  definitions: Record<string, {
    type?: string
    label?: string
    description?: string
    groupName?: string
    updatedBy?: string | null
    updatedAt?: string | null
  }>
}

const OWNERSHIP: Record<string, {
  owner: string
  mode: 'metadata' | 'delegated'
  href?: string
  note: string
}> = {
  platformName: {
    owner: 'Platform metadata',
    mode: 'metadata',
    note: 'Stored CRM metadata. Not presented as a runtime branding switch until a consumer is wired.',
  },
  supportEmail: {
    owner: 'Platform metadata',
    mode: 'metadata',
    note: 'Stored support metadata. Public-surface wiring must be verified before treating it as runtime configuration.',
  },
  commissionRate: {
    owner: 'Finance / Market policy',
    mode: 'delegated',
    href: '/admin/pricing/market-config',
    note: 'Commission policy is governed through the canonical finance and market configuration path.',
  },
  currency: {
    owner: 'Market policy',
    mode: 'delegated',
    href: '/admin/pricing/market-config',
    note: 'Market currency belongs to canonical market configuration and financial snapshots.',
  },
  minTaskerStaff: {
    owner: 'Company / Trust policy',
    mode: 'delegated',
    href: '/admin/users/companies',
    note: 'Company eligibility belongs to company/KYC policy, not a generic settings toggle.',
  },
  weeklySettlementDay: {
    owner: 'Finance',
    mode: 'delegated',
    href: '/admin/financial',
    note: 'Settlement scheduling belongs to the canonical finance workflow.',
  },
  autoApproveKyc: {
    owner: 'Trust & Safety',
    mode: 'delegated',
    href: '/admin/kyc',
    note: 'KYC approval remains governed by the verification workflow. This stored legacy value is not a live bypass switch.',
  },
}

function displayValue(value: string | number | boolean) {
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled'
  return String(value)
}

export default function AdminSettingsPage() {
  const { user } = useAdminSession()
  const canView = Boolean(user?.permissions?.includes('platform:settings:view'))

  const [data, setData] = useState<SettingsPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/settings', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Unable to load settings registry')
      setData({
        settings: body.settings || {},
        definitions: body.definitions || {},
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load settings registry')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [canView])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const keys = Object.keys(data?.settings || {})
    return {
      total: keys.length,
      metadata: keys.filter(key => OWNERSHIP[key]?.mode === 'metadata').length,
      delegated: keys.filter(key => OWNERSHIP[key]?.mode === 'delegated').length,
    }
  }, [data])

  if (!canView && user) {
    return (
      <CrmState
        type="permission"
        title="Platform settings access required"
        description="Your current staff permissions do not allow this configuration registry."
      />
    )
  }

  if (loading) {
    return (
      <CrmState
        type="loading"
        title="Loading configuration registry"
        description="Loading stored platform metadata and canonical ownership information."
      />
    )
  }

  if (!data) {
    return (
      <CrmState
        type="error"
        title="Configuration registry unavailable"
        description="The settings registry could not be loaded for the current staff session."
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
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="Platform governance"
        title="Settings registry"
        description="See stored configuration values and the canonical module that owns each control. Generic settings are not allowed to bypass domain workflows."
        actions={
          <CrmButton variant="secondary" onClick={load}>
            <FiRefreshCw size={14} />
            Refresh
          </CrmButton>
        }
        context={
          <>
            <CrmBadge tone="success" dot>Canonical ownership enforced</CrmBadge>
            <CrmBadge tone="info">No fake runtime switches</CrmBadge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <CrmMetricCard
          label="Stored keys"
          value={counts.total.toLocaleString()}
          helper="Known settings registry entries"
          icon={<FiSettings size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="Metadata keys"
          value={counts.metadata.toLocaleString()}
          helper="Stored metadata, not runtime claims"
          icon={<FiGlobe size={16} />}
          tone="neutral"
        />
        <CrmMetricCard
          label="Delegated controls"
          value={counts.delegated.toLocaleString()}
          helper="Owned by domain modules"
          icon={<FiShield size={16} />}
          tone="amber"
        />
      </section>

      <CrmCard
        title="Configuration ownership"
        description="High-risk and runtime behavior belongs to canonical modules rather than one generic settings form."
        padding="none"
      >
        <div className="divide-y divide-[var(--crm-border)]">
          {Object.entries(data.settings).map(([key, value]) => {
            const definition = data.definitions[key] || {}
            const ownership = OWNERSHIP[key] || {
              owner: 'Unclassified metadata',
              mode: 'metadata' as const,
              note: 'This key is stored but has no verified runtime-control contract.',
            }

            return (
              <div
                key={key}
                className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    {definition.label || key}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {definition.description || key}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-slate-400">{key}</div>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Stored value
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800">
                    {displayValue(value)}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CrmBadge tone={ownership.mode === 'delegated' ? 'amber' : 'neutral'}>
                      {ownership.mode === 'delegated' ? 'DELEGATED' : 'METADATA'}
                    </CrmBadge>
                    <span className="text-xs font-semibold text-slate-700">{ownership.owner}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{ownership.note}</p>
                </div>

                <div className="lg:text-right">
                  {ownership.href ? (
                    <Link
                      href={ownership.href}
                      className="inline-flex h-9 items-center rounded-[10px] border border-[var(--crm-border)] bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Open owner
                    </Link>
                  ) : (
                    <span className="text-[11px] text-slate-400">Registry only</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CrmCard>

      <section className="grid gap-5 lg:grid-cols-3">
        <ControlCard
          icon={<FiDollarSign size={17} />}
          title="Finance & pricing"
          description="Commission, currency, settlement and pricing controls belong to Finance and Market Configuration."
          href="/admin/pricing/market-config"
          label="Market configuration"
        />
        <ControlCard
          icon={<FiUsers size={17} />}
          title="Trust & company policy"
          description="KYC and provider/company eligibility stay inside governed Trust and People workflows."
          href="/admin/kyc"
          label="KYC operations"
        />
        <ControlCard
          icon={<FiTool size={17} />}
          title="Public runtime"
          description="Website and mobile runtime controls are live through the canonical App & Web runtime contract; legacy generic maintenance settings are retired."
          href="/admin/platform"
          label="App & Web"
        />
      </section>
    </div>
  )
}

function ControlCard({
  icon,
  title,
  description,
  href,
  label,
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  label: string
}) {
  return (
    <CrmCard>
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--crm-accent-soft)] text-amber-700">
        {icon}
      </div>
      <h2 className="mt-4 text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-flex text-xs font-semibold text-amber-700 hover:text-amber-800"
      >
        {label}
      </Link>
    </CrmCard>
  )
}
