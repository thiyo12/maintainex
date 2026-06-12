'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { FiChevronLeft, FiChevronRight, FiEye, FiAlertCircle, FiRefreshCw, FiCheckCircle, FiXCircle } from 'react-icons/fi'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { can, PERMISSION } from '@/lib/permissions'
import { PermissionGate } from '@/components/admin/PermissionGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface KycDoc {
  id: string
  userId: string
  user: { name: string | null; email: string }
  documentType: string
  status: string
  frontImageUrl: string | null
  backImageUrl: string | null
  createdAt: string
}

interface PaginatedMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

const reviewSchema = z.object({
  reason: z.string().optional(),
})

type ReviewForm = z.infer<typeof reviewSchema>

export default function MarketplaceKyc() {
  const adminUser = useAuthStore((s) => s.adminUser)
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [page, setPage] = useState(1)
  const [selectedDoc, setSelectedDoc] = useState<KycDoc | null>(null)

  const canReview = adminUser ? can(adminUser.role, PERMISSION.approveKyc) : false

  const form = useForm<ReviewForm>({
    resolver: zodResolver(reviewSchema),
  })

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-marketplace-kyc', statusFilter, page],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/kyc', {
        params: { status: statusFilter, page, limit: 20 },
      })
      const body = res.data
      if (body.error) throw new Error(body.error)
      return { docs: body.data as KycDoc[], meta: body.meta as PaginatedMeta }
    },
  })

  const docs = data?.docs || []
  const meta = data?.meta || { total: 0, page: 1, limit: 20, totalPages: 0 }

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: 'APPROVE' | 'REJECT'; reason?: string }) => {
      const res = await api.patch(`/api/admin/marketplace/kyc/${id}`, {
        action,
        ...(reason ? { reason } : {}),
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-kyc'] })
      toast.success('Document reviewed successfully')
      setSelectedDoc(null)
      form.reset()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to process review')
    },
  })

  const handleApprove = () => {
    if (!selectedDoc) return
    reviewMutation.mutate({ id: selectedDoc.id, action: 'APPROVE' })
  }

  const handleReject = (data: ReviewForm) => {
    if (!selectedDoc) return
    reviewMutation.mutate({ id: selectedDoc.id, action: 'REJECT', reason: data.reason })
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-4 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-4 w-20" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <FiAlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-gray-600">{error instanceof Error ? error.message : 'Failed to load documents'}</p>
          <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-end flex-wrap gap-2">
        <Button variant="outline" onClick={() => refetch()}><FiRefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      <Card>
        <CardHeader>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? ''); setPage(1) }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Filter by status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="">All</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FiAlertCircle className="w-12 h-12 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900">No documents found</h3>
              <p className="text-gray-500">No KYC documents match the current filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Document Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <p className="text-sm font-medium text-gray-900">{doc.user.name || '\u2014'}</p>
                        <p className="text-xs text-gray-500">{doc.user.email}</p>
                      </TableCell>
                      <TableCell className="text-gray-600">{doc.documentType}</TableCell>
                      <TableCell>
                        <Badge className={
                          doc.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          doc.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }>{doc.status}</Badge>
                      </TableCell>
                      <TableCell className="text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDoc(doc)}>
                          <FiEye className="w-4 h-4 mr-1" /> Review
                        </Button>
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

      <Dialog open={!!selectedDoc} onOpenChange={(open) => { if (!open) { setSelectedDoc(null); form.reset() }}}>
          <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Document</DialogTitle>
            <DialogDescription>Review and approve or reject this identity document</DialogDescription>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4">
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                  <p className="text-xs font-medium text-gray-500">User</p>
                  <p className="text-sm">{selectedDoc.user.name} ({selectedDoc.user.email})</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Type</p>
                  <p className="text-sm">{selectedDoc.documentType}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Submitted</p>
                  <p className="text-sm">{new Date(selectedDoc.createdAt).toLocaleString()}</p>
                </div>
              </div>
              {selectedDoc.frontImageUrl && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Front Image</p>
                  <img src={selectedDoc.frontImageUrl} alt="Front" className="max-h-48 max-w-full h-auto rounded border" />
                </div>
              )}
              {selectedDoc.backImageUrl && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Back Image</p>
                  <img src={selectedDoc.backImageUrl} alt="Back" className="max-h-48 max-w-full h-auto rounded border" />
                </div>
              )}
              {canReview && selectedDoc.status === 'PENDING' && (
                <div className="space-y-3 pt-2">
                  <div className="flex gap-3">
                    <Button
                      className="flex-1"
                      onClick={handleApprove}
                      disabled={reviewMutation.isPending}
                    >
                      <FiCheckCircle className="w-4 h-4 mr-2" /> Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={reviewMutation.isPending}
                      onClick={() => {
                        const reason = form.getValues('reason')
                        handleReject({ reason })
                      }}
                    >
                      <FiXCircle className="w-4 h-4 mr-2" /> Reject
                    </Button>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Rejection Reason (optional)</p>
                    <Textarea
                      placeholder="Enter reason for rejection..."
                      {...form.register('reason')}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
