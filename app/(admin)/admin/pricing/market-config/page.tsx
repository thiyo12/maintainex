'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { FiDollarSign, FiSave, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi'
import AdminLayout from '@/components/admin/AdminLayout'

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

const EDITABLE_FIELDS = [
  { key: 'weightCapability', label: 'Capability Weight', type: 'number' },
  { key: 'weightReliability', label: 'Reliability Weight', type: 'number' },
  { key: 'weightReputation', label: 'Reputation Weight', type: 'number' },
  { key: 'weightAvailability', label: 'Availability Weight', type: 'number' },
  { key: 'weightTravel', label: 'Travel Weight', type: 'number' },
  { key: 'weightExperience', label: 'Experience Weight', type: 'number' },
  { key: 'weightFairness', label: 'Fairness Weight', type: 'number' },
  { key: 'weightPreferredSkill', label: 'Preferred Skill Weight', type: 'number' },
  { key: 'wave1Size', label: 'Wave 1 Size', type: 'number' },
  { key: 'wave2Size', label: 'Wave 2 Size', type: 'number' },
  { key: 'wave3Size', label: 'Wave 3 Size', type: 'number' },
  { key: 'wave1ExpiryMinutes', label: 'Wave 1 Expiry (min)', type: 'number' },
  { key: 'wave2ExpiryMinutes', label: 'Wave 2 Expiry (min)', type: 'number' },
  { key: 'wave3ExpiryMinutes', label: 'Wave 3 Expiry (min)', type: 'number' },
  { key: 'commissionRateBps', label: 'Commission (BPS)', type: 'number' },
  { key: 'urgentModifierBps', label: 'Urgent Modifier (BPS)', type: 'number' },
  { key: 'emergencyModifierBps', label: 'Emergency Modifier (BPS)', type: 'number' },
  { key: 'urgencyCapBps', label: 'Urgency Cap (BPS)', type: 'number' },
  { key: 'newProviderBaseline', label: 'New Provider Baseline', type: 'number' },
  { key: 'maxOpportunityBoost', label: 'Max Opportunity Boost', type: 'number' },
  { key: 'benchmarkPercentileLow', label: 'Benchmark Percentile Low', type: 'number' },
  { key: 'benchmarkPercentileHigh', label: 'Benchmark Percentile High', type: 'number' },
  { key: 'benchmarkOutlierIqrMult', label: 'Benchmark IQR Multiplier', type: 'number' },
]

export default function MarketConfigPage() {
  return <AdminLayout><MarketConfigContent /></AdminLayout>
}

function MarketConfigContent() {
  const [config, setConfig] = useState<MarketConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [changes, setChanges] = useState<Record<string, number>>({})
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [countryCode, setCountryCode] = useState('LK')

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/market-config?countryCode=${countryCode}`, { credentials: 'include' })
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const data = await res.json()
      setConfig(data.config)
      setChanges({})
      setReason('')
    } catch { toast.error('Failed to load config') }
    finally { setLoading(false) }
  }, [countryCode])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const handleChange = (key: string, value: string) => {
    const num = parseFloat(value)
    if (isNaN(num)) return
    setChanges(prev => ({ ...prev, [key]: num }))
  }

  const hasChanges = Object.keys(changes).length > 0 && reason.trim().length > 0

  const handleSave = async () => {
    if (!hasChanges || !config) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/market-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ countryCode: config.countryCode, reason, ...changes }),
      })
      if (!res.ok) {
        const e = await res.json()
        if (e.error?.includes('Concurrent modification')) {
          toast.error('Stale update — another admin modified this config. Refreshing...')
          fetchConfig()
          return
        }
        throw new Error(e.error)
      }
      toast.success('Configuration updated')
      fetchConfig()
    } catch (e: any) { toast.error(e.message || 'Save failed') }
    finally { setSaving(false) }
  }

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center py-20">
        <FiRefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        <span className="ml-2 text-gray-400">Loading configuration...</span>
      </div>
    </AdminLayout>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FiDollarSign className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-white">Market Configuration</h1>
        </div>
        <div className="flex items-center space-x-3">
          <select value={countryCode} onChange={e => setCountryCode(e.target.value)}
            className="bg-[#1A1B26] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
            <option value="LK">Sri Lanka (LK)</option>
            <option value="GLOBAL">Global Defaults</option>
            <option value="CA">Canada (CA)</option>
          </select>
          <button onClick={fetchConfig} className="flex items-center space-x-2 px-3 py-2 bg-[#1A1B26] text-gray-300 rounded-lg hover:bg-[#24263a]">
            <FiRefreshCw className="w-4 h-4" /><span>Refresh</span>
          </button>
        </div>
      </div>

      {!config ? (
        <div className="bg-[#15161E] rounded-xl p-12 text-center text-gray-500">No configuration found for {countryCode}</div>
      ) : (
        <>
          <div className="bg-[#15161E] rounded-xl p-4 border border-gray-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Last updated: {new Date(config.updatedAt).toLocaleString()}</span>
              {Object.keys(changes).length > 0 && (
                <span className="text-amber-400">{Object.keys(changes).length} unsaved change(s)</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {EDITABLE_FIELDS.map(f => (
              <div key={f.key} className="bg-[#15161E] rounded-xl p-4 border border-gray-800">
                <label className="block text-xs font-medium text-gray-400 mb-2">{f.label}</label>
                <input type="number" step="any"
                  value={changes[f.key] !== undefined ? changes[f.key] : (config as any)[f.key]}
                  onChange={e => handleChange(f.key, e.target.value)}
                  className={`w-full bg-[#0B0C12] border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 ${
                    changes[f.key] !== undefined ? 'border-amber-500 bg-amber-500/10' : 'border-gray-700'
                  }`} />
              </div>
            ))}
          </div>

          {Object.keys(changes).length > 0 && (
            <div className="bg-[#15161E] rounded-xl p-4 border border-amber-500/30 space-y-3">
              <div className="flex items-center space-x-2 text-amber-400">
                <FiAlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Change reason required</span>
              </div>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                className="w-full bg-[#0B0C12] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" placeholder="Why are you making this change?" />
              <button onClick={handleSave} disabled={!hasChanges || saving}
                className="flex items-center space-x-2 px-4 py-2 bg-amber-500 text-[#0B0C12] rounded-lg hover:bg-amber-400 disabled:opacity-50 font-medium text-sm">
                <FiSave className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
