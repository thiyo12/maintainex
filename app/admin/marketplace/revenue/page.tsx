'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiDollarSign, FiRefreshCw, FiAlertCircle, FiCreditCard, FiTrendingUp, FiShield } from 'react-icons/fi'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { PERMISSION } from '@/lib/permissions'
import { PermissionGate } from '@/components/admin/PermissionGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface RevenueData {
  stats: {
    totalRevenue: number
    totalTransactions: number
    avgTransaction: number
    platformFeeCollected: number
  }
  dailyRevenue: Array<{
    date: string
    revenue: number
    transactions: number
    fees: number
  }>
  topProviders: Array<{
    userId: string
    name: string
    jobsCompleted: number
    totalEarnings: number
  }>
  recentTransactions: Array<{
    id: string
    userId: string
    walletType: string
    type: string
    amount: number
    reference: string
    referenceType: string
    status: string
    createdAt: string
  }>
}

function formatLKR(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
  }).format(amount)
}

function getDefaultDateRange() {
  const now = new Date()
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const to = now.toISOString().slice(0, 10)
  return { from, to }
}

export default function MarketplaceRevenue() {
  const adminUser = useAuthStore((s) => s.adminUser)
  const defaults = getDefaultDateRange()
  const [fromDate, setFromDate] = useState(defaults.from)
  const [toDate, setToDate] = useState(defaults.to)

  const { data, isLoading, error, refetch } = useQuery<RevenueData>({
    queryKey: ['admin-marketplace-revenue', fromDate, toDate],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/revenue', {
        params: { from: fromDate, to: toDate },
      })
      const body = res.data
      if (body.error || !body.success) throw new Error(body.error || 'Failed to load revenue data')
      return body.data
    },
  })

  const stats = [
    {
      label: 'Total Revenue',
      value: formatLKR(data?.stats.totalRevenue || 0),
      icon: FiDollarSign,
      color: 'bg-amber-500',
    },
    {
      label: 'Total Transactions',
      value: (data?.stats.totalTransactions || 0).toLocaleString(),
      icon: FiCreditCard,
      color: 'bg-blue-500',
    },
    {
      label: 'Avg Transaction',
      value: formatLKR(data?.stats.avgTransaction || 0),
      icon: FiTrendingUp,
      color: 'bg-green-500',
    },
    {
      label: 'Platform Fee Collected',
      value: formatLKR(data?.stats.platformFeeCollected || 0),
      icon: FiShield,
      color: 'bg-purple-500',
    },
  ]

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardHeader><Skeleton className="h-4 w-20" /></CardHeader><CardContent><Skeleton className="h-8 w-24" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <FiAlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-gray-600">{error instanceof Error ? error.message : 'Failed to load revenue data'}</p>
          <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <PermissionGate roles={PERMISSION.viewDashboard}>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Revenue Analytics</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <FiRefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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

        {/* Tabs */}
        <Tabs defaultValue="daily">
          <TabsList>
            <TabsTrigger value="daily">Daily Revenue</TabsTrigger>
            <TabsTrigger value="providers">Top Providers</TabsTrigger>
            <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
          </TabsList>

          {/* Daily Revenue Table */}
          <TabsContent value="daily" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!data?.dailyRevenue.length ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <FiDollarSign className="w-12 h-12 text-gray-300" />
                    <p className="text-gray-500">No revenue data for this period</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Revenue (LKR)</TableHead>
                          <TableHead className="text-right">Transactions</TableHead>
                          <TableHead className="text-right">Platform Fees</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.dailyRevenue.map((day) => (
                          <TableRow key={day.date}>
                            <TableCell className="font-medium">{day.date}</TableCell>
                            <TableCell className="text-right font-mono">{formatLKR(day.revenue)}</TableCell>
                            <TableCell className="text-right">{day.transactions}</TableCell>
                            <TableCell className="text-right font-mono text-amber-600">{formatLKR(day.fees)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Top Providers */}
          <TabsContent value="providers" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Providers by Earnings</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!data?.topProviders.length ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <FiDollarSign className="w-12 h-12 text-gray-300" />
                    <p className="text-gray-500">No provider earnings for this period</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rank</TableHead>
                          <TableHead>Provider</TableHead>
                          <TableHead className="text-right">Jobs Completed</TableHead>
                          <TableHead className="text-right">Total Earnings</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.topProviders.map((p, idx) => (
                          <TableRow key={p.userId}>
                            <TableCell className="font-bold text-amber-600">#{idx + 1}</TableCell>
                            <TableCell>
                              <div className="font-medium">{p.name}</div>
                              <div className="text-xs text-gray-400">{p.userId.slice(0, 12)}...</div>
                            </TableCell>
                            <TableCell className="text-right">{p.jobsCompleted}</TableCell>
                            <TableCell className="text-right font-mono font-medium">{formatLKR(p.totalEarnings)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recent Transactions */}
          <TabsContent value="transactions" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions (Last 50)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!data?.recentTransactions.length ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <FiCreditCard className="w-12 h-12 text-gray-300" />
                    <p className="text-gray-500">No transactions for this period</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Wallet</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.recentTransactions.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                              {new Date(t.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={t.walletType === 'PROVIDER' ? 'border-amber-500 text-amber-600' : 'border-blue-500 text-blue-600'}>
                                {t.walletType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={t.type === 'CREDIT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                {t.type}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-mono font-medium ${t.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                              {t.type === 'CREDIT' ? '+' : '-'}{formatLKR(t.amount)}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500 max-w-[160px] truncate">{t.referenceType}</TableCell>
                            <TableCell>
                              <Badge className={t.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                {t.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  )
}
