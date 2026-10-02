'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowLeft,
  FiCreditCard,
  FiPlus,
  FiRefreshCw,
  FiShield,
  FiUsers,
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
import { CrmModal } from '@/components/crm/v2/CrmOverlays'
import { crmApiError } from '@/lib/crm/api-error'

interface Plan {
  id: string
  name: string
  price: number
  currency: string
  countryCode: string
  description?: string | null
  features: string[]
  isActive: boolean
  createdAt: string
}

interface Subscription {
  id: string
  companyId: string
  companyName: string
  companyMxId?: string | null
  countryCode: string
  planId: string
  planName: string
  price: number
  currency: string
  status: string
  autoRenew: boolean
  startDate: string
  endDate?: string | null
  createdAt: string
}

interface Payload {
  plans: Plan[]
  subscriptions: Subscription[]
  metrics: {
    plans: number
    activePlans: number
    activeSubscriptions: number
    cancelledSubscriptions: number
    trialCompanies: number
    activeCompanies: number
    pastDueCompanies: number
  }
  canManage: boolean
}

const EMPTY: Payload = {
  plans: [],
  subscriptions: [],
  metrics: {
    plans: 0,
    activePlans: 0,
    activeSubscriptions: 0,
    cancelledSubscriptions: 0,
    trialCompanies: 0,
    activeCompanies: 0,
    pastDueCompanies: 0,
  },
  canManage: false,
}

