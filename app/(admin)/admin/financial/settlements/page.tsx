'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiCalendar, FiDownload, FiRefreshCw, FiFilter } from 'react-icons/fi'
import AdminLayout from '@/components/admin/AdminLayout'

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
  provider?: {
    name: string
    email: string
    mxId?: string
  }
}

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [summary, setSummary] = useState({
    totalPaid: 0,
    totalCommission: 0,
    totalNet: 0,
    count: 0
  })

  useEffect(() => {
    fetchSettlements()
  }, [dateFrom, dateTo])

  const fetchSettlements = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: 'PAID' })
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      const res = await fetch(`/api/admin/financial/commission?${params}`, {
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
      const items = data.settlements || []
      setSettlements(items)
      const totalPaid = items.reduce((sum: number, s: Settlement) => sum + s.totalEarnings, 0)
      const totalCommission = items.reduce((sum: number, s: Settlement) => sum + s.commissionOwed, 0)
      setSummary({
        totalPaid,
        totalCommission,
        totalNet: totalPaid - totalCommission,
        count: items.length
      })
    } catch (error) {
      console.error('Failed to fetch settlements:', error)
      toast.error('Failed to load settlements')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    toast.success('Export feature coming soon')
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
      year: 'numeric', month: 'short', day: 'numeric'
    })
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Settlement History</h1>
            <p className="text-gray-400 mt-1">Historical record of all completed provider settlements</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchSettlements}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#15161E] border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-[#0B0C12] rounded-lg font-medium hover:bg-amber-400 transition-colors"
            >
              <FiDownload className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-[#15161E] border border-white/5 rounded-xl p-5">
            <div className="text-sm text-gray-400 mb-1">Total Settled</div>
            <div className="text-2xl font-bold text-white">{summary.count}</div>
            <div className="text-xs text-gray-500">settlements</div>
          </div>
          <div className="bg-[#15161E] border border-white/5 rounded-xl p-5">
            <div className="text-sm text-gray-400 mb-1">Total Earnings</div>
            <div className="text-2xl font-bold text-white">{formatCurrency(summary.totalPaid)}</div>
            <div className="text-xs text-gray-500">gross provider earnings</div>
          </div>
          <div className="bg-[#15161E] border border-white/5 rounded-xl p-5">
            <div className="text-sm text-gray-400 mb-1">Commission Collected</div>
            <div className="text-2xl font-bold text-amber-400">{formatCurrency(summary.totalCommission)}</div>
            <div className="text-xs text-gray-500">platform revenue</div>
          </div>
          <div className="bg-[#15161E] border border-white/5 rounded-xl p-5">
            <div className="text-sm text-gray-400 mb-1">Net Provider Payout</div>
            <div className="text-2xl font-bold text-emerald-400">{formatCurrency(summary.totalNet)}</div>
            <div className="text-xs text-gray-500">after commission</div>
          </div>
        </div>

        <div className="bg-[#15161E] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <FiFilter className="w-4 h-4 text-gray-500" />
            <div className="flex items-center gap-2">
              <FiCalendar className="w-4 h-4 text-gray-500" />
              <label className="text-sm text-gray-400">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo('') }}
                className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : settlements.length === 0 ? (
          <div className="bg-[#15161E] border border-white/5 rounded-xl py-16 text-center">
            <FiCalendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-lg">No settlements found</p>
            <p className="text-gray-600 text-sm mt-1">Adjust date filters or check back later</p>
          </div>
        ) : (
          <div className="bg-[#15161E] border border-white/5 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Commission</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Net Payout</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {settlements.map((s) => (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-300">{formatDate(s.weekStart)}</div>
                        <div className="text-xs text-gray-500">to {formatDate(s.weekEnd)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-white">{s.provider?.name || s.providerId.slice(0, 8)}</div>
                        <div className="text-xs text-gray-500">{s.provider?.mxId || ''}</div>
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
                      <td className="px-4 py-3 text-sm text-gray-300">{formatCurrency(s.totalEarnings)}</td>
                      <td className="px-4 py-3 text-sm text-amber-400">{formatCurrency(s.commissionOwed)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-emerald-400">{formatCurrency(s.totalEarnings - s.commissionOwed)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                          {s.paidAt ? `Paid ${formatDate(s.paidAt)}` : 'Paid'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}