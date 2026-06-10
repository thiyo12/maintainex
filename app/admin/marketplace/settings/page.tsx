'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiShield, FiAlertCircle } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface PlatformSettings {
  platformFeeBps: number
  minJobAmountCents: number
  maxJobAmountCents: number
  escrowReleaseDays: number
  supportEmail: string
}

export default function MarketplaceSettings() {
  const { user: currentUser } = useAdminSession()
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    platformFeePercent: '',
    minJobAmount: '',
    maxJobAmount: '',
    escrowReleaseDays: '',
    supportEmail: '',
  })
  const [message, setMessage] = useState('')

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'

  const formatBps = (bps: number) => `${(bps / 100).toFixed(2)}%`
  const formatMoney = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
  const dollarsToCents = (val: string) => Math.round(parseFloat(val || '0') * 100)

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false)
      return
    }
    fetchSettings()
  }, [isSuperAdmin])

  const fetchSettings = async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/admin/marketplace/settings', {
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const result = await res.json()

      if (result.error) {
        toast.error(result.error)
        setError(result.error)
        return
      }

      const s = result.data
      setSettings(s)
      setForm({
        platformFeePercent: (s.platformFeeBps / 100).toFixed(2),
        minJobAmount: (Number(s.minJobAmountCents) / 100).toFixed(2),
        maxJobAmount: (Number(s.maxJobAmountCents) / 100).toFixed(2),
        escrowReleaseDays: String(s.escrowReleaseDays || 14),
        supportEmail: s.supportEmail || '',
      })
    } catch (error) {
      console.error('Settings fetch error:', error)
      toast.error('Failed to load settings')
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const payload = {
        platformFeeBps: Math.round(parseFloat(form.platformFeePercent) * 100),
        minJobAmountCents: dollarsToCents(form.minJobAmount),
        maxJobAmountCents: dollarsToCents(form.maxJobAmount),
        escrowReleaseDays: parseInt(form.escrowReleaseDays) || 14,
        supportEmail: form.supportEmail,
      }

      const authHeaders = getAuthHeader()
      const res = await fetch('/api/admin/marketplace/settings', {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const result = await res.json()

      if (result.error) {
        setMessage(result.error)
        toast.error(result.error)
        return
      }

      setSettings(result.data)
      setMessage('Settings saved successfully')
      toast.success('Settings saved successfully')
    } catch (error) {
      console.error('Settings save error:', error)
      setMessage('Failed to save')
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <FiShield className="w-12 h-12 text-red-500" />
        <p className="text-gray-600">This page is restricted to SUPER_ADMIN role only.</p>
      </div>
    )
  }

  if (error && !settings) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <FiAlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-gray-600">{error}</p>
        <button onClick={fetchSettings} className="btn-primary px-4 py-2 rounded-lg text-sm">Try Again</button>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-gray-600 mt-1">Manage marketplace platform configuration</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-4 md:p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Fee Configuration</h2>
        </div>
        <div className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">Platform Fee (%)</label>
              <input
                type="text"
                className="input-field w-full"
                value={form.platformFeePercent}
                onChange={(e) => setForm({ ...form, platformFeePercent: e.target.value })}
                placeholder="5.00"
              />
              <p className="text-xs text-gray-500">{formatBps(Math.round(parseFloat(form.platformFeePercent || '0') * 100))}</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">Escrow Release (days)</label>
              <input
                type="number"
                className="input-field w-full"
                value={form.escrowReleaseDays}
                onChange={(e) => setForm({ ...form, escrowReleaseDays: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">Min Job Amount ($)</label>
              <input
                type="text"
                className="input-field w-full"
                value={form.minJobAmount}
                onChange={(e) => setForm({ ...form, minJobAmount: e.target.value })}
                placeholder="5.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">Max Job Amount ($)</label>
              <input
                type="text"
                className="input-field w-full"
                value={form.maxJobAmount}
                onChange={(e) => setForm({ ...form, maxJobAmount: e.target.value })}
                placeholder="10000.00"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">Support Email</label>
            <input
              type="text"
              className="input-field w-full"
              value={form.supportEmail}
              onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
              placeholder="support@maintainex.com"
            />
          </div>
        </div>
      </div>

      {settings && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 md:p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Current Values</h2>
          </div>
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Fee:</span> <span className="font-medium">{formatBps(settings.platformFeeBps)}</span></div>
              <div><span className="text-gray-500">Release Days:</span> <span className="font-medium">{settings.escrowReleaseDays}</span></div>
              <div><span className="text-gray-500">Min Amount:</span> <span className="font-medium">{formatMoney(Number(settings.minJobAmountCents))}</span></div>
              <div><span className="text-gray-500">Max Amount:</span> <span className="font-medium">{formatMoney(Number(settings.maxJobAmountCents))}</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary px-6 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {message && (
          <p className={`text-sm ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
