'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiSearch, FiChevronLeft, FiChevronRight, FiEye, FiAlertCircle, FiBriefcase, FiRefreshCw } from 'react-icons/fi'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { formatMoney } from '@/lib/money'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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

interface Job {
  id: string
  title: string
  status: string
  budgetCents: number | null
  currency: string
  categoryId: string | null
  client: { name: string | null; email: string }
  createdAt: string
}

interface PaginatedMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

const STATUS_MAP: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
  ON_HOLD: 'bg-yellow-100 text-yellow-800',
}

export default function MarketplaceJobs() {
  const adminUser = useAuthStore((s) => s.adminUser)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-marketplace-jobs', search, statusFilter, page],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/jobs', {
        params: { search, status: statusFilter, page, limit: 20 },
      })
      const body = res.data
      if (body.error) throw new Error(body.error)
      return { jobs: body.data as Job[], meta: body.meta as PaginatedMeta }
    },
  })

  const jobs = data?.jobs || []
  const meta = data?.meta || { total: 0, page: 1, limit: 20, totalPages: 0 }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>{['Title', 'Client', 'Budget', 'Status', 'Created', ''].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
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
          <p className="text-gray-600">{error instanceof Error ? error.message : 'Failed to load jobs'}</p>
          <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-end">
        <Button variant="outline" onClick={() => refetch()}><FiRefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-0 w-full sm:min-w-[200px] sm:w-auto">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search jobs..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? ''); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="ON_HOLD">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FiBriefcase className="w-12 h-12 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900">No jobs found</h3>
              <p className="text-gray-500">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.title}</TableCell>
                      <TableCell className="text-gray-600">{job.client.name || job.client.email}</TableCell>
                      <TableCell className="font-medium">{job.budgetCents ? formatMoney(job.budgetCents) : '\u2014'}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_MAP[job.status] || 'bg-gray-100 text-gray-800'}>{job.status}</Badge>
                      </TableCell>
                      <TableCell className="text-gray-500">{new Date(job.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <a href={`/admin/marketplace/jobs/${job.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex items-center")}><FiEye className="w-4 h-4 mr-1" /> View</a>
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
    </div>
  )
}
