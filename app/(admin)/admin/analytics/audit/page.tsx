'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { FiFileText, FiRefreshCw, FiSearch, FiFilter } from 'react-icons/fi'
import AdminLayout from '@/components/admin/AdminLayout'

interface AuditLog {
  id: string
  adminUserId: string
  adminEmail: string
  adminRole: string
  action: string
  targetTable?: string
  targetId?: string
  targetLabel?: string
  oldValue?: string
  newValue?: string
  ipAddress: string
  createdAt: string
}

const ACTION_COLORS: Record<string, string> = {
  PROVIDER_SUSPEND: 'bg-red-500/20 text-red-400',
  PROVIDER_REACTIVATE: 'bg-green-500/20 text-green-400',
  COMPANY_SUSPEND: 'bg-red-500/20 text-red-400',
  COMPANY_REACTIVATE: 'bg-green-500/20 text-green-400',
  CREDENTIAL_APPROVE: 'bg-green-500/20 text-green-400',
  CREDENTIAL_REJECT: 'bg-red-500/20 text-red-400',
  CREDENTIAL_EXPIRE: 'bg-gray-500/20 text-gray-400',
  MARKET_CONFIG_UPDATE: 'bg-amber-500/20 text-amber-400',
  RISK_EVENT_RESOLVE: 'bg-red-500/20 text-red-400',
  RISK_EVENT_DISMISS: 'bg-green-500/20 text-green-400',
  RISK_EVENT_ESCALATE: 'bg-orange-500/20 text-orange-400',
}

export default function AuditLogPage() {
  return <AdminLayout><AuditLogContent /></AdminLayout>
}

function AuditLogContent() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({ action: '', adminUserId: '', dateFrom: '', dateTo: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' })
      if (filters.action) params.set('action', filters.action)
      if (filters.adminUserId) params.set('adminUserId', filters.adminUserId)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      const res = await fetch(`/api/admin/audit?${params}`, { credentials: 'include' })
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch { toast.error('Failed to load audit logs') }
    finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FiFileText className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <span className="text-sm text-gray-400">({total} entries)</span>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm ${showFilters ? 'bg-amber-500 text-[#0B0C12]' : 'bg-[#1A1B26] text-gray-300 hover:bg-[#24263a]'}`}>
            <FiFilter className="w-4 h-4" /><span>Filters</span>
          </button>
          <button onClick={fetchLogs} className="flex items-center space-x-2 px-3 py-2 bg-[#1A1B26] text-gray-300 rounded-lg hover:bg-[#24263a]">
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /><span>Refresh</span>
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-[#15161E] rounded-xl p-4 border border-gray-800">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Action</label>
              <input value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
                className="w-full bg-[#0B0C12] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="e.g. PROVIDER_SUSPEND" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Admin User ID</label>
              <input value={filters.adminUserId} onChange={e => setFilters(f => ({ ...f, adminUserId: e.target.value }))}
                className="w-full bg-[#0B0C12] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Admin ID" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">From Date</label>
              <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                className="w-full bg-[#0B0C12] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">To Date</label>
              <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                className="w-full bg-[#0B0C12] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={() => { setFilters({ action: '', adminUserId: '', dateFrom: '', dateTo: '' }); setPage(1) }}
              className="text-sm text-gray-400 hover:text-white">Clear filters</button>
          </div>
        </div>
      )}

      <div className="bg-[#15161E] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-gray-800">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Admin</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Action</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Target</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">IP</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Details</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                <div className="flex items-center justify-center space-x-2"><FiRefreshCw className="animate-spin" /><span>Loading...</span></div>
              </td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No audit logs found</td></tr>
            ) : logs.map(log => (
              <>
                <tr key={log.id} className="hover:bg-[#1A1B26]">
                  <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-white">{log.adminEmail}</div>
                    <div className="text-xs text-gray-500">{log.adminRole}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${ACTION_COLORS[log.action] || 'bg-gray-500/20 text-gray-400'}`}>{log.action}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-300">{log.targetTable || '-'}</div>
                    {log.targetLabel && <div className="text-xs text-gray-500">{log.targetLabel}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 font-mono">{log.ipAddress}</td>
                  <td className="px-4 py-3">
                    {(log.oldValue || log.newValue) && (
                      <button onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                        className="text-xs text-amber-400 hover:text-amber-300">
                        {expandedRow === log.id ? 'Hide' : 'View'}
                      </button>
                    )}
                  </td>
                </tr>
                {expandedRow === log.id && (
                  <tr key={`${log.id}-detail`}>
                    <td colSpan={6} className="px-4 py-3 bg-[#0B0C12]">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        {log.oldValue && <div><span className="text-gray-400">Old:</span> <pre className="text-gray-300 whitespace-pre-wrap mt-1">{log.oldValue}</pre></div>}
                        {log.newValue && <div><span className="text-gray-400">New:</span> <pre className="text-gray-300 whitespace-pre-wrap mt-1">{log.newValue}</pre></div>}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">{total} total</span>
          <div className="flex items-center space-x-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 bg-[#1A1B26] text-gray-300 rounded-lg hover:bg-[#24263a] disabled:opacity-50 text-sm">Prev</button>
            <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 bg-[#1A1B26] text-gray-300 rounded-lg hover:bg-[#24263a] disabled:opacity-50 text-sm">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
