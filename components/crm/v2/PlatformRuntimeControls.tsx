'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { FiRefreshCw, FiSave, FiShield } from 'react-icons/fi'
import {
  CrmBadge,
  CrmButton,
  CrmCard,
  CrmState,
  crmInputClass,
} from '@/components/crm/v2/CrmPrimitives'

interface RuntimeConfig {
  channels: { website: boolean; mobile: boolean; booking: boolean }
  maintenance: { enabled: boolean; message: string }
  catalog: { visible: boolean }
  offers: { visible: boolean }
  notifications: { enabled: boolean }
  banner: { enabled: boolean; message: string; severity: 'INFO' | 'WARNING' | 'CRITICAL' }
  mobile: { minimumVersion: string }
  market: { availableMarkets: string[] }
  booking: { enabled: false; locked: true; reason: string }
}

interface RuntimePayload {
  config: RuntimeConfig
  canManage: boolean
}

type Draft = Record<string, boolean | string>

export default function PlatformRuntimeControls({
  surface,
}: {
  surface: 'website' | 'mobile'
}) {
  const [payload, setPayload] = useState<RuntimePayload | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/platform/runtime', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Unable to load runtime controls')
      setPayload(body)
      setDraft(toDraft(body.config))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load runtime controls')
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visibleKeys = useMemo(
    () =>
      surface === 'website'
        ? [
            'runtime.website.enabled',
            'runtime.maintenance.enabled',
            'runtime.catalog.visible',
            'runtime.offers.visible',
            'runtime.banner.enabled',
            'runtime.banner.message',
            'runtime.banner.severity',
          ]
        : [
            'runtime.mobile.enabled',
            'runtime.maintenance.enabled',
            'runtime.catalog.visible',
            'runtime.offers.visible',
            'runtime.notifications.enabled',
            'runtime.banner.enabled',
            'runtime.banner.message',
            'runtime.banner.severity',
            'runtime.mobile.minimumVersion',
          ],
    [surface]
  )

  async function save() {
    if (!payload?.canManage || saving) return
    setSaving(true)
    try {
      const settings = Object.fromEntries(
        visibleKeys.map(key => [key, draft[key]])
      )
      const response = await fetch('/api/admin/platform/runtime', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Runtime update failed')
      toast.success('Runtime controls updated')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Runtime update failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !payload) {
    return (
      <CrmState
        type="loading"
        title="Loading runtime controls"
        description="Reading the live App & Web runtime contract."
      />
    )
  }

  if (!payload) {
    return (
      <CrmState
        type="error"
        title="Runtime controls unavailable"
        description="The live runtime configuration could not be loaded."
        action={<CrmButton variant="secondary" onClick={load}>Retry</CrmButton>}
      />
    )
  }

  const title = surface === 'website' ? 'Website runtime controls' : 'Mobile runtime controls'

  return (
    <CrmCard
      title={title}
      description="These controls are consumed by live application code and are audited when changed."
      action={
        <div className="flex items-center gap-2">
          <CrmBadge tone={payload.canManage ? 'warning' : 'neutral'}>
            {payload.canManage ? 'Sensitive write' : 'Read-only'}
          </CrmBadge>
          <CrmButton size="sm" variant="ghost" onClick={load}>
            <FiRefreshCw size={13} />
            Refresh
          </CrmButton>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Toggle
          label={surface === 'website' ? 'Website available' : 'Mobile app available'}
          description={surface === 'website' ? 'Allow normal public website access.' : 'Allow mobile sessions to enter the app.'}
          checked={Boolean(draft[surface === 'website' ? 'runtime.website.enabled' : 'runtime.mobile.enabled'])}
          onChange={value => setDraft(current => ({
            ...current,
            [surface === 'website' ? 'runtime.website.enabled' : 'runtime.mobile.enabled']: value,
          }))}
          disabled={!payload.canManage}
        />

        <Toggle
          label="Maintenance mode"
          description="Blocks supported public/mobile channels and shows the maintenance message."
          checked={Boolean(draft['runtime.maintenance.enabled'])}
          onChange={value => setDraft(current => ({ ...current, 'runtime.maintenance.enabled': value }))}
          disabled={!payload.canManage}
          dangerous
        />

        <Toggle
          label="Catalog visible"
          description="Controls service/category discovery at the API boundary."
          checked={Boolean(draft['runtime.catalog.visible'])}
          onChange={value => setDraft(current => ({ ...current, 'runtime.catalog.visible': value }))}
          disabled={!payload.canManage}
        />

        <Toggle
          label="Offers visible"
          description="Controls seasonal and flash offer delivery."
          checked={Boolean(draft['runtime.offers.visible'])}
          onChange={value => setDraft(current => ({ ...current, 'runtime.offers.visible': value }))}
          disabled={!payload.canManage}
        />

        {surface === 'mobile' && (
          <Toggle
            label="Push notifications"
            description="Controls mobile push registration and notification listeners."
            checked={Boolean(draft['runtime.notifications.enabled'])}
            onChange={value => setDraft(current => ({ ...current, 'runtime.notifications.enabled': value }))}
            disabled={!payload.canManage}
          />
        )}

        <Toggle
          label="Operational banner"
          description="Shows the public-safe message on supported surfaces."
          checked={Boolean(draft['runtime.banner.enabled'])}
          onChange={value => setDraft(current => ({ ...current, 'runtime.banner.enabled': value }))}
          disabled={!payload.canManage}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Field label="Maintenance message">
          <textarea
            value={String(draft['runtime.maintenance.message'] || '')}
            onChange={event => setDraft(current => ({ ...current, 'runtime.maintenance.message': event.target.value }))}
            className={`${crmInputClass} h-auto min-h-[90px] py-2.5`}
            maxLength={240}
            disabled={!payload.canManage}
          />
        </Field>

        <Field label="Operational banner message">
          <textarea
            value={String(draft['runtime.banner.message'] || '')}
            onChange={event => setDraft(current => ({ ...current, 'runtime.banner.message': event.target.value }))}
            className={`${crmInputClass} h-auto min-h-[90px] py-2.5`}
            maxLength={240}
            disabled={!payload.canManage}
          />
        </Field>

        <Field label="Banner severity">
          <select
            value={String(draft['runtime.banner.severity'] || 'INFO')}
            onChange={event => setDraft(current => ({ ...current, 'runtime.banner.severity': event.target.value }))}
            className={crmInputClass}
            disabled={!payload.canManage}
          >
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </Field>

        {surface === 'mobile' && (
          <Field label="Minimum supported mobile version">
            <input
              value={String(draft['runtime.mobile.minimumVersion'] || '1.0.0')}
              onChange={event => setDraft(current => ({ ...current, 'runtime.mobile.minimumVersion': event.target.value }))}
              className={crmInputClass}
              placeholder="1.0.0"
              disabled={!payload.canManage}
            />
          </Field>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#17191b] text-[var(--crm-accent)]">
            <FiShield size={15} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-800">
              {payload.config.market.availableMarkets.length || 'No explicit'} configured markets
            </div>
            <div className="mt-1 text-[11px] leading-5 text-slate-500">
              {surface === 'website'
                ? 'Public booking remains hard-locked off until the approved website-booking UX gate is complete.'
                : 'Mobile market availability is derived from canonical MarketConfig records.'}
            </div>
          </div>
        </div>

        {payload.canManage && (
          <CrmButton variant="primary" onClick={save} disabled={saving}>
            <FiSave size={14} />
            {saving ? 'Saving…' : 'Save runtime'}
          </CrmButton>
        )}
      </div>
    </CrmCard>
  )
}

function toDraft(config: RuntimeConfig): Draft {
  return {
    'runtime.website.enabled': config.channels.website,
    'runtime.mobile.enabled': config.channels.mobile,
    'runtime.maintenance.enabled': config.maintenance.enabled,
    'runtime.maintenance.message': config.maintenance.message,
    'runtime.catalog.visible': config.catalog.visible,
    'runtime.offers.visible': config.offers.visible,
    'runtime.notifications.enabled': config.notifications.enabled,
    'runtime.banner.enabled': config.banner.enabled,
    'runtime.banner.message': config.banner.message,
    'runtime.banner.severity': config.banner.severity,
    'runtime.mobile.minimumVersion': config.mobile.minimumVersion,
  }
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  dangerous = false,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled: boolean
  dangerous?: boolean
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-[var(--crm-border)] bg-white p-4">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        <span className="mt-1 block text-[11px] leading-5 text-slate-500">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        disabled={disabled}
        className={`h-5 w-5 shrink-0 rounded border-slate-300 ${dangerous ? 'accent-red-600' : 'accent-amber-500'}`}
      />
    </label>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  )
}
