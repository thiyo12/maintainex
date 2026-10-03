'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowLeft,
  FiCheckCircle,
  FiDollarSign,
  FiEdit2,
  FiRefreshCw,
  FiShield,
} from 'react-icons/fi'
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
} from '@/components/crm/v2/CrmPrimitives'
import { crmApiError } from '@/lib/crm/api-error'

type Policy = {
  id: string | null
  countryCode: string
  providerType: 'TASKER' | 'COMPANY'
  currency: string
  warningThresholdMinor: string
  cashRestrictionThresholdMinor: string
  reviewThresholdMinor: string
  maxDebtAgeDays: number
  allowOnlineWhenCashRestricted: boolean
  autoOffsetOnlineEarnings: boolean
  settlementCadence: 'REALTIME' | 'WEEKLY'
  enabled: boolean
  inheritedDefault: boolean
  updatedAt?: string | null
}

type Payload = {
  policies: Policy[]
  canManage: boolean
}

type Form = {
  warning: string
  cashRestriction: string
  review: string
  maxDebtAgeDays: string
  allowOnlineWhenCashRestricted: boolean
  autoOffsetOnlineEarnings: boolean
  settlementCadence: 'REALTIME' | 'WEEKLY'
  enabled: boolean
  reason: string
}

function major(minor: string) {
  return (Number(minor || 0) / 100).toFixed(2)
}

function toMinor(value: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return String(Math.round(amount * 100))
}

