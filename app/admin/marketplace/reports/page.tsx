'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiDownload, FiDollarSign, FiTrendingUp, FiUsers, FiBriefcase, FiAlertCircle } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface ReportData {
  totalUsers: number
  activeJobs: number
  monthlyRevenue: number
  pendingKyc: number
  openDisputes: number
  totalEscrows: number
  newUsersThisMonth: number
  completedJobsThisMonth: number
  avgJobValue: number
}

export default function MarketplaceReports() {
  const { user } = useAdminSession()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
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

      if (result.error) {
        toast.error(result.error)
        setError(result.error)
        return
      }

      setData(result.stats)
    } catch (error) {
      console.error('Reports fetch error:', error)
      toast.error('Failed to load reports')
      setError('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  const formatMoney = (cents: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
  }

  const exportCsv = async (type: string) => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/admin/marketplace/reports/export?type=${type}`, {
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      if (!res.ok) {
        toast.error('Failed to export')
        return
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(new Blob([blob]))
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-report.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success(`${type} report exported`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export report')
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
        <button onClick={fetchReports} className="btn-primary px-4 py-2 rounded-lg text-sm">Try Again</button>
      </div>
    )
  }

  const stats = [
    { label: 'Total Users', value: data?.totalUsers.toLocaleString() || '0', icon: FiUsers, color: 'bg-blue-500' },
    { label: 'Active Jobs', value: data?.activeJobs.toLocaleString() || '0', icon: FiBriefcase, color: 'bg-green-500' },
    { label: 'Monthly Revenue', value: formatMoney(data?.monthlyRevenue || 0), icon: FiDollarSign, color: 'bg-primary-500' },
    { label: 'Avg Job Value', value: formatMoney(data?.avgJobValue || 0), icon: FiTrendingUp, color: 'bg-purple-500' },
    { label: 'New Users (Month)', value: data?.newUsersThisMonth.toLocaleString() || '0', icon: FiUsers, color: 'bg-teal-500' },
    { label: 'Completed Jobs (Month)', value: data?.completedJobsThisMonth.toLocaleString() || '0', icon: FiBriefcase, color: 'bg-orange-500' },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Platform analytics and data export</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportCsv('users')}
            className="btn-outline flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          >
            <FiDownload className="w-4 h-4" /> Users CSV
          </button>
          <button
            onClick={() => exportCsv('jobs')}
            className="btn-outline flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          >
            <FiDownload className="w-4 h-4" /> Jobs CSV
          </button>
          <button
            onClick={() => exportCsv('transactions')}
            className="btn-outline flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          >
            <FiDownload className="w-4 h-4" /> Transactions CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-10 h-10 md:w-12 md:h-12 ${s.color} rounded-xl flex items-center justify-center`}>
                <s.icon className="text-white text-lg md:text-xl" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-gray-900">{s.value}</div>
            <div className="text-gray-500 text-sm">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-4 md:p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Export Data</h2>
        </div>
        <div className="p-4 md:p-6">
          <p className="mb-4 text-sm text-gray-500">Download CSV reports for offline analysis.</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => exportCsv('users')}
              className="btn-outline flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
            >
              <FiDownload className="w-4 h-4" /> Export Users
            </button>
            <button
              onClick={() => exportCsv('jobs')}
              className="btn-outline flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
            >
              <FiDownload className="w-4 h-4" /> Export Jobs
            </button>
            <button
              onClick={() => exportCsv('transactions')}
              className="btn-outline flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
            >
              <FiDownload className="w-4 h-4" /> Export Transactions
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
