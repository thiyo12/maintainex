'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiActivity,
  FiArrowLeft,
  FiCheckCircle,
  FiCreditCard,
  FiEdit2,
  FiGlobe,
  FiPlus,
  FiRefreshCw,
  FiShield,
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import {
  CrmBadge,
  CrmButton,
  CrmCard,
  CrmField,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  CrmTableFrame,
  crmInputClass,
  crmTableClass,
  crmTdClass,
  crmThClass,
  type CrmTone,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmModal } from '@/components/crm/v2/CrmOverlays'
import { crmApiError } from '@/lib/crm/api-error'

type ProviderCode = 'PAYPAL' | 'PAYHERE' | 'MANUAL_BANK'
type CapabilityKey =
  | 'checkout'
  | 'authorize'
  | 'capture'
  | 'refund'
  | 'partialRefund'
  | 'webhooks'
  | 'disputes'
  | 'payouts'
  | 'reconciliation'

interface ProviderConfig {
  id: string
  countryCode: string
  provider: ProviderCode
  enabled: boolean
  environment: 'SANDBOX' | 'LIVE'
  supportedCurrencies: string[]
  paymentMethods: string[]
  capabilities: Partial<Record<CapabilityKey, boolean>>
  captureMode: string
  operationalStatus: string
  priority: number
  commissionRateBps?: number | null
  updatedBy?: string | null
  updatedAt: string
  runtime: {
    configured: boolean
    environment?: string | null
    webhookConfigured: boolean
    refundConfigured: boolean
  }
}

interface ProviderStat {
  countryCode: string
  provider: string
  status: string
  currency: string
  count: number
  grossAmount: string
  providerFee: string
  netSettlement: string
}

interface EventStat {
  countryCode: string
  provider: string
  processingStatus: string
  count: number
}

interface Payload {
  configs: ProviderConfig[]
  transactionStats: ProviderStat[]
  eventStats: EventStat[]
  canManage: boolean
}

interface FormState {
  countryCode: string
  provider: ProviderCode
  enabled: boolean
  environment: 'SANDBOX' | 'LIVE'
  supportedCurrencies: string
  paymentMethods: string
  captureMode: 'CAPTURE' | 'AUTHORIZE'
  operationalStatus: 'DISABLED' | 'ACTIVE' | 'DEGRADED' | 'MAINTENANCE'
  priority: string
  commissionRateBps: string
  capabilities: Record<CapabilityKey, boolean>
  reason: string
}

const CAPABILITIES: Array<{ key: CapabilityKey; label: string }> = [
  { key: 'checkout', label: 'Checkout' },
  { key: 'authorize', label: 'Authorization' },
  { key: 'capture', label: 'Capture' },
  { key: 'refund', label: 'Refunds' },
  { key: 'partialRefund', label: 'Partial refunds' },
  { key: 'webhooks', label: 'Verified webhooks' },
  { key: 'disputes', label: 'Provider disputes' },
  { key: 'payouts', label: 'Provider payouts' },
  { key: 'reconciliation', label: 'Reconciliation' },
]

function defaults(): FormState {
  return {
    countryCode: 'CA',
    provider: 'PAYPAL',
    enabled: false,
    environment: 'SANDBOX',
    supportedCurrencies: 'CAD',
    paymentMethods: 'PAYPAL',
    captureMode: 'CAPTURE',
    operationalStatus: 'DISABLED',
    priority: '100',
    commissionRateBps: '',
    capabilities: {
      checkout: true,
      authorize: false,
      capture: true,
      refund: true,
      partialRefund: true,
      webhooks: true,
      disputes: true,
      payouts: false,
      reconciliation: true,
    },
    reason: '',
  }
}

function tone(config: ProviderConfig): CrmTone {
  if (!config.enabled || config.operationalStatus === 'DISABLED') return 'neutral'
  if (!config.runtime.configured || config.runtime.environment !== config.environment) return 'danger'
  if (config.operationalStatus === 'ACTIVE') return 'success'
  if (config.operationalStatus === 'DEGRADED') return 'warning'
  return 'info'
}