function money(minor: string, currency: string) {
  const amount = Number(minor || 0) / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

export default function ProviderFinancialPoliciesPage() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Policy | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/financial/provider-policies', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw crmApiError(body, 'Unable to load provider financial policies')
      setPayload(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load provider financial policies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const metrics = useMemo(() => {
    const policies = payload?.policies || []
    return {
      markets: new Set(policies.map(item => item.countryCode)).size,
      configured: policies.filter(item => !item.inheritedDefault).length,
      autoOffset: policies.filter(item => item.autoOffsetOnlineEarnings).length,
      recoveryEnabled: policies.filter(item => item.allowOnlineWhenCashRestricted).length,
    }
  }, [payload])

  const startEdit = (policy: Policy) => {
    setEditing(policy)
    setForm({
      warning: major(policy.warningThresholdMinor),
      cashRestriction: major(policy.cashRestrictionThresholdMinor),
      review: major(policy.reviewThresholdMinor),
      maxDebtAgeDays: String(policy.maxDebtAgeDays),
      allowOnlineWhenCashRestricted: policy.allowOnlineWhenCashRestricted,
      autoOffsetOnlineEarnings: policy.autoOffsetOnlineEarnings,
      settlementCadence: policy.settlementCadence,
      enabled: policy.enabled,
      reason: '',
    })
  }

  const save = async () => {
    if (!editing || !form) return
    const warningThresholdMinor = toMinor(form.warning)
    const cashRestrictionThresholdMinor = toMinor(form.cashRestriction)
    const reviewThresholdMinor = toMinor(form.review)
    if (
      warningThresholdMinor === null ||
      cashRestrictionThresholdMinor === null ||
      reviewThresholdMinor === null
    ) {
      toast.error('Enter valid non-negative threshold amounts')
      return
    }
    if (!form.reason.trim()) {
      toast.error('A policy change reason is required')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/financial/provider-policies', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryCode: editing.countryCode,
          providerType: editing.providerType,
          currency: editing.currency,
          warningThresholdMinor,
          cashRestrictionThresholdMinor,
          reviewThresholdMinor,
          maxDebtAgeDays: Number(form.maxDebtAgeDays),
          allowOnlineWhenCashRestricted: form.allowOnlineWhenCashRestricted,
          autoOffsetOnlineEarnings: form.autoOffsetOnlineEarnings,
          settlementCadence: form.settlementCadence,
          enabled: form.enabled,
          reason: form.reason.trim(),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw crmApiError(body, 'Unable to update provider financial policy')
      toast.success('Provider financial policy updated')
      setEditing(null)
      setForm(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update policy')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <CrmState
        type="loading"
        title="Loading provider financial policies"
        description="Loading cash restriction, debt aging and automatic recovery rules."
      />
    )
  }

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="Finance · Provider standing"
        title="Provider financial policies"
        description="Control warning, cash-job restriction, review and automatic debt-recovery rules by market and provider type. Changes are audited and do not rewrite ledger history."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/financial"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FiArrowLeft size={14} />
              Finance
            </Link>
            <CrmButton variant="secondary" onClick={load}>
              <FiRefreshCw size={14} />
              Refresh
            </CrmButton>
          </div>
        }
        context={
          <>
            <CrmBadge tone="info">Market scoped</CrmBadge>
            <CrmBadge tone={payload?.canManage ? 'success' : 'neutral'} dot>
              {payload?.canManage ? 'Manage access' : 'Read only'}
            </CrmBadge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CrmMetricCard
          label="Visible markets"
          value={metrics.markets.toLocaleString()}
          helper="Staff market scope"
          icon={<FiShield size={16} />}
        />
        <CrmMetricCard
          label="Persisted policies"
          value={metrics.configured.toLocaleString()}
          helper="Overrides stored in control plane"
          icon={<FiCheckCircle size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="Auto-offset enabled"
          value={metrics.autoOffset.toLocaleString()}
          helper="Future online earnings recover old cash debt"
          icon={<FiDollarSign size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="Online recovery paths"
          value={metrics.recoveryEnabled.toLocaleString()}
          helper="Online jobs remain available when cash restricted"
          icon={<FiShield size={16} />}
          tone="success"
        />
      </section>

      <CrmTableFrame
        title="Standing policy matrix"
        description="Threshold order must be Warning ≤ Cash restricted ≤ Manual review. Amounts are shown in major currency units."
      >
        <table className={`${crmTableClass} min-w-[1250px]`}>
          <thead>
            <tr>
              <th className={crmThClass}>Market</th>
              <th className={crmThClass}>Provider</th>
              <th className={crmThClass}>Warning</th>
              <th className={crmThClass}>Cash restricted</th>
              <th className={crmThClass}>Review</th>
              <th className={crmThClass}>Debt age</th>
              <th className={crmThClass}>Online recovery</th>
              <th className={crmThClass}>Auto offset</th>
              <th className={crmThClass}>Cadence</th>
              <th className={crmThClass}>Source</th>
              <th className={`${crmThClass} text-right`}>Control</th>
            </tr>
          </thead>
          <tbody>
            {(payload?.policies || []).map(policy => (
              <tr
                key={`${policy.countryCode}-${policy.providerType}-${policy.currency}`}
                className="transition-colors hover:bg-[#fafbf9]"
              >
                <td className={crmTdClass}>
                  <div className="font-semibold text-slate-900">{policy.countryCode}</div>
                  <div className="mt-1 text-[11px] text-slate-400">{policy.currency}</div>
                </td>
                <td className={crmTdClass}>
                  <CrmBadge tone={policy.providerType === 'COMPANY' ? 'info' : 'neutral'}>
                    {policy.providerType}
                  </CrmBadge>
                </td>
                <td className={crmTdClass}>{money(policy.warningThresholdMinor, policy.currency)}</td>
                <td className={crmTdClass}>
                  <span className="font-semibold text-amber-700">
                    {money(policy.cashRestrictionThresholdMinor, policy.currency)}
                  </span>
                </td>
                <td className={crmTdClass}>
                  <span className="font-semibold text-red-700">
                    {money(policy.reviewThresholdMinor, policy.currency)}
                  </span>
                </td>
                <td className={crmTdClass}>{policy.maxDebtAgeDays} days</td>
                <td className={crmTdClass}>
                  <CrmBadge tone={policy.allowOnlineWhenCashRestricted ? 'success' : 'danger'} dot>
                    {policy.allowOnlineWhenCashRestricted ? 'Allowed' : 'Blocked'}
                  </CrmBadge>
                </td>
                <td className={crmTdClass}>
                  <CrmBadge tone={policy.autoOffsetOnlineEarnings ? 'success' : 'neutral'} dot>
                    {policy.autoOffsetOnlineEarnings ? 'Enabled' : 'Off'}
                  </CrmBadge>
                </td>
                <td className={crmTdClass}>{policy.settlementCadence}</td>
                <td className={crmTdClass}>
                  <CrmBadge tone={policy.inheritedDefault ? 'warning' : 'info'}>
                    {policy.inheritedDefault ? 'Code default' : 'CRM override'}
                  </CrmBadge>
                </td>
                <td className={`${crmTdClass} text-right`}>
                  {payload?.canManage ? (
                    <CrmButton variant="secondary" size="sm" onClick={() => startEdit(policy)}>
                      <FiEdit2 size={13} />
                      Edit
                    </CrmButton>
                  ) : (
                    <span className="text-xs text-slate-400">Read-only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CrmTableFrame>

      {editing && form && (
        <CrmCard
          title={`Edit ${editing.countryCode} · ${editing.providerType} · ${editing.currency}`}
          description="Policy changes affect future eligibility evaluations. Existing ledger entries and receivable amounts are never rewritten."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <CrmField label={`Warning amount · ${editing.currency}`}>
              <input
                className={crmInputClass}
                inputMode="decimal"
                value={form.warning}
                onChange={event => setForm({ ...form, warning: event.target.value })}
              />
            </CrmField>
            <CrmField label={`Cash restriction · ${editing.currency}`}>
              <input
                className={crmInputClass}
                inputMode="decimal"
                value={form.cashRestriction}
                onChange={event => setForm({ ...form, cashRestriction: event.target.value })}
              />
            </CrmField>
            <CrmField label={`Manual review · ${editing.currency}`}>
              <input
                className={crmInputClass}
                inputMode="decimal"
                value={form.review}
                onChange={event => setForm({ ...form, review: event.target.value })}
              />
            </CrmField>
            <CrmField label="Maximum debt age (days)">
              <input
                className={crmInputClass}
                inputMode="numeric"
                value={form.maxDebtAgeDays}
                onChange={event => setForm({ ...form, maxDebtAgeDays: event.target.value })}
              />
            </CrmField>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Toggle
              label="Online jobs when cash-restricted"
              value={form.allowOnlineWhenCashRestricted}
              onChange={value => setForm({ ...form, allowOnlineWhenCashRestricted: value })}
            />
            <Toggle
              label="Auto-offset future online earnings"
              value={form.autoOffsetOnlineEarnings}
              onChange={value => setForm({ ...form, autoOffsetOnlineEarnings: value })}
            />
            <Toggle
              label="Policy enabled"
              value={form.enabled}
              onChange={value => setForm({ ...form, enabled: value })}
            />
            <CrmField label="Settlement cadence">
              <select
                className={crmInputClass}
                value={form.settlementCadence}
                onChange={event =>
                  setForm({
                    ...form,
                    settlementCadence: event.target.value as 'REALTIME' | 'WEEKLY',
                  })
                }
              >
                <option value="REALTIME">Realtime</option>
                <option value="WEEKLY">Weekly</option>
              </select>
            </CrmField>
          </div>

          <CrmField label="Change reason" className="mt-4">
            <textarea
              className={`${crmInputClass} min-h-[100px] py-2.5`}
              value={form.reason}
              onChange={event => setForm({ ...form, reason: event.target.value })}
              placeholder="Why is this policy changing?"
            />
          </CrmField>

          <div className="mt-4 flex items-center justify-end gap-2">
            <CrmButton
              variant="secondary"
              onClick={() => {
                setEditing(null)
                setForm(null)
              }}
              disabled={saving}
            >
              Cancel
            </CrmButton>
            <CrmButton onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save audited policy'}
            </CrmButton>
          </div>
        </CrmCard>
      )}
    </div>
  )
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      className="flex min-h-[58px] items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left"
      onClick={() => onChange(!value)}
    >
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <CrmBadge tone={value ? 'success' : 'neutral'} dot>
        {value ? 'On' : 'Off'}
      </CrmBadge>
    </button>
  )
}
