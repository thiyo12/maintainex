'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiShield, FiAlertCircle, FiRefreshCw, FiCopy } from 'react-icons/fi'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { PERMISSION } from '@/lib/permissions'
import { PermissionGate } from '@/components/admin/PermissionGate'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface Admin {
  id: string
  email: string
  role: string
  firstName: string
  lastName: string
  totpEnabled: boolean
  assignedCountries: string[]
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

const adminSchema = z.object({
  email: z.string().email('Valid email is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.string().min(1),
  assignedCountries: z.string().optional(),
})

type AdminForm = z.infer<typeof adminSchema>

const ROLE_HIERARCHY: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MODERATOR: 'Moderator',
  SUPPORT: 'Support',
}

const roleBadgeClass: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-800',
  ADMIN: 'bg-blue-100 text-blue-800',
  MODERATOR: 'bg-yellow-100 text-yellow-800',
  SUPPORT: 'bg-gray-100 text-gray-800',
}

export default function MarketplaceAdminUsers() {
  const adminUser = useAuthStore((s) => s.adminUser)
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Admin | null>(null)
  const [tempPassword, setTempPassword] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const isSuperAdmin = adminUser?.role === 'SUPER_ADMIN'

  const form = useForm<AdminForm>({
    resolver: zodResolver(adminSchema),
    defaultValues: { email: '', firstName: '', lastName: '', role: 'MODERATOR', assignedCountries: '' },
  })

  const { data: admins, isLoading, error, refetch } = useQuery<Admin[]>({
    queryKey: ['admin-marketplace-admin-users'],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/admin-users')
      const body = res.data
      if (body.error) throw new Error(body.error)
      return body.data
    },
    enabled: isSuperAdmin,
  })

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; form: AdminForm }) => {
      const payload = {
        ...data.form,
        assignedCountries: data.form.assignedCountries
          ? data.form.assignedCountries.split(',').map((c) => c.trim()).filter(Boolean)
          : [],
      }
      if (data.id) {
        const res = await api.patch(`/api/admin/marketplace/admin-users/${data.id}`, payload)
        return res.data
      } else {
        const res = await api.post('/api/admin/marketplace/admin-users', payload)
        return res.data
      }
    },
    onSuccess: (result, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-admin-users'] })
      toast.success(vars.id ? 'Admin updated' : 'Admin created')

      if (!vars.id && result.data?.tempPassword) {
        setTempPassword(result.data.tempPassword)
        form.reset({ email: '', firstName: '', lastName: '', role: 'MODERATOR', assignedCountries: '' })
        setEditing(null)
      } else {
        setDialogOpen(false)
        setEditing(null)
        form.reset()
        setTempPassword('')
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to save admin')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/admin/marketplace/admin-users/${id}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-admin-users'] })
      toast.success('Admin deleted')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to delete admin')
    },
  })

  const openEdit = (admin: Admin) => {
    form.reset({
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
      assignedCountries: (admin.assignedCountries || []).join(', '),
    })
    setEditing(admin)
    setTempPassword('')
    setDialogOpen(true)
  }

  const openCreate = () => {
    form.reset({ email: '', firstName: '', lastName: '', role: 'MODERATOR', assignedCountries: '' })
    setEditing(null)
    setTempPassword('')
    setDialogOpen(true)
  }

  const onSubmit = (data: AdminForm) => {
    saveMutation.mutate({ id: editing?.id, form: data })
  }

  const copyPassword = () => {
    navigator.clipboard.writeText(tempPassword)
    toast.success('Password copied')
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <FiShield className="w-12 h-12 text-red-500" />
          <p className="text-gray-600">This page is restricted to SUPER_ADMIN role only.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>{['Name', 'Email', 'Role', '2FA', 'Countries', 'Status', 'Last Login'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
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
          <p className="text-gray-600">{error instanceof Error ? error.message : 'Failed to load admins'}</p>
          <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => refetch()}><FiRefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
        <Button onClick={openCreate}><FiPlus className="mr-2 h-4 w-4" /> Add Admin</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {admins && admins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FiShield className="w-12 h-12 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900">No admin users</h3>
              <p className="text-gray-500">Create your first admin to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>2FA</TableHead>
                  <TableHead>Countries</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins?.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.firstName} {admin.lastName}</TableCell>
                    <TableCell className="text-gray-600">{admin.email}</TableCell>
                    <TableCell>
                      <Badge className={roleBadgeClass[admin.role] || 'bg-gray-100 text-gray-800'}>
                        {ROLE_HIERARCHY[admin.role] || admin.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={admin.totpEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {admin.totpEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">{(admin.assignedCountries || []).join(', ') || '\u2014'}</TableCell>
                    <TableCell>
                      <Badge className={admin.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {admin.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell>
        <div className="flex gap-2 flex-wrap">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(admin)}>
                          <FiEdit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setConfirmDeleteId(admin.id)}>
                          <FiTrash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setTempPassword('') }}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'New'} Admin</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">First Name</label>
                <Input {...form.register('firstName')} placeholder="John" />
                {form.formState.errors.firstName && <p className="text-xs text-red-500">{form.formState.errors.firstName.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Last Name</label>
                <Input {...form.register('lastName')} placeholder="Doe" />
                {form.formState.errors.lastName && <p className="text-xs text-red-500">{form.formState.errors.lastName.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Email</label>
                <Input {...form.register('email')} type="email" placeholder="admin@example.com" disabled={!!editing} />
                {form.formState.errors.email && <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Role</label>
                <Select value={form.watch('role') ?? null} onValueChange={(v) => { if (v) form.setValue('role', v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MODERATOR">Moderator</SelectItem>
                    <SelectItem value="SUPPORT">Support</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-medium text-gray-500">Assigned Countries (comma-separated)</label>
                <Input {...form.register('assignedCountries')} placeholder="US, GB, CA" />
              </div>
            </div>

            {tempPassword && (
              <div className="rounded border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-sm font-medium text-yellow-800">Temporary Password</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 text-sm text-yellow-900 font-mono">{tempPassword}</code>
                  <Button variant="ghost" size="sm" onClick={copyPassword}>
                    <FiCopy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="mt-1 text-xs text-yellow-700">
                  Share this securely with the new admin. They will be prompted to change it on first login.
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setTempPassword('') }}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null) }}
        title="Delete Admin"
        description="Are you sure you want to delete this admin user? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDeleteId) { deleteMutation.mutate(confirmDeleteId); setConfirmDeleteId(null) } }}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
