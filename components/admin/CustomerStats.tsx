'use client'

import { FiUsers, FiDollarSign, FiCalendar, FiTrendingUp, FiTrendingDown, FiStar, FiUserCheck, FiClock, FiAlertCircle } from 'react-icons/fi'
import { clsx } from 'clsx'

export interface CustomerStats {
  totalCustomers: number
  totalCustomersTrend: number
  vipCustomers: number
  vipCustomersTrend: number
  totalRevenue: number
  totalRevenueTrend: number
  newCustomersThisMonth: number
  newCustomersTrend: number
  activeCustomers: number
  activeCustomersTrend: number
  blacklistedCustomers: number
  averageSpent: number
  averageBookings: number
}

interface CustomerStatsProps {
  stats: CustomerStats
  loading?: boolean
}

interface StatCardProps {
  label: string
  value: string | number
  trend?: number
  icon: React.ElementType
  iconBg: string
  iconColor: string
  loading?: boolean
}

const StatCard = ({ label, value, trend, icon: Icon, iconBg, iconColor, loading }: StatCardProps) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-gray-200 rounded-lg" />
            <div className="w-12 h-4 bg-gray-200 rounded" />
          </div>
          <div className="w-20 h-6 bg-gray-200 rounded mb-2" />
          <div className="w-16 h-4 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  const isPositive = trend !== undefined && trend >= 0
  const TrendIcon = isPositive ? FiTrendingUp : FiTrendingDown

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', iconBg)}>
          <Icon className={clsx('w-5 h-5', iconColor)} />
        </div>
        {trend !== undefined && (
          <div
            className={clsx(
              'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
              isPositive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            )}
          >
            <TrendIcon className="w-3 h-3" />
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  )
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toLocaleString()
}

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return 'LKR ' + (amount / 1000000).toFixed(1) + 'M'
  }
  if (amount >= 1000) {
    return 'LKR ' + (amount / 1000).toFixed(0) + 'K'
  }
  return 'LKR ' + amount.toLocaleString()
}

export default function CustomerStats({ stats, loading = false }: CustomerStatsProps) {
  const statCards = [
    {
      label: 'Total Customers',
      value: formatNumber(stats.totalCustomers),
      trend: stats.totalCustomersTrend,
      icon: FiUsers,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      label: 'VIP Customers',
      value: formatNumber(stats.vipCustomers),
      trend: stats.vipCustomersTrend,
      icon: FiStar,
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      trend: stats.totalRevenueTrend,
      icon: FiDollarSign,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      label: 'New Customers',
      value: formatNumber(stats.newCustomersThisMonth),
      trend: stats.newCustomersTrend,
      icon: FiUserCheck,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      label: 'Active Customers',
      value: formatNumber(stats.activeCustomers),
      trend: stats.activeCustomersTrend,
      icon: FiClock,
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600',
    },
    {
      label: 'Blacklisted',
      value: stats.blacklistedCustomers,
      trend: undefined,
      icon: FiAlertCircle,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
    },
    {
      label: 'Avg. Spent',
      value: formatCurrency(stats.averageSpent),
      trend: undefined,
      icon: FiDollarSign,
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
    },
    {
      label: 'Avg. Bookings',
      value: stats.averageBookings.toFixed(1),
      trend: undefined,
      icon: FiCalendar,
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, index) => (
        <StatCard key={index} {...stat} loading={loading} />
      ))}
    </div>
  )
}
