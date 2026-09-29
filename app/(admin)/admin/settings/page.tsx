'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  FiAlertTriangle,
  FiDollarSign,
  FiGlobe,
  FiMail,
  FiRefreshCw,
  FiSave,
  FiSettings,
  FiShield,
  FiUsers,
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'

interface SettingsState {
  platformName: string
  supportEmail: string
  currency: string
  commissionRate: number
  minTaskerStaff: number
  weeklySettlementDay: string
  autoApproveKyc: boolean
  maintenanceMode: boolean
}

const DEFAULTS: SettingsState = {
  platformName: 'MaintainEX',
  supportEmail: 'support@maintainex.lk',
  currency: 'LKR',
  commissionRate: 10,
  minTaskerStaff: 3,
  weeklySettlementDay: 'monday',
  autoApproveKyc: false,
  maintenanceMode: false,
}

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

export default function AdminSettingsPage() {
  const { user } = useAdminSession()
  const role = (user?.role || 'SUPPORT') as AdminRole
  const canEdit = (ROLE_PERMISSIONS[role] || []).includes('settings:edit')
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS)
  const [definitions, setDefinitions] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/settings', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Unable to load settings')
      setSettings({ ...DEFAULTS, ...(body.settings || {}) })
      setDefinitions(body.definitions || {})
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!canEdit) return
    if (settings.autoApproveKyc && !window.confirm('Auto-approve KYC reduces manual review. Confirm this setting change?')) return
    if (settings.maintenanceMode && !window.confirm('Maintenance mode can restrict public access. Confirm this setting change?')) return

    setSaving(true)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Failed to save settings')
      toast.success('Platform settings saved and audited')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setSettings(current => ({ ...current, [key]: value }))
  }

  if (loading) {
    return <div className="h-[560px] rounded-2xl border border-slate-200 bg-white animate-pulse" />
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-amber-600 font-semibold">Platform configuration</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-slate-950">Settings</h1>
          <p className="mt-1.5 text-sm text-slate-500">Validated settings stored by MaintainEX. Sensitive changes are rate-limited and audited.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600">
            <FiRefreshCw size={15}/> Refresh
          </button>
          {canEdit && (
            <button disabled={saving} onClick={save} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-950 text-white text-sm font-semibold disabled:opacity-50">
              <FiSave size={15}/> {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </section>

      {!canEdit && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Your staff role has read-only access to platform settings.
        </div>
      )}

      <section className="grid xl:grid-cols-2 gap-5">
        <Panel icon={FiGlobe} title="Platform identity" subtitle="Public platform and support defaults.">
          <div className="grid md:grid-cols-2 gap-4">
            <Input label="Platform name" value={settings.platformName} disabled={!canEdit} onChange={value => update('platformName', value)} />
            <Input label="Support email" type="email" value={settings.supportEmail} disabled={!canEdit} onChange={value => update('supportEmail', value)} />
            <Input label="Default currency" value={settings.currency} disabled={!canEdit} onChange={value => update('currency', value.toUpperCase().slice(0,3))} />
            <Select label="Weekly settlement day" value={settings.weeklySettlementDay} options={DAYS} disabled={!canEdit} onChange={value => update('weeklySettlementDay', value)} />
          </div>
        </Panel>

        <Panel icon={FiDollarSign} title="Marketplace economics" subtitle="Commission and company workforce defaults.">
          <div className="grid md:grid-cols-2 gap-4">
            <NumberInput label="Commission rate (%)" min={0} max={100} step={0.5} value={settings.commissionRate} disabled={!canEdit} onChange={value => update('commissionRate', value)} />
            <NumberInput label="Minimum company staff" min={0} max={10000} step={1} value={settings.minTaskerStaff} disabled={!canEdit} onChange={value => update('minTaskerStaff', value)} />
          </div>
        </Panel>

        <Panel icon={FiShield} title="Trust defaults" subtitle="High-impact settings require deliberate confirmation.">
          <Toggle
            label="Auto-approve KYC"
            description="Stored platform setting for automatic KYC behavior. Keep disabled unless the runtime policy has been reviewed."
            checked={settings.autoApproveKyc}
            disabled={!canEdit}
            onChange={value => update('autoApproveKyc', value)}
            warning={settings.autoApproveKyc}
          />
        </Panel>

        <Panel icon={FiSettings} title="Operational state" subtitle="Public-access configuration.">
          <Toggle
            label="Maintenance mode"
            description="Stored maintenance-mode setting. Use only during planned maintenance or an operational incident."
            checked={settings.maintenanceMode}
            disabled={!canEdit}
            onChange={value => update('maintenanceMode', value)}
            warning={settings.maintenanceMode}
          />
        </Panel>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <FiAlertTriangle className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="font-semibold text-slate-900">Runtime wiring note</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              This page manages the canonical Settings records only. A setting affects customer/mobile behavior only where that runtime explicitly consumes the stored key. The CRM does not claim unsupported switches such as IP allowlists, session timeout, or push/email master toggles.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2"><FiUsers className="text-slate-400"/><h2 className="font-semibold text-slate-900">Last persisted metadata</h2></div>
        <div className="mt-4 grid md:grid-cols-2 xl:grid-cols-4 gap-3">
          {Object.entries(definitions).map(([key, definition]) => (
            <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700">{definition.label || key}</div>
              <div className="mt-1 text-[11px] text-slate-400">{definition.updatedAt ? new Date(definition.updatedAt).toLocaleString('en-LK') : 'Using default'}</div>
              <div className="mt-1 text-[11px] text-slate-400 truncate">{definition.updatedBy || 'No updater recorded'}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Panel({icon:Icon,title,subtitle,children}:{icon:any;title:string;subtitle:string;children:React.ReactNode}) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><Icon className="text-amber-600"/><h2 className="font-semibold text-slate-900">{title}</h2></div><p className="mt-1 mb-4 text-xs text-slate-400">{subtitle}</p>{children}</section>
}

function Input({label,value,onChange,disabled,type='text'}:{label:string;value:string;onChange:(value:string)=>void;disabled?:boolean;type?:string}) {
  return <label className="block"><span className="text-xs font-medium text-slate-600">{label}</span><input type={type} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)} className="mt-1.5 w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-300 disabled:opacity-60"/></label>
}

function NumberInput({label,value,onChange,disabled,min,max,step}:{label:string;value:number;onChange:(value:number)=>void;disabled?:boolean;min:number;max:number;step:number}) {
  return <label className="block"><span className="text-xs font-medium text-slate-600">{label}</span><input type="number" value={value} min={min} max={max} step={step} disabled={disabled} onChange={e=>onChange(Number(e.target.value)||0)} className="mt-1.5 w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-300 disabled:opacity-60"/></label>
}

function Select({label,value,options,onChange,disabled}:{label:string;value:string;options:string[];onChange:(value:string)=>void;disabled?:boolean}) {
  return <label className="block"><span className="text-xs font-medium text-slate-600">{label}</span><select value={value} disabled={disabled} onChange={e=>onChange(e.target.value)} className="mt-1.5 w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm capitalize disabled:opacity-60">{options.map(option=><option key={option} value={option}>{option}</option>)}</select></label>
}

function Toggle({label,description,checked,onChange,disabled,warning}:{label:string;description:string;checked:boolean;onChange:(value:boolean)=>void;disabled?:boolean;warning?:boolean}) {
  return <label className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${warning?'border-amber-200 bg-amber-50':'border-slate-200'}`}><div><div className="text-sm font-semibold text-slate-800">{label}</div><div className="mt-1 text-xs leading-5 text-slate-500">{description}</div></div><input type="checkbox" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)} className="w-5 h-5 accent-amber-500"/></label>
}
