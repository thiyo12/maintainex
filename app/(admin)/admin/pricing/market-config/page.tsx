'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  FiAlertTriangle,
  FiDollarSign,
  FiMap,
  FiRefreshCw,
  FiSave,
  FiSliders,
  FiTarget,
  FiTrendingUp,
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
  crmInputClass,
} from '@/components/crm/v2/CrmPrimitives'
import { crmApiError } from '@/lib/crm/api-error'

interface MarketConfig {
  id: string
  countryCode: string
  defaultCurrency: string
  weightCapability: number
  weightReliability: number
  weightReputation: number
  weightAvailability: number
  weightTravel: number
  weightExperience: number
  weightFairness: number
  weightPreferredSkill: number
  wave1Size: number
  wave2Size: number
  wave3Size: number
  wave1ExpiryMinutes: number
  wave2ExpiryMinutes: number
  wave3ExpiryMinutes: number
  newProviderBaseline: number
  maxOpportunityBoost: number
  urgentModifierBps: number
  emergencyModifierBps: number
  urgencyCapBps: number
  commissionRateBps: number
  minJobAmountCents: number
  maxJobAmountCents: number
  minBenchmarkSample: number
  benchmarkPercentileLow: number
  benchmarkPercentileHigh: number
  benchmarkOutlierIqrMult: number
  updatedAt: string
}

type NumericKey = Exclude<keyof MarketConfig, 'id' | 'countryCode' | 'defaultCurrency' | 'updatedAt'>

interface FieldDefinition {
  key: NumericKey
  label: string
  hint: string
  pricing?: boolean
}

const MATCHING_FIELDS: FieldDefinition[] = [
  { key: 'weightCapability', label: 'Capability weight', hint: 'Influence of skill/capability fit.' },
  { key: 'weightReliability', label: 'Reliability weight', hint: 'Influence of provider reliability.' },
  { key: 'weightReputation', label: 'Reputation weight', hint: 'Influence of rating/reputation.' },
  { key: 'weightAvailability', label: 'Availability weight', hint: 'Influence of current availability.' },
  { key: 'weightTravel', label: 'Travel weight', hint: 'Influence of distance/travel cost.' },
  { key: 'weightExperience', label: 'Experience weight', hint: 'Influence of completed work history.' },
  { key: 'weightFairness', label: 'Fairness weight', hint: 'Influence of opportunity balancing.' },
  { key: 'weightPreferredSkill', label: 'Preferred skill weight', hint: 'Boost for preferred skill matches.' },
]

const WAVE_FIELDS: FieldDefinition[] = [
  { key: 'wave1Size', label: 'Wave 1 size', hint: 'Providers contacted in first wave.' },
  { key: 'wave2Size', label: 'Wave 2 size', hint: 'Providers contacted in second wave.' },
  { key: 'wave3Size', label: 'Wave 3 size', hint: 'Providers contacted in third wave.' },
  { key: 'wave1ExpiryMinutes', label: 'Wave 1 expiry', hint: 'Minutes before the first wave expands.' },
  { key: 'wave2ExpiryMinutes', label: 'Wave 2 expiry', hint: 'Minutes before the second wave expands.' },
  { key: 'wave3ExpiryMinutes', label: 'Wave 3 expiry', hint: 'Minutes before the final wave expires.' },
]

const ECONOMICS_FIELDS: FieldDefinition[] = [
  { key: 'commissionRateBps', label: 'Commission (BPS)', hint: '100 BPS = 1%.', pricing: true },
  { key: 'urgentModifierBps', label: 'Urgent modifier (BPS)', hint: 'Price modifier for urgent work.', pricing: true },
  { key: 'emergencyModifierBps', label: 'Emergency modifier (BPS)', hint: 'Price modifier for emergency work.', pricing: true },
  { key: 'urgencyCapBps', label: 'Urgency cap (BPS)', hint: 'Maximum urgency adjustment.', pricing: true },
  { key: 'minJobAmountCents', label: 'Minimum job amount', hint: 'Minor currency units.', pricing: true },
  { key: 'maxJobAmountCents', label: 'Maximum job amount', hint: 'Minor currency units.', pricing: true },
  { key: 'newProviderBaseline', label: 'New provider baseline', hint: 'Starting quality score for new providers.' },
  { key: 'maxOpportunityBoost', label: 'Max opportunity boost', hint: 'Maximum fairness/opportunity boost.' },
]

const BENCHMARK_FIELDS: FieldDefinition[] = [
  { key: 'minBenchmarkSample', label: 'Minimum sample', hint: 'Minimum jobs before benchmark confidence.', pricing: true },
  { key: 'benchmarkPercentileLow', label: 'Low percentile', hint: 'Lower benchmark percentile.', pricing: true },
  { key: 'benchmarkPercentileHigh', label: 'High percentile', hint: 'Upper benchmark percentile.', pricing: true },
  { key: 'benchmarkOutlierIqrMult', label: 'IQR multiplier', hint: 'Outlier sensitivity.', pricing: true },
]

