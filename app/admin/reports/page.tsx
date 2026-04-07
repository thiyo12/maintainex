'use client'

import { useEffect, useState } from 'react'
import { FiBarChart2, FiCalendar, FiUsers, FiBriefcase, FiTrendingUp, FiTrendingDown, FiRefreshCw, FiDownload } from 'react-icons/fi'
import toast from 'react-hot-toast'

interface ReportData {
  period: string
  dateRange: { start: string; end: string }
  summary: {
    bookings: {
      total: number
      pending: number
      confirmed: number
      inProgress: number
      completed: number
      cancelled: number
      change: number
    }
    applications: {
      total: number
      new: number
      reviewed: number
      interview: number
      hired: number
      rejected: number
      change: number
    }
    adminActivity: {
      total: number
      logins: number
      creates: number
      updates: number
      deletes: number
      statusChanges: number
      change: number
    }
  }
  dailyStats: {
    dailyBookings: Array<{ date: string; status: string; count: number }>
    dailyApplications: Array<{ date: string; status: string; count: number }>
  }
  recentActivity: Array<{
    id: string
    adminEmail: string
    adminName: string | null
    action: string
    entityType: string
    description: string
    details: string | null
    createdAt: string
  }>
  adminList: Array<{
    adminId: string
    adminEmail: string
    adminName: string | null
    activityCount: number
  }>
  activityTotal: number
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  VIEW: 'bg-gray-100 text-gray-700',
  LOGIN: 'bg-purple-100 text-purple-700',
  LOGOUT: 'bg-gray-100 text-gray-700',
  STATUS_CHANGE: 'bg-yellow-100 text-yellow-700',
  EXPORT: 'bg-indigo-100 text-indigo-700'
}

const entityColors: Record<string, string> = {
  BOOKING: 'bg-primary-100 text-primary-700',
  APPLICATION: 'bg-blue-100 text-blue-700',
  SERVICE: 'bg-green-100 text-green-700',
  SETTINGS: 'bg-purple-100 text-purple-700',
  AUTH: 'bg-yellow-100 text-yellow-700'
}

