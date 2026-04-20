'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { 
  FiUsers, FiTrendingUp, FiMessageSquare, FiMail, FiPhone, 
  FiMapPin, FiPlus, FiSend, FiUserPlus, FiActivity, FiStar,
  FiHash, FiArrowRight
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface CRMStats {
  totalCustomers: number
  newCustomersThisMonth: number
  newCustomersLastMonth: number
  customerGrowth: number
  activeCustomers: number
  inactiveCustomers: number
  blacklistedCustomers: number
  regularCustomers: number
  vipCustomers: number
  corporateCustomers: number
  potentialCustomers: number
  avgBookingsPerCustomer: number
  repeatCustomerRate: number
  avgRevenuePerCustomer: number
  totalRevenue: number
  topCustomers: Array<{ id: string; name: string; totalSpent: number; totalBookings: number }>
  customersByProvince: Array<{ province: string; count: number; revenue: number }>
  recentSignups: Array<{ id: string; name: string; email: string; createdAt: string }>
  totalCommunications: number
  whatsappMessages: number
  smsMessages: number
  emailMessages: number
  topTags: Array<{ id: string; name: string; color: string; usageCount: number }>
  customerRegistrationsByDay: Array<{ date: string; count: number }>
}

export default function CRMDashboardPage() {
  const { user } = useAdminSession()
  const [stats, setStats] = useState<CRMStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const fetchStats = useCallback(async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/crm/stats', {
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to load CRM stats')
        return
      }

      setStats(data)
      setError(null)
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiActivity className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading CRM Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-primary-500 text-dark-900 rounded-lg font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const s = stats!

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">CRM Dashboard</h1>
        <p className="text-gray-600">Customer insights and management overview</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <FiUsers className="text-primary-600 text-xl" />
            </div>
            {s.customerGrowth !== 0 && (
              <span className={`text-sm font-medium ${s.customerGrowth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {s.customerGrowth > 0 ? '+' : ''}{Math.round(s.customerGrowth)}%
              </span>
            )}
          </div>
          <div className="text-3xl font-bold text-gray-900">{s.totalCustomers}</div>
          <div className="text-gray-600">Total Customers</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <FiTrendingUp className="text-green-600 text-xl" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{s.newCustomersThisMonth}</div>
          <div className="text-gray-600">New This Month</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <FiStar className="text-yellow-600 text-xl" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{s.vipCustomers}</div>
          <div className="text-gray-600">VIP Customers</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <FiActivity className="text-purple-600 text-xl" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{Math.round(s.repeatCustomerRate)}%</div>
          <div className="text-gray-600">Repeat Rate</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Growth (Last 30 Days)</h2>
          <div className="h-64 flex items-end gap-1">
            {s.customerRegistrationsByDay.length > 0 ? (
              s.customerRegistrationsByDay.map((day, i) => {
                const maxCount = Math.max(...s.customerRegistrationsByDay.map(d => d.count), 1)
                const height = (day.count / maxCount) * 100
                const date = new Date(day.date)
                const showLabel = i === 0 || i === s.customerRegistrationsByDay.length - 1 || i === Math.floor(s.customerRegistrationsByDay.length / 2)
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-primary-500 rounded-t hover:bg-primary-600 transition-colors"
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={`${day.count} customers on ${day.date}`}
                    />
                    {showLabel && (
                      <span className="text-xs text-gray-500 mt-1 transform -rotate-45 origin-center whitespace-nowrap">
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="w-full flex items-center justify-center text-gray-500">
                No registration data available
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Communication Channels</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <FiMessageSquare className="text-green-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">WhatsApp</div>
                  <div className="text-sm text-gray-500">{s.whatsappMessages} messages</div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FiPhone className="text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">SMS</div>
                  <div className="text-sm text-gray-500">{s.smsMessages} messages</div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FiMail className="text-purple-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">Email</div>
                  <div className="text-sm text-gray-500">{s.emailMessages} messages</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isSuperAdmin && s.customersByProvince.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Customers by Province</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {s.customersByProvince.map(province => (
              <div key={province.province} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FiMapPin className="text-gray-400" />
                  <span className="font-medium text-gray-900">{province.province}</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{province.count}</div>
                <div className="text-sm text-gray-500">
                  ฿{province.revenue.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Top Customers</h2>
            <Link href="/admin/customers" className="text-primary-600 text-sm font-medium hover:text-primary-700 flex items-center">
              View All <FiArrowRight className="ml-1" />
            </Link>
          </div>
          <div className="divide-y">
            {s.topCustomers.length > 0 ? (
              s.topCustomers.map(customer => (
                <div key={customer.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{customer.name}</div>
                    <div className="text-sm text-gray-500">
                      {customer.totalBookings} bookings
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">
                      ฿{customer.totalSpent.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">total spent</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">No customers yet</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Signups</h2>
            <Link href="/admin/customers" className="text-primary-600 text-sm font-medium hover:text-primary-700 flex items-center">
              View All <FiArrowRight className="ml-1" />
            </Link>
          </div>
          <div className="divide-y">
            {s.recentSignups.length > 0 ? (
              s.recentSignups.map(signup => (
                <div key={signup.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{signup.name}</div>
                    <div className="text-sm text-gray-500">{signup.email}</div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(signup.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">No recent signups</div>
            )}
          </div>
        </div>
      </div>

      {s.topTags.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Tags</h2>
          <div className="flex flex-wrap gap-2">
            {s.topTags.map(tag => (
              <span
                key={tag.id}
                className="px-3 py-1.5 rounded-full text-sm font-medium"
                style={{ 
                  backgroundColor: tag.color + '20', 
                  color: tag.color 
                }}
              >
                <FiHash className="inline mr-1" />
                {tag.name} ({tag.usageCount})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Link
            href="/admin/customers?action=add"
            className="flex items-center justify-center gap-2 p-4 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
          >
            <FiUserPlus className="text-primary-600" />
            <span className="font-medium text-primary-700">Add Customer</span>
          </Link>
          <Link
            href="/admin/crm/messages"
            className="flex items-center justify-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
          >
            <FiSend className="text-green-600" />
            <span className="font-medium text-green-700">Send Bulk Message</span>
          </Link>
          <Link
            href="/admin/crm/segments"
            className="flex items-center justify-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <FiPlus className="text-blue-600" />
            <span className="font-medium text-blue-700">Create Segment</span>
          </Link>
        </div>
      </div>
    </div>
  )
}