'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiGrid, FiAlertCircle, FiRefreshCw } from 'react-icons/fi'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { can, PERMISSION } from '@/lib/permissions'
import { PermissionGate } from '@/components/admin/PermissionGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface Category {
  id: string
  name: string
  iconName: string
  colorHex: string
  sortOrder: number
  isActive: boolean
  countries: string[]
}

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  iconName: z.string().optional(),
  colorHex: z.string().optional(),
  sortOrder: z.coerce.number().int(),
  countries: z.string().optional(),
})

type CategoryForm = z.infer<typeof categorySchema>

export default function MarketplaceCategories() {
  const adminUser = useAuthStore((s) => s.adminUser)
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)

  const canEdit = adminUser ? can(adminUser.role, PERMISSION.manageCategories) : false

  const form = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', iconName: '', colorHex: '#6366f1', sortOrder: 0, countries: '' },
  })

  const { data: categories, isLoading, error, refetch } = useQuery<Category[]>({
    queryKey: ['admin-marketplace-categories'],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/categories')
      const body = res.data
      if (body.error) throw new Error(body.error)
      return body.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; form: CategoryForm }) => {
      const payload = {
        ...data.form,
        countries: data.form.countries ? data.form.countries.split(',').map((c) => c.trim()).filter(Boolean) : [],
      }
      if (data.id) {
        const res = await api.patch(`/api/admin/marketplace/categories/${data.id}`, payload)
        return res.data
      } else {
        const res = await api.post('/api/admin/marketplace/categories', payload)
        return res.data
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-categories'] })
      toast.success(vars.id ? 'Category updated' : 'Category created')
      setDialogOpen(false)
      setEditing(null)
      form.reset()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to save category')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/admin/marketplace/categories/${id}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-categories'] })
      toast.success('Category deleted')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to delete category')
    },
  })

  const openEdit = (cat: Category) => {
    form.reset({
      name: cat.name,
      iconName: cat.iconName,
      colorHex: cat.colorHex,
      sortOrder: cat.sortOrder,
      countries: (cat.countries || []).join(', '),
    })
    setEditing(cat)
    setDialogOpen(true)
  }

  const openCreate = () => {
    form.reset({ name: '', iconName: '', colorHex: '#6366f1', sortOrder: 0, countries: '' })
    setEditing(null)
    setDialogOpen(true)
  }

  const onSubmit = (data: CategoryForm) => {
    saveMutation.mutate({ id: editing?.id, form: data })
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
          <div><h1 className="text-2xl font-bold text-gray-900">Categories</h1><p className="text-gray-500">Loading categories...</p></div>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>{['', 'Name', 'Icon', 'Color', 'Order', 'Status', 'Countries'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}
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
          <p className="text-gray-600">{error instanceof Error ? error.message : 'Failed to load categories'}</p>
          <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-500">Manage job categories</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}><FiRefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          <PermissionGate roles={PERMISSION.manageCategories}>
            <Button onClick={openCreate}><FiPlus className="mr-2 h-4 w-4" /> Add Category</Button>
          </PermissionGate>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {categories && categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FiGrid className="w-12 h-12 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900">No categories found</h3>
              <p className="text-gray-500">Create your first category to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Name</TableHead>
                  <TableHead>Icon</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Countries</TableHead>
                  <PermissionGate roles={PERMISSION.manageCategories}>
                    <TableHead className="w-20" />
                  </PermissionGate>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories?.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell><FiGrid className="w-4 h-4 text-gray-300" /></TableCell>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-gray-600 font-mono">{cat.iconName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border" style={{ backgroundColor: cat.colorHex }} />
                        <span className="text-xs text-gray-500">{cat.colorHex}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{cat.sortOrder}</TableCell>
                    <TableCell>
                      <Badge className={cat.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">{(cat.countries || []).join(', ') || '\u2014'}</TableCell>
                    <PermissionGate roles={PERMISSION.manageCategories}>
                      <TableCell>
        <div className="flex gap-2 flex-wrap">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                            <FiEdit2 className="w-4 h-4" />
                          </Button>
                          {cat.isActive && (
                            <Button variant="ghost" size="icon" onClick={() => {
                              if (confirm(`Delete "${cat.name}"?`)) deleteMutation.mutate(cat.id)
                            }}>
                              <FiTrash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </PermissionGate>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'New'} Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Name</label>
                <Input {...form.register('name')} placeholder="Category name" />
                {form.formState.errors.name && <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Icon Name</label>
                <Input {...form.register('iconName')} placeholder="icon-name" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Color</label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    className="w-10 h-10 p-1 cursor-pointer"
                    {...form.register('colorHex')}
                  />
                  <Input {...form.register('colorHex')} placeholder="#6366f1" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Sort Order</label>
                <Input type="number" {...form.register('sortOrder')} />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-medium text-gray-500">Countries (comma-separated)</label>
                <Input {...form.register('countries')} placeholder="US, GB, CA" />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
