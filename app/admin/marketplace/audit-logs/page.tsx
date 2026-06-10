'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { FiChevronLeft, FiChevronRight, FiAlertCircle } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface AuditLogEntry {
  id: string
  adminEmail: string
  adminRole: string
  action: string
  targetTable: string | null
  targetId: string | null
  targetLabel: string | null
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  ipAddress: string
  createdAt: string
}

interface PaginatedMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-blue-100 text-blue-800',
  LOGOUT: 'bg-gray-100 text-gray-800',
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  SUSPEND: 'bg-yellow-100 text-yellow-800',
  UNSUSPEND: 'bg-green-100 text-green-800',
  BAN: 'bg-red-100 text-red-800',
  UNBAN: 'bg-green-100 text-green-800',
  KYC_APPROVE: 'bg-green-100 text-green-800',
  KYC_REJECT: 'bg-red-100 text-red-800',
  JOB_CANCEL: 'bg-red-100 text-red-800',
  ESCROW_RELEASE: 'bg-green-100 text-green-800',
  ESCROW_REFUND: 'bg-yellow-100 text-yellow-800',
  ADMIN_CREATE: 'bg-blue-100 text-blue-800',
  ADMIN_UPDATE: 'bg-blue-100 text-blue-800',
  SETTINGS_UPDATE: 'bg-yellow-100 text-yellow-800',
}

export default function MarketplaceAuditLogs() {
  const { user } = useAdminSession()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [meta, setMeta] = useState<PaginatedMeta>({ total: 0, page: 1, limit: 50, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [tableFilter, setTableFilter] = useState('')
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (actionFilter) params.set('action', actionFilter)
      if (tableFilter) params.set('target_table', tableFilter)
      params.set('page', String(page))
      params.set('limit', '50')

      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/admin/marketplace/audit-logs?${params}`, {
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const result = await res.json()

      if (result.error) {
        toast.error(result.error)
        setError(result.error)
        return
      }

      setLogs(result.data)
      setMeta(result.meta)
    } catch (error) {
      console.error('Audit logs fetch error:', error)
      toast.error('Failed to load audit logs')
      setError('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [actionFilter, tableFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const actionBadge = (action: string) => {
    const color = ACTION_COLORS[action] || 'bg-gray-100 text-gray-800'
    return <span className={`px-3 py-1 rounded-full text-xs font-medium ${color}`}>{action}</span>
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-1">{meta.total} entries</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-4 md:p-6 border-b">
          <div className="flex flex-wrap gap-3">
            <select
              className="input-field w-44"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All Actions</option>
              {Object.keys(ACTION_COLORS).map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select
              className="input-field w-44"
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
            >
              <option value="">All Tables</option>
              <option value="User">User</option>
              <option value="IdentityDocument">IdentityDocument</option>
              <option value="MarketplaceJob">MarketplaceJob</option>
              <option value="JobEscrow">JobEscrow</option>
              <option value="JobCategory">JobCategory</option>
              <option value="AdminUser">AdminUser</option>
              <option value="PlatformSettings">PlatformSettings</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <FiAlertCircle className="w-12 h-12 text-red-500" />
              <p className="text-gray-600">{error}</p>
              <button onClick={() => fetchLogs()} className="btn-primary px-4 py-2 rounded-lg text-sm">Try Again</button>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">No logs found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-4 md:px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-4">
                      <div>
                        <p className="text-sm text-gray-900">{log.adminEmail}</p>
                        <p className="text-xs text-gray-500">{log.adminRole}</p>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">{actionBadge(log.action)}</td>
                    <td className="px-4 md:px-6 py-4">
                      <p className="text-sm text-gray-900">{log.targetLabel || log.targetId || '\u2014'}</p>
                      {log.targetTable && <p className="text-xs text-gray-500">{log.targetTable}</p>}
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm font-mono text-gray-500">{log.ipAddress}</td>
                    <td className="px-4 md:px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-4 md:px-6 py-4">
                      {(log.oldValue || log.newValue) && (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-sm font-medium text-primary-600 hover:text-primary-700"
                        >
                          Diff
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {meta.page} of {meta.totalPages}</p>
          <div className="flex gap-2">
            <button
              className="btn-outline px-3 py-2 rounded-lg text-sm disabled:opacity-50"
              disabled={meta.page <= 1}
              onClick={() => fetchLogs(meta.page - 1)}
            >
              <FiChevronLeft className="w-4 h-4" />
            </button>
            <button
              className="btn-outline px-3 py-2 rounded-lg text-sm disabled:opacity-50"
              disabled={meta.page >= meta.totalPages}
              onClick={() => fetchLogs(meta.page + 1)}
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedLog(null)}>
          <div className="w-full max-w-2xl rounded-lg bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold">Audit Log Detail</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-500">Action</p>
                  {actionBadge(selectedLog.action)}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Admin</p>
                  <p className="text-sm">{selectedLog.adminEmail}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Target</p>
                  <p className="text-sm">{selectedLog.targetLabel || '\u2014'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">IP Address</p>
                  <p className="text-sm font-mono">{selectedLog.ipAddress}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {selectedLog.oldValue && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Old Value</p>
                    <pre className="rounded bg-gray-50 p-3 text-xs overflow-auto max-h-60">{JSON.stringify(selectedLog.oldValue, null, 2)}</pre>
                  </div>
                )}
                {selectedLog.newValue && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">New Value</p>
                    <pre className="rounded bg-gray-50 p-3 text-xs overflow-auto max-h-60">{JSON.stringify(selectedLog.newValue, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
