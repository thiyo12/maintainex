'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FiChevronLeft, FiChevronRight, FiDollarSign, FiAlertCircle, FiRefreshCw, FiCheckCircle, FiXCircle } from 'react-icons/fi'
import api from '@/lib/api'
import { PERMISSION } from '@/lib/permissions'
import { PermissionGate } from '@/components/admin/PermissionGate'
import { formatMoney } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

interface PayoutRow {
  id: string
  userId: string
  user: { id: string; name: string | null; email: string; mxId?: string | null } | null
  amountLkr: number
  description: string | null
  status: string
  source: string
  method: string | null
  bankDetails: string | null
  rejectedReason: string | null
  processedBy: string | null
  createdAt: string
  clearedAt: string | null
  walletAvailable: number
  walletFrozen: boolean
}

interface Meta {
  total: number
  page: number
  limit: number
  totalPages: number
  pendingAmount: number
  clearedAmount: number
  rejectedCount: number
  failedCount: number
}

const payoutStatusMap: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  CLEARED: 'bg-green-100 text-green-800',
  RELEASED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  FAILED: 'bg-gray-100 text-gray-800',
}

function statusLabel(s: string): string {
  switch (s) {
    case 'PENDING': return 'Pending'
    case 'PROCESSING': return 'Processing'
    case 'CLEARED': return 'Paid'
    case 'RELEASED': return 'Released'
    case 'REJECTED': return 'Rejected'
    case 'FAILED': return 'Failed'
    default: return s.replace('_', ' ')
  }
}

export default function SettlementsPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [page, setPage] = useState(1)
  const [confirmAction, setConfirmAction] = useState<{ payoutId: string; action: 'paid' | 'reject' } | null>(null)
  const [reason, setReason] = useState('')

  const payoutsQuery = useQuery({
    queryKey: ['admin-payouts', statusFilter, page],
    queryFn: async () => {
      const res = await api.get('/api/admin/financial/payouts', {
        params: { status: statusFilter, page, limit: 20 },
      })
      const body = res.data
      if (body.error) throw new Error(body.error)
      return { payouts: body.payouts as PayoutRow[], meta: body.meta as Meta }
    },
  })

  const actionMutation = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: 'paid' | 'reject'; reason?: string }) => {
      const res = await api.patch(`/api/admin/financial/payouts/${id}`, { action, reason })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] })
      toast.success('Payout updated successfully')
      setConfirmAction(null)
      setReason('')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to process payout')
    },
  })

  const payouts = payoutsQuery.data?.payouts || []
  const meta = payoutsQuery.data?.meta || { total: 0, page: 1, limit: 20, totalPages: 0, pendingAmount: 0, clearedAmount: 0, rejectedCount: 0, failedCount: 0 }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Pending Amount</p>
            <p className="text-2xl font-bold text-yellow-600">{formatMoney(Math.round(meta.pendingAmount * 100))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Paid Out</p>
            <p className="text-2xl font-bold text-green-600">{formatMoney(Math.round(meta.clearedAmount * 100))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{meta.rejectedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Failed</p>
            <p className="text-2xl font-bold text-gray-600">{meta.failedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? 'PENDING'); setPage(1) }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PROCESSING">Processing</SelectItem>
              <SelectItem value="CLEARED">Paid</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => payoutsQuery.refetch()}>
            <FiRefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {payoutsQuery.isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>{['User', 'Amount', 'Method', 'Status', 'Requested', 'Processed by', ''].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : payoutsQuery.error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <FiAlertCircle className="w-12 h-12 text-red-500" />
              <p className="text-gray-600">Failed to load payouts</p>
              <Button variant="outline" onClick={() => payoutsQuery.refetch()}>Try Again</Button>
            </div>
          ) : payouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FiDollarSign className="w-12 h-12 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900">No payouts found</h3>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Processed by</TableHead>
                      <PermissionGate roles={PERMISSION.manageEscrow}>
                        <TableHead className="w-48" />
                      </PermissionGate>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-gray-900">
                          <div className="font-medium">{p.user?.name || p.user?.email}</div>
                          {p.user?.mxId ? <div className="text-xs text-gray-400">{p.user.mxId}</div> : null}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatMoney(Math.round(p.amountLkr * 100))}
                          {p.walletFrozen && p.status === 'PENDING' ? (
                            <Badge className="ml-2 bg-red-100 text-red-700">Frozen wallet</Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {(p.method || 'bank').toUpperCase()}
                          {p.bankDetails ? (
                            <div className="text-xs text-gray-400 max-w-[180px] truncate" title={p.bankDetails}>{p.bankDetails}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge className={payoutStatusMap[p.status] || 'bg-gray-100 text-gray-800'}>{statusLabel(p.status)}</Badge>
                          {p.rejectedReason ? (
                            <div className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={p.rejectedReason}>Reason: {p.rejectedReason}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-gray-500">{p.processedBy || '\u2014'}</TableCell>
                        <PermissionGate roles={PERMISSION.manageEscrow}>
                          <TableCell>
                            {p.status === 'PENDING' || p.status === 'PROCESSING' ? (
                              <div className="flex gap-2 flex-wrap">
                                <Button size="sm" onClick={() => { setConfirmAction({ payoutId: p.id, action: 'paid' }); setReason('') }}>
                                  <FiCheckCircle className="mr-1" /> Mark Paid
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => { setConfirmAction({ payoutId: p.id, action: 'reject' }); setReason('') }}>
                                  <FiXCircle className="mr-1" /> Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">{p.clearedAt ? new Date(p.clearedAt).toLocaleDateString() : ''}</span>
                            )}
                          </TableCell>
                        </PermissionGate>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {meta.totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-gray-500">Page {meta.page} of {meta.totalPages} ({meta.total} payouts)</p>
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
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!confirmAction} onOpenChange={(o) => { if (!o) { setConfirmAction(null); setReason('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmAction?.action === 'paid' ? 'Confirm Payout' : 'Reject Payout'}</DialogTitle>
            <DialogDescription>
              {confirmAction?.action === 'paid'
                ? 'Mark this payout as paid. The provider wallet balance will be debited and the user notified.'
                : 'Reject this payout. The user will be notified with the reason below.'}
            </DialogDescription>
          </DialogHeader>
          {confirmAction?.action === 'reject' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rejection reason (required)</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[80px]"
                placeholder="e.g. Invalid bank details provided. Please contact support."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => { setConfirmAction(null); setReason('') }}>Cancel</Button>
            <Button
              variant={confirmAction?.action === 'reject' ? 'destructive' : 'default'}
              onClick={() => {
                if (!confirmAction) return
                if (confirmAction.action === 'reject' && !reason.trim()) {
                  toast.error('A rejection reason is required')
                  return
                }
                actionMutation.mutate({ id: confirmAction.payoutId, action: confirmAction.action, reason: reason.trim() })
              }}
              disabled={actionMutation.isPending}
            >
              {actionMutation.isPending ? 'Processing...' : confirmAction?.action === 'paid' ? 'Confirm Payout' : 'Reject Payout'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}