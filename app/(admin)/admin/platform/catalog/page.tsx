'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowLeft,
  FiEdit3,
  FiEye,
  FiGrid,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTool,
  FiUsers,
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import {
  CrmBadge,
  CrmButton,
  CrmField,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  CrmTableFrame,
  CrmTabs,
  crmInputClass,
  crmTableClass,
  crmTdClass,
  crmThClass,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmModal } from '@/components/crm/v2/CrmOverlays'
import { crmApiError } from '@/lib/crm/api-error'

type Tab = 'services' | 'categories' | 'templates'
type CreateType = 'category' | 'service'

interface CategoryRow {
  id: string
  name: string
  slug: string
  description?: string | null
  countryCode: string
  displayOrder: number
  isActive: boolean
  createdAt: string
  _count?: { services: number }
}

interface ServiceRow {
  id: string
  name: string
  slug: string
  shortDescription?: string | null
  price: number
  duration: number
  countryCode: string
  displayOrder: number
  views: number
  isTrending: boolean
  isActive: boolean
  createdAt: string
  category?: { id: string; name: string; slug: string }
}

interface TemplateRow {
  id: string
  name: string
  slug: string
  description?: string | null
  countryCode: string
  pricingMode: string
  priceMin?: number | null
  priceMax?: number | null
  currency?: string | null
  defaultDurationMinutes?: number | null
  benchmarkEligible: boolean
  isActive: boolean
  sortOrder: number
  createdAt: string
  jobCategory?: { id: string; name: string; slug: string }
}

interface Payload {
  categories: CategoryRow[]
  services: ServiceRow[]
  templates: TemplateRow[]
  jobCategories: Array<{
    id: string
    name: string
    slug: string
    countries: string[]
    isActive: boolean
  }>
}

interface CreateForm {
  name: string
  description: string
  countryCode: string
  categoryId: string
  price: string
  duration: string
  isActive: boolean
}

const EMPTY: Payload = {
  categories: [],
  services: [],
  templates: [],
  jobCategories: [],
}

const EMPTY_FORM: CreateForm = {
  name: '',
  description: '',
  countryCode: 'LK',
  categoryId: '',
  price: '0',
  duration: '60',
  isActive: false,
}