function money(minor: string, currency: string) {
  const raw = Number(minor || 0)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(raw) ? raw / 100 : 0)
}

export default function PaymentProvidersPage() {
  const { user } = useAdminSession()
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ProviderConfig | null>(null)
  const [form, setForm] = useState<FormState>(defaults())
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/financial/providers', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      if (!response.ok) throw crmApiError(body, 'Unable to load providers')
      setPayload(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load providers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => {
    const configs = payload?.configs || []
    const events = payload?.eventStats || []
    return {
      configured: configs.length,
      active: configs.filter(item => item.enabled && item.operationalStatus === 'ACTIVE').length,
      unhealthy: configs.filter(item =>
        item.enabled &&
        (!item.runtime.configured || item.runtime.environment !== item.environment)
      ).length,
      failedEvents: events
        .filter(item => item.processingStatus === 'FAILED')
        .reduce((sum, item) => sum + item.count, 0),
    }
  }, [payload])

  function beginNew() {
    setEditing(null)
    setForm(defaults())
    setOpen(true)
  }

  function beginEdit(config: ProviderConfig) {
    setEditing(config)
    setForm({
      countryCode: config.countryCode,
      provider: config.provider,
      enabled: config.enabled,
      environment: config.environment,
      supportedCurrencies: config.supportedCurrencies.join(', '),
      paymentMethods: config.paymentMethods.join(', '),
      captureMode: config.captureMode === 'AUTHORIZE' ? 'AUTHORIZE' : 'CAPTURE',
      operationalStatus: ['ACTIVE', 'DEGRADED', 'MAINTENANCE'].includes(config.operationalStatus)
        ? config.operationalStatus as FormState['operationalStatus']
        : 'DISABLED',
      priority: String(config.priority),
      commissionRateBps: config.commissionRateBps == null ? '' : String(config.commissionRateBps),
      capabilities: Object.fromEntries(
        CAPABILITIES.map(item => [item.key, config.capabilities[item.key] === true])
      ) as Record<CapabilityKey, boolean>,
      reason: '',
    })
    setOpen(true)
  }

  async function save() {
    if (!payload?.canManage || saving) return
    if (form.reason.trim().length < 4) {
      toast.error('Add a clear change reason')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/financial/providers', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryCode: form.countryCode.trim().toUpperCase(),
          provider: form.provider,
          enabled: form.enabled,
          environment: form.environment,
          supportedCurrencies: form.supportedCurrencies
            .split(',')
            .map(value => value.trim().toUpperCase())
            .filter(Boolean),
          paymentMethods: form.paymentMethods
            .split(',')
            .map(value => value.trim().toUpperCase())
            .filter(Boolean),
          capabilities: form.capabilities,
          captureMode: form.captureMode,
          operationalStatus: form.operationalStatus,
          priority: Number(form.priority),
          commissionRateBps:
            form.commissionRateBps.trim() === ''
              ? null
              : Number(form.commissionRateBps),
          reason: form.reason.trim(),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw crmApiError(body, 'Provider update failed')
      toast.success('Payment provider configuration updated and audited')
      setOpen(false)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Provider update failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !payload) {
    return (
      <CrmState
        type="loading"
        title="Loading payment providers"
        description="Checking market configuration, runtime readiness and provider reconciliation state."
      />
    )
  }

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="Finance · International provider control"
        title="Payment Providers"
        description="Configure payment-provider availability by market and currency without exposing credentials. Checkout remains fail-closed when runtime and market configuration disagree."
        actions={
          <>
            <CrmButton variant="secondary" onClick={load} disabled={loading}>
              <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </CrmButton>
            {payload?.canManage && (
              <CrmButton variant="primary" onClick={beginNew}>
                <FiPlus size={14} />
                Add provider
              </CrmButton>
            )}
          </>
        }
        context={
          <>
            <CrmBadge tone="info">
              {user?.assignedCountries?.length
                ? `${user.assignedCountries.length} assigned market${user.assignedCountries.length === 1 ? '' : 's'}`
                : 'Market scoped'}
            </CrmBadge>
            <CrmBadge tone={payload?.canManage ? 'amber' : 'neutral'}>
              {payload?.canManage ? 'Super-admin governed writes' : 'Read-only'}
            </CrmBadge>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/admin/financial"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-amber-700"
        >
          <FiArrowLeft size={13} />
          Finance Control Centre
        </Link>
        <Link href="/admin/financial/payments" className="text-xs font-semibold text-amber-700 hover:text-amber-800">
          Payment Operations
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CrmMetricCard
          label="Configured providers"
          value={totals.configured}
          helper="Market/provider combinations"
          icon={<FiGlobe size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="Active providers"
          value={totals.active}
          helper="Explicitly enabled + operational"
          icon={<FiCheckCircle size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="Runtime mismatch"
          value={totals.unhealthy}
          helper="Enabled but credentials/environment disagree"
          icon={<FiShield size={16} />}
          tone={totals.unhealthy ? 'danger' : 'success'}
        />
        <CrmMetricCard
          label="Failed provider events"
          value={totals.failedEvents}
          helper="Verified events needing investigation"
          icon={<FiActivity size={16} />}
          tone={totals.failedEvents ? 'danger' : 'neutral'}
        />
      </section>

      <CrmTableFrame
        title="Market payment matrix"
        description="No provider is available to checkout unless this matrix explicitly enables the provider, currency and checkout capability."
      >
        <table className={`${crmTableClass} min-w-[1350px]`}>
          <thead>
            <tr>
              <th className={crmThClass}>Market</th>
              <th className={crmThClass}>Provider</th>
              <th className={crmThClass}>Status</th>
              <th className={crmThClass}>Environment</th>
              <th className={crmThClass}>Currencies</th>
              <th className={crmThClass}>Methods</th>
              <th className={crmThClass}>Capabilities</th>
              <th className={crmThClass}>Runtime</th>
              <th className={crmThClass}>Priority</th>
              <th className={`${crmThClass} text-right`}>Control</th>
            </tr>
          </thead>
          <tbody>
            {(payload?.configs || []).map(config => (
              <tr key={config.id} className="transition-colors hover:bg-[#fafbf9]">
                <td className={crmTdClass}>
                  <div className="font-semibold text-slate-900">{config.countryCode}</div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    Updated {new Date(config.updatedAt).toLocaleString('en-LK', { dateStyle: 'medium' })}
                  </div>
                </td>
                <td className={crmTdClass}>
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <FiCreditCard className="text-amber-600" />
                    {config.provider.replaceAll('_', ' ')}
                  </div>
                </td>
                <td className={crmTdClass}>
                  <CrmBadge tone={tone(config)} dot>
                    {config.enabled ? config.operationalStatus : 'DISABLED'}
                  </CrmBadge>
                </td>
                <td className={crmTdClass}>
                  <CrmBadge tone={config.environment === 'LIVE' ? 'warning' : 'info'}>
                    {config.environment}
                  </CrmBadge>
                </td>
                <td className={crmTdClass}>
                  <div className="flex max-w-[200px] flex-wrap gap-1">
                    {config.supportedCurrencies.map(currency => (
                      <CrmBadge key={currency}>{currency}</CrmBadge>
                    ))}
                  </div>
                </td>
                <td className={crmTdClass}>
                  <div className="text-xs text-slate-600">{config.paymentMethods.join(', ') || '—'}</div>
                </td>
                <td className={crmTdClass}>
                  <div className="flex max-w-[300px] flex-wrap gap-1">
                    {CAPABILITIES
                      .filter(item => config.capabilities[item.key])
                      .map(item => (
                        <span key={item.key} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                          {item.label}
                        </span>
                      ))}
                  </div>
                </td>
                <td className={crmTdClass}>
                  <div className="space-y-1">
                    <CrmBadge
                      tone={
                        config.runtime.configured &&
                        config.runtime.environment === config.environment
                          ? 'success'
                          : 'danger'
                      }
                      dot
                    >
                      {config.runtime.configured ? 'Configured' : 'Missing runtime'}
                    </CrmBadge>
                    <div className="text-[10px] leading-4 text-slate-400">
                      Runtime {config.runtime.environment || '—'}
                      {' · '}
                      Webhook {config.runtime.webhookConfigured ? 'ready' : 'not configured'}
                      {' · '}
                      Refund API {config.runtime.refundConfigured ? 'ready' : 'not configured'}
                    </div>
                  </div>
                </td>
                <td className={crmTdClass}>
                  <span className="font-mono text-xs font-semibold text-slate-700">{config.priority}</span>
                </td>
                <td className={`${crmTdClass} text-right`}>
                  {payload?.canManage ? (
                    <CrmButton variant="secondary" size="sm" onClick={() => beginEdit(config)}>
                      <FiEdit2 size={13} />
                      Edit
                    </CrmButton>
                  ) : (
                    <span className="text-xs text-slate-400">Read-only</span>
                  )}
                </td>
              </tr>
            ))}
            {!payload?.configs?.length && (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-xs text-slate-400">
                  No payment provider is configured for the markets visible to this staff account. Checkout will fail closed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CrmTableFrame>

      <section className="grid gap-4 xl:grid-cols-2">
        <CrmCard
          title="Provider transaction economics"
          description="Gross, provider fee and provider net settlement captured from provider records."
        >
          <div className="space-y-3">
            {(payload?.transactionStats || []).slice(0, 12).map((row, index) => (
              <div
                key={`${row.countryCode}-${row.provider}-${row.status}-${row.currency}-${index}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 px-3 py-3"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    {row.countryCode} · {row.provider} · {row.status}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">{row.count} transactions · {row.currency}</div>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <div className="font-semibold text-slate-800">{money(row.grossAmount, row.currency)} gross</div>
                  <div>{money(row.providerFee, row.currency)} fee · {money(row.netSettlement, row.currency)} net</div>
                </div>
              </div>
            ))}
            {!payload?.transactionStats?.length && (
              <div className="py-8 text-center text-xs text-slate-400">No provider transactions recorded yet.</div>
            )}
          </div>
        </CrmCard>

        <CrmCard
          title="Webhook / provider event health"
          description="Immutable verified event processing summary."
        >
          <div className="space-y-3">
            {(payload?.eventStats || []).slice(0, 16).map((row, index) => (
              <div
                key={`${row.countryCode}-${row.provider}-${row.processingStatus}-${index}`}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3"
              >
                <div className="text-xs font-semibold text-slate-700">
                  {row.countryCode || 'Unresolved'} · {row.provider}
                </div>
                <CrmBadge
                  tone={
                    row.processingStatus === 'PROCESSED'
                      ? 'success'
                      : row.processingStatus === 'FAILED'
                        ? 'danger'
                        : row.processingStatus === 'IGNORED'
                          ? 'neutral'
                          : 'warning'
                  }
                >
                  {row.processingStatus} · {row.count}
                </CrmBadge>
              </div>
            ))}
            {!payload?.eventStats?.length && (
              <div className="py-8 text-center text-xs text-slate-400">No provider events recorded yet.</div>
            )}
          </div>
        </CrmCard>
      </section>

      <CrmModal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={editing ? `Edit ${editing.provider} · ${editing.countryCode}` : 'Add payment provider'}
        description="This changes operational provider availability, not credentials. Credentials stay in server environment variables."
        maxWidth="max-w-3xl"
        footer={
          <>
            <CrmButton variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </CrmButton>
            <CrmButton variant="primary" onClick={save} disabled={saving || form.reason.trim().length < 4}>
              {saving ? 'Saving…' : 'Save governed config'}
            </CrmButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CrmField label="Country code" hint="ISO alpha-2 market code.">
            <input
              value={form.countryCode}
              disabled={Boolean(editing)}
              onChange={event => setForm(current => ({ ...current, countryCode: event.target.value.toUpperCase().slice(0, 2) }))}
              className={crmInputClass}
            />
          </CrmField>
          <CrmField label="Provider">
            <select
              value={form.provider}
              disabled={Boolean(editing)}
              onChange={event => setForm(current => ({ ...current, provider: event.target.value as ProviderCode }))}
              className={crmInputClass}
            >
              <option value="PAYPAL">PayPal</option>
              <option value="PAYHERE">PayHere</option>
              <option value="MANUAL_BANK">Manual bank</option>
            </select>
          </CrmField>
          <CrmField label="Environment">
            <select
              value={form.environment}
              onChange={event => setForm(current => ({ ...current, environment: event.target.value as FormState['environment'] }))}
              className={crmInputClass}
            >
              <option value="SANDBOX">Sandbox</option>
              <option value="LIVE">Live</option>
            </select>
          </CrmField>
          <CrmField label="Operational status">
            <select
              value={form.operationalStatus}
              onChange={event => setForm(current => ({ ...current, operationalStatus: event.target.value as FormState['operationalStatus'] }))}
              className={crmInputClass}
            >
              <option value="DISABLED">Disabled</option>
              <option value="ACTIVE">Active</option>
              <option value="DEGRADED">Degraded</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
          </CrmField>
          <CrmField label="Supported currencies" hint="Comma-separated ISO currency codes.">
            <input
              value={form.supportedCurrencies}
              onChange={event => setForm(current => ({ ...current, supportedCurrencies: event.target.value }))}
              className={crmInputClass}
            />
          </CrmField>
          <CrmField label="Payment methods" hint="Operational method labels only.">
            <input
              value={form.paymentMethods}
              onChange={event => setForm(current => ({ ...current, paymentMethods: event.target.value }))}
              className={crmInputClass}
            />
          </CrmField>
          <CrmField label="Capture mode">
            <select
              value={form.captureMode}
              onChange={event => setForm(current => ({ ...current, captureMode: event.target.value as FormState['captureMode'] }))}
              className={crmInputClass}
            >
              <option value="CAPTURE">Capture</option>
              <option value="AUTHORIZE">Authorize</option>
            </select>
          </CrmField>
          <CrmField label="Priority" hint="Lower value is selected first.">
            <input
              type="number"
              min={0}
              max={10000}
              value={form.priority}
              onChange={event => setForm(current => ({ ...current, priority: event.target.value }))}
              className={crmInputClass}
            />
          </CrmField>
          <CrmField label="Commission BPS" hint="Optional provider/market override metadata.">
            <input
              type="number"
              min={0}
              max={10000}
              value={form.commissionRateBps}
              onChange={event => setForm(current => ({ ...current, commissionRateBps: event.target.value }))}
              className={crmInputClass}
            />
          </CrmField>
          <CrmField label="Enable checkout">
            <button
              type="button"
              onClick={() => setForm(current => ({ ...current, enabled: !current.enabled }))}
              className={`flex h-10 w-full items-center justify-between rounded-[11px] border px-3 text-sm font-semibold ${
                form.enabled
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <span>{form.enabled ? 'Enabled' : 'Disabled'}</span>
              <span>{form.enabled ? 'ON' : 'OFF'}</span>
            </button>
          </CrmField>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold text-slate-700">Provider capabilities</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {CAPABILITIES.map(item => (
              <label key={item.key} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={form.capabilities[item.key]}
                  onChange={event => setForm(current => ({
                    ...current,
                    capabilities: {
                      ...current.capabilities,
                      [item.key]: event.target.checked,
                    },
                  }))}
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <CrmField
            label="Change reason"
            hint="Required. The reason is written to the immutable CRM security audit trail."
          >
            <textarea
              value={form.reason}
              onChange={event => setForm(current => ({ ...current, reason: event.target.value.slice(0, 2000) }))}
              rows={3}
              className={`${crmInputClass} h-auto min-h-[92px] resize-y py-2.5`}
              placeholder="Why should this provider configuration change?"
            />
          </CrmField>
        </div>
      </CrmModal>
    </div>
  )
}
