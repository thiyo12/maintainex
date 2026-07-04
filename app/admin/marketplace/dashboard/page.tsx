'use client'

import { useQuery } from '@tanstack/react-query'
import { FiUsers, FiBriefcase, FiDollarSign, FiShield, FiClock, FiRefreshCw, FiAlertTriangle, FiStar } from 'react-icons/fi'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '@/lib/api'

interface DashboardStats {
  totalUsers: number
  activeJobs: number
  monthlyRevenue: number
  pendingDisputes: number
  openAlerts: number
  totalEscrows: number
  revenueData: Array<{ date: string; revenue: number }>
  recentActivity: Array<{ id: string; action: string; targetLabel: string | null; createdAt: string }>
}

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery<DashboardStats>({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const [usersRes, jobsRes, revenueRes, disputesRes, alertsRes, escrowRes, activityRes] = await Promise.allSettled([
        api.get('/api/admin/marketplace/users?limit=1'),
        api.get('/api/admin/marketplace/jobs?limit=1'),
        api.get('/api/admin/marketplace/revenue'),
        api.get('/api/admin/marketplace/disputes?limit=1'),
        api.get('/api/admin/marketplace/alerts?limit=1&status=open'),
        api.get('/api/admin/marketplace/escrow?limit=1'),
        api.get('/api/admin/marketplace/audit-logs?limit=10'),
      ])

      return {
        totalUsers: usersRes.status === 'fulfilled' ? usersRes.value.data?.total || 0 : 0,
        activeJobs: jobsRes.status === 'fulfilled' ? jobsRes.value.data?.total || 0 : 0,
        monthlyRevenue: revenueRes.status === 'fulfilled' ? revenueRes.value.data?.totalRevenue || 0 : 0,
        pendingDisputes: disputesRes.status === 'fulfilled' ? disputesRes.value.data?.total || 0 : 0,
        openAlerts: alertsRes.status === 'fulfilled' ? alertsRes.value.data?.total || 0 : 0,
        totalEscrows: escrowRes.status === 'fulfilled' ? escrowRes.value.data?.total || 0 : 0,
        revenueData: revenueRes.status === 'fulfilled' ? revenueRes.value.data?.daily || [] : [],
        recentActivity: activityRes.status === 'fulfilled' ? activityRes.value.data?.logs || [] : [],
      }
    },
    refetchInterval: 60000,
  })

  const stats = [
    { label: 'Total Users', value: data?.totalUsers.toLocaleString() || '0', icon: FiUsers, color: '#3B82F6' },
    { label: 'Active Jobs', value: data?.activeJobs.toLocaleString() || '0', icon: FiBriefcase, color: '#22C55E' },
    { label: 'Monthly Revenue', value: `$${(data?.monthlyRevenue || 0).toLocaleString()}`, icon: FiDollarSign, color: '#A855F7' },
    { label: 'Pending Disputes', value: data?.pendingDisputes.toLocaleString() || '0', icon: FiShield, color: '#F59E0B' },
    { label: 'Open Alerts', value: data?.openAlerts.toLocaleString() || '0', icon: FiAlertTriangle, color: '#EF4444' },
    { label: 'Total Escrows', value: data?.totalEscrows.toLocaleString() || '0', icon: FiClock, color: '#06B6D4' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: '#F59E0B' }}>Dashboard</h1>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ backgroundColor: '#1B1D27', color: '#F59E0B', border: '1px solid #23252F' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#23252F'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1B1D27'}
        >
          <FiRefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg text-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          Failed to load some dashboard data
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((kpi) => (
          <div key={kpi.label} className="rounded-xl p-5" style={{ backgroundColor: '#1B1D27', border: '1px solid #23252F' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">{kpi.label}</span>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${kpi.color}20` }}>
                <kpi.icon style={{ color: kpi.color }} size={18} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white">{isLoading ? '...' : kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl p-6" style={{ backgroundColor: '#1B1D27', border: '1px solid #23252F' }}>
          <h3 className="text-lg font-semibold text-white mb-4">Revenue (Last 7 Days)</h3>
          {data?.revenueData && data.revenueData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#23252F" />
                  <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 12 }} stroke="#23252F" />
                  <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} stroke="#23252F" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1B1D27', border: '1px solid #23252F', borderRadius: '8px' }}
                    labelStyle={{ color: '#F59E0B' }}
                  />
                  <Bar dataKey="revenue" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500 text-sm">No revenue data available</div>
          )}
        </div>

        <div className="rounded-xl p-6" style={{ backgroundColor: '#1B1D27', border: '1px solid #23252F' }}>
          <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
          {data?.recentActivity && data.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {data.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #23252F' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded font-medium" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}>
                      {activity.action}
                    </span>
                    <span className="text-sm text-gray-400">{activity.targetLabel || activity.action}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(activity.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500 text-sm">No recent activity</div>
          )}
        </div>
      </div>
    </div>
  )
}
