'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  FiUsers, FiUserCheck, FiBriefcase, FiTool, FiDollarSign,
  FiTrendingUp, FiActivity, FiClock, FiArrowUpRight, FiArrowDownRight
} from 'react-icons/fi'
import { getAuthHeader } from '@/lib/auth-client'
import AdminLayout from '@/components/admin/AdminLayout'

interface AnalyticsData {
  summary: {
    totalUsers: number
    activeTaskers: number
    activeCompanies: number
    totalJobs: number
    openJobs: number
    completedJobs: number
    cancelledJobs: number
    totalRevenue: number
    totalCommission: number
    commissionCount: number
  }
  jobsByStatus: {
    open: number
    completed: number
    cancelled: number
    inProgress: number
  }
  usersByRole: Record<string, number>
  recentActivity: Array<{
    id: string
    adminEmail: string
    action: string
    entityType: string
    entityId: string | null
    description: string
    createdAt: string
  }>
}

const STAT_CARDS = [
  { key: 'totalUsers', label: 'Total Users', icon: FiUsers, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { key: 'activeTaskers', label: 'Active Taskers', icon: FiUserCheck, color: 'text-green-400', bg: 'bg-green-500/10' },
  { key: 'activeCompanies', label: 'Active Companies', icon: FiBriefcase, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { key: 'totalJobs', label: 'Total Jobs', icon: FiTool, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { key: 'totalRevenue', label: 'Revenue', icon: FiDollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10', isCurrency: true },
  { key: 'totalCommission', label: 'Commission', icon: FiTrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10', isCurrency: true },
]

const JOB_STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  open: { color: 'text-green-400', bg: 'bg-green-500' },
  completed: { color: 'text-blue-400', bg: 'bg-blue-500' },
  inProgress: { color: 'text-amber-400', bg: 'bg-amber-500' },
  cancelled: { color: 'text-red-400', bg: 'bg-red-500' },
}

export default function AnalyticsOverview() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAnalytics = useCallback(async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/admin/analytics', { headers: { ...authHeaders } })
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAnalytics() }, [fetchAnalytics])

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 0 }).format(v)

  const formatNumber = (v: number) =>
    new Intl.NumberFormat('en-US').format(v)

  const maxJobStatus = data ? Math.max(data.jobsByStatus.open, data.jobsByStatus.completed, data.jobsByStatus.inProgress, data.jobsByStatus.cancelled, 1) : 1

  const totalJobsForPercent = data ? Math.max(data.summary.totalJobs, 1) : 1

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics Overview</h1>
          <p className="text-gray-400 text-sm mt-1">Platform metrics and performance data</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {STAT_CARDS.map((card) => {
                const value = (data.summary as any)[card.key] ?? 0
                return (
                  <div key={card.key} className="bg-[#15161E] border border-white/5 rounded-xl p-4">
                    <div className={`w-9 h-9 ${card.bg} rounded-lg flex items-center justify-center mb-3`}>
                      <card.icon className={`${card.color} text-lg`} />
                    </div>
                    <div className="text-xl font-bold text-white">
                      {card.isCurrency ? formatCurrency(value) : formatNumber(value)}
                    </div>
                    <div className="text-gray-400 text-xs mt-0.5">{card.label}</div>
                  </div>
                )
              })}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-[#15161E] border border-white/5 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-4">Jobs by Status</h3>
                <div className="space-y-3">
                  {Object.entries(data.jobsByStatus).map(([status, count]) => {
                    const cfg = JOB_STATUS_COLORS[status] || JOB_STATUS_COLORS.open
                    const pct = (count / maxJobStatus) * 100
                    const displayPct = ((count / totalJobsForPercent) * 100).toFixed(1)
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-300 capitalize">{status.replace(/([A-Z])/g, ' $1')}</span>
                          <span className="text-sm text-gray-400">{formatNumber(count)} ({displayPct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full ${cfg.bg} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-[#15161E] border border-white/5 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-4">Users by Role</h3>
                <div className="space-y-3">
                  {Object.entries(data.usersByRole).map(([role, count]) => {
                    const maxRole = Math.max(...Object.values(data.usersByRole), 1)
                    const pct = (count / maxRole) * 100
                    return (
                      <div key={role}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-300">{role}</span>
                          <span className="text-sm text-gray-400">{formatNumber(count)}</span>
                        </div>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                  {Object.keys(data.usersByRole).length === 0 && (
                    <p className="text-gray-500 text-sm">No user data available</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-[#15161E] border border-white/5 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <FiActivity className="text-amber-400" size={18} />
                <h3 className="text-white font-semibold">Recent Activity</h3>
              </div>
              {data.recentActivity.length === 0 ? (
                <p className="text-gray-500 text-sm py-4">No recent activity</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {data.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FiClock size={14} className="text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium">{activity.adminEmail}</span>
                          <span className="text-gray-500 text-xs">•</span>
                          <span className="text-amber-400 text-xs font-medium px-1.5 py-0.5 bg-amber-500/10 rounded">
                            {activity.action}
                          </span>
                          <span className="text-gray-500 text-xs">•</span>
                          <span className="text-gray-400 text-xs">{activity.entityType}</span>
                        </div>
                        <p className="text-gray-400 text-xs mt-0.5 truncate">{activity.description}</p>
                      </div>
                      <span className="text-gray-500 text-xs flex-shrink-0">
                        {new Date(activity.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}
