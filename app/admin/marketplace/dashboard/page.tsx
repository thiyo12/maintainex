'use client'

import { useQuery } from '@tanstack/react-query'
import { FiUsers, FiBriefcase, FiDollarSign, FiShield, FiClock, FiRefreshCw, FiAlertCircle } from 'react-icons/fi'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { formatMoney } from '@/lib/money'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

interface DashboardData {
  totalUsers: number
  activeJobs: number
  monthlyRevenue: number
  pendingKyc: number
  totalEscrows: number
  recentActivity: Array<{
    id: string
    adminEmail: string
    action: string
    targetLabel: string | null
    createdAt: string
  }>
}

export default function MarketplaceDashboard() {
  const adminUser = useAuthStore((s) => s.adminUser)

  const { data, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ['admin-marketplace-dashboard'],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/reports/summary')
      const body = res.data
      if (body.error || !body.success) throw new Error(body.error || 'Failed to load dashboard')
      return body.data
    },
  })

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketplace Dashboard</h1>
          <p className="text-gray-500">Overview of your marketplace platform.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardHeader><Skeleton className="h-4 w-20" /></CardHeader><CardContent><Skeleton className="h-8 w-24" /></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <FiAlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-gray-600">{error instanceof Error ? error.message : 'Failed to load dashboard'}</p>
          <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    )
  }

  const stats = [
    { label: 'Total Users', value: data?.totalUsers.toLocaleString() || '0', icon: FiUsers, color: 'bg-blue-500' },
    { label: 'Active Jobs', value: data?.activeJobs.toLocaleString() || '0', icon: FiBriefcase, color: 'bg-green-500' },
    { label: 'Monthly Revenue', value: formatMoney(data?.monthlyRevenue || 0), icon: FiDollarSign, color: 'bg-indigo-500' },
    { label: 'Pending KYC', value: data?.pendingKyc.toLocaleString() || '0', icon: FiShield, color: 'bg-yellow-500' },
    { label: 'Total Escrows', value: data?.totalEscrows.toLocaleString() || '0', icon: FiClock, color: 'bg-purple-500' },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketplace Dashboard</h1>
          <p className="text-gray-500">Overview of your marketplace platform.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}><FiRefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{kpi.label}</CardTitle>
              <div className={`w-8 h-8 ${kpi.color} rounded-lg flex items-center justify-center`}>
                <kpi.icon className="w-4 h-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentActivity && data.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {data.recentActivity.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{activity.action}</Badge>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a href="/admin/marketplace/kyc" className={cn(buttonVariants({ variant: "outline" }), "flex items-center gap-2")}>
                <FiShield className="w-4 h-4" />
                Review KYC ({data?.pendingKyc || 0})
              </a>
              <a href="/admin/marketplace/escrow" className={cn(buttonVariants({ variant: "outline" }), "flex items-center gap-2")}>
                <FiClock className="w-4 h-4" />
                Escrows ({data?.totalEscrows || 0})
              </a>
              <a href="/admin/marketplace/users" className={cn(buttonVariants({ variant: "outline" }), "flex items-center gap-2")}>
                <FiUsers className="w-4 h-4" />
                Manage Users
              </a>
              <a href="/admin/marketplace/jobs" className={cn(buttonVariants({ variant: "outline" }), "flex items-center gap-2")}>
                <FiBriefcase className="w-4 h-4" />
                View Jobs
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
