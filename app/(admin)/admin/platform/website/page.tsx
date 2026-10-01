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
  FiSave,
  FiShield,
  FiTag,
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'

interface Overview {
  settings: Record<string, { value: unknown }>
  catalog: {
    categories: { active: number; inactive: number }
    services: { active: number; inactive: number; trending: number }
  }
  offers: { activeSeasonal: number; activeFlash: number }
}

export default function WebsiteManagementPage() {
  const { user } = useAdminSession()
  const role = (user?.role || 'SUPPORT') as AdminRole
  const canEdit = (ROLE_PERMISSIONS[role] || []).includes('settings:edit')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [form, setForm] = useState({
    platformName: 'MaintainEX',
    supportEmail: 'support@maintainex.lk',
    maintenanceMode: false,
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [overviewResponse, settingsResponse] = await Promise.all([
        fetch('/api/admin/platform/overview', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/admin/settings', { credentials: 'include', cache: 'no-store' }),
      ])
      const overviewBody = await overviewResponse.json().catch(() => ({}))
      const settingsBody = await settingsResponse.json().catch(() => ({}))
      if (!overviewResponse.ok) throw new Error(overviewBody?.error || 'Unable to load website controls')
      if (!settingsResponse.ok) throw new Error(settingsBody?.error || 'Unable to load settings')
      setOverview(overviewBody)
      setForm({
        platformName: String(settingsBody.settings?.platformName || 'MaintainEX'),
        supportEmail: String(settingsBody.settings?.supportEmail || 'support@maintainex.lk'),
        maintenanceMode: Boolean(settingsBody.settings?.maintenanceMode),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load website management'
      setOverview(null)
      setLoadError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!canEdit || loadError || !overview) return
    if (!window.confirm('Save these website/platform settings? The change will be audited.')) return
    setSaving(true)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: form }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Failed to save settings')
      toast.success('Website settings saved')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="h-[500px] rounded-2xl border border-slate-200 bg-white animate-pulse" />

  if (loadError || !overview) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <FiAlertTriangle className="text-red-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h1 className="font-semibold text-red-900">Website management could not be loaded</h1>
            <p className="mt-1 text-sm text-red-700">{loadError || 'Canonical website settings are unavailable.'}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 h-10 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/platform" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
          <FiArrowLeft size={15}/> Platform management
        </Link>
        <div className="mt-3 text-xs uppercase tracking-[0.16em] text-amber-600 font-semibold">Public surface</div>
        <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-slate-950">Website Management</h1>
        <p className="mt-1.5 text-sm text-slate-500">Manage real settings, public service inventory and promotional content used by the MaintainEX website.</p>
      </div>

      {form.maintenanceMode && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <FiAlertTriangle className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-800">Maintenance mode is enabled</div>
            <div className="text-sm text-red-700 mt-1">Public access may be restricted by the existing maintenance setting.</div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-900">Public-site settings</h2>
              <p className="text-xs text-slate-400 mt-1">These values are persisted in the canonical Settings table.</p>
            </div>
            <FiShield className="text-emerald-600" size={18}/>
          </div>

          <div className="mt-5 grid md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Platform name</span>
              <input
                disabled={!canEdit}
                value={form.platformName}
                onChange={e=>setForm(current=>({...current,platformName:e.target.value}))}
                className="mt-1.5 w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-300 disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Support email</span>
              <input
                disabled={!canEdit}
                type="email"
                value={form.supportEmail}
                onChange={e=>setForm(current=>({...current,supportEmail:e.target.value}))}
                className="mt-1.5 w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-300 disabled:opacity-60"
              />
            </label>
          </div>

          <label className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
            <div>
              <div className="text-sm font-semibold text-slate-800">Maintenance mode</div>
              <div className="text-xs text-slate-400 mt-1">Use only for planned maintenance or an operational incident.</div>
            </div>
            <input
              disabled={!canEdit}
              type="checkbox"
              checked={form.maintenanceMode}
              onChange={e=>setForm(current=>({...current,maintenanceMode:e.target.checked}))}
              className="w-5 h-5 accent-amber-500"
            />
          </label>

          {canEdit ? (
            <button onClick={save} disabled={saving} className="mt-5 inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-950 text-white text-sm font-semibold disabled:opacity-50">
              <FiSave size={15}/> {saving ? 'Saving…' : 'Save audited settings'}
            </button>
          ) : (
            <div className="mt-5 text-xs text-slate-400">Your staff role has read-only website settings access.</div>
          )}
        </section>

        <section className="rounded-2xl bg-[#10151d] text-white p-5">
          <FiGlobe className="text-amber-300" size={20}/>
          <h2 className="mt-4 font-semibold">Public content state</h2>
          <div className="mt-5 space-y-3">
            <KV label="Active categories" value={String(overview?.catalog.categories.active || 0)} />
            <KV label="Active services" value={String(overview?.catalog.services.active || 0)} />
            <KV label="Trending services" value={String(overview?.catalog.services.trending || 0)} />
            <KV label="Seasonal offers" value={String(overview?.offers.activeSeasonal || 0)} />
            <KV label="Flash offers" value={String(overview?.offers.activeFlash || 0)} />
          </div>
        </section>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Module href="/admin/platform/catalog" icon={FiGrid} title="Services & categories" text="Create and safely activate/deactivate public catalog entries." />
        <Module href="/admin/platform/offers" icon={FiTag} title="Offers & promotions" text="Manage seasonal and flash campaign visibility." />
      </div>
    </div>
  )
}

function KV({label,value}:{label:string;value:string}) {
  return <div className="flex items-center justify-between gap-4 text-sm"><span className="text-slate-400">{label}</span><span className="font-semibold text-white">{value}</span></div>
}

function Module({href,icon:Icon,title,text}:{href:string;icon:any;title:string;text:string}) {
  return <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-5 flex items-start justify-between gap-4 hover:bg-slate-50">
    <div><Icon className="text-amber-600" size={18}/><h3 className="mt-3 font-semibold text-slate-900">{title}</h3><p className="mt-1 text-sm text-slate-500">{text}</p></div>
    <FiArrowUpRight className="text-slate-400" />
  </Link>
}