export default function AdminReports() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [filterEntity, setFilterEntity] = useState<string>('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchReport()
  }, [period])

  const fetchReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ period })
      if (filterEntity) params.append('entityType', filterEntity)
      
      const res = await fetch(`/api/reports?${params}`)
      
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/admin/login'
          return
        }
        throw new Error('Failed to fetch reports')
      }
      
      const result = await res.json()
      setData(result)
    } catch (err) {
      console.error('Failed to fetch reports:', err)
      setError('Failed to load reports. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const exportPDF = async () => {
    setExporting(true)
    try {
      const response = await fetch(`/api/reports/export?period=${period}`)
      
      if (!response.ok) {
        throw new Error('Failed to export')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `maintainex-${period}-report.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('Report downloaded successfully!')
    } catch (err) {
      console.error('Export error:', err)
      toast.error('Failed to export report')
    } finally {
      setExporting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading && !data) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Loading...</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        </div>
        <div className="bg-white rounded-xl p-8 shadow-sm text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={fetchReport} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Track all admin activities and business metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterEntity}
            onChange={(e) => {
              setFilterEntity(e.target.value)
              fetchReport()
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">All Entities</option>
            <option value="BOOKING">Bookings</option>
            <option value="APPLICATION">Applications</option>
            <option value="SERVICE">Services</option>
            <option value="SETTINGS">Settings</option>
            <option value="AUTH">Auth</option>
          </select>
          <button onClick={fetchReport} className="btn-outline flex items-center">
            <FiRefreshCw className="mr-2" /> Refresh
          </button>
          <button 
            onClick={exportPDF} 
            disabled={exporting}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 flex items-center disabled:opacity-50"
          >
            {exporting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <FiDownload className="mr-2" />
            )}
            Export PDF
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 mb-8">
        {(['week', 'month', 'year'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              period === p
                ? 'bg-primary-500 text-dark-900'
                : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {data ? (
        <>
          {/* Date Range */}
          <div className="bg-white rounded-xl p-4 shadow-sm mb-8">
            <div className="flex items-center gap-2 text-gray-600">
              <FiCalendar />
              <span>
                {formatDate(data.dateRange.start)} - {formatDate(data.dateRange.end)}
              </span>
            </div>
          </div>

          {/* Main Stats Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Bookings */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                  <FiBarChart2 className="text-primary-600 text-xl" />
                </div>
                <div className={`flex items-center text-sm font-medium ${data.summary.bookings.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.summary.bookings.change >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
                  <span className="ml-1">{Math.abs(data.summary.bookings.change)}%</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{data.summary.bookings.total}</div>
              <div className="text-gray-600">Total Bookings</div>
              <div className="mt-3 flex gap-2 text-xs">
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                  {data.summary.bookings.pending} Pending
                </span>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  {data.summary.bookings.completed} Done
                </span>
              </div>
            </div>

            {/* Total Applications */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FiBriefcase className="text-blue-600 text-xl" />
                </div>
                <div className={`flex items-center text-sm font-medium ${data.summary.applications.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.summary.applications.change >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
                  <span className="ml-1">{Math.abs(data.summary.applications.change)}%</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{data.summary.applications.total}</div>
              <div className="text-gray-600">Job Applications</div>
              <div className="mt-3 flex gap-2 text-xs">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                  {data.summary.applications.new} New
                </span>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  {data.summary.applications.hired} Hired
                </span>
              </div>
            </div>

            {/* Admin Activity */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <FiUsers className="text-purple-600 text-xl" />
                </div>
                <div className={`flex items-center text-sm font-medium ${data.summary.adminActivity.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.summary.adminActivity.change >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
                  <span className="ml-1">{Math.abs(data.summary.adminActivity.change)}%</span>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{data.summary.adminActivity.total}</div>
              <div className="text-gray-600">Admin Actions</div>
              <div className="mt-3 flex gap-2 text-xs">
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                  {data.summary.adminActivity.logins} Logins
                </span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="text-3xl font-bold text-gray-900 mb-4">Quick View</div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Confirmed</span>
                  <span className="font-medium text-blue-600">{data.summary.bookings.confirmed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">In Progress</span>
                  <span className="font-medium text-purple-600">{data.summary.bookings.inProgress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cancelled</span>
                  <span className="font-medium text-red-600">{data.summary.bookings.cancelled}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Reviewed</span>
                  <span className="font-medium text-indigo-600">{data.summary.applications.reviewed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Interview</span>
                  <span className="font-medium text-green-600">{data.summary.applications.interview}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Rejected</span>
                  <span className="font-medium text-red-600">{data.summary.applications.rejected}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Activity Breakdown */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            {/* Admin Activity by Type */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Admin Activity Breakdown</h2>
              <div className="space-y-4">
                {[
                  { label: 'Logins', value: data.summary.adminActivity.logins, color: 'bg-purple-500' },
                  { label: 'Creates', value: data.summary.adminActivity.creates, color: 'bg-green-500' },
                  { label: 'Updates', value: data.summary.adminActivity.updates, color: 'bg-blue-500' },
                  { label: 'Deletes', value: data.summary.adminActivity.deletes, color: 'bg-red-500' },
                  { label: 'Status Changes', value: data.summary.adminActivity.statusChanges, color: 'bg-yellow-500' }
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-medium">{item.value}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`${item.color} h-2 rounded-full transition-all`}
                        style={{ width: `${data.summary.adminActivity.total > 0 ? (item.value / data.summary.adminActivity.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Most Active Admins */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Most Active Admins</h2>
              {data.adminList.length > 0 ? (
                <div className="space-y-3">
                  {data.adminList.slice(0, 5).map((admin, index) => (
                    <div key={admin.adminId} className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">
                        {admin.adminName?.[0] || admin.adminEmail[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {admin.adminName || admin.adminEmail}
                        </div>
                        <div className="text-sm text-gray-500">{admin.adminEmail}</div>
                      </div>
                      <div className="text-lg font-bold text-gray-900">
                        {admin.activityCount}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">No activity recorded</div>
              )}
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Activity Log</h2>
              <p className="text-sm text-gray-500 mt-1">
                Showing {data.recentActivity.length} of {data.activityTotal} activities
              </p>
            </div>
            <div className="divide-y">
              {data.recentActivity.length > 0 ? (
                data.recentActivity.map((activity) => (
                  <div key={activity.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${actionColors[activity.action] || 'bg-gray-100 text-gray-700'}`}>
                          {activity.action}
                        </span>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${entityColors[activity.entityType] || 'bg-gray-100 text-gray-700'}`}>
                          {activity.entityType}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{activity.description}</div>
                        <div className="text-sm text-gray-500">
                          by {activity.adminName || activity.adminEmail}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDateTime(activity.createdAt)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">No activities recorded</div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