export default function CatalogManagementPage() {
  const { user } = useAdminSession()
  const canView = Boolean(user?.permissions?.includes('catalog:view'))
  const canEdit = Boolean(user?.permissions?.includes('catalog:edit'))
  const canPublish = Boolean(user?.permissions?.includes('catalog:publish'))

  const marketOptions = useMemo(() => {
    if (!user) return ['LK']
    const scoped = user.assignedCountries || []
    const known = user.markets?.map(market => market.code) || []
    const all = Array.from(new Set([...scoped, ...known]))
    return all.length ? all : ['LK']
  }, [user])

  const [data, setData] = useState<Payload>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('services')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createType, setCreateType] = useState<CreateType>('service')
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/platform/catalog', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Unable to load catalog')
      setData({
        categories: body.categories || [],
        services: body.services || [],
        templates: body.templates || [],
        jobCategories: body.jobCategories || [],
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load catalog')
    } finally {
      setLoading(false)
    }
  }, [canView])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!marketOptions.includes(form.countryCode)) {
      setForm(current => ({ ...current, countryCode: marketOptions[0] }))
    }
  }, [form.countryCode, marketOptions])

  const rows = useMemo(() => {
    const list =
      tab === 'services' ? data.services :
      tab === 'categories' ? data.categories :
      data.templates

    const normalized = query.trim().toLowerCase()
    if (!normalized) return list

    return list.filter((item: any) =>
      [
        item.name,
        item.slug,
        item.countryCode,
        item.category?.name,
        item.jobCategory?.name,
        item.pricingMode,
      ].some(value => String(value || '').toLowerCase().includes(normalized))
    )
  }, [data, query, tab])

  const activeCount =
    data.categories.filter(item => item.isActive).length +
    data.services.filter(item => item.isActive).length +
    data.templates.filter(item => item.isActive).length

  async function toggle(type: 'category' | 'service' | 'template', item: any) {
    if (!canPublish) return

    setBusy(item.id)
    try {
      const response = await fetch('/api/admin/platform/catalog', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          id: item.id,
          isActive: !item.isActive,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Catalog publication update failed')
      toast.success(`${item.name} ${item.isActive ? 'deactivated' : 'activated'}`)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Catalog update failed')
    } finally {
      setBusy(null)
    }
  }

  function openCreate() {
    if (!canEdit) return
    setForm({
      ...EMPTY_FORM,
      countryCode: marketOptions[0] || 'LK',
      isActive: false,
    })
    setCreateType('service')
    setShowCreate(true)
  }

  async function create() {
    if (!canEdit) return
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (createType === 'service' && !form.categoryId) {
      toast.error('Select a category')
      return
    }

    setBusy('create')
    try {
      const payload =
        createType === 'category'
          ? {
              type: 'category',
              name: form.name.trim(),
              description: form.description.trim(),
              countryCode: form.countryCode,
              isActive: canPublish ? form.isActive : false,
            }
          : {
              type: 'service',
              name: form.name.trim(),
              description: form.description.trim(),
              countryCode: form.countryCode,
              categoryId: form.categoryId,
              price: Number(form.price),
              duration: Number(form.duration),
              isActive: canPublish ? form.isActive : false,
            }

      const response = await fetch('/api/admin/platform/catalog', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Catalog item creation failed')

      toast.success(
        canPublish && form.isActive
          ? `${createType === 'category' ? 'Category' : 'Service'} created and published`
          : `${createType === 'category' ? 'Category' : 'Service'} created as inactive draft`
      )
      setShowCreate(false)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Catalog item creation failed')
    } finally {
      setBusy(null)
    }
  }

  if (!canView && user) {
    return (
      <CrmState
        type="permission"
        title="Catalog access required"
        description="Your current staff permissions do not allow this marketplace catalog workspace."
      />
    )
  }

  if (loading) {
    return (
      <CrmState
        type="loading"
        title="Loading marketplace catalog"
        description="Loading categories, services and canonical service templates for your market scope."
      />
    )
  }

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="App & Web · Canonical catalog"
        title="Services & categories"
        description="Manage the marketplace catalog without destructive deletes. Editing and public activation use separate permissions."
        actions={
          <>
            <CrmButton variant="secondary" onClick={load}>
              <FiRefreshCw size={14} />
              Refresh
            </CrmButton>
            <Link
              href="/admin/platform/professions"
              className="inline-flex h-10 items-center gap-2 rounded-[11px] border border-[var(--crm-border)] bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FiUsers size={14} />
              Professions & skills
            </Link>
            {canEdit && (
              <CrmButton variant="primary" onClick={openCreate}>
                <FiPlus size={14} />
                Create item
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
            <CrmBadge tone={canEdit ? 'success' : 'neutral'} dot>
              {canEdit ? 'Edit access' : 'Read-only'}
            </CrmBadge>
            <CrmBadge tone={canPublish ? 'amber' : 'neutral'}>
              {canPublish ? 'Publish authority' : 'Draft only'}
            </CrmBadge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CrmMetricCard
          label="Categories"
          value={data.categories.length.toLocaleString()}
          helper={`${data.categories.filter(item => item.isActive).length} active`}
          icon={<FiGrid size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="Services"
          value={data.services.length.toLocaleString()}
          helper={`${data.services.filter(item => item.isActive).length} active`}
          icon={<FiTool size={16} />}
          tone="amber"
        />
        <CrmMetricCard
          label="Service templates"
          value={data.templates.length.toLocaleString()}
          helper={`${data.templates.filter(item => item.isActive).length} active`}
          icon={<FiEdit3 size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="Published entries"
          value={activeCount.toLocaleString()}
          helper="Across visible catalog sources"
          icon={<FiEye size={16} />}
          tone="neutral"
        />
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <CrmTabs
          items={[
            { id: 'services', label: 'Services', count: data.services.length },
            { id: 'categories', label: 'Categories', count: data.categories.length },
            { id: 'templates', label: 'Templates', count: data.templates.length },
          ]}
          active={tab}
          onChange={id => setTab(id as Tab)}
        />

        <div className="relative w-full lg:w-80">
          <FiSearch
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search catalog…"
            className={`${crmInputClass} pl-9`}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <CrmState
          type="empty"
          title="No catalog entries found"
          description="No entries match the current tab and search filter."
        />
      ) : (
        <CrmTableFrame
          title={tab === 'services' ? 'Services' : tab === 'categories' ? 'Categories' : 'Service templates'}
          description="Current market-scoped catalog records."
        >
          <table className={crmTableClass}>
            <thead>
              <tr>
                <th className={crmThClass}>Item</th>
                <th className={crmThClass}>Market</th>
                <th className={crmThClass}>Configuration</th>
                <th className={crmThClass}>Status</th>
                <th className={`${crmThClass} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item: any) => {
                const type =
                  tab === 'services' ? 'service' :
                  tab === 'categories' ? 'category' :
                  'template'

                const detail =
                  tab === 'services'
                    ? `${item.category?.name || 'Uncategorised'} · ${item.price ?? 0} · ${item.duration ?? 0} min`
                    : tab === 'categories'
                      ? `${item._count?.services || 0} services · order ${item.displayOrder ?? 0}`
                      : `${item.jobCategory?.name || 'No job category'} · ${String(item.pricingMode || 'UNSET').replaceAll('_', ' ')}`

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className={crmTdClass}>
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="mt-1 text-[11px] text-slate-400">{item.slug || item.id}</div>
                    </td>
                    <td className={crmTdClass}>
                      <CrmBadge tone="info">{item.countryCode || 'MULTI'}</CrmBadge>
                    </td>
                    <td className={crmTdClass}>
                      <div className="max-w-[360px] text-xs text-slate-500">{detail}</div>
                    </td>
                    <td className={crmTdClass}>
                      <CrmBadge tone={item.isActive ? 'success' : 'neutral'} dot>
                        {item.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </CrmBadge>
                    </td>
                    <td className={`${crmTdClass} text-right`}>
                      {canPublish ? (
                        <CrmButton
                          size="sm"
                          variant={item.isActive ? 'secondary' : 'primary'}
                          disabled={busy === item.id}
                          onClick={() => toggle(type, item)}
                        >
                          {item.isActive ? 'Deactivate' : 'Activate'}
                        </CrmButton>
                      ) : (
                        <span className="text-[11px] text-slate-400">No publish permission</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CrmTableFrame>
      )}

      <CrmModal
        open={showCreate}
        onClose={() => {
          if (busy !== 'create') setShowCreate(false)
        }}
        title="Create catalog item"
        description={
          canPublish
            ? 'Create an inactive draft or publish immediately.'
            : 'You can create drafts. Publishing requires catalog:publish.'
        }
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
              {busy === 'create' ? 'Creating…' : 'Create item'}
            </CrmButton>
          </>
        }
      >
        <div className="space-y-4">
          <CrmTabs
            items={[
              { id: 'service', label: 'Service' },
              { id: 'category', label: 'Category' },
            ]}
            active={createType}
            onChange={id => setCreateType(id as CreateType)}
          />

          <CrmField label="Name">
            <input
              value={form.name}
              onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
              className={crmInputClass}
              placeholder={createType === 'service' ? 'e.g. AC servicing' : 'e.g. Appliance repair'}
              maxLength={120}
            />
          </CrmField>

          <CrmField label="Description">
            <textarea
              value={form.description}
              onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
              className={`${crmInputClass} h-auto min-h-[96px] resize-y py-2.5`}
              maxLength={createType === 'service' ? 5000 : 1000}
            />
          </CrmField>

          <CrmField label="Market">
            <select
              value={form.countryCode}
              onChange={event => setForm(current => ({
                ...current,
                countryCode: event.target.value,
                categoryId: '',
              }))}
              className={crmInputClass}
            >
              {marketOptions.map(code => (
                <option key={code} value={code}>
                  {user?.markets?.find(market => market.code === code)?.name || code}
                </option>
              ))}
            </select>
          </CrmField>

          {createType === 'service' && (
            <>
              <CrmField label="Category">
                <select
                  value={form.categoryId}
                  onChange={event => setForm(current => ({ ...current, categoryId: event.target.value }))}
                  className={crmInputClass}
                >
                  <option value="">Select category</option>
                  {data.categories
                    .filter(category => category.countryCode === form.countryCode)
                    .map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </CrmField>

              <div className="grid gap-4 sm:grid-cols-2">
                <CrmField label="Base price">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={event => setForm(current => ({ ...current, price: event.target.value }))}
                    className={crmInputClass}
                  />
                </CrmField>
                <CrmField label="Duration (minutes)">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.duration}
                    onChange={event => setForm(current => ({ ...current, duration: event.target.value }))}
                    className={crmInputClass}
                  />
                </CrmField>
              </div>
            </>
          )}

          <label className="flex items-start justify-between gap-4 rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-4">
            <div>
              <div className="text-sm font-semibold text-slate-800">Publish immediately</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                {canPublish
                  ? 'If disabled, the item is created as an inactive draft.'
                  : 'You do not have publication authority. The item will be created inactive.'}
              </div>
            </div>
            <input
              type="checkbox"
              checked={canPublish && form.isActive}
              disabled={!canPublish}
              onChange={event => setForm(current => ({ ...current, isActive: event.target.checked }))}
              className="mt-0.5 h-5 w-5 accent-amber-500"
            />
          </label>
        </div>
      </CrmModal>
    </div>
  )
}
