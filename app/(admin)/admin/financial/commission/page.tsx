'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiDollarSign, FiClock, FiAlertTriangle, FiCheckCircle, FiFilter, FiRefreshCw } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'

interface Settlement {
  id: string
  providerId: string
  providerType: string
  weekStart: string
  weekEnd: string
  totalEarnings: number
  commissionRate: number
  commissionOwed: number
  commissionPaid: boolean
  paidAt?: string
  dueAt: string
  status: string
  suspendedAt?: string
  notes?: string
  provider?: {
    name: string
    email: string
    mxId?: string
  }
}

interface Summary {
  totalCommissionOwed: number
  totalCommissionPaid: number
  pendingThisWeek: number
  overdueCount: number
  pendingCount: number
  paidCount: number
}

export default function CommissionPage() {
  const { user: admin } = useAdminSession()
  const canManageCommission = !!admin && (ROLE_PERMISSIONS[admin.role as AdminRole] || []).includes('commission:manage')
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('ALL')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary>({
    totalCommissionOwed: 0,
    totalCommissionPaid: 0,
    pendingThisWeek: 0,
    overdueCount: 0,
    pendingCount: 0,
    paidCount: 0
  })

  useEffect(() => {
    fetchSettlements()
  }, [filter])

  const fetchSettlements = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/financial/commission?status=${filter}`, {
        headers: { }
      })
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
        return
      }
      setSettlements(data.settlements || [])
      setSummary(data.summary || {
        totalCommissionOwed: 0,
        totalCommissionPaid: 0,
        pendingThisWeek: 0,
        overdueCount: 0,
        pendingCount: 0,
        paidCount: 0
      })
    } catch (error) {
      console.error('Failed to fetch settlements:', error)
      toast.error('Failed to load commission data')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (settlementId: string, action: string) => {
    if (!canManageCommission) {
      toast.error('You do not have permission to manage commission settlements')
      return
    }
    setActionLoading(settlementId)
    try {
      const res = await fetch('/api/admin/financial/commission', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settlementId, action })
      })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success(`Settlement ${action === 'MARK_PAID' ? 'marked as paid' : action === 'SUSPEND' ? 'suspended' : 'updated'}`)
        fetchSettlements()
      }
    } catch (error) {
      console.error('Failed to perform action:', error)
      toast.error('Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const isOverdue = (dueAt: string) => new Date(dueAt) < new Date()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
      case 'PENDING': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
      case 'OVERDUE': return 'bg-red-500/20 text-red-400 border border-red-500/30'
      case 'SUSPENDED': return 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
    }
  }

  const stats = [
    {
      label: 'Total Commission Owed',
      value: formatCurrency(summary.totalCommissionOwed),
      icon: FiDollarSign,
      color: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
      sub: `${summary.pendingCount} pending settlements`
    },
    {
      label: 'Total Commission Paid',
      value: formatCurrency(summary.totalCommissionPaid),
      icon: FiCheckCircle,
      color: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      sub: `${summary.paidCount} settled`
    },
    {
      label: 'Pending This Week',
      value: formatCurrency(summary.pendingThisWeek),
      icon: FiClock,
      color: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      sub: 'Due this cycle'
    },
    {
      label: 'Overdue',
      value: summary.overdueCount.toString(),
      icon: FiAlertTriangle,
      color: 'bg-red-500/20',
      iconColor: 'text-red-400',
      sub: 'Requires action'
    }
  ]

  return (
    <>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Commission Management</h1>
            <p className="text-gray-400 mt-1">Manage weekly settlements and provider commissions</p>
          </div>
          <button
            onClick={fetchSettlements}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#15161E] border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-[#15161E] border border-white/5 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{stat.sub}</div>
            </div>
          ))}
        </div>

        <div className="bg-[#15161E] border border-white/5 rounded-xl p-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <FiFilter className="w-4 h-4 text-gray-500 ml-2" />
            {['ALL', 'PENDING', 'PAID', 'OVERDUE', 'SUSPENDED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === status
                    ? 'bg-amber-500 text-[#0B0C12]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {status}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 px-3">
              <span className="text-xs text-gray-500">Rate:</span>
              <span className="text-sm font-semibold text-amber-400">10%</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : settlements.length === 0 ? (
          <div className="bg-[#15161E] border border-white/5 rounded-xl py-16 text-center">
            <FiDollarSign className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-lg">No settlements found</p>
            <p className="text-gray-600 text-sm mt-1">Settlements will appear here once providers complete jobs</p>
          </div>
        ) : (
          <div className="bg-[#15161E] border border-white/5 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Week</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Earnings</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Commission</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Due Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">{canManageCommission ? 'Actions' : 'Access'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {settlements.map((s) => (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-white">{s.provider?.name || s.providerId.slice(0, 8) + '...'}</div>
                        <div className="text-xs text-gray-500">{s.provider?.mxId || s.providerId.slice(0, 12)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          s.providerType === 'COMPANY'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {s.providerType === 'COMPANY' ? 'Company' : 'Tasker'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-300">{formatDate(s.weekStart)}</div>
                        <div className="text-xs text-gray-500">to {formatDate(s.weekEnd)}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">{formatCurrency(s.totalEarnings)}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-white">{formatCurrency(s.commissionOwed)}</div>
                        <div className="text-xs text-gray-500">{s.commissionRate}%</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${isOverdue(s.dueAt) && s.status !== 'PAID' ? 'text-red-400 font-medium' : 'text-gray-300'}`}>
                          {formatDate(s.dueAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {!canManageCommission && <span className="text-xs text-gray-500">Read only</span>}
                          {canManageCommission && s.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleAction(s.id, 'MARK_PAID')}
                                disabled={!canManageCommission || actionLoading === s.id}
                                className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50 font-medium"
                              >
                                {actionLoading === s.id ? '...' : 'Mark Paid'}
                              </button>
                              <button
                                onClick={() => handleAction(s.id, 'SEND_REMINDER')}
                                disabled={!canManageCommission || actionLoading === s.id}
                                className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50 font-medium"
                              >
                                {actionLoading === s.id ? '...' : 'Remind'}
                              </button>
                              {isOverdue(s.dueAt) && (
                                <button
                                  onClick={() => handleAction(s.id, 'SUSPEND')}
                                  disabled={!canManageCommission || actionLoading === s.id}
                                  className="px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 font-medium"
                                >
                                  {actionLoading === s.id ? '...' : 'Suspend'}
                                </button>
                              )}
                            </>
                          )}
                          {canManageCommission && s.status === 'OVERDUE' && (
                            <>
                              <button
                                onClick={() => handleAction(s.id, 'MARK_PAID')}
                                disabled={!canManageCommission || actionLoading === s.id}
                                className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50 font-medium"
                              >
                                {actionLoading === s.id ? '...' : 'Mark Paid'}
                              </button>
                              <button
                                onClick={() => handleAction(s.id, 'SUSPEND')}
                                disabled={!canManageCommission || actionLoading === s.id}
                                className="px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 font-medium"
                              >
                                {actionLoading === s.id ? '...' : 'Suspend'}
                              </button>
                            </>
                          )}
                          {canManageCommission && s.status === 'SUSPENDED' && (
                            <>
                              <button
                                onClick={() => handleAction(s.id, 'MARK_PAID')}
                                disabled={!canManageCommission || actionLoading === s.id}
                                className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50 font-medium"
                                title="Record commission payment and reactivate the provider if this settlement caused the suspension"
                              >
                                {actionLoading === s.id ? '...' : 'Mark Paid'}
                              </button>
                              <button
                                onClick={() => handleAction(s.id, 'UNSUSPEND')}
                                disabled={!canManageCommission || actionLoading === s.id}
                                className="px-3 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50 font-medium"
                                title="Reactivate the provider without clearing the unpaid commission debt"
                              >
                                {actionLoading === s.id ? '...' : 'Reactivate · debt stays'}
                              </button>
                            </>
                          )}
                          {s.status === 'PAID' && (
                            <span className="text-xs text-gray-500">
                              {s.paidAt ? formatDate(s.paidAt) : 'Paid'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}