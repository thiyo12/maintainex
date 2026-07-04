'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FiArrowLeft, FiCheck, FiX, FiStar, FiTrash2, FiExternalLink } from 'react-icons/fi'
import api from '@/lib/api'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import toast from 'react-hot-toast'

export default function AdminPropertyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const id = params.id as string
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-property', id],
    queryFn: async () => {
      const res = await api.get(`/api/admin/properties/${id}`)
      return res.data.data as any
    },
    enabled: !!id,
  })

  const approveMutation = useMutation({
    mutationFn: async () => { await api.post(`/api/admin/properties/${id}/approve`) },
    onSuccess: () => { toast.success('Property approved'); queryClient.invalidateQueries({ queryKey: ['admin-property', id] }); queryClient.invalidateQueries({ queryKey: ['admin-properties'] }) },
    onError: () => toast.error('Failed to approve'),
  })

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => { await api.post(`/api/admin/properties/${id}/reject`, { reason }) },
    onSuccess: () => { toast.success('Property rejected'); queryClient.invalidateQueries({ queryKey: ['admin-property', id] }); queryClient.invalidateQueries({ queryKey: ['admin-properties'] }) },
    onError: () => toast.error('Failed to reject'),
  })

  const featureMutation = useMutation({
    mutationFn: async () => { await api.post(`/api/admin/properties/${id}/feature`) },
    onSuccess: () => { toast.success('Featured toggled'); queryClient.invalidateQueries({ queryKey: ['admin-property', id] }); queryClient.invalidateQueries({ queryKey: ['admin-properties'] }) },
    onError: () => toast.error('Failed to toggle feature'),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => { await api.delete(`/api/admin/properties/${id}`) },
    onSuccess: () => { toast.success('Property deleted'); router.push('/admin/marketplace/properties') },
    onError: () => toast.error('Failed to delete'),
  })

  const handleReject = () => {
    const reason = prompt('Rejection reason:')
    if (reason) rejectMutation.mutate(reason)
  }

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
  if (!data) return <div className="text-center py-12 text-gray-400">Property not found</div>

  const p = data

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}><FiArrowLeft /></Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{p.title}</h1>
          <p className="text-gray-500">{p.propertyType} • {p.purpose} • {p.countryCode}</p>
        </div>
      </div>

      {/* Status Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <Badge variant={p.status === 'approved' ? 'default' : p.status === 'pending' ? 'secondary' : 'destructive'}>{p.status}</Badge>
            {p.isFeatured && <Badge className="bg-yellow-100 text-yellow-800">Featured</Badge>}
            {p.boostTier && <Badge className="bg-blue-100 text-blue-800">{p.boostTier}</Badge>}
            <div className="flex-1" />
            {p.status === 'pending' && (
              <>
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => approveMutation.mutate()}><FiCheck className="mr-1" /> Approve</Button>
                <Button size="sm" variant="destructive" onClick={handleReject}><FiX className="mr-1" /> Reject</Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={() => featureMutation.mutate()}>
              <FiStar className={`mr-1 ${p.isFeatured ? 'fill-current' : ''}`} /> {p.isFeatured ? 'Unfeature' : 'Feature'}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}><FiTrash2 /></Button>
          </div>
          {p.rejectionReason && (
            <div className="mt-3 p-3 bg-red-50 rounded-lg text-sm text-red-700">
              <strong>Rejection reason:</strong> {p.rejectionReason}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Property Details */}
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-gray-500">Price</span><span className="font-bold">{p.countryCode === 'CA' ? 'CAD' : 'Rs.'} {p.priceLkr?.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span>{p.propertyType}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Purpose</span><span>{p.purpose}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Country</span><span>{p.countryCode === 'LK' ? 'Sri Lanka' : 'Canada'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">District</span><span>{p.district || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">City</span><span>{p.city || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Area</span><span>{p.area || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Address</span><span>{p.address || '-'}</span></div>
          </CardContent>
        </Card>

        {/* Specs */}
        <Card>
          <CardHeader><CardTitle>Specifications</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-gray-500">Bedrooms</span><span>{p.bedrooms || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Bathrooms</span><span>{p.bathrooms || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Parking</span><span>{p.parking || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Area (sqft)</span><span>{p.areaSqft || p.propertySize || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Land Size</span><span>{p.landSize || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Year Built</span><span>{p.yearBuilt || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Furnished</span><span>{p.isFurnished ? 'Yes' : 'No'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">New/Used</span><span>{p.isNewProperty ? 'New' : 'Used'}</span></div>
          </CardContent>
        </Card>

        {/* Seller Info */}
        <Card>
          <CardHeader><CardTitle>Seller</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-gray-500">Name</span><span>{p.contactName || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Phone</span><span>{p.contactPhone || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Posted By</span><span className="text-xs">{p.postedBy}</span></div>
          </CardContent>
        </Card>

        {/* Analytics */}
        <Card>
          <CardHeader><CardTitle>Analytics</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-gray-500">Views</span><span className="font-bold">{p.views}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Saves</span><span>{p.saves}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Inquiries</span><span>{p.inquiries}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Created</span><span>{new Date(p.createdAt).toLocaleDateString()}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {p.description && (
        <Card>
          <CardHeader><CardTitle>Description</CardTitle></CardHeader>
          <CardContent><p className="text-gray-600 whitespace-pre-wrap">{p.description}</p></CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete Property"
        description="Are you sure you want to delete this property? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { deleteMutation.mutate(); setConfirmDelete(false) }}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
