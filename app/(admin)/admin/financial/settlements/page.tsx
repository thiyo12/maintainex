'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiCalendar, FiDownload, FiRefreshCw, FiFilter } from 'react-icons/fi'

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
  currency: string
  countryCode: string
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
  const [summary, setSummary] = useState<{
    count: number
    byCurrency: Array<{
      currency: string
      totalPaid: number
      totalCommission: number
      totalNet: number
    }>
  }>({
    count: 0,
    byCurrency: [],
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
      const items: Settlement[] = data.settlements || []
      setSettlements(items)

      const byCurrency = new Map<string, { totalPaid: number; totalCommission: number }>()
      for (const item of items) {
        const currency = item.currency || 'LKR'
        const current = byCurrency.get(currency) || { totalPaid: 0, totalCommission: 0 }
        current.totalPaid += Number(item.totalEarnings || 0)
        current.totalCommission += Number(item.commissionOwed || 0)
        byCurrency.set(currency, current)
      }

      setSummary({
        count: items.length,
        byCurrency: [...byCurrency.entries()].map(([currency, values]) => ({
          currency,
          totalPaid: values.totalPaid,
          totalCommission: values.totalCommission,
          totalNet: values.totalPaid - values.totalCommission,
        })),
      })
    } catch (error) {
      console.error('Failed to fetch settlements:', error)
      toast.error('Failed to load settlements')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!settlements.length) {
      toast.error('No settlements to export')
      return
    }

    const escapeCsv = (value: unknown) => {
      const text = String(value ?? '')
      return `"${text.replaceAll('"', '""')}"`
    }

    const rows = [
      ['Settlement ID', 'Week Start', 'Week End', 'Provider', 'MX ID', 'Provider Type', 'Country', 'Currency', 'Total Earnings', 'Commission', 'Net Payout', 'Paid At'],
      ...settlements.map((s) => [
        s.id,
        s.weekStart,
        s.weekEnd,
        s.provider?.name || '',
        s.provider?.mxId || '',
        s.providerType,
        s.countryCode,
        s.currency,
        s.totalEarnings,
        s.commissionOwed,
        Number(s.totalEarnings || 0) - Number(s.commissionOwed || 0),
        s.paidAt || '',
      ]),
    ]

    const csv = rows.map(row => row.map(escapeCsv).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `maintainex-settlements-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    toast.success('Settlement CSV exported')
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: currency || 'LKR',
      minimumFractionDigits: 0
    }).format(Number(amount || 0))
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    })
  }

  return (
    <>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-[#15161E] border border-white/5 rounded-xl p-5">
            <div className="text-sm text-gray-400 mb-1">Total Settled</div>
            <div className="text-2xl font-bold text-white">{summary.count}</div>
            <div className="text-xs text-gray-500">settlements in current filter</div>
          </div>
          {summary.byCurrency.map((row) => (
            <div key={row.currency} className="bg-[#15161E] border border-white/5 rounded-xl p-5">
              <div className="text-sm text-gray-400 mb-1">{row.currency} settlement totals</div>
              <div className="text-xl font-bold text-white">{formatCurrency(row.totalPaid, row.currency)}</div>
              <div className="mt-2 text-xs text-amber-400">
                Commission {formatCurrency(row.totalCommission, row.currency)}
              </div>
              <div className="text-xs text-emerald-400">
                Net {formatCurrency(row.totalNet, row.currency)}
              </div>
            </div>
          ))}
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
                      <td className="px-4 py-3 text-sm text-gray-300">{formatCurrency(s.totalEarnings, s.currency)}</td>
                      <td className="px-4 py-3 text-sm text-amber-400">{formatCurrency(s.commissionOwed, s.currency)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-emerald-400">{formatCurrency(s.totalEarnings - s.commissionOwed, s.currency)}</td>
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
    </>
  )
}