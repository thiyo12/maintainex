'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { FiCalendar, FiUsers, FiClock, FiCheckCircle, FiArrowRight, FiTool, FiAlertTriangle, FiSave, FiRefreshCw, FiRotateCcw } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'

interface DashboardData {
  stats: {
    totalBookings: number
    pendingBookings: number
    totalApplications: number
    newApplications: number
    totalServices: number
  }
  recentBookings: any[]
  recentApplications: any[]
}

interface MaintenanceSettings {
  maintenanceMode: boolean
  maintenanceMessage: string
}

export default function AdminDashboard() {
  const { user } = useAdminSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [maintenance, setMaintenance] = useState<MaintenanceSettings>({
    maintenanceMode: false,
    maintenanceMessage: ''
  })
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const fetchMaintenanceSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/maintenance?' + Date.now(), { cache: 'no-store' })
      const result = await res.json()
      setMaintenance(result)
    } catch (error) {
      console.error('Failed to fetch maintenance settings:', error)
    }
  }, [])

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (isSuperAdmin) {
      fetchMaintenanceSettings()
    }
  }, [isSuperAdmin, fetchMaintenanceSettings, reloadKey])

  const saveMaintenance = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceMode: maintenance.maintenanceMode,
          maintenanceMessage: maintenance.maintenanceMessage
        })
      })
      
      if (!res.ok) throw new Error()
      
      const data = await res.json()
      
      setTimeout(() => {
        setReloadKey(prev => prev + 1)
        fetchMaintenanceSettings()
        
        if (data.maintenanceMode === false) {
          toast.success('Maintenance disabled! Website is now live.')
        } else {
          toast.success('Maintenance mode enabled!')
        }
      }, 500)
    } catch (error) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const refreshSettings = async () => {
    await fetchMaintenanceSettings()
    toast.success('Settings refreshed!')
  }

  const resetToDefaults = async () => {
    if (!confirm('Reset maintenance settings to defaults?')) return
    
    setSaving(true)
    try {
      const res = await fetch('/api/settings/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceMode: false,
          maintenanceMessage: "We're making things better! Our website is currently undergoing some scheduled maintenance to serve you better. We'll be back shortly. Thank you for your patience!"
        })
      })
      
      if (!res.ok) throw new Error()
      
      toast.success('Settings reset! Website is now live.')
      
      setTimeout(() => {
        setReloadKey(prev => prev + 1)
        fetchMaintenanceSettings()
      }, 500)
    } catch (error) {
      toast.error('Failed to reset settings')
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

  const stats = data?.stats || {
    totalBookings: 0,
    pendingBookings: 0,
    totalApplications: 0,
    newApplications: 0,
    totalServices: 0
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Heres an overview of your business.</p>
      </div>

      {isSuperAdmin && (
        <div className="bg-gradient-to-r from-dark-900 to-dark-800 rounded-xl p-6 mb-8 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${maintenance.maintenanceMode ? 'bg-red-500' : 'bg-green-500'}`}>
                <FiAlertTriangle className="text-white text-2xl" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Maintenance Mode</h3>
                <p className="text-gray-300 text-sm">
                  {maintenance.maintenanceMode ? 'Website is showing maintenance page' : 'Website is live and accessible'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={refreshSettings}
                className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2"
                title="Refresh settings"
              >
                <FiRefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={resetToDefaults}
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                title="Reset to defaults"
              >
                <FiRotateCcw className="w-4 h-4" />
                Reset Default
              </button>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={maintenance.maintenanceMode}
                  onChange={(e) => setMaintenance({ ...maintenance, maintenanceMode: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-500"></div>
                <span className="ml-3 text-sm font-medium">
                  {maintenance.maintenanceMode ? 'ON' : 'OFF'}
                </span>
              </label>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/20">
            <label className="block text-sm text-gray-300 mb-2">Maintenance Message</label>
            <textarea
              value={maintenance.maintenanceMessage}
              onChange={(e) => setMaintenance({ ...maintenance, maintenanceMessage: e.target.value })}
              rows={2}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter maintenance message..."
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={saveMaintenance}
                disabled={saving}
                className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-dark-900 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <FiSave className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <span className="text-sm text-gray-400">
                {maintenance.maintenanceMode 
                  ? 'Visitors will see the maintenance page until you turn it off'
                  : 'Turn ON to enable maintenance mode'
                }
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <FiCalendar className="text-primary-600 text-xl" />
            </div>
            <span className="text-sm text-green-600 font-medium">+12%</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.totalBookings}</div>
          <div className="text-gray-600">Total Bookings</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <FiClock className="text-yellow-600 text-xl" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.pendingBookings}</div>
          <div className="text-gray-600">Pending Bookings</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FiUsers className="text-blue-600 text-xl" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.totalApplications}</div>
          <div className="text-gray-600">Job Applications</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <FiCheckCircle className="text-purple-600 text-xl" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.newApplications}</div>
          <div className="text-gray-600">New Applications</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
            <Link href="/admin/bookings" className="text-primary-600 text-sm font-medium hover:text-primary-700 flex items-center">
              View All <FiArrowRight className="ml-1" />
            </Link>
          </div>
          <div className="divide-y">
            {data?.recentBookings && data.recentBookings.length > 0 ? (
              data.recentBookings.map((booking: any) => (
                <div key={booking.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{booking.name}</div>
                    <div className="text-sm text-gray-500">{booking.service?.title}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                    booking.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700' :
                    booking.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {booking.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">No bookings yet</div>
            )}
          </div>
        </div>

        {/* Recent Applications */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Applications</h2>
            <Link href="/admin/applications" className="text-primary-600 text-sm font-medium hover:text-primary-700 flex items-center">
              View All <FiArrowRight className="ml-1" />
            </Link>
          </div>
          <div className="divide-y">
            {data?.recentApplications && data.recentApplications.length > 0 ? (
              data.recentApplications.map((app: any) => (
                <div key={app.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{app.name}</div>
                    <div className="text-sm text-gray-500">{app.position}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    app.status === 'NEW' ? 'bg-blue-100 text-blue-700' :
                    app.status === 'REVIEWED' ? 'bg-purple-100 text-purple-700' :
                    app.status === 'INTERVIEW' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {app.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">No applications yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
