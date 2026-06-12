'use client'

import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FiDownload, FiDollarSign, FiTrendingUp, FiUsers, FiBriefcase, FiAlertCircle, FiRefreshCw } from 'react-icons/fi'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { can, PERMISSION } from '@/lib/permissions'
import { PermissionGate } from '@/components/admin/PermissionGate'
import { formatMoney } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

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
  const adminUser = useAuthStore((s) => s.adminUser)

  const { data, isLoading, error, refetch } = useQuery<ReportData>({
    queryKey: ['admin-marketplace-reports'],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/reports/summary')
      const body = res.data
      if (body.error || !body.success) throw new Error(body.error || 'Failed to load reports')
      return body.data
    },
  })

  const exportCsv = async (type: string) => {
    try {
      const res = await api.get(`/api/admin/marketplace/reports/export?type=${type}`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-report.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success(`${type} report exported`)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to export report')
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Reports</h1><p className="text-gray-500">Loading reports...</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
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
          <p className="text-gray-600">{error instanceof Error ? error.message : 'Failed to load reports'}</p>
          <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    )
  }

  const stats = [
    { label: 'Total Users', value: data?.totalUsers.toLocaleString() || '0', icon: FiUsers, color: 'bg-blue-500' },
    { label: 'Active Jobs', value: data?.activeJobs.toLocaleString() || '0', icon: FiBriefcase, color: 'bg-green-500' },
    { label: 'Monthly Revenue', value: formatMoney(data?.monthlyRevenue || 0), icon: FiDollarSign, color: 'bg-indigo-500' },
    { label: 'Avg Job Value', value: formatMoney(data?.avgJobValue || 0), icon: FiTrendingUp, color: 'bg-purple-500' },
    { label: 'New Users (Month)', value: data?.newUsersThisMonth.toLocaleString() || '0', icon: FiUsers, color: 'bg-teal-500' },
    { label: 'Completed Jobs (Month)', value: data?.completedJobsThisMonth.toLocaleString() || '0', icon: FiBriefcase, color: 'bg-orange-500' },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500">Platform analytics and data export</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}><FiRefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{s.label}</CardTitle>
              <div className={`w-8 h-8 ${s.color} rounded-lg flex items-center justify-center`}>
                <s.icon className="w-4 h-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PermissionGate roles={PERMISSION.exportReports}>
        <Card>
          <CardHeader><CardTitle>Export Data</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-gray-500">Download CSV reports for offline analysis.</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => exportCsv('users')}>
                <FiDownload className="mr-2 h-4 w-4" /> Export Users
              </Button>
              <Button variant="outline" onClick={() => exportCsv('jobs')}>
                <FiDownload className="mr-2 h-4 w-4" /> Export Jobs
              </Button>
              <Button variant="outline" onClick={() => exportCsv('transactions')}>
                <FiDownload className="mr-2 h-4 w-4" /> Export Transactions
              </Button>
            </div>
          </CardContent>
        </Card>
      </PermissionGate>
    </div>
  )
}
