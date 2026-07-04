'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  FiPlus, FiEdit2, FiTrash2, FiTag, FiAlertCircle, FiRefreshCw,
  FiSearch, FiChevronLeft, FiChevronRight, FiToggleLeft, FiToggleRight, FiStar,
} from 'react-icons/fi'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { PERMISSION } from '@/lib/permissions'
import { PermissionGate } from '@/components/admin/PermissionGate'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface OfferTemplate {
  id: string
  categoryId: string
  title: string
  description: string
  priceLkr: number
  scopeNotes: string | null
  isRemote: boolean
  availabilityLabel: string
  isFeatured: boolean
  photoUrl: string | null
  isActive: boolean
  createdAt: string
}

interface Category {
  id: string
  name: string
}

interface PaginatedMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

const offerSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priceLkr: z.coerce.number().min(1, 'Price is required'),
  scopeNotes: z.string().optional(),
  isRemote: z.boolean(),
  availabilityLabel: z.string().min(1, 'Availability is required'),
  isFeatured: z.boolean(),
  photoUrl: z.string().optional(),
})

type OfferForm = z.infer<typeof offerSchema>

export default function MarketplaceOffers() {
  const adminUser = useAuthStore((s) => s.adminUser)
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<OfferTemplate | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const form = useForm<OfferForm>({
    resolver: zodResolver(offerSchema),
    defaultValues: {
      categoryId: '',
      title: '',
      description: '',
      priceLkr: 0,
      scopeNotes: '',
      isRemote: false,
      availabilityLabel: 'Today',
      isFeatured: false,
      photoUrl: '',
    },
  })

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['admin-marketplace-categories-list'],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/categories')
      const body = res.data
      if (body.error) throw new Error(body.error)
      return body.data
    },
  })

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-marketplace-offers', search, page],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/offers', {
        params: { search, page, limit: 20 },
      })
      const body = res.data
      if (body.error) throw new Error(body.error)
      return { offers: body.data as OfferTemplate[], meta: body.pagination as PaginatedMeta }
    },
  })

  const offers = data?.offers || []
  const meta = data?.meta || { total: 0, page: 1, limit: 20, totalPages: 0 }

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; form: OfferForm }) => {
      const payload = { ...data.form }
      if (data.id) {
        const res = await api.patch('/api/admin/marketplace/offers', { id: data.id, ...payload })
        return res.data
      } else {
        const res = await api.post('/api/admin/marketplace/offers', payload)
        return res.data
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-offers'] })
      toast.success(vars.id ? 'Offer updated' : 'Offer created')
      setDialogOpen(false)
      setEditing(null)
      form.reset()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to save offer')
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async (offer: OfferTemplate) => {
      const res = await api.patch('/api/admin/marketplace/offers', {
        id: offer.id,
        isActive: !offer.isActive,
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-offers'] })
      toast.success('Offer status updated')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update offer')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete('/api/admin/marketplace/offers', { params: { id } })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-offers'] })
      toast.success('Offer deleted')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to delete offer')
    },
  })

  const openEdit = (offer: OfferTemplate) => {
    form.reset({
      categoryId: offer.categoryId,
      title: offer.title,
      description: offer.description || '',
      priceLkr: offer.priceLkr,
      scopeNotes: offer.scopeNotes || '',
      isRemote: offer.isRemote,
      availabilityLabel: offer.availabilityLabel || 'Today',
      isFeatured: offer.isFeatured,
      photoUrl: offer.photoUrl || '',
    })
    setEditing(offer)
    setDialogOpen(true)
  }

  const openCreate = () => {
    form.reset({
      categoryId: '',
      title: '',
      description: '',
      priceLkr: 0,
      scopeNotes: '',
      isRemote: false,
      availabilityLabel: 'Today',
      isFeatured: false,
      photoUrl: '',
    })
    setEditing(null)
    setDialogOpen(true)
  }

  const onSubmit = (data: OfferForm) => {
    saveMutation.mutate({ id: editing?.id, form: data })
  }

  const getCategoryName = (id: string) => {
    return categories?.find((c) => c.id === id)?.name || '\u2014'
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>{['Title', 'Category', 'Price (LKR)', 'Active', 'Featured', 'Actions'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
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
          <p className="text-gray-600">{error instanceof Error ? error.message : 'Failed to load offers'}</p>
          <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => refetch()}><FiRefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
        <PermissionGate roles={PERMISSION.manageCategories}>
          <Button onClick={openCreate} className="bg-amber-500 hover:bg-amber-600 text-white"><FiPlus className="mr-2 h-4 w-4" /> Add Offer</Button>
        </PermissionGate>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <div className="relative max-w-sm">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search offers..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
          </div>
          {offers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FiTag className="w-12 h-12 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900">No offers found</h3>
              <p className="text-gray-500">{search ? 'Try adjusting your search' : 'Create your first offer to get started'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price (LKR)</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Featured</TableHead>
                    <PermissionGate roles={PERMISSION.manageCategories}>
                      <TableHead className="w-24" />
                    </PermissionGate>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offers.map((offer) => (
                    <TableRow key={offer.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">{offer.title}</TableCell>
                      <TableCell className="text-gray-600">{getCategoryName(offer.categoryId)}</TableCell>
                      <TableCell className="text-gray-600 font-mono">LKR {offer.priceLkr.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={offer.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {offer.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {offer.isFeatured ? (
                          <FiStar className="w-4 h-4 text-amber-500 fill-amber-500" />
                        ) : (
                          <span className="text-gray-300">\u2014</span>
                        )}
                      </TableCell>
                      <PermissionGate roles={PERMISSION.manageCategories}>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => toggleActiveMutation.mutate(offer)} title={offer.isActive ? 'Deactivate' : 'Activate'}>
                              {offer.isActive ? <FiToggleRight className="w-5 h-5 text-green-500" /> : <FiToggleLeft className="w-5 h-5 text-gray-400" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(offer)}>
                              <FiEdit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setConfirmDeleteId(offer.id)}>
                              <FiTrash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </PermissionGate>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {meta.totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-gray-500">Page {meta.page} of {meta.totalPages} ({meta.total} total)</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage((p) => p - 1)}>
                      <FiChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                      <FiChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'New'} Offer</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Category *</label>
                <Select value={form.watch('categoryId') ?? ''} onValueChange={(v) => { if (v) form.setValue('categoryId', v) }}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.categoryId && <p className="text-xs text-red-500">{form.formState.errors.categoryId.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Title *</label>
                <Input {...form.register('title')} placeholder="Offer title" />
                {form.formState.errors.title && <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Price (LKR) *</label>
                <Input type="number" {...form.register('priceLkr')} placeholder="0" />
                {form.formState.errors.priceLkr && <p className="text-xs text-red-500">{form.formState.errors.priceLkr.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Availability</label>
                <Select value={form.watch('availabilityLabel') ?? ''} onValueChange={(v) => { if (v) form.setValue('availabilityLabel', v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Today">Today</SelectItem>
                    <SelectItem value="This Week">This Week</SelectItem>
                    <SelectItem value="Flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-medium text-gray-500">Description</label>
                <textarea
                  {...form.register('description')}
                  rows={3}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Describe the offer..."
                />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-medium text-gray-500">Scope Notes</label>
                <Input {...form.register('scopeNotes')} placeholder="What's included/excluded" />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-medium text-gray-500">Photo URL</label>
                <Input {...form.register('photoUrl')} placeholder="https://..." />
              </div>
              <div className="flex items-center gap-6 col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.watch('isRemote')}
                    onChange={(e) => form.setValue('isRemote', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Remote</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.watch('isFeatured')}
                    onChange={(e) => form.setValue('isFeatured', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Featured</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-amber-500 hover:bg-amber-600 text-white">
                {saveMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null) }}
        title="Delete Offer"
        description={`Are you sure you want to delete "${confirmDeleteId ? offers.find((o) => o.id === confirmDeleteId)?.title || '' : ''}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDeleteId) { deleteMutation.mutate(confirmDeleteId); setConfirmDeleteId(null) } }}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
