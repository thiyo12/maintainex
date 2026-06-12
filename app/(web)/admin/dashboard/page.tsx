'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiUsers, FiCheckCircle, FiClock, FiActivity } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface DashboardStats {
  stats: {
    totalBookings: number
    pendingBookings: number
    totalApplications: number
    newApplications: number
    totalServices: number
  }
  recentBookings: Array<{
    id: string
    createdAt: Date
    status: string
    totalPrice: number
    service?: { name: string }
    user?: { name: string | null }
  }>
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here's your business overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <FiClock className="text-primary-600 text-lg md:text-xl" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats?.stats?.pendingBookings || 0}</div>
          <div className="text-gray-500 text-sm">Pending Bookings</div>
        </div>

        <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <FiCheckCircle className="text-green-600 text-lg md:text-xl" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats?.stats?.totalBookings || 0}</div>
          <div className="text-gray-500 text-sm">Total Bookings</div>
        </div>

        <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FiUsers className="text-blue-600 text-lg md:text-xl" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats?.stats?.newApplications || 0}</div>
          <div className="text-gray-500 text-sm">New Applications</div>
        </div>

        <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <FiActivity className="text-purple-600 text-lg md:text-xl" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats?.stats?.totalServices || 0}</div>
          <div className="text-gray-500 text-sm">Services</div>
        </div>
      </div>

      {/* Recent Bookings Table */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-4 md:p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats?.recentBookings && stats.recentBookings.length > 0 ? (
                stats.recentBookings.slice(0, 10).map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-4">
                      <div className="font-medium text-gray-900">{booking.user?.name || 'N/A'}</div>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-gray-600">{booking.service?.name || 'N/A'}</td>
                    <td className="px-4 md:px-6 py-4 text-gray-600">
                      {new Date(booking.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        booking.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        booking.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                        booking.status === 'CONFIRMED' ? 'bg-primary-100 text-primary-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 font-medium">
                      ฿{booking.totalPrice?.toLocaleString() || 0}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 md:px-6 py-8 text-center text-gray-500">
                    No bookings found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}