export default function MarketConfigPage() {
  const { user } = useAdminSession()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const canView = Boolean(user?.permissions?.includes('markets:view'))
  const canManage = Boolean(user?.permissions?.includes('markets:manage'))
  const canManagePricing = Boolean(user?.permissions?.includes('pricing:manage'))

  const availableMarkets = useMemo(() => {
    if (!user) return [] as string[]
    const scoped = user.assignedCountries || []
    const known = user.markets?.map(market => market.code) || []
    if (isSuperAdmin) return Array.from(new Set(['GLOBAL', ...known, ...scoped]))
    return Array.from(new Set(scoped))
  }, [isSuperAdmin, user])

  const [config, setConfig] = useState<MarketConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [changes, setChanges] = useState<Partial<Record<NumericKey, number>>>({})
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [countryCode, setCountryCode] = useState('LK')

  useEffect(() => {
    if (!availableMarkets.length) return
    if (!availableMarkets.includes(countryCode)) {
      setCountryCode(availableMarkets[0])
    }
  }, [availableMarkets, countryCode])

  const fetchConfig = useCallback(async () => {
    if (!canView || !countryCode) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        `/api/admin/market-config?countryCode=${encodeURIComponent(countryCode)}`,
        { credentials: 'include', cache: 'no-store' }
      )
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Failed to load market configuration')
      setConfig(body.config || null)
      setChanges({})
      setReason('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load market configuration')
      setConfig(null)
    } finally {
      setLoading(false)
    }
  }, [canView, countryCode])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  function valueFor(key: NumericKey): number {
    if (changes[key] !== undefined) return Number(changes[key])
    return Number(config?.[key] || 0)
  }

  function changeField(field: FieldDefinition, raw: string) {
    if (!canManage) return
    if (field.pricing && !canManagePricing) return
    if (raw.trim() === '') return
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    setChanges(current => ({ ...current, [field.key]: value }))
  }

  const hasChanges = Object.keys(changes).length > 0
  const canSave = canManage && hasChanges && reason.trim().length >= 4 && !saving

  async function save() {
    if (!canSave || !config) return

    setSaving(true)
    try {
      const response = await fetch('/api/admin/market-config', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryCode: config.countryCode,
          reason: reason.trim(),
          ...changes,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Failed to save market configuration')
      toast.success('Market configuration updated and audited')
      await fetchConfig()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save market configuration')
    } finally {
      setSaving(false)
    }
  }

  if (!canView && user) {
    return (
      <CrmState
        type="permission"
        title="Market configuration access required"
        description="Your current staff permissions do not allow this market configuration workspace."
      />
    )
  }

  if (loading) {
    return (
      <CrmState
        type="loading"
        title="Loading market configuration"
        description="Loading matching, pricing and benchmark policy for the selected market."
      />
    )
  }

  if (!config) {
    return (
      <CrmState
        type="empty"
        title="No market configuration found"
        description={`No configuration is currently stored for ${countryCode}.`}
        action={
          <CrmButton variant="secondary" onClick={fetchConfig}>
            <FiRefreshCw size={14} />
            Refresh
          </CrmButton>
        }
      />
    )
  }

  const waveTotal = config.wave1Size + config.wave2Size + config.wave3Size

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="App & Web · Market policy"
        title="Market configuration"
        description="Control market-scoped matching, dispatch waves, pricing modifiers and benchmark policy from one governed workspace."
        actions={
          <>
            <select
              value={countryCode}
              onChange={event => setCountryCode(event.target.value)}
              className={`${crmInputClass} w-auto min-w-[170px]`}
            >
              {availableMarkets.map(code => (
                <option key={code} value={code}>
                  {code === 'GLOBAL' ? 'Global defaults' : user?.markets?.find(market => market.code === code)?.name || code}
                </option>
              ))}
            </select>
            <CrmButton variant="secondary" onClick={fetchConfig}>
              <FiRefreshCw size={14} />
              Refresh
            </CrmButton>
          </>
        }
        context={
          <>
            <CrmBadge tone={canManage ? 'success' : 'neutral'} dot>
              {canManage ? 'Market write access' : 'Read-only'}
            </CrmBadge>
            <CrmBadge tone={canManagePricing ? 'amber' : 'neutral'}>
              {canManagePricing ? 'Pricing authority' : 'Pricing read-only'}
            </CrmBadge>
            <CrmBadge tone="info">{config.countryCode}</CrmBadge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CrmMetricCard
          label="Currency"
          value={config.defaultCurrency}
          helper="Market settlement currency"
          icon={<FiDollarSign size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="Commission"
          value={`${(config.commissionRateBps / 100).toFixed(2)}%`}
          helper={`${config.commissionRateBps} BPS`}
          icon={<FiTrendingUp size={16} />}
          tone="amber"
        />
        <CrmMetricCard
          label="Matching waves"
          value={waveTotal.toLocaleString()}
          helper={`${config.wave1Size} / ${config.wave2Size} / ${config.wave3Size}`}
          icon={<FiTarget size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="Unsaved changes"
          value={Object.keys(changes).length}
          helper={hasChanges ? 'Reason required before save' : 'Configuration is in sync'}
          icon={<FiSliders size={16} />}
          tone={hasChanges ? 'warning' : 'neutral'}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ConfigGroup
          title="Matching weights"
          description="Scoring weights used by the provider-matching engine."
          icon={<FiTarget size={17} />}
          fields={MATCHING_FIELDS}
          valueFor={valueFor}
          onChange={changeField}
          canManage={canManage}
          canManagePricing={canManagePricing}
          changed={changes}
        />
        <ConfigGroup
          title="Dispatch waves"
          description="Provider fan-out size and expiry windows for matching waves."
          icon={<FiMap size={17} />}
          fields={WAVE_FIELDS}
          valueFor={valueFor}
          onChange={changeField}
          canManage={canManage}
          canManagePricing={canManagePricing}
          changed={changes}
        />
        <ConfigGroup
          title="Economics & opportunity"
          description="Pricing-sensitive controls are additionally protected by pricing authority."
          icon={<FiDollarSign size={17} />}
          fields={ECONOMICS_FIELDS}
          valueFor={valueFor}
          onChange={changeField}
          canManage={canManage}
          canManagePricing={canManagePricing}
          changed={changes}
        />
        <ConfigGroup
          title="Benchmark policy"
          description="Statistical controls used by price benchmarking and outlier handling."
          icon={<FiTrendingUp size={17} />}
          fields={BENCHMARK_FIELDS}
          valueFor={valueFor}
          onChange={changeField}
          canManage={canManage}
          canManagePricing={canManagePricing}
          changed={changes}
        />
      </section>

      <CrmCard
        title="Change control"
        description="Every update is market-scoped, validated, concurrency-protected and audited."
        action={
          <CrmBadge tone={hasChanges ? 'warning' : 'success'} dot>
            {hasChanges ? `${Object.keys(changes).length} pending` : 'No pending changes'}
          </CrmBadge>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <CrmField
            label="Change reason"
            hint="Required for configuration updates. This becomes part of the audit record."
          >
            <textarea
              value={reason}
              onChange={event => setReason(event.target.value.slice(0, 2000))}
              disabled={!canManage || !hasChanges}
              rows={3}
              placeholder="Explain why this market configuration needs to change…"
              className={`${crmInputClass} h-auto min-h-[92px] resize-y py-2.5`}
            />
          </CrmField>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            {hasChanges && reason.trim().length < 4 && (
              <div className="inline-flex items-center gap-2 text-xs text-amber-700">
                <FiAlertTriangle size={13} />
                Add a clear reason before saving.
              </div>
            )}
            <CrmButton variant="primary" disabled={!canSave} onClick={save}>
              <FiSave size={14} />
              {saving ? 'Saving…' : 'Save governed changes'}
            </CrmButton>
          </div>
        </div>
        <div className="mt-4 text-[11px] text-slate-400">
          Last updated {new Date(config.updatedAt).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      </CrmCard>
    </div>
  )
}

function ConfigGroup({
  title,
  description,
  icon,
  fields,
  valueFor,
  onChange,
  canManage,
  canManagePricing,
  changed,
}: {
  title: string
  description: string
  icon: React.ReactNode
  fields: FieldDefinition[]
  valueFor: (key: NumericKey) => number
  onChange: (field: FieldDefinition, value: string) => void
  canManage: boolean
  canManagePricing: boolean
  changed: Partial<Record<NumericKey, number>>
}) {
  return (
    <CrmCard
      title={title}
      description={description}
      action={<span className="text-slate-400">{icon}</span>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(field => {
          const pricingLocked = Boolean(field.pricing && !canManagePricing)
          const disabled = !canManage || pricingLocked
          const isChanged = changed[field.key] !== undefined

          return (
            <CrmField
              key={field.key}
              label={field.label}
              hint={pricingLocked ? 'Requires pricing:manage' : field.hint}
            >
              <input
                type="number"
                step="any"
                value={valueFor(field.key)}
                disabled={disabled}
                onChange={event => onChange(field, event.target.value)}
                className={`${crmInputClass} ${isChanged ? 'border-amber-300 bg-amber-50/50 ring-2 ring-amber-100' : ''}`}
              />
            </CrmField>
          )
        })}
      </div>
    </CrmCard>
  )
}
