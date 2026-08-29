'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiAlertCircle, FiRefreshCw, FiFlag, FiXCircle, FiDollarSign } from 'react-icons/fi'
import api from '@/lib/api'
import { PERMISSION } from '@/lib/permissions'
import { PermissionGate } from '@/components/admin/PermissionGate'
import { formatMoney } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface JobDetail {
  id: string
  title: string
  description: string | null
  status: string
  budgetCents: number | null
  currency: string
  categoryId: string | null
  source: 'V1' | 'V2'
  client: { id: string; name: string | null; email: string }
  worker: { id: string; name: string | null; email: string } | null
  escrow: { id: string; status: string; amountCents: number } | null
  createdAt: string
}

const STATUS_MAP: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
  ON_HOLD: 'bg-yellow-100 text-yellow-800',
}

export default function MarketplaceJobDetail() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: job, isLoading, error, refetch } = useQuery<JobDetail>({
    queryKey: ['admin-marketplace-job', params.id],
    queryFn: async () => {
      const res = await api.get(`/api/admin/marketplace/jobs/${params.id}`)
      const body = res.data
      if (body.error) throw new Error(body.error)
      return body.data
    },
  })

  const patchAction = useMutation({
    mutationFn: async ({ action, reason }: { action: string; reason: string }) => {
      const res = await api.patch(`/api/admin/marketplace/jobs/${params.id}`, { action, reason })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-job', params.id] })
      toast.success('Action completed successfully')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Action failed')
    },
  })

  function promptAndRun(action: string, label: string) {
    const reason = window.prompt(`Reason for ${label}:`)
    if (reason === null) return
    if (!reason.trim()) {
      toast.error('Reason is required')
      return
    }
    patchAction.mutate({ action, reason: reason.trim() })
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><Card><CardHeader><Skeleton className="h-5 w-24" /></CardHeader><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card></div>
          <Card><CardHeader><Skeleton className="h-5 w-20" /></CardHeader><CardContent><Skeleton className="h-16 w-full" /></CardContent></Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <FiAlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-gray-600">{error instanceof Error ? error.message : 'Failed to load job'}</p>
          <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center h-64">
        <p className="text-gray-500">Job not found</p>
      </div>
    )
  }

  const isActive = job.status !== 'COMPLETED' && job.status !== 'CANCELLED'
  const hasEscrow = !!job.escrow && ['PENDING', 'PROTECTED', 'ON_HOLD'].includes(job.escrow.status)

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <FiArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
          <Badge className={STATUS_MAP[job.status] || 'bg-gray-100 text-gray-800'}>{job.status}</Badge>
          <Badge variant="outline" className="text-xs">{job.source}</Badge>
        </div>
        <Button variant="outline" onClick={() => refetch()}><FiRefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {job.description && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Description</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.description}</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500">Budget</p>
                  <p className="text-sm text-gray-900">{job.budgetCents ? formatMoney(job.budgetCents) : '\u2014'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Created</p>
                  <p className="text-sm text-gray-900">{new Date(job.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Client</p>
                  <p className="text-sm text-gray-900 break-all">{job.client.name || job.client.email}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Worker</p>
                  <p className="text-sm text-gray-900">{job.worker?.name || job.worker?.email || 'Not assigned'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <PermissionGate roles={PERMISSION.forceCancelJob}>
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {isActive && (
                <>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => promptAndRun('cancel', 'Cancel Job')}
                    disabled={patchAction.isPending}
                  >
                    <FiXCircle className="mr-2 h-4 w-4" />
                    {patchAction.isPending ? 'Processing...' : 'Cancel Job'}
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                    onClick={() => promptAndRun('flag', 'Flag for Review')}
                    disabled={patchAction.isPending}
                  >
                    <FiFlag className="mr-2 h-4 w-4" />
                    {patchAction.isPending ? 'Processing...' : 'Flag for Review'}
                  </Button>
                </>
              )}

              {hasEscrow && (
                <Button
                  variant="outline"
                  className="w-full border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => promptAndRun('force_refund', 'Force Refund Escrow')}
                  disabled={patchAction.isPending}
                >
                  <FiDollarSign className="mr-2 h-4 w-4" />
                  {patchAction.isPending ? 'Processing...' : 'Force Refund Escrow'}
                </Button>
              )}
            </CardContent>
          </Card>
        </PermissionGate>
      </div>

      {job.escrow && (
        <Card>
          <CardHeader><CardTitle>Escrow</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Amount</p>
                <p className="text-sm text-gray-900">{formatMoney(job.escrow.amountCents)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Status</p>
                <p className="text-sm text-gray-900">{job.escrow.status}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Escrow ID</p>
                <p className="text-sm text-gray-900 font-mono text-xs">{job.escrow.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
