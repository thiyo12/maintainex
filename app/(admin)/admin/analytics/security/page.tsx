'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  FiShield, FiSearch, FiFilter, FiClock, FiUser, FiGlobe,
  FiAlertTriangle, FiInfo, FiChevronLeft, FiChevronRight
} from 'react-icons/fi'
import AdminLayout from '@/components/admin/AdminLayout'

interface AuditLog {
  id: string
  adminUserId: string
  adminEmail: string
  adminRole: string
  action: string
  targetTable: string | null
  targetId: string | null
  targetLabel: string | null
  oldValue: string | null
  newValue: string | null
  ipAddress: string
  userAgent: string | null
  createdAt: string
}

interface LogsResponse {
  logs: AuditLog[]
  admins: Array<{ adminUserId: string; adminEmail: string }>
  actionTypes: string[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

const SEVERITY_MAP: Record<string, { color: string; bg: string; label: string }> = {
  LOGIN: { color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Info' },
  LOGOUT: { color: 'text-gray-400', bg: 'bg-gray-500/10', label: 'Info' },
  CREATE: { color: 'text-green-400', bg: 'bg-green-500/10', label: 'Create' },
  UPDATE: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Update' },
  DELETE: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Delete' },
  SUSPEND: { color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Suspend' },
  BAN: { color: 'text-red-500', bg: 'bg-red-500/15', label: 'Ban' },
  KYC_APPROVE: { color: 'text-green-400', bg: 'bg-green-500/10', label: 'Approve' },
  KYC_REJECT: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Reject' },
  ESCROW_RELEASE: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Escrow' },
  ESCROW_REFUND: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Refund' },
  ADMIN_CREATE: { color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Admin' },
  SETTINGS_UPDATE: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', label: 'Settings' },
  COMMISSION_CONFIG: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Config' },
}

function getSeverity(action: string) {
  if (SEVERITY_MAP[action]) return SEVERITY_MAP[action]
  if (action.includes('BAN') || action.includes('DELETE') || action.includes('FREEZE'))
    return { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Critical' }
  if (action.includes('SUSPEND') || action.includes('FLAG'))
    return { color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Warning' }
  return { color: 'text-gray-400', bg: 'bg-gray-500/10', label: 'Info' }
}

export default function SecurityLogs() {
  const [data, setData] = useState<LogsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ action: '', adminUserId: '', dateFrom: '', dateTo: '' })

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (filters.action) params.set('action', filters.action)
      if (filters.adminUserId) params.set('adminUserId', filters.adminUserId)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)

      const res = await fetch(`/api/admin/security/logs?${params}`, { headers: { } })
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Failed to load security logs')
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Logs</h1>
          <p className="text-gray-400 text-sm mt-1">Audit trail of all admin actions</p>
        </div>

        <div className="bg-[#15161E] border border-white/5 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <FiFilter size={14} />
              <span>Filters:</span>
            </div>
            <select
              value={filters.action}
              onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(1) }}
              className="px-3 py-1.5 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
            >
              <option value="">All Actions</option>
              {data?.actionTypes.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select
              value={filters.adminUserId}
              onChange={(e) => { setFilters({ ...filters, adminUserId: e.target.value }); setPage(1) }}
              className="px-3 py-1.5 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
            >
              <option value="">All Admins</option>
              {data?.admins.map((a) => (
                <option key={a.adminUserId} value={a.adminUserId}>{a.adminEmail}</option>
              ))}
            </select>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => { setFilters({ ...filters, dateFrom: e.target.value }); setPage(1) }}
              className="px-3 py-1.5 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
              placeholder="From"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => { setFilters({ ...filters, dateTo: e.target.value }); setPage(1) }}
              className="px-3 py-1.5 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
              placeholder="To"
            />
            {(filters.action || filters.adminUserId || filters.dateFrom || filters.dateTo) && (
              <button
                onClick={() => { setFilters({ action: '', adminUserId: '', dateFrom: '', dateTo: '' }); setPage(1) }}
                className="px-3 py-1.5 text-gray-400 hover:text-white text-sm transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data ? (
          <>
            <div className="bg-[#15161E] border border-white/5 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Timestamp</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Admin</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Action</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Target</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Details</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium hidden xl:table-cell">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-gray-500">
                          No logs found
                        </td>
                      </tr>
                    ) : (
                      data.logs.map((log) => {
                        const severity = getSeverity(log.action)
                        return (
                          <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-gray-300">
                                <FiClock size={12} className="text-gray-500" />
                                <span className="text-xs">{formatDate(log.createdAt)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-amber-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                                  <FiUser size={10} className="text-amber-400" />
                                </div>
                                <div>
                                  <div className="text-white text-xs">{log.adminEmail}</div>
                                  <div className="text-gray-500 text-[10px]">{log.adminRole}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${severity.bg} ${severity.color}`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <div className="text-gray-300 text-xs">
                                {log.targetTable && <span className="text-gray-400">{log.targetTable}</span>}
                                {log.targetId && <span className="text-gray-500 ml-1">#{log.targetId.slice(0, 8)}</span>}
                              </div>
                              {log.targetLabel && (
                                <div className="text-gray-500 text-[10px] mt-0.5 truncate max-w-[200px]">{log.targetLabel}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              {log.newValue ? (
                                <div className="text-gray-400 text-xs truncate max-w-[200px]">{log.newValue}</div>
                              ) : (
                                <span className="text-gray-600">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 hidden xl:table-cell">
                              <div className="flex items-center gap-1 text-gray-400">
                                <FiGlobe size={10} />
                                <span className="text-xs">{log.ipAddress}</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {data.pagination.pages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-gray-500 text-sm">
                  Page {data.pagination.page} of {data.pagination.pages} ({data.pagination.total} total)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg bg-[#15161E] border border-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <FiChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage(Math.min(data.pagination.pages, page + 1))}
                    disabled={page === data.pagination.pages}
                    className="p-2 rounded-lg bg-[#15161E] border border-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <FiChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}