'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FiChevronLeft, FiChevronRight, FiStar, FiCheckCircle, FiXCircle, FiAlertCircle, FiRefreshCw, FiMessageSquare } from 'react-icons/fi'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { can, PERMISSION } from '@/lib/permissions'
import { PermissionGate } from '@/components/admin/PermissionGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

interface Review {
  id: string
  user: { id: string; name: string | null; email: string }
  service: { id: string; name: string }
  rating: number
  comment: string | null
  status: string
  customerName: string | null
  createdAt: string
}

interface PaginatedMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function MarketplaceReviews() {
  const adminUser = useAuthStore((s) => s.adminUser)
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [page, setPage] = useState(1)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ reviewId: string; action: 'approve' | 'reject' } | null>(null)

  const canModerate = adminUser ? can(adminUser.role, PERMISSION.moderateReviews) : false

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-marketplace-reviews', statusFilter, page],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/reviews', {
        params: { status: statusFilter, page, limit: 20 },
      })
      const body = res.data
      if (body.error) throw new Error(body.error)
      return { reviews: body.data as Review[], meta: body.meta as PaginatedMeta }
    },
  })

  const moderateMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      const res = await api.patch('/api/admin/marketplace/reviews', { id, action })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-reviews'] })
      toast.success('Review updated successfully')
      setConfirmAction(null)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update review')
    },
  })

  const reviews = data?.reviews || []
  const meta = data?.meta || { total: 0, page: 1, limit: 20, totalPages: 0 }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return <Badge className="bg-green-100 text-green-800">Approved</Badge>
      case 'REJECTED': return <Badge variant="destructive">Rejected</Badge>
      default: return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-end flex-wrap gap-2">
        <Button variant="outline" onClick={() => refetch()}><FiRefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b flex flex-wrap gap-3">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? 'PENDING'); setPage(1) }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>{['Service', 'User', 'Rating', 'Comment', 'Status', 'Date', ''].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <FiAlertCircle className="w-12 h-12 text-red-500" />
              <p className="text-gray-600">Failed to load reviews</p>
              <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FiMessageSquare className="w-12 h-12 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900">No reviews found</h3>
              <p className="text-gray-500">All clear!</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <PermissionGate roles={PERMISSION.moderateReviews}>
                        <TableHead className="w-48" />
                      </PermissionGate>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.map((r) => (
                      <TableRow key={r.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedReview(r)}>
                        <TableCell className="text-gray-900 font-medium max-w-xs truncate">{r.service.name}</TableCell>
                        <TableCell className="text-gray-600">{r.user.name || r.user.email}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-amber-500">
                            <FiStar size={14} />
                            <span>{r.rating}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600 max-w-sm truncate">{r.comment || '\u2014'}</TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="text-gray-500 whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                        <PermissionGate roles={PERMISSION.moderateReviews}>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {r.status === 'PENDING' && (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => { setConfirmAction({ reviewId: r.id, action: 'approve' }) }}>
                                  <FiCheckCircle className="mr-1 h-3 w-3" /> Approve
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => { setConfirmAction({ reviewId: r.id, action: 'reject' }) }}>
                                  <FiXCircle className="mr-1 h-3 w-3" /> Reject
                                </Button>
                              </div>
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
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedReview} onOpenChange={(o) => { if (!o) setSelectedReview(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
            <DialogDescription>Full review content</DialogDescription>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div>
                <span className="text-sm text-gray-500">Service:</span>
                <p className="font-medium">{selectedReview.service.name}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">By:</span>
                <p className="font-medium">{selectedReview.user.name || selectedReview.user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Rating:</span>
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <FiStar key={i} size={16} fill={i < selectedReview.rating ? 'currentColor' : 'none'} />
                  ))}
                  <span className="text-gray-700 ml-1">({selectedReview.rating}/5)</span>
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Comment:</span>
                <p className="mt-1 text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedReview.comment || 'No comment'}</p>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Status: {statusBadge(selectedReview.status)}</span>
                <span className="text-sm text-gray-500">{new Date(selectedReview.createdAt).toLocaleString()}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAction} onOpenChange={(o) => { if (!o) setConfirmAction(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm {confirmAction?.action === 'approve' ? 'Approve' : 'Reject'} Review</DialogTitle>
            <DialogDescription>
              {confirmAction?.action === 'approve'
                ? 'This review will be published and visible to all users.'
                : 'This review will be hidden and not visible to users.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction?.action === 'reject' ? 'destructive' : 'default'}
              onClick={() => {
                if (confirmAction) moderateMutation.mutate({ id: confirmAction.reviewId, action: confirmAction.action })
              }}
              disabled={moderateMutation.isPending}
            >
              {moderateMutation.isPending ? 'Processing...' : confirmAction?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
