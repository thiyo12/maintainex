'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiChevronLeft, FiChevronRight, FiAlertCircle, FiRefreshCw } from 'react-icons/fi'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { can, PERMISSION } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

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
  const adminUser = useAuthStore((s) => s.adminUser)
  const [actionFilter, setActionFilter] = useState('')
  const [tableFilter, setTableFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-marketplace-audit-logs', actionFilter, tableFilter, page],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/audit-logs', {
        params: { action: actionFilter, target_table: tableFilter, page, limit: 50 },
      })
      const body = res.data
      if (body.error) throw new Error(body.error)
      return { logs: body.data as AuditLogEntry[], meta: body.meta as PaginatedMeta }
    },
  })

  const logs = data?.logs || []
  const meta = data?.meta || { total: 0, page: 1, limit: 50, totalPages: 0 }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
          <div><h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1><p className="text-gray-500">Loading...</p></div>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>{['Admin', 'Action', 'Target', 'IP', 'Time', ''].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <FiAlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-gray-600">{error instanceof Error ? error.message : 'Failed to load logs'}</p>
          <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-500">{meta.total} entries</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}><FiRefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3">
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v ?? ''); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All Actions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Actions</SelectItem>
                {Object.keys(ACTION_COLORS).map((a) => (
                  <SelectItem key={a} value={a}>{a.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tableFilter} onValueChange={(v) => { setTableFilter(v ?? ''); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All Tables" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Tables</SelectItem>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="IdentityDocument">IdentityDocument</SelectItem>
                <SelectItem value="MarketplaceJob">MarketplaceJob</SelectItem>
                <SelectItem value="JobEscrow">JobEscrow</SelectItem>
                <SelectItem value="JobCategory">JobCategory</SelectItem>
                <SelectItem value="AdminUser">AdminUser</SelectItem>
                <SelectItem value="PlatformSettings">PlatformSettings</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FiAlertCircle className="w-12 h-12 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900">No logs found</h3>
              <p className="text-gray-500">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedLog(log)}>
                      <TableCell>
                        <p className="text-sm text-gray-900">{log.adminEmail}</p>
                        <p className="text-xs text-gray-500">{log.adminRole}</p>
                      </TableCell>
                      <TableCell>
                        <Badge className={ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-800'}>{log.action}</Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-gray-900">{log.targetLabel || log.targetId || '\u2014'}</p>
                        {log.targetTable && <p className="text-xs text-gray-500">{log.targetTable}</p>}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-gray-500">{log.ipAddress}</TableCell>
                      <TableCell className="text-sm text-gray-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</TableCell>
                      <TableCell>
                        {(log.oldValue || log.newValue) && (
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedLog(log) }}>
                            Diff
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {meta.totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-gray-500">Page {meta.page} of {meta.totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage(p => p - 1)}>
                      <FiChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>
                      <FiChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null) }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Log Detail</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Action</p>
                    <p className="text-sm font-medium">{selectedLog.action}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Admin</p>
                    <p className="text-sm">{selectedLog.adminEmail}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Target</p>
                    <p className="text-sm break-all">{selectedLog.targetLabel || '\u2014'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">IP Address</p>
                    <p className="text-sm">{selectedLog.ipAddress}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedLog.oldValue && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Old Value</p>
                    <pre className="rounded bg-gray-50 p-3 text-xs overflow-auto max-h-60">
                      {JSON.stringify(selectedLog.oldValue, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.newValue && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">New Value</p>
                    <pre className="rounded bg-gray-50 p-3 text-xs overflow-auto max-h-60">
                      {JSON.stringify(selectedLog.newValue, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
