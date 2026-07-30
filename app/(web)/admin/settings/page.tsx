'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  FiSave, FiSettings, FiDollarSign, FiShield, FiBell,
  FiGlobe, FiMail, FiClock, FiUsers, FiLock, FiAlertTriangle,
  FiToggleLeft, FiToggleRight
} from 'react-icons/fi'
import { getAuthHeader } from '@/lib/auth-client'
import AdminLayout from '@/components/admin/AdminLayout'

interface PlatformSettings {
  platformName: string
  supportEmail: string
  maintenanceMode: boolean
  commissionRate: number
  weeklySettlementDay: string
  suspensionGracePeriodDays: number
  maxActiveJobsPerUser: number
  sessionTimeoutMinutes: number
  maxLoginAttempts: number
  ipAllowlist: string
  emailNotificationsEnabled: boolean
  pushNotificationsEnabled: boolean
}

const TABS = [
  { id: 'platform', label: 'Platform', icon: FiGlobe },
  { id: 'commission', label: 'Commission', icon: FiDollarSign },
  { id: 'security', label: 'Security', icon: FiShield },
  { id: 'notifications', label: 'Notifications', icon: FiBell },
]

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('platform')
  const [settings, setSettings] = useState<PlatformSettings>({
    platformName: 'MaintainEX',
    supportEmail: 'support@maintainex.lk',
    maintenanceMode: false,
    commissionRate: 10,
    weeklySettlementDay: 'MONDAY',
    suspensionGracePeriodDays: 7,
    maxActiveJobsPerUser: 10,
    sessionTimeoutMinutes: 60,
    maxLoginAttempts: 5,
    ipAllowlist: '',
    emailNotificationsEnabled: true,
    pushNotificationsEnabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/admin/settings', { headers: { ...authHeaders } })
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (res.ok) {
        const data = await res.json()
        setSettings((prev) => ({ ...prev, ...data }))
      }
    } catch {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error()
      toast.success('Settings saved successfully')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-gray-400 text-sm mt-1">Configure platform, commission, security, and notifications</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-[#0B0C12] rounded-lg font-medium text-sm hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-[#0B0C12] border-t-transparent rounded-full animate-spin" />
            ) : (
              <FiSave size={16} />
            )}
            Save Changes
          </button>
        </div>

        <div className="flex gap-1 bg-[#15161E] border border-white/5 rounded-xl p-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-[#15161E] border border-white/5 rounded-xl p-6">
          {activeTab === 'platform' && (
            <div className="space-y-6">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <FiGlobe className="text-amber-400" />
                Platform Configuration
              </h3>
              <div className="grid gap-5">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Platform Name</label>
                  <input
                    type="text"
                    value={settings.platformName}
                    onChange={(e) => updateSetting('platformName', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    <FiMail className="inline mr-1" />
                    Support Email
                  </label>
                  <input
                    type="email"
                    value={settings.supportEmail}
                    onChange={(e) => updateSetting('supportEmail', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-[#0B0C12] border border-white/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FiAlertTriangle className="text-amber-400" size={18} />
                    <div>
                      <div className="text-white text-sm font-medium">Maintenance Mode</div>
                      <div className="text-gray-500 text-xs">Temporarily disable public access</div>
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting('maintenanceMode', !settings.maintenanceMode)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.maintenanceMode ? 'bg-amber-500' : 'bg-white/10'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      settings.maintenanceMode ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'commission' && (
            <div className="space-y-6">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <FiDollarSign className="text-amber-400" />
                Commission Settings
              </h3>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Commission Rate (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={settings.commissionRate}
                      onChange={(e) => updateSetting('commissionRate', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2.5 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Platform fee deducted from provider earnings</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    <FiClock className="inline mr-1" />
                    Weekly Settlement Day
                  </label>
                  <select
                    value={settings.weeklySettlementDay}
                    onChange={(e) => updateSetting('weeklySettlementDay', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Suspension Grace Period (days)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={settings.suspensionGracePeriodDays}
                    onChange={(e) => updateSetting('suspensionGracePeriodDays', parseInt(e.target.value) || 7)}
                    className="w-full px-3 py-2.5 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                  <p className="text-gray-500 text-xs mt-1">Days after missed payment before suspension</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    <FiUsers className="inline mr-1" />
                    Max Active Jobs Per User
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={settings.maxActiveJobsPerUser}
                    onChange={(e) => updateSetting('maxActiveJobsPerUser', parseInt(e.target.value) || 10)}
                    className="w-full px-3 py-2.5 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <FiShield className="text-amber-400" />
                Security Settings
              </h3>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    <FiClock className="inline mr-1" />
                    Session Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={settings.sessionTimeoutMinutes}
                    onChange={(e) => updateSetting('sessionTimeoutMinutes', parseInt(e.target.value) || 60)}
                    className="w-full px-3 py-2.5 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                  <p className="text-gray-500 text-xs mt-1">Auto-logout after inactivity</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    <FiLock className="inline mr-1" />
                    Max Login Attempts
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={20}
                    value={settings.maxLoginAttempts}
                    onChange={(e) => updateSetting('maxLoginAttempts', parseInt(e.target.value) || 5)}
                    className="w-full px-3 py-2.5 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                  <p className="text-gray-500 text-xs mt-1">Account lockout after failed attempts</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    <FiGlobe className="inline mr-1" />
                    IP Allowlist
                  </label>
                  <textarea
                    value={settings.ipAllowlist}
                    onChange={(e) => updateSetting('ipAllowlist', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50 resize-none"
                    placeholder="One IP per line. Leave empty to allow all."
                  />
                  <p className="text-gray-500 text-xs mt-1">Restrict admin access to specific IPs</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <FiBell className="text-amber-400" />
                Notification Settings
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-[#0B0C12] border border-white/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FiMail className="text-amber-400" size={18} />
                    <div>
                      <div className="text-white text-sm font-medium">Email Notifications</div>
                      <div className="text-gray-500 text-xs">Send email alerts for critical events</div>
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting('emailNotificationsEnabled', !settings.emailNotificationsEnabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.emailNotificationsEnabled ? 'bg-amber-500' : 'bg-white/10'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      settings.emailNotificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                <div className="flex items-center justify-between p-4 bg-[#0B0C12] border border-white/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FiBell className="text-amber-400" size={18} />
                    <div>
                      <div className="text-white text-sm font-medium">Push Notifications</div>
                      <div className="text-gray-500 text-xs">Send push notifications to mobile users</div>
                    </div>
                  </div>
                  <button
                    onClick={() => updateSetting('pushNotificationsEnabled', !settings.pushNotificationsEnabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.pushNotificationsEnabled ? 'bg-amber-500' : 'bg-white/10'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      settings.pushNotificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <p className="text-amber-400/80 text-xs">
                  Email templates and notification preferences can be configured in the database directly.
                  Changes here take effect immediately.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
