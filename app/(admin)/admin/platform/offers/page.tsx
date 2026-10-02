'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowLeft,
  FiClock,
  FiPlus,
  FiRefreshCw,
  FiTag,
  FiZap,
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
  CrmTabs,
  crmInputClass,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmModal } from '@/components/crm/v2/CrmOverlays'

interface SeasonalOffer {
  id: string
  title: string
  description?: string | null
  season: string
  country: string
  isActive: boolean
  createdAt: string
  _count?: { jobs: number }
}

interface FlashOffer {
  id: string
  title: string
  description?: string | null
  discountType: 'PERCENTAGE' | 'FLAT' | string
  discountValue: number
  startsAt: string
  expiresAt: string
  currentClaims: number
  maxClaims: number
  isActive: boolean
  createdAt: string
}

interface Payload {
  seasonal: SeasonalOffer[]
  flash: FlashOffer[]
  canManageGlobalFlash: boolean
}

interface OfferForm {
  title: string
  description: string
  season: string
  country: string
  discountType: 'PERCENTAGE' | 'FLAT'
  discountValue: string
  startsAt: string
  expiresAt: string
  isActive: boolean
}

const EMPTY_FORM: OfferForm = {
  title: '',
  description: '',
  season: 'general',
  country: 'LK',
  discountType: 'PERCENTAGE',
  discountValue: '10',
  startsAt: '',
  expiresAt: '',
  isActive: false,
}

