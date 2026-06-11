'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiSlash, FiCheckCircle, FiXCircle, FiFileText, FiAlertCircle, FiRefreshCw } from 'react-icons/fi'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { can, PERMISSION } from '@/lib/permissions'
import { PermissionGate } from '@/components/admin/PermissionGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

interface UserDetail {
  id: string
  name: string | null
  email: string
  role: string
  identityStatus: string
  isActive: boolean
  isBanned: boolean
  country: string | null
  bio: string | null
  avatarUrl: string | null
  phone: string | null
  createdAt: string
  identityDocuments: Array<{
    id: string
    documentType: string
    status: string
    frontImageUrl: string | null
    backImageUrl: string | null
    createdAt: string
  }>
}

export default function MarketplaceUserDetail() {
  const params = useParams()
  const router = useRouter()
  const adminUser = useAuthStore((s) => s.adminUser)
  const queryClient = useQueryClient()

  const canAct = adminUser ? can(adminUser.role, PERMISSION.manageUsers) : false

  const { data: user, isLoading, error, refetch } = useQuery<UserDetail>({
    queryKey: ['admin-marketplace-user', params.id],
    queryFn: async () => {
      const res = await api.get(`/api/admin/marketplace/users/${params.id}`)
      const body = res.data
      if (body.error) throw new Error(body.error)
      return body.data
    },
  })

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      const res = await api.patch(`/api/admin/marketplace/users/${params.id}`, { action })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-user', params.id] })
      toast.success('Action performed successfully')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to perform action')
    },
  })

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><Card><CardHeader><Skeleton className="h-5 w-32" /></CardHeader><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card></div>
          <Card><CardHeader><Skeleton className="h-5 w-20" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <FiAlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-gray-600">{error instanceof Error ? error.message : 'Failed to load user'}</p>
          <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center h-64">
        <p className="text-gray-500">User not found</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <FiArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">{user.name || 'Unnamed User'}</h1>
          <Badge variant="outline">{user.role}</Badge>
          {user.isBanned && <Badge variant="destructive">Banned</Badge>}
          {!user.isActive && !user.isBanned && <Badge variant="secondary">Suspended</Badge>}
          {user.isActive && !user.isBanned && <Badge className="bg-green-100 text-green-800">Active</Badge>}
        </div>
        <Button variant="outline" onClick={() => refetch()}><FiRefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500">Email</p>
                  <p className="text-sm text-gray-900 break-all">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Phone</p>
                  <p className="text-sm text-gray-900">{user.phone || '\u2014'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Country</p>
                  <p className="text-sm text-gray-900">{user.country || '\u2014'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Joined</p>
                  <p className="text-sm text-gray-900">{new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              {user.bio && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Bio</p>
                  <p className="text-sm text-gray-700">{user.bio}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <PermissionGate roles={PERMISSION.manageUsers}>
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {user.isActive && !user.isBanned && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => actionMutation.mutate('suspend')}
                  disabled={actionMutation.isPending}
                >
                  <FiXCircle className="w-4 h-4 mr-2" /> Suspend Account
                </Button>
              )}
              {!user.isActive && !user.isBanned && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => actionMutation.mutate('unsuspend')}
                  disabled={actionMutation.isPending}
                >
                  <FiCheckCircle className="w-4 h-4 mr-2" /> Unsuspend Account
                </Button>
              )}
              {!user.isBanned && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => actionMutation.mutate('ban')}
                  disabled={actionMutation.isPending}
                >
                  <FiSlash className="w-4 h-4 mr-2" /> Ban Account
                </Button>
              )}
              {user.isBanned && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => actionMutation.mutate('unban')}
                  disabled={actionMutation.isPending}
                >
                  <FiCheckCircle className="w-4 h-4 mr-2" /> Unban Account
                </Button>
              )}
            </CardContent>
          </Card>
        </PermissionGate>
      </div>

      {user.identityDocuments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Identity Documents</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {user.identityDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <FiFileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.documentType}</p>
                      <p className="text-xs text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Badge className={
                    doc.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    doc.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }>
                    {doc.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
