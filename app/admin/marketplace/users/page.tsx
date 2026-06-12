'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiSearch, FiChevronLeft, FiChevronRight, FiEye, FiAlertCircle, FiUsers, FiRefreshCw } from 'react-icons/fi'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { can, PERMISSION } from '@/lib/permissions'
import { PermissionGate } from '@/components/admin/PermissionGate'
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

interface User {
  id: string
  name: string | null
  email: string
  role: string
  identityStatus: string
  isActive: boolean
  isBanned: boolean
  country: string | null
  createdAt: string
}

interface PaginatedMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function MarketplaceUsers() {
  const adminUser = useAuthStore((s) => s.adminUser)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [kycFilter, setKycFilter] = useState('')
  const [page, setPage] = useState(1)

  const canManage = adminUser ? can(adminUser.role, PERMISSION.manageUsers) : false

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-marketplace-users', search, roleFilter, statusFilter, kycFilter, page],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/users', {
        params: { search, role: roleFilter, status: statusFilter, kyc_status: kycFilter, page, limit: 20 },
      })
      const body = res.data
      if (body.error) throw new Error(body.error)
      return { users: body.data as User[], meta: body.meta as PaginatedMeta }
    },
  })

  const users = data?.users || []
  const meta = data?.meta || { total: 0, page: 1, limit: 20, totalPages: 0 }

  const statusBadge = (u: User) => {
    if (u.isBanned) return <Badge variant="destructive">Banned</Badge>
    if (!u.isActive) return <Badge variant="secondary">Suspended</Badge>
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
  }

  const kycBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Verified</Badge>
      case 'PENDING': return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>
      case 'REJECTED': return <Badge variant="destructive">Rejected</Badge>
      default: return <Badge variant="outline">Not Submitted</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-gray-900">Marketplace Users</h1><p className="text-gray-500">Loading users...</p></div>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>{['Name', 'Email', 'Role', 'Country', 'KYC', 'Status', 'Joined'].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>)}
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
          <p className="text-gray-600">{error instanceof Error ? error.message : 'Failed to load users'}</p>
          <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketplace Users</h1>
          <p className="text-gray-500">{meta.total} total users</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}><FiRefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-0 w-full sm:min-w-[200px] sm:w-auto">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v ?? ''); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="All Roles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Roles</SelectItem>
                <SelectItem value="CLIENT">Client</SelectItem>
                <SelectItem value="WORKER">Worker</SelectItem>
                <SelectItem value="BOTH">Both</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? ''); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
            <Select value={kycFilter} onValueChange={(v) => { setKycFilter(v ?? ''); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All KYC" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All KYC</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="NOT_SUBMITTED">Not Submitted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FiUsers className="w-12 h-12 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900">No users found</h3>
              <p className="text-gray-500">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>KYC</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name || '\u2014'}</TableCell>
                      <TableCell className="text-gray-600">{u.email}</TableCell>
                      <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                      <TableCell className="text-gray-600">{u.country || '\u2014'}</TableCell>
                      <TableCell>{kycBadge(u.identityStatus)}</TableCell>
                      <TableCell>{statusBadge(u)}</TableCell>
                      <TableCell className="text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <a href={`/admin/marketplace/users/${u.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex items-center")}><FiEye className="w-4 h-4 mr-1" /> View</a>
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
