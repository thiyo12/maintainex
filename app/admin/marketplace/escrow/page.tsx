'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FiChevronLeft, FiChevronRight, FiDollarSign, FiAlertCircle, FiRefreshCw } from 'react-icons/fi'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { can, PERMISSION } from '@/lib/permissions'
import { PermissionGate } from '@/components/admin/PermissionGate'
import { formatMoney } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

interface Escrow {
  id: string
  jobId: string
  status: string
  amountCents: number
  heldAt: string | null
  releasedAt: string | null
  refundedAt: string | null
  createdAt: string
}

interface Dispute {
  id: string
  job: { id: string; title: string }
  raisedBy: { id: string; name: string | null; email: string }
  reason: string
  status: string
  createdAt: string
}

interface PaginatedMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

const escrowStatusMap: Record<string, string> = {
  ON_HOLD: 'bg-yellow-100 text-yellow-800',
  PROTECTED: 'bg-blue-100 text-blue-800',
  RELEASED: 'bg-green-100 text-green-800',
  REFUNDED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

export default function MarketplaceEscrow() {
  const adminUser = useAuthStore((s) => s.adminUser)
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [confirmAction, setConfirmAction] = useState<{ escrowId: string; action: 'release' | 'refund' } | null>(null)

  const canAct = adminUser ? can(adminUser.role, PERMISSION.manageEscrow) : false

  const escrowQuery = useQuery({
    queryKey: ['admin-marketplace-escrows', statusFilter, page],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/escrow', {
        params: { status: statusFilter, page, limit: 20 },
      })
      const body = res.data
      if (body.error) throw new Error(body.error)
      return { escrows: body.data as Escrow[], meta: body.meta as PaginatedMeta }
    },
  })

  const disputesQuery = useQuery({
    queryKey: ['admin-marketplace-disputes'],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/escrow/disputes')
      const body = res.data
      if (body.error) throw new Error(body.error)
      return body.data as Dispute[]
    },
  })

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'release' | 'refund' }) => {
      const res = await api.patch(`/api/admin/marketplace/escrow/${id}`, { action })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-escrows'] })
      toast.success('Escrow action performed successfully')
      setConfirmAction(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to process action')
    },
  })

  const escrows = escrowQuery.data?.escrows || []
  const escrowMeta = escrowQuery.data?.meta || { total: 0, page: 1, limit: 20, totalPages: 0 }
  const disputes = disputesQuery.data || []

  const isLoading = escrowQuery.isLoading || disputesQuery.isLoading
  const error = escrowQuery.error || disputesQuery.error

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-end flex-wrap gap-2">
        <Button variant="outline" onClick={() => { escrowQuery.refetch(); disputesQuery.refetch() }}>
          <FiRefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Tabs defaultValue="escrows">
        <TabsList>
          <TabsTrigger value="escrows">Escrows ({escrowMeta.total})</TabsTrigger>
          <TabsTrigger value="disputes">Disputes ({disputes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="escrows" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? ''); setPage(1) }}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  <SelectItem value="PROTECTED">Protected</SelectItem>
                  <SelectItem value="RELEASED">Released</SelectItem>
                  <SelectItem value="REFUNDED">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="p-0">
              {escrowQuery.isLoading ? (
                <Table>
                  <TableHeader>
                    <TableRow>{['Job ID', 'Amount', 'Status', 'Held', ''].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : escrowQuery.error ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <FiAlertCircle className="w-12 h-12 text-red-500" />
                  <p className="text-gray-600">Failed to load escrows</p>
                  <Button variant="outline" onClick={() => escrowQuery.refetch()}>Try Again</Button>
                </div>
              ) : escrows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <FiDollarSign className="w-12 h-12 text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-900">No escrows found</h3>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job ID</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Held</TableHead>
                        <PermissionGate roles={PERMISSION.manageEscrow}>
                          <TableHead className="w-40" />
                        </PermissionGate>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {escrows.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-mono text-xs text-gray-600">{e.jobId}</TableCell>
                          <TableCell className="font-medium">{formatMoney(e.amountCents)}</TableCell>
                          <TableCell>
                            <Badge className={escrowStatusMap[e.status] || 'bg-gray-100 text-gray-800'}>{e.status}</Badge>
                          </TableCell>
                          <TableCell className="text-gray-500">{e.heldAt ? new Date(e.heldAt).toLocaleDateString() : '\u2014'}</TableCell>
                          <PermissionGate roles={PERMISSION.manageEscrow}>
                            <TableCell>
                              {(e.status === 'ON_HOLD' || e.status === 'PROTECTED') && (
                                <div className="flex gap-2 flex-wrap">
                                  <Button size="sm" onClick={() => setConfirmAction({ escrowId: e.id, action: 'release' })}>
                                    Release
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => setConfirmAction({ escrowId: e.id, action: 'refund' })}>
                                    Refund
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </PermissionGate>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {escrowMeta.totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t">
                      <p className="text-sm text-gray-500">Page {escrowMeta.page} of {escrowMeta.totalPages}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={escrowMeta.page <= 1} onClick={() => setPage(p => p - 1)}>
                          <FiChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" disabled={escrowMeta.page >= escrowMeta.totalPages} onClick={() => setPage(p => p + 1)}>
                          <FiChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disputes" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {disputesQuery.isLoading ? (
                <Table>
                  <TableHeader>
                    <TableRow>{['Job', 'Raised By', 'Reason', 'Status', 'Date'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : disputesQuery.error ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <FiAlertCircle className="w-12 h-12 text-red-500" />
                  <p className="text-gray-600">Failed to load disputes</p>
                  <Button variant="outline" onClick={() => disputesQuery.refetch()}>Try Again</Button>
                </div>
              ) : disputes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <FiAlertCircle className="w-12 h-12 text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-900">No disputes</h3>
                  <p className="text-gray-500">All clear!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Raised By</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disputes.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-gray-900">{d.job.title}</TableCell>
                        <TableCell className="text-gray-600">{d.raisedBy.name || d.raisedBy.email}</TableCell>
                        <TableCell className="text-gray-600 max-w-xs truncate">{d.reason}</TableCell>
                        <TableCell>
                          <Badge className={
                            d.status === 'OPEN' ? 'bg-yellow-100 text-yellow-800' :
                            d.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }>{d.status}</Badge>
                        </TableCell>
                        <TableCell className="text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!confirmAction} onOpenChange={(o) => { if (!o) setConfirmAction(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm {confirmAction?.action === 'release' ? 'Release' : 'Refund'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to {confirmAction?.action} this escrow? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction?.action === 'refund' ? 'destructive' : 'default'}
              onClick={() => {
                if (confirmAction) actionMutation.mutate({ id: confirmAction.escrowId, action: confirmAction.action })
              }}
              disabled={actionMutation.isPending}
            >
              {actionMutation.isPending ? 'Processing...' : `Confirm ${confirmAction?.action === 'release' ? 'Release' : 'Refund'}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
