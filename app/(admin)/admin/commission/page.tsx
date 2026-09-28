'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/admin/AdminLayout'

interface Settlement {
  id: string
  jobId: string
  escrowId: string
  providerId: string
  customerId: string
  jobAmount: number
  commissionRate: number
  commissionAmount: number
  status: string
  settledAt?: string
  createdAt: string
}

export default function CommissionPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [summary, setSummary] = useState({
    pendingCommission: 0,
    pendingJobAmount: 0,
    pendingCount: 0,
    settledCommission: 0,
    settledCount: 0,
  })
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchSettlements()
  }, [filter])

  const fetchSettlements = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/commission?status=${filter}`)
      const data = await res.json()
      setSettlements(data.settlements || [])
      setSummary(data.summary || {
        pendingCommission: 0,
        pendingJobAmount: 0,
        pendingCount: 0,
        settledCommission: 0,
        settledCount: 0,
      })
    } catch (error) {
      console.error('Failed to fetch settlements:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSettle = async (settlementId: string) => {
    setActionLoading(settlementId)
    try {
      const res = await fetch('/api/admin/commission', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settlementId, action: 'MARK_SETTLED' })
      })

      if (res.ok) {
        fetchSettlements()
      }
    } catch (error) {
      console.error('Failed to settle:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR'
    }).format(amount / 100)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'SETTLED': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Commission Management</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-yellow-600 text-sm font-medium">Pending Commission</div>
            <div className="text-2xl font-bold text-yellow-700">{formatCurrency(summary.pendingCommission)}</div>
            <div className="text-sm text-yellow-600">{summary.pendingCount} settlements</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-blue-600 text-sm font-medium">Pending Job Value</div>
            <div className="text-2xl font-bold text-blue-700">{formatCurrency(summary.pendingJobAmount)}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-green-600 text-sm font-medium">Settled Commission</div>
            <div className="text-2xl font-bold text-green-700">{formatCurrency(summary.settledCommission)}</div>
            <div className="text-sm text-green-600">{summary.settledCount} settled</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-gray-600 text-sm font-medium">Total Records</div>
            <div className="text-2xl font-bold text-gray-700">{summary.pendingCount + summary.settledCount}</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {['ALL', 'PENDING', 'SETTLED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === status
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Settlements List */}
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : settlements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No settlements found</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Provider</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Job</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Job Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Commission</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Settled</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {settlements.map((settlement) => (
                  <tr key={settlement.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{settlement.providerId.slice(0, 8)}...</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{settlement.jobId.slice(0, 8)}...</div>
                      <div className="text-sm text-gray-500">{settlement.commissionRate}%</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(settlement.jobAmount)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(settlement.commissionAmount)}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {settlement.settledAt ? formatDate(settlement.settledAt) : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(settlement.status)}`}>
                        {settlement.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {settlement.status === 'PENDING' && (
                        <button
                          onClick={() => handleSettle(settlement.id)}
                          disabled={actionLoading === settlement.id}
                          className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:opacity-50"
                        >
                          {actionLoading === settlement.id ? '...' : 'Mark Settled'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
