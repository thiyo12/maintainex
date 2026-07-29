'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiUsers, FiCheckCircle, FiClock, FiShield, FiDollarSign, FiAlertTriangle, FiBriefcase, FiUserX } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'
import AdminLayout from '@/components/admin/AdminLayout'

interface DashboardStats {
  stats: {
    totalUsers: number
    totalTaskers: number
    totalCompanies: number
    pendingKYC: number
    verifiedKYC: number
    rejectedKYC: number
    bannedUsers: number
    pendingSettlements: number
    overdueSettlements: number
    totalCommissionOwed: number
    totalCommissionPaid: number
    pendingCheatingReports: number
    totalJobPostings: number
    openJobs: number
    completedJobs: number
    totalWalletBalance: number
    commissionRate: number
  }
  weeklySummary: {
    pendingCommission: number
    pendingCount: number
    overdueCommission: number
    overdueCount: number
  }
}

export default function AdminDashboard() {
  const { user } = useAdminSession()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/dashboard', {
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      }
      setStats(data)
    } catch (error) {
      console.error('Dashboard error:', error)
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Platform Dashboard</h1>
          <p className="text-gray-600 mt-1">MaintainEX marketplace overview — App & Website</p>
        </div>

        {/* Users Section */}
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Users</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FiUsers className="text-blue-600 text-lg md:text-xl" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats?.stats?.totalUsers || 0}</div>
            <div className="text-gray-500 text-sm">Total Users</div>
          </div>

          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <FiCheckCircle className="text-green-600 text-lg md:text-xl" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats?.stats?.totalTaskers || 0}</div>
            <div className="text-gray-500 text-sm">Taskers</div>
          </div>

          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <FiBriefcase className="text-purple-600 text-lg md:text-xl" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats?.stats?.totalCompanies || 0}</div>
            <div className="text-gray-500 text-sm">Companies</div>
          </div>

          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <FiUserX className="text-red-600 text-lg md:text-xl" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats?.stats?.bannedUsers || 0}</div>
            <div className="text-gray-500 text-sm">Banned Users</div>
          </div>
        </div>

        {/* KYC & Verification Section */}
        <h2 className="text-lg font-semibold text-gray-800 mb-3">KYC Verification</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <FiClock className="text-yellow-600 text-lg md:text-xl" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-yellow-700">{stats?.stats?.pendingKYC || 0}</div>
            <div className="text-yellow-600 text-sm">Pending Review</div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <FiCheckCircle className="text-green-600 text-lg md:text-xl" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-green-700">{stats?.stats?.verifiedKYC || 0}</div>
            <div className="text-green-600 text-sm">Verified</div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <FiShield className="text-red-600 text-lg md:text-xl" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-red-700">{stats?.stats?.rejectedKYC || 0}</div>
            <div className="text-red-600 text-sm">Rejected</div>
          </div>
        </div>

        {/* Commission & Settlement Section */}
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Commission & Settlements</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <FiDollarSign className="text-amber-600 text-lg md:text-xl" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-gray-900">{formatCurrency(stats?.stats?.totalCommissionOwed || 0)}</div>
            <div className="text-gray-500 text-sm">Pending Commission</div>
          </div>

          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <FiCheckCircle className="text-green-600 text-lg md:text-xl" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-gray-900">{formatCurrency(stats?.stats?.totalCommissionPaid || 0)}</div>
            <div className="text-gray-500 text-sm">Commission Collected</div>
          </div>

          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <FiAlertTriangle className="text-red-600 text-lg md:text-xl" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-red-700">{stats?.weeklySummary?.overdueCount || 0}</div>
            <div className="text-red-600 text-sm">Overdue Settlements</div>
          </div>

          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FiDollarSign className="text-blue-600 text-lg md:text-xl" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-gray-900">10%</div>
            <div className="text-gray-500 text-sm">Commission Rate</div>
          </div>
        </div>

        {/* Jobs & Activity Section */}
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Jobs & Activity</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
            <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats?.stats?.totalJobPostings || 0}</div>
            <div className="text-gray-500 text-sm">Total Jobs</div>
          </div>

          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
            <div className="text-2xl md:text-3xl font-bold text-green-700">{stats?.stats?.openJobs || 0}</div>
            <div className="text-gray-500 text-sm">Open Jobs</div>
          </div>

          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
            <div className="text-2xl md:text-3xl font-bold text-blue-700">{stats?.stats?.completedJobs || 0}</div>
            <div className="text-gray-500 text-sm">Completed</div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <FiAlertTriangle className="text-red-600 text-lg md:text-xl" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-red-700">{stats?.stats?.pendingCheatingReports || 0}</div>
            <div className="text-red-600 text-sm">Cheating Reports</div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
