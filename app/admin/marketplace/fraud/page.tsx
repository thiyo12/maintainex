'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FiSearch, FiChevronLeft, FiChevronRight, FiAlertTriangle,
  FiRefreshCw, FiChevronDown, FiChevronRight as FiChevronRightIcon,
  FiShield, FiSlash, FiAlertCircle, FiX,
} from 'react-icons/fi'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { can, PERMISSION } from '@/lib/permissions'
import { PermissionGate } from '@/components/admin/PermissionGate'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import toast from 'react-hot-toast'

interface FraudEvent {
  id: string
  type: string
  description: string
  createdAt: string
}

interface Flag {
  id: string
  userId: string
  userName: string | null
  userEmail: string
  reason: string
  status: string
  flaggedAt: string
  fraudEvents?: FraudEvent[]
}

interface PaginatedMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

type Action = 'dismiss' | 'warn' | 'suspend' | 'ban'

export default function MarketplaceFlags() {
  const adminUser = useAuthStore((s) => s.adminUser)
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('pending')
  const [page, setPage] = useState(1)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<{ flag: Flag; action: Action } | null>(null)
  const [actionNotes, setActionNotes] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-marketplace-flags', statusFilter, page],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/flags', {
        params: { status: statusFilter === 'all' ? undefined : statusFilter, page, limit: 20 },
      })
      const body = res.data
      if (body.error) throw new Error(body.error)
      return { flags: body.data as Flag[], meta: body.meta as PaginatedMeta }
    },
  })

  const flags = data?.flags || []
  const meta = data?.meta || { total: 0, page: 1, limit: 20, totalPages: 0 }

  const actionMutation = useMutation({
    mutationFn: async (vars: { id: string; action: Action; notes: string }) => {
      const res = await api.patch('/api/admin/marketplace/flags', vars)
      const body = res.data
      if (body.error) throw new Error(body.error)
      return body
    },
    onSuccess: () => {
      toast.success('Action performed successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-flags'] })
      setActionTarget(null)
      setActionNotes('')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to perform action')
    },
  })

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>
      case 'reviewed': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Reviewed</Badge>
      case 'resolved': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Resolved</Badge>
      case 'dismissed': return <Badge variant="secondary">Dismissed</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleAction = (flag: Flag, action: Action) => {
    setActionTarget({ flag, action })
  }

  const confirmAction = () => {
    if (!actionTarget) return
    actionMutation.mutate({
      id: actionTarget.flag.id,
      action: actionTarget.action,
      notes: actionNotes,
    })
  }

  const getActionTitle = () => {
    if (!actionTarget) return ''
    switch (actionTarget.action) {
      case 'dismiss': return 'Dismiss Flag'
      case 'warn': return 'Warn User'
      case 'suspend': return 'Suspend User'
      case 'ban': return 'Ban User'
      default: return 'Confirm Action'
    }
  }

  const getActionDescription = () => {
    if (!actionTarget) return ''
    const name = actionTarget.flag.userName || actionTarget.flag.userEmail
    switch (actionTarget.action) {
      case 'dismiss': return `Dismiss the flag for ${name}? This will mark it as resolved without further action.`
      case 'warn': return `Send a warning to ${name}? They will be notified of the violation.`
      case 'suspend': return `Suspend ${name}? They will be unable to use the platform until reactivated.`
      case 'ban': return `Permanently ban ${name}? This action cannot be undone.`
      default: return 'Are you sure?'
    }
  }

  const isDangerous = actionTarget?.action === 'suspend' || actionTarget?.action === 'ban'

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>{['User', 'Reason', 'Status', 'Flagged At', ''].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>)}
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
          <p className="text-gray-600">{error instanceof Error ? error.message : 'Failed to load flags'}</p>
          <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <PermissionGate roles={PERMISSION.manageUsers}>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FiAlertTriangle className="w-6 h-6 text-[#F59E0B]" />
              Flagged Accounts
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Review and manage flagged accounts</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <FiRefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        <Card className="dark:bg-[#1B1D27] dark:border-[#23252F]">
          <CardHeader>
            <div className="flex flex-wrap gap-3">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? 'pending'); setPage(1) }}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {flags.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <FiAlertTriangle className="w-12 h-12 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900">No flagged accounts</h3>
                <p className="text-gray-500">Nothing to review right now</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>User</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Flagged At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flags.map((flag) => (
                      <>
                        <TableRow
                          key={flag.id}
                          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          onClick={() => setExpandedRow(expandedRow === flag.id ? null : flag.id)}
                        >
                          <TableCell className="w-8">
                            {expandedRow === flag.id ? (
                              <FiChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <FiChevronRightIcon className="w-4 h-4 text-gray-400" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{flag.userName || '—'}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{flag.userEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-300 max-w-xs truncate">{flag.reason}</TableCell>
                          <TableCell>{statusBadge(flag.status)}</TableCell>
                          <TableCell className="text-gray-500 dark:text-gray-400">
                            {new Date(flag.flaggedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {flag.status === 'pending' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-gray-600 hover:text-gray-900"
                                    onClick={() => handleAction(flag, 'dismiss')}
                                    title="Dismiss"
                                  >
                                    <FiX className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-amber-600 hover:text-amber-700"
                                    onClick={() => handleAction(flag, 'warn')}
                                    title="Warn"
                                  >
                                    <FiAlertTriangle className="w-4 h-4" />
                                  </Button>
                                  {can(adminUser?.role || 'SUPPORT', PERMISSION.suspendUser) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-orange-600 hover:text-orange-700"
                                      onClick={() => handleAction(flag, 'suspend')}
                                      title="Suspend"
                                    >
                                      <FiSlash className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {can(adminUser?.role || 'SUPPORT', PERMISSION.banUser) && adminUser?.role === 'SUPER_ADMIN' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-600 hover:text-red-700"
                                      onClick={() => handleAction(flag, 'ban')}
                                      title="Ban"
                                    >
                                      <FiShield className="w-4 h-4" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedRow === flag.id && (
                          <TableRow key={`${flag.id}-expanded`}>
                            <TableCell colSpan={6} className="bg-gray-50 dark:bg-gray-800/30 p-0">
                              <div className="p-4">
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Fraud Events</h4>
                                {flag.fraudEvents && flag.fraudEvents.length > 0 ? (
                                  <div className="space-y-2">
                                    {flag.fraudEvents.map((event) => (
                                      <div
                                        key={event.id}
                                        className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-[#1B1D27] border border-gray-200 dark:border-[#23252F]"
                                      >
                                        <FiAlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">{event.type}</span>
                                            <span className="text-xs text-gray-400">
                                              {new Date(event.createdAt).toLocaleString()}
                                            </span>
                                          </div>
                                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{event.description}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 dark:text-gray-400">No fraud events recorded</p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
                {meta.totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t dark:border-[#23252F]">
                    <p className="text-sm text-gray-500">
                      Page {meta.page} of {meta.totalPages} ({meta.total} total)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={meta.page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <FiChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={meta.page >= meta.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        <FiChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <ConfirmDialog
          open={!!actionTarget}
          onOpenChange={(open) => { if (!open) { setActionTarget(null); setActionNotes('') } }}
          title={getActionTitle()}
          description={getActionDescription()}
          confirmLabel={actionTarget?.action === 'dismiss' ? 'Dismiss' : actionTarget?.action === 'warn' ? 'Send Warning' : actionTarget?.action === 'suspend' ? 'Suspend' : 'Ban'}
          confirmVariant={isDangerous ? 'destructive' : 'default'}
          onConfirm={confirmAction}
          loading={actionMutation.isPending}
        />
      </div>
    </PermissionGate>
  )
}