export default function OffersManagementPage() {
  const { user } = useAdminSession()
  const canView = Boolean(user?.permissions?.includes('promotions:view'))
  const canManage = Boolean(user?.permissions?.includes('promotions:manage'))

  const markets = useMemo(() => {
    if (!user) return ['LK']
    const scoped = user.assignedCountries || []
    const known = user.markets?.map(market => market.code) || []
    const merged = Array.from(new Set([...scoped, ...known]))
    return merged.length ? merged : ['LK']
  }, [user])

  const [data, setData] = useState<Payload>({
    seasonal: [],
    flash: [],
    canManageGlobalFlash: false,
  })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [type, setType] = useState<'seasonal' | 'flash'>('seasonal')
  const [form, setForm] = useState<OfferForm>(EMPTY_FORM)

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/platform/offers', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Unable to load offers')
      setData({
        seasonal: body.seasonal || [],
        flash: body.flash || [],
        canManageGlobalFlash: Boolean(body.canManageGlobalFlash),
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load offers')
    } finally {
      setLoading(false)
    }
  }, [canView])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!markets.includes(form.country)) {
      setForm(current => ({ ...current, country: markets[0] }))
    }
  }, [form.country, markets])

  const activeSeasonal = data.seasonal.filter(item => item.isActive).length
  const activeFlash = data.flash.filter(
    item => item.isActive && new Date(item.expiresAt) > new Date()
  ).length

  async function toggle(kind: 'seasonal' | 'flash', item: SeasonalOffer | FlashOffer) {
    if (!canManage) return
    if (kind === 'flash' && !data.canManageGlobalFlash) return

    setBusy(item.id)
    try {
      const response = await fetch('/api/admin/platform/offers', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: kind,
          id: item.id,
          isActive: !item.isActive,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Promotion update failed')
      toast.success(`${item.title} ${item.isActive ? 'deactivated' : 'activated'}`)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Promotion update failed')
    } finally {
      setBusy(null)
    }
  }

  function openCreate() {
    if (!canManage) return
    setType('seasonal')
    setForm({
      ...EMPTY_FORM,
      country: markets[0] || 'LK',
    })
    setShowCreate(true)
  }

  async function create() {
    if (!canManage) return
    if (!form.title.trim()) {
      toast.error('Offer title is required')
      return
    }

    if (type === 'flash') {
      const discount = Number(form.discountValue)
      if (!Number.isFinite(discount) || discount <= 0) {
        toast.error('Enter a valid discount value')
        return
      }
      if (form.discountType === 'PERCENTAGE' && discount > 100) {
        toast.error('Percentage discounts cannot exceed 100%')
        return
      }
      if (!form.startsAt || !form.expiresAt) {
        toast.error('Flash offers require a start and expiry time')
        return
      }
    }

    setBusy('create')
    try {
      const payload =
        type === 'seasonal'
          ? {
              type,
              title: form.title.trim(),
              description: form.description.trim(),
              season: form.season,
              country: form.country,
              isActive: form.isActive,
            }
          : {
              type,
              title: form.title.trim(),
              description: form.description.trim(),
              discountType: form.discountType,
              discountValue: Number(form.discountValue),
              startsAt: form.startsAt,
              expiresAt: form.expiresAt,
              isActive: form.isActive,
            }

      const response = await fetch('/api/admin/platform/offers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Promotion creation failed')

      toast.success('Promotion created and audited')
      setShowCreate(false)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Promotion creation failed')
    } finally {
      setBusy(null)
    }
  }

  if (!canView && user) {
    return (
      <CrmState
        type="permission"
        title="Promotion access required"
        description="Your current staff permissions do not allow this promotions workspace."
      />
    )
  }

  if (loading) {
    return (
      <CrmState
        type="loading"
        title="Loading promotions"
        description="Loading seasonal and flash campaigns available to your staff scope."
      />
    )
  }

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="App & Web · Promotions"
        title="Offers & promotions"
        description="Operate real seasonal and flash campaigns with market scoping, owner-only global controls and audited mutations."
        actions={
          <>
            <CrmButton variant="secondary" onClick={load}>
              <FiRefreshCw size={14} />
              Refresh
            </CrmButton>
            {canManage && (
              <CrmButton variant="primary" onClick={openCreate}>
                <FiPlus size={14} />
                New offer
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
            <CrmBadge tone={canManage ? 'success' : 'neutral'} dot>
              {canManage ? 'Campaign management' : 'Read-only'}
            </CrmBadge>
            <CrmBadge tone={data.canManageGlobalFlash ? 'amber' : 'neutral'}>
              {data.canManageGlobalFlash ? 'Global flash authority' : 'Market-scoped'}
            </CrmBadge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CrmMetricCard
          label="Seasonal offers"
          value={data.seasonal.length.toLocaleString()}
          helper={`${activeSeasonal} active`}
          icon={<FiTag size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="Active seasonal"
          value={activeSeasonal.toLocaleString()}
          helper="Visible campaigns"
          icon={<FiTag size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="Flash offers"
          value={data.flash.length.toLocaleString()}
          helper="Global campaigns"
          icon={<FiZap size={16} />}
          tone="amber"
        />
        <CrmMetricCard
          label="Live flash"
          value={activeFlash.toLocaleString()}
          helper="Active and unexpired"
          icon={<FiClock size={16} />}
          tone={activeFlash > 0 ? 'warning' : 'neutral'}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <CrmCard
          title="Seasonal offers"
          description="Country-scoped campaigns and seasonal merchandising."
          action={<CrmBadge tone="info">{data.seasonal.length} total</CrmBadge>}
        >
          {data.seasonal.length === 0 ? (
            <Empty label="No seasonal offers" />
          ) : (
            <div className="space-y-2">
              {data.seasonal.map(item => (
                <OfferRow
                  key={item.id}
                  title={item.title}
                  meta={`${item.country} · ${item.season} · ${item._count?.jobs || 0} linked jobs`}
                  active={item.isActive}
                  canManage={canManage}
                  busy={busy === item.id}
                  onToggle={() => toggle('seasonal', item)}
                />
              ))}
            </div>
          )}
        </CrmCard>

        <CrmCard
          title="Flash offers"
          description="Global high-visibility campaigns. Mutation is owner-only."
          action={<CrmBadge tone="amber">{data.flash.length} total</CrmBadge>}
        >
          {data.flash.length === 0 ? (
            <Empty label="No flash offers" />
          ) : (
            <div className="space-y-2">
              {data.flash.map(item => (
                <OfferRow
                  key={item.id}
                  title={item.title}
                  meta={`${item.discountType} ${item.discountValue} · ${item.currentClaims}/${item.maxClaims} claims · expires ${formatDate(item.expiresAt)}`}
                  active={item.isActive && new Date(item.expiresAt) > new Date()}
                  canManage={canManage && data.canManageGlobalFlash}
                  busy={busy === item.id}
                  onToggle={() => toggle('flash', item)}
                />
              ))}
            </div>
          )}

          {!data.canManageGlobalFlash && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              Global flash offers are visible for operational awareness, but only SUPER_ADMIN can create or modify them.
            </div>
          )}
        </CrmCard>
      </section>

      <CrmModal
        open={showCreate}
        onClose={() => {
          if (busy !== 'create') setShowCreate(false)
        }}
        title="Create promotion"
        description="Campaign creation is permission-gated, validated and audited."
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
              onClick={create}
            >
              {busy === 'create' ? 'Creating…' : 'Create promotion'}
            </CrmButton>
          </>
        }
      >
        <div className="space-y-4">
          <CrmTabs
            items={[
              { id: 'seasonal', label: 'Seasonal' },
              ...(data.canManageGlobalFlash ? [{ id: 'flash', label: 'Flash' }] : []),
            ]}
            active={type}
            onChange={id => setType(id as 'seasonal' | 'flash')}
          />

          <CrmField label="Title">
            <input
              value={form.title}
              onChange={event => setForm(current => ({ ...current, title: event.target.value }))}
              maxLength={160}
              className={crmInputClass}
              placeholder="Campaign title"
            />
          </CrmField>

          <CrmField label="Description">
            <textarea
              value={form.description}
              onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
              maxLength={1500}
              rows={3}
              className={`${crmInputClass} h-auto min-h-[90px] resize-y py-2.5`}
            />
          </CrmField>

          {type === 'seasonal' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <CrmField label="Season">
                <select
                  value={form.season}
                  onChange={event => setForm(current => ({ ...current, season: event.target.value }))}
                  className={crmInputClass}
                >
                  {['general', 'spring', 'summer', 'fall', 'winter'].map(season => (
                    <option key={season} value={season}>{season}</option>
                  ))}
                </select>
              </CrmField>
              <CrmField label="Market">
                <select
                  value={form.country}
                  onChange={event => setForm(current => ({ ...current, country: event.target.value }))}
                  className={crmInputClass}
                >
                  {markets.map(code => (
                    <option key={code} value={code}>
                      {user?.markets?.find(market => market.code === code)?.name || code}
                    </option>
                  ))}
                </select>
              </CrmField>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <CrmField label="Discount type">
                  <select
                    value={form.discountType}
                    onChange={event => setForm(current => ({
                      ...current,
                      discountType: event.target.value as 'PERCENTAGE' | 'FLAT',
                    }))}
                    className={crmInputClass}
                  >
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FLAT">Flat</option>
                  </select>
                </CrmField>
                <CrmField
                  label="Discount value"
                  hint={form.discountType === 'PERCENTAGE' ? 'Maximum 100%.' : 'Global flat value configured by owner.'}
                >
                  <input
                    type="number"
                    min="0"
                    max={form.discountType === 'PERCENTAGE' ? 100 : undefined}
                    step="0.01"
                    value={form.discountValue}
                    onChange={event => setForm(current => ({ ...current, discountValue: event.target.value }))}
                    className={crmInputClass}
                  />
                </CrmField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <CrmField label="Starts at">
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={event => setForm(current => ({ ...current, startsAt: event.target.value }))}
                    className={crmInputClass}
                  />
                </CrmField>
                <CrmField label="Expires at">
                  <input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={event => setForm(current => ({ ...current, expiresAt: event.target.value }))}
                    className={crmInputClass}
                  />
                </CrmField>
              </div>
            </>
          )}

          <label className="flex items-start justify-between gap-4 rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-4">
            <div>
              <div className="text-sm font-semibold text-slate-800">Activate immediately</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                Disabled campaigns remain stored but are not active.
              </div>
            </div>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={event => setForm(current => ({ ...current, isActive: event.target.checked }))}
              className="mt-0.5 h-5 w-5 accent-amber-500"
            />
          </label>
        </div>
      </CrmModal>
    </div>
  )
}

function OfferRow({
  title,
  meta,
  active,
  canManage,
  busy,
  onToggle,
}: {
  title: string
  meta: string
  active: boolean
  canManage: boolean
  busy: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--crm-border)] p-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-800">{title}</div>
        <div className="mt-1 text-[11px] leading-5 text-slate-400">{meta}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <CrmBadge tone={active ? 'success' : 'neutral'} dot>
          {active ? 'ACTIVE' : 'INACTIVE'}
        </CrmBadge>
        {canManage && (
          <CrmButton
            size="sm"
            variant={active ? 'secondary' : 'primary'}
            disabled={busy}
            onClick={onToggle}
          >
            {active ? 'Deactivate' : 'Activate'}
          </CrmButton>
        )}
      </div>
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="py-10 text-center text-xs text-slate-400">
      <FiClock className="mx-auto mb-2" size={17} />
      {label}
    </div>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-LK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
