'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiUsers, FiBriefcase, FiDollarSign, FiAlertCircle, FiClock, FiShield, FiAlertTriangle } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface DashboardData {
  stats: {
    totalUsers: number
    activeJobs: number
    monthlyRevenue: number
    openDisputes: number
    pendingKyc: number
    totalEscrows: number
  }
  recentActivity: Array<{
    id: string
    adminEmail: string
    action: string
    targetLabel: string | null
    createdAt: string
  }>
}

const initialStats = {
  totalUsers: 0,
  activeJobs: 0,
  monthlyRevenue: 0,
  openDisputes: 0,
  pendingKyc: 0,
  totalEscrows: 0,
}

export default function MarketplaceDashboard() {
  const { user } = useAdminSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/admin/marketplace/reports/summary', {
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const result = await res.json()

      if (result.error || !result.success) {
        toast.error(result.error || 'Failed to load dashboard')
        setError(result.error || 'Failed to load dashboard')
        return
      }

      setData(result.data)
    } catch (error) {
      console.error('Dashboard fetch error:', error)
      toast.error('Failed to load dashboard')
      setError('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <FiAlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-gray-600">{error}</p>
        <button onClick={fetchDashboard} className="btn-primary px-4 py-2 rounded-lg text-sm">
          Try Again
        </button>
      </div>
    )
  }

  const stats = data?.stats || initialStats

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const kpiCards = [
    { label: 'Total Users', value: stats.totalUsers.toLocaleString(), icon: FiUsers, color: 'bg-blue-500' },
    { label: 'Active Jobs', value: stats.activeJobs.toLocaleString(), icon: FiBriefcase, color: 'bg-green-500' },
    { label: 'Monthly Revenue', value: formatMoney(stats.monthlyRevenue), icon: FiDollarSign, color: 'bg-primary-500' },
    { label: 'Open Disputes', value: stats.openDisputes.toLocaleString(), icon: FiAlertTriangle, color: 'bg-red-500' },
    { label: 'Pending KYC', value: stats.pendingKyc.toLocaleString(), icon: FiShield, color: 'bg-yellow-500' },
    { label: 'Total Escrows', value: stats.totalEscrows.toLocaleString(), icon: FiClock, color: 'bg-purple-500' },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Marketplace Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your marketplace platform.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6 mb-8">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-10 h-10 md:w-12 md:h-12 ${kpi.color} rounded-xl flex items-center justify-center`}>
                <kpi.icon className="text-white text-lg md:text-xl" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-gray-500 text-sm">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 md:p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="p-4 md:p-6">
            {data?.recentActivity && data.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {data.recentActivity.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mr-2">
                        {activity.action}
                      </span>
                      <span className="text-sm text-gray-600">{activity.adminEmail}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(activity.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No recent activity</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 md:p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => window.location.href = '/admin/marketplace/kyc'}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700"
              >
                <FiShield className="w-4 h-4" />
                Review KYC ({stats.pendingKyc})
              </button>
              <button
                onClick={() => window.location.href = '/admin/marketplace/escrow'}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700"
              >
                <FiAlertTriangle className="w-4 h-4" />
                Disputes ({stats.openDisputes})
              </button>
              <button
                onClick={() => window.location.href = '/admin/marketplace/users'}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700"
              >
                <FiUsers className="w-4 h-4" />
                Manage Users
              </button>
              <button
                onClick={() => window.location.href = '/admin/marketplace/jobs'}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700"
              >
                <FiBriefcase className="w-4 h-4" />
                View Jobs
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
