'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { FiSearch, FiChevronLeft, FiChevronRight, FiEye, FiStar, FiTrash2, FiCheck, FiX } from 'react-icons/fi'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import Link from 'next/link'

const STATUS_OPTIONS = ['all', 'pending', 'approved', 'rejected', 'draft']
const COUNTRY_OPTIONS = ['all', 'LK', 'CA']
const TYPE_OPTIONS = ['all', 'house', 'apartment', 'commercial', 'land', 'rental']

export default function AdminPropertiesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [country, setCountry] = useState('all')
  const [propertyType, setPropertyType] = useState('all')
  const [page, setPage] = useState(1)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-properties', search, status, country, propertyType, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (status !== 'all') params.set('status', status)
      if (country !== 'all') params.set('country', country)
      if (propertyType !== 'all') params.set('propertyType', propertyType)
      params.set('page', String(page))
      params.set('limit', '20')
      const res = await api.get(`/api/admin/properties?${params.toString()}`)
      return res.data as { success: boolean; data: any[]; meta: { total: number; page: number; limit: number; totalPages: number } }
    },
  })

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api/admin/properties/${id}/approve`)
    },
    onSuccess: () => {
      toast.success('Property approved')
      queryClient.invalidateQueries({ queryKey: ['admin-properties'] })
    },
    onError: () => toast.error('Failed to approve'),
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await api.post(`/api/admin/properties/${id}/reject`, { reason })
    },
    onSuccess: () => {
      toast.success('Property rejected')
      queryClient.invalidateQueries({ queryKey: ['admin-properties'] })
    },
    onError: () => toast.error('Failed to reject'),
  })

  const featureMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api/admin/properties/${id}/feature`)
    },
    onSuccess: () => {
      toast.success('Featured status toggled')
      queryClient.invalidateQueries({ queryKey: ['admin-properties'] })
    },
    onError: () => toast.error('Failed to toggle feature'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/admin/properties/${id}`)
    },
    onSuccess: () => {
      toast.success('Property deleted')
      queryClient.invalidateQueries({ queryKey: ['admin-properties'] })
    },
    onError: () => toast.error('Failed to delete'),
  })

  const handleReject = (id: string) => {
    const reason = prompt('Rejection reason:')
    if (reason) rejectMutation.mutate({ id, reason })
  }

  const listings = data?.data || []
  const meta = data?.meta

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Property Management</h1>
        <p className="text-gray-500 mt-1">Review, approve, and manage property listings</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-0 w-full sm:min-w-[200px] sm:w-auto">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input className="pl-9" placeholder="Search properties..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            </div>
            <Select value={status} onValueChange={v => { setStatus(v ?? 'all'); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={country} onValueChange={v => { setCountry(v ?? 'all'); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="Country" /></SelectTrigger>
              <SelectContent>
                {COUNTRY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c === 'all' ? 'All Countries' : c === 'LK' ? 'Sri Lanka' : 'Canada'}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={propertyType} onValueChange={v => { setPropertyType(v ?? 'all'); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No properties found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Featured</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listings.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">{l.title}</TableCell>
                      <TableCell><Badge variant="outline">{l.propertyType}</Badge></TableCell>
                      <TableCell className="text-sm text-gray-500">{[l.city, l.district].filter(Boolean).join(', ') || '-'}</TableCell>
                      <TableCell className="font-medium">{l.countryCode === 'CA' ? 'CAD' : 'Rs.'} {l.priceLkr?.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={l.status === 'approved' ? 'default' : l.status === 'pending' ? 'secondary' : l.status === 'rejected' ? 'destructive' : 'outline'}>
                          {l.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <button onClick={() => featureMutation.mutate(l.id)} className="text-yellow-500 hover:text-yellow-600">
                          <FiStar className={l.isFeatured ? 'fill-current' : ''} />
                        </button>
                      </TableCell>
                      <TableCell>{l.views}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {l.status === 'pending' && (
                            <>
                              <Button size="sm" variant="outline" className="text-green-600" onClick={() => approveMutation.mutate(l.id)}><FiCheck /></Button>
                              <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleReject(l.id)}><FiX /></Button>
                            </>
                          )}
                          <Link href={`/admin/marketplace/properties/${l.id}`}>
                            <Button size="sm" variant="outline"><FiEye /></Button>
                          </Link>
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => setConfirmDeleteId(l.id)}><FiTrash2 /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <p className="text-sm text-gray-500">Page {meta.page} of {meta.totalPages} ({meta.total} total)</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage(p => p - 1)}><FiChevronLeft /></Button>
                <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setPage(p => p + 1)}><FiChevronRight /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null) }}
        title="Delete Property"
        description="Are you sure you want to delete this property? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDeleteId) { deleteMutation.mutate(confirmDeleteId); setConfirmDeleteId(null) } }}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
