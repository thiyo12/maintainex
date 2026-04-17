'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiSave, FiMail, FiPhone, FiMapPin, FiMessageCircle } from 'react-icons/fi'
import { getAuthHeader } from '@/lib/auth-client'

interface Settings {
  companyName: string
  email: string
  phone: string
  address: string
  mapEmbedUrl: string | null
  whatsappNumber: string | null
  facebookUrl: string | null
  instagramUrl: string | null
  workingHours: string | null
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings>({
    companyName: 'Maintainex',
    email: 'info@maintainex.lk',
    phone: '+94 XX XXX XXXX',
    address: 'Jaffna, Sri Lanka',
    mapEmbedUrl: '',
    whatsappNumber: '',
    facebookUrl: '',
    instagramUrl: '',
    workingHours: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/settings', { headers: { ...authHeaders } })
      
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      
      const data = await res.json()
      setSettings({
        companyName: data.companyName || 'Maintainex',
        email: data.email || 'info@maintainex.lk',
        phone: data.phone || '+94 XX XXX XXXX',
        address: data.address || 'Jaffna, Sri Lanka',
        mapEmbedUrl: data.mapEmbedUrl || '',
        whatsappNumber: data.whatsappNumber || '',
        facebookUrl: data.facebookUrl || '',
        instagramUrl: data.instagramUrl || '',
        workingHours: data.workingHours || ''
      })
    } catch (error) {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(settings)
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      if (!res.ok) throw new Error()

      toast.success('Settings saved successfully!')
    } catch (error) {
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your company information</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Company Information</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="input-field"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FiMail className="inline mr-2" />
                  Email
                </label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FiPhone className="inline mr-2" />
                  Phone
                </label>
                <input
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FiMapPin className="inline mr-2" />
                Address
              </label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Working Hours</label>
              <input
                type="text"
                value={settings.workingHours || ''}
                onChange={(e) => setSettings({ ...settings, workingHours: e.target.value })}
                className="input-field"
                placeholder="Monday - Saturday: 8:00 AM - 6:00 PM"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Social & Contact</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FiMessageCircle className="inline mr-2" />
                WhatsApp Number
              </label>
              <input
                type="text"
                value={settings.whatsappNumber || ''}
                onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                className="input-field"
                placeholder="94XXXXXXXXX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facebook URL</label>
              <input
                type="url"
                value={settings.facebookUrl || ''}
                onChange={(e) => setSettings({ ...settings, facebookUrl: e.target.value })}
                className="input-field"
                placeholder="https://facebook.com/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instagram URL</label>
              <input
                type="url"
                value={settings.instagramUrl || ''}
                onChange={(e) => setSettings({ ...settings, instagramUrl: e.target.value })}
                className="input-field"
                placeholder="https://instagram.com/..."
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Map Settings</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps Embed URL</label>
            <textarea
              value={settings.mapEmbedUrl || ''}
              onChange={(e) => setSettings({ ...settings, mapEmbedUrl: e.target.value })}
              rows={3}
              className="input-field resize-none"
              placeholder="Paste your Google Maps embed iframe URL here"
            />
            <p className="text-sm text-gray-500 mt-1">
              Get this from Google Maps → Share → Embed a map
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-dark-900 border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <FiSave className="mr-2" />
            )}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  )
}
