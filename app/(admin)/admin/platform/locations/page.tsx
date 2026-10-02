'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowLeft,
  FiEdit3,
  FiMapPin,
  FiPlus,
  FiRefreshCw,
  FiUploadCloud,
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
} from '@/components/crm/v2/CrmPrimitives'
import { CrmModal } from '@/components/crm/v2/CrmOverlays'
import { crmApiError } from '@/lib/crm/api-error'

type Area = { id: string; name: string }
type City = { id: string; name: string; areas: Area[] }
type StateRow = { id: string; name: string; cities: City[] }
type Country = { id: string; name: string; code: string; states: StateRow[]; _source?: 'database' | 'static-fallback' }

type Payload = {
  source: 'database' | 'hybrid' | 'static-fallback'
  countries: Country[]
}

type CreateType = 'country' | 'state' | 'city' | 'area'

export default function LocationsManagementPage() {
  const { user } = useAdminSession()
  const canView = Boolean(user?.permissions?.includes('markets:view'))
  const canManage = Boolean(user?.permissions?.includes('markets:manage'))
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<string>('')

  const [showCreate, setShowCreate] = useState(false)
  const [createType, setCreateType] = useState<CreateType>('state')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [parentStateId, setParentStateId] = useState('')
  const [parentCityId, setParentCityId] = useState('')

  const [renameTarget, setRenameTarget] = useState<{
    type: CreateType
    id: string
    name: string
  } | null>(null)
  const [renameName, setRenameName] = useState('')

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/platform/locations', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Unable to load locations')
      setData(body)
      const countries: Country[] = body.countries || []
      setSelectedCountry(current =>
        countries.some(country => country.code === current)
          ? current
          : countries[0]?.code || ''
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load locations')
    } finally {
      setLoading(false)
    }
  }, [canView])

  useEffect(() => {
    load()
  }, [load])

  const country = useMemo(
    () => data?.countries.find(item => item.code === selectedCountry) || null,
    [data, selectedCountry]
  )
  const countryIsFallback = country?._source === 'static-fallback'

  const totals = useMemo(() => {
    const countries = data?.countries || []
    const states = countries.reduce((sum, item) => sum + item.states.length, 0)
    const cities = countries.reduce(
      (sum, item) => sum + item.states.reduce((inner, state) => inner + state.cities.length, 0),
      0
    )
    const areas = countries.reduce(
      (sum, item) =>
        sum +
        item.states.reduce(
          (inner, state) =>
            inner + state.cities.reduce((citySum, city) => citySum + city.areas.length, 0),
          0
        ),
      0
    )
    return { countries: countries.length, states, cities, areas }
  }, [data])

  function openCreate(type: CreateType, stateId = '', cityId = '') {
    setCreateType(type)
    setName('')
    setCode('')
    setParentStateId(stateId)
    setParentCityId(cityId)
    setShowCreate(true)
  }

  async function create() {
    if (!canManage || !name.trim()) return
    if (!country && createType !== 'country') return

    const payload: Record<string, unknown> = {
      type: createType,
      name: name.trim(),
    }

    if (createType === 'country') payload.code = code.trim().toUpperCase()
    if (createType === 'state') payload.countryId = country?.id
    if (createType === 'city') payload.stateId = parentStateId
    if (createType === 'area') payload.cityId = parentCityId

    setBusy('create')
    try {
      const response = await fetch('/api/admin/platform/locations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Location creation failed')
      toast.success(`${createType[0].toUpperCase() + createType.slice(1)} created`)
      setShowCreate(false)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Location creation failed')
    } finally {
      setBusy(null)
    }
  }

  async function seedFallback() {
    if (!canManage || !country) return
    setBusy('seed')
    try {
      const response = await fetch('/api/admin/platform/locations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'seed', countryCode: country.code }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Location seed failed')
      toast.success(
        `Canonical hierarchy ready · ${body.summary?.statesCreated || 0} states · ${body.summary?.citiesCreated || 0} cities · ${body.summary?.areasCreated || 0} areas added`
      )
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Location seed failed')
    } finally {
      setBusy(null)
    }
  }

  async function rename() {
    if (!canManage || !renameTarget || renameName.trim().length < 2) return
    setBusy('rename')
    try {
      const response = await fetch('/api/admin/platform/locations', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: renameTarget.type,
          id: renameTarget.id,
          name: renameName.trim(),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Location rename failed')
      toast.success('Location renamed')
      setRenameTarget(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Location rename failed')
    } finally {
      setBusy(null)
    }
  }

  function startRename(type: CreateType, id: string, currentName: string) {
    setRenameTarget({ type, id, name: currentName })
    setRenameName(currentName)
  }

  if (!canView && user) {
    return (
      <CrmState
        type="permission"
        title="Location access required"
        description="Your staff permissions do not allow market location management."
      />
    )
  }

  if (loading) {
    return (
      <CrmState
        type="loading"
        title="Loading service locations"
        description="Loading countries, states/provinces, cities and service areas."
      />
    )
  }

  if (!data) {
    return (
      <CrmState
        type="error"
        title="Locations unavailable"
        description="The canonical location hierarchy could not be loaded."
        action={<CrmButton variant="secondary" onClick={load}>Retry</CrmButton>}
      />
    )
  }

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="App & Web · Market coverage"
        title="Locations & service areas"
        description="Manage the canonical geography used by marketplace booking. The database is the operational source; the static list remains only as a migration fallback."
        actions={
          <>
            <CrmButton variant="secondary" onClick={load}>
              <FiRefreshCw size={14} />
              Refresh
            </CrmButton>
            {isSuperAdmin && canManage && (
              <CrmButton variant="secondary" onClick={() => openCreate('country')}>
                <FiPlus size={14} />
                Country
              </CrmButton>
            )}
            {country && canManage && !countryIsFallback && (
              <CrmButton variant="primary" onClick={() => openCreate('state')}>
                <FiPlus size={14} />
                State / province
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
            <CrmBadge tone={data.source === 'database' ? 'success' : 'warning'} dot>
              {data.source === 'database' ? 'Database source' : data.source === 'hybrid' ? 'Hybrid migration' : 'Static fallback'}
            </CrmBadge>
            <CrmBadge tone={canManage ? 'amber' : 'neutral'}>
              {canManage ? 'Manage access' : 'Read-only'}
            </CrmBadge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CrmMetricCard label="Countries" value={totals.countries} helper="Scoped markets" icon={<FiMapPin size={16} />} tone="info" />
        <CrmMetricCard label="States / provinces" value={totals.states} helper="Regional hierarchy" icon={<FiMapPin size={16} />} tone="neutral" />
        <CrmMetricCard label="Cities" value={totals.cities} helper="Bookable cities" icon={<FiMapPin size={16} />} tone="amber" />
        <CrmMetricCard label="Areas" value={totals.areas} helper="Service-area granularity" icon={<FiMapPin size={16} />} tone="success" />
      </section>

      {countryIsFallback && country && (
        <CrmCard
          title="Static fallback is still serving this market"
          description="Seed this hierarchy into the database before editing. Existing fallback IDs are preserved during the seed."
          action={
            canManage ? (
              <CrmButton variant="primary" disabled={busy === 'seed'} onClick={seedFallback}>
                <FiUploadCloud size={14} />
                {busy === 'seed' ? 'Seeding…' : `Seed ${country.code} into database`}
              </CrmButton>
            ) : undefined
          }
        >
          <p className="text-xs leading-5 text-slate-500">
            The mobile API remains safe because it automatically falls back to the static hierarchy until canonical database rows exist.
          </p>
        </CrmCard>
      )}

      <CrmCard title="Market" description="Choose the market hierarchy you want to inspect or manage.">
        <div className="flex flex-wrap gap-2">
          {data.countries.map(item => (
            <button
              type="button"
              key={item.code}
              onClick={() => setSelectedCountry(item.code)}
              className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-colors ${
                item.code === selectedCountry
                  ? 'border-[#17191b] bg-[#17191b] text-white'
                  : 'border-[var(--crm-border)] bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.name} · {item.code}
            </button>
          ))}
        </div>
      </CrmCard>

      {country ? (
        <CrmTableFrame
          title={`${country.name} hierarchy`}
          description="States/provinces, cities and areas used by marketplace booking."
          action={
            !countryIsFallback && canManage ? (
              <button
                type="button"
                onClick={() => startRename('country', country.id, country.name)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"
              >
                <FiEdit3 size={13} />
                Rename market
              </button>
            ) : undefined
          }
        >
          <table className={crmTableClass}>
            <thead>
              <tr>
                <th className={crmThClass}>State / province</th>
                <th className={crmThClass}>City</th>
                <th className={crmThClass}>Areas</th>
                <th className={`${crmThClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {country.states.flatMap(state =>
                state.cities.length
                  ? state.cities.map((city, cityIndex) => (
                      <tr key={`${state.id}:${city.id}`} className="hover:bg-slate-50/70">
                        <td className={crmTdClass}>
                          {cityIndex === 0 ? (
                            <div>
                              <div className="font-semibold text-slate-900">{state.name}</div>
                              <div className="mt-1 text-[11px] text-slate-400">{state.id}</div>
                            </div>
                          ) : (
                            <span className="text-slate-300">↳</span>
                          )}
                        </td>
                        <td className={crmTdClass}>
                          <div className="font-semibold text-slate-800">{city.name}</div>
                          <div className="mt-1 text-[11px] text-slate-400">{city.areas.length} areas</div>
                        </td>
                        <td className={crmTdClass}>
                          <div className="flex max-w-[520px] flex-wrap gap-1.5">
                            {city.areas.length ? city.areas.map(area => (
                              <button
                                type="button"
                                key={area.id}
                                disabled={!canManage || Boolean(countryIsFallback)}
                                onClick={() => startRename('area', area.id, area.name)}
                                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 disabled:cursor-default"
                              >
                                {area.name}
                              </button>
                            )) : <span className="text-xs text-slate-400">No areas</span>}
                          </div>
                        </td>
                        <td className={`${crmTdClass} text-right`}>
                          {!countryIsFallback && canManage ? (
                            <div className="inline-flex gap-2">
                              <CrmButton size="sm" variant="secondary" onClick={() => startRename('city', city.id, city.name)}>
                                Rename city
                              </CrmButton>
                              <CrmButton size="sm" variant="primary" onClick={() => openCreate('area', state.id, city.id)}>
                                Add area
                              </CrmButton>
                            </div>
                          ) : <span className="text-[11px] text-slate-400">Read-only</span>}
                        </td>
                      </tr>
                    ))
                  : [
                      <tr key={state.id}>
                        <td className={crmTdClass}>
                          <div className="font-semibold text-slate-900">{state.name}</div>
                        </td>
                        <td className={crmTdClass}><span className="text-xs text-slate-400">No cities</span></td>
                        <td className={crmTdClass}>—</td>
                        <td className={`${crmTdClass} text-right`}>
                          {!countryIsFallback && canManage ? (
                            <CrmButton size="sm" variant="primary" onClick={() => openCreate('city', state.id)}>
                              Add city
                            </CrmButton>
                          ) : null}
                        </td>
                      </tr>,
                    ]
              )}
            </tbody>
          </table>

          {!countryIsFallback && canManage && country.states.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-[var(--crm-border)] bg-[#fafbf9] px-4 py-3">
              {country.states.map(state => (
                <div key={state.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <span className="text-xs font-semibold text-slate-700">{state.name}</span>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-amber-700"
                    onClick={() => openCreate('city', state.id)}
                  >
                    + City
                  </button>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-slate-500"
                    onClick={() => startRename('state', state.id, state.name)}
                  >
                    Rename
                  </button>
                </div>
              ))}
            </div>
          )}
        </CrmTableFrame>
      ) : (
        <CrmState type="empty" title="No market locations" description="No location hierarchy is available for your current market scope." />
      )}

      <CrmModal
        open={showCreate}
        onClose={() => busy !== 'create' && setShowCreate(false)}
        title={`Create ${createType}`}
        description="New locations are written to the canonical database hierarchy used by mobile booking."
        footer={
          <>
            <CrmButton variant="secondary" disabled={busy === 'create'} onClick={() => setShowCreate(false)}>Cancel</CrmButton>
            <CrmButton variant="primary" disabled={busy === 'create' || name.trim().length < 2} onClick={create}>
              {busy === 'create' ? 'Creating…' : 'Create'}
            </CrmButton>
          </>
        }
      >
        <div className="space-y-4">
          <CrmField label="Name">
            <input className={crmInputClass} value={name} onChange={event => setName(event.target.value)} maxLength={120} />
          </CrmField>

          {createType === 'country' && (
            <CrmField label="Country code" hint="Two-letter market code, e.g. LK or CA.">
              <input className={crmInputClass} value={code} onChange={event => setCode(event.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
            </CrmField>
          )}

          {createType === 'city' && country && (
            <CrmField label="State / province">
              <select className={crmInputClass} value={parentStateId} onChange={event => setParentStateId(event.target.value)}>
                <option value="">Select state / province</option>
                {country.states.map(state => <option key={state.id} value={state.id}>{state.name}</option>)}
              </select>
            </CrmField>
          )}

          {createType === 'area' && country && (
            <CrmField label="City">
              <select className={crmInputClass} value={parentCityId} onChange={event => setParentCityId(event.target.value)}>
                <option value="">Select city</option>
                {country.states.flatMap(state =>
                  state.cities.map(city => <option key={city.id} value={city.id}>{state.name} · {city.name}</option>)
                )}
              </select>
            </CrmField>
          )}
        </div>
      </CrmModal>

      <CrmModal
        open={Boolean(renameTarget)}
        onClose={() => busy !== 'rename' && setRenameTarget(null)}
        title={renameTarget ? `Rename ${renameTarget.type}` : 'Rename location'}
        description="Renaming keeps the same location ID, so existing booking references remain stable."
        footer={
          <>
            <CrmButton variant="secondary" disabled={busy === 'rename'} onClick={() => setRenameTarget(null)}>Cancel</CrmButton>
            <CrmButton variant="primary" disabled={busy === 'rename' || renameName.trim().length < 2} onClick={rename}>
              {busy === 'rename' ? 'Saving…' : 'Save name'}
            </CrmButton>
          </>
        }
      >
        <CrmField label="Name">
          <input className={crmInputClass} value={renameName} onChange={event => setRenameName(event.target.value)} maxLength={120} />
        </CrmField>
      </CrmModal>
    </div>
  )
}