export default function SubscriptionsPage() {
  const { user } = useAdminSession()
  const canView = Boolean(user?.permissions?.includes('subscriptions:view'))
  const canManagePermission = Boolean(user?.permissions?.includes('subscriptions:manage'))

  const markets = useMemo(() => {
    if (!user) return ['LK']
    const scoped = user.assignedCountries || []
    const configured = user.markets?.map(market => market.code) || []
    const merged = Array.from(new Set([...scoped, ...configured]))
    return merged.length ? merged : ['LK']
  }, [user])

  const [data, setData] = useState<Payload>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '',
    countryCode: 'LK',
    price: '0',
    description: '',
    features: '',
  })

  const canManage = canManagePermission && data.canManage

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/platform/subscriptions', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Unable to load subscriptions')
      setData({
        plans: body.plans || [],
        subscriptions: body.subscriptions || [],
        metrics: body.metrics || EMPTY.metrics,
        canManage: Boolean(body.canManage),
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load subscriptions')
    } finally {
      setLoading(false)
    }
  }, [canView])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!markets.includes(form.countryCode)) {
      setForm(current => ({ ...current, countryCode: markets[0] || 'LK' }))
    }
  }, [form.countryCode, markets])

  async function createPlan() {
    if (!canManage) return
    const price = Number(form.price)
    if (form.name.trim().length < 2 || !Number.isFinite(price) || price < 0) {
      toast.error('Enter a valid plan name and price')
      return
    }

    setBusy('create')
    try {
      const response = await fetch('/api/admin/platform/subscriptions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          countryCode: form.countryCode,
          price,
          description: form.description.trim(),
          features: form.features
            .split('\n')
            .map(item => item.trim())
            .filter(Boolean),
          isActive: true,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Plan creation failed')
      toast.success('Subscription plan created')
      setShowCreate(false)
      setForm({
        name: '',
        countryCode: markets[0] || 'LK',
        price: '0',
        description: '',
        features: '',
      })
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Plan creation failed')
    } finally {
      setBusy(null)
    }
  }

  async function togglePlan(plan: Plan) {
    if (!canManage) return
    setBusy(plan.id)
    try {
      const response = await fetch('/api/admin/platform/subscriptions', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan.id, isActive: !plan.isActive }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Plan update failed')
      toast.success(`${plan.name} ${plan.isActive ? 'deactivated' : 'activated'}`)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Plan update failed')
    } finally {
      setBusy(null)
    }
  }

  if (!canView && user) {
    return (
      <CrmState
        type="permission"
        title="Subscription access required"
        description="Your current staff permissions do not allow this subscription workspace."
      />
    )
  }

  if (loading) {
    return (
      <CrmState
        type="loading"
        title="Loading subscriptions"
        description="Loading market-scoped plans and company subscription state."
      />
    )
  }

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="App & Web · Subscriptions"
        title="Company subscriptions"
        description="Operate market-specific plans while preserving the exact plan name, price and currency captured by every historical subscription."
        actions={
          <>
            <CrmButton variant="secondary" onClick={load}>
              <FiRefreshCw size={14} />
              Refresh
            </CrmButton>
            {canManage && (
              <CrmButton variant="primary" onClick={() => setShowCreate(true)}>
                <FiPlus size={14} />
                New plan
              </CrmButton>
            )}
          </>
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
            <CrmBadge tone="success" dot>
              Market scoped
            </CrmBadge>
            <CrmBadge tone={canManage ? 'amber' : 'neutral'}>
              {canManage ? 'Owner plan control' : 'Read-only'}
            </CrmBadge>
            <CrmBadge tone="info">Immutable price snapshots</CrmBadge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CrmMetricCard
          label="Active plans"
          value={data.metrics.activePlans.toLocaleString()}
          helper={`${data.metrics.plans} total plans`}
          icon={<FiCreditCard size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="Active subscriptions"
          value={data.metrics.activeSubscriptions.toLocaleString()}
          helper={`${data.metrics.cancelledSubscriptions} cancelled`}
          icon={<FiUsers size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="Company trials"
          value={data.metrics.trialCompanies.toLocaleString()}
          helper="Current trial state"
          icon={<FiShield size={16} />}
          tone="amber"
        />
        <CrmMetricCard
          label="Past due"
          value={data.metrics.pastDueCompanies.toLocaleString()}
          helper={`${data.metrics.activeCompanies} active companies`}
          icon={<FiCreditCard size={16} />}
          tone={data.metrics.pastDueCompanies > 0 ? 'warning' : 'neutral'}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_1.4fr]">
        <CrmCard
          title="Plan catalogue"
          description="Plans are immutable for price history. To change pricing, create a new plan and retire the old one."
          action={<CrmBadge tone="neutral">{data.plans.length} plans</CrmBadge>}
        >
          {data.plans.length === 0 ? (
            <Empty label="No subscription plans configured" />
          ) : (
            <div className="space-y-2">
              {data.plans.map(plan => (
                <div
                  key={plan.id}
                  className="rounded-xl border border-[var(--crm-border)] p-3.5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-900">{plan.name}</div>
                        <CrmBadge tone={plan.isActive ? 'success' : 'neutral'} dot>
                          {plan.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </CrmBadge>
                        <CrmBadge tone="info">{plan.countryCode}</CrmBadge>
                      </div>
                      <div className="mt-1 text-lg font-bold text-slate-950">
                        {plan.currency} {plan.price.toLocaleString()}
                      </div>
                      {plan.description && (
                        <div className="mt-1 text-xs leading-5 text-slate-500">{plan.description}</div>
                      )}
                      {plan.features.length > 0 && (
                        <div className="mt-2 text-[11px] leading-5 text-slate-400">
                          {plan.features.join(' · ')}
                        </div>
                      )}
                    </div>
                    {canManage && (
                      <CrmButton
                        size="sm"
                        variant={plan.isActive ? 'secondary' : 'primary'}
                        disabled={busy === plan.id}
                        onClick={() => togglePlan(plan)}
                      >
                        {plan.isActive ? 'Retire' : 'Reactivate'}
                      </CrmButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CrmCard>

        <CrmCard
          title="Recent company subscriptions"
          description="Operational history uses the captured plan snapshot, not the current plan price."
          action={<CrmBadge tone="info">{data.subscriptions.length} recent</CrmBadge>}
        >
          {data.subscriptions.length === 0 ? (
            <Empty label="No company subscriptions found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-[var(--crm-border)] text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    <th className="px-2 py-2">Company</th>
                    <th className="px-2 py-2">Market</th>
                    <th className="px-2 py-2">Plan</th>
                    <th className="px-2 py-2">Captured price</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subscriptions.map(item => (
                    <tr key={item.id} className="border-b border-[var(--crm-border)] last:border-0">
                      <td className="px-2 py-3">
                        <div className="text-xs font-semibold text-slate-800">{item.companyName}</div>
                        <div className="mt-0.5 text-[10px] text-slate-400">{item.companyMxId || item.companyId}</div>
                      </td>
                      <td className="px-2 py-3 text-xs text-slate-600">{item.countryCode}</td>
                      <td className="px-2 py-3 text-xs font-medium text-slate-700">{item.planName}</td>
                      <td className="px-2 py-3 text-xs font-semibold text-slate-800">
                        {item.currency} {item.price.toLocaleString()}
                      </td>
                      <td className="px-2 py-3">
                        <CrmBadge tone={statusTone(item.status)} dot>{item.status}</CrmBadge>
                      </td>
                      <td className="px-2 py-3 text-xs text-slate-500">{formatDate(item.startDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CrmCard>
      </section>

      <CrmModal
        open={showCreate}
        onClose={() => {
          if (busy !== 'create') setShowCreate(false)
        }}
        title="Create subscription plan"
        description="A new immutable market-specific plan is created. Existing subscription snapshots are never rewritten."
        footer={
          <>
            <CrmButton
              variant="secondary"
              disabled={busy === 'create'}
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </CrmButton>
            <CrmButton
              variant="primary"
              disabled={busy === 'create'}
              onClick={createPlan}
            >
              {busy === 'create' ? 'Creating…' : 'Create plan'}
            </CrmButton>
          </>
        }
      >
        <div className="space-y-4">
          <CrmField label="Plan name">
            <input
              value={form.name}
              maxLength={120}
              onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
              className={crmInputClass}
              placeholder="Professional"
            />
          </CrmField>
          <div className="grid gap-4 sm:grid-cols-2">
            <CrmField label="Market">
              <select
                value={form.countryCode}
                onChange={event => setForm(current => ({ ...current, countryCode: event.target.value }))}
                className={crmInputClass}
              >
                {markets.map(code => (
                  <option key={code} value={code}>
                    {user?.markets?.find(market => market.code === code)?.name || code}
                  </option>
                ))}
              </select>
            </CrmField>
            <CrmField label="Monthly price" hint="Currency is derived from the market server-side.">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={event => setForm(current => ({ ...current, price: event.target.value }))}
                className={crmInputClass}
              />
            </CrmField>
          </div>
          <CrmField label="Description">
            <textarea
              value={form.description}
              maxLength={2000}
              rows={3}
              onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
              className={`${crmInputClass} h-auto min-h-[90px] resize-y py-2.5`}
            />
          </CrmField>
          <CrmField label="Features" hint="One feature per line. Maximum 50.">
            <textarea
              value={form.features}
              rows={5}
              onChange={event => setForm(current => ({ ...current, features: event.target.value }))}
              className={`${crmInputClass} h-auto min-h-[120px] resize-y py-2.5`}
              placeholder={'Priority support\nLower commission\nAdvanced reporting'}
            />
          </CrmField>
        </div>
      </CrmModal>
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return <div className="py-10 text-center text-xs text-slate-400">{label}</div>
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-LK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ACTIVE') return 'success'
  if (status === 'PAST_DUE') return 'warning'
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'danger'
  return 'neutral'
}
