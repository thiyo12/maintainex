'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FiBell, FiCheck, FiCheckCircle, FiAlertCircle, FiRefreshCw, FiShield, FiFileText, FiDollarSign, FiStar, FiUser } from 'react-icons/fi'
import api from '@/lib/api'
import { PERMISSION } from '@/lib/permissions'
import { PermissionGate } from '@/components/admin/PermissionGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'

interface AdminNotification {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  createdAt: string
}

const typeIcons: Record<string, any> = {
  kyc_pending: FiShield,
  dispute_raised: FiDollarSign,
  review_pending: FiStar,
  escrow_action: FiDollarSign,
  user_flagged: FiUser,
  job_reported: FiFileText,
}

const typeColors: Record<string, string> = {
  kyc_pending: 'text-yellow-500',
  dispute_raised: 'text-red-500',
  review_pending: 'text-blue-500',
  escrow_action: 'text-green-500',
  user_flagged: 'text-purple-500',
  job_reported: 'text-orange-500',
}

export default function AdminNotifications() {
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/notifications')
      const body = res.data
      if (body.error) throw new Error(body.error)
      return { notifications: body.data as AdminNotification[], unreadCount: body.unreadCount as number }
    },
    refetchInterval: 15000,
  })

  const markAllMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch('/api/admin/marketplace/notifications', { all: true })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] })
      queryClient.invalidateQueries({ queryKey: ['admin-notifications-count'] })
      toast.success('All marked as read')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to mark all as read')
    },
  })

  const notifications = data?.notifications || []

  return (
    <PermissionGate roles={PERMISSION.viewNotifications}>
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <div className="flex gap-2">
          {notifications.some(n => !n.read) && (
            <Button variant="outline" onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}>
              <FiCheckCircle className="mr-2 h-4 w-4" /> Mark All Read
            </Button>
          )}
          <Button variant="outline" onClick={() => refetch()}><FiRefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 flex gap-4 items-start">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <FiAlertCircle className="w-12 h-12 text-red-500" />
              <p className="text-gray-600">Failed to load notifications</p>
              <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FiBell className="w-12 h-12 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900">No notifications</h3>
              <p className="text-gray-500">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const Icon = typeIcons[n.type] || FiBell
                return (
                  <div key={n.id} className={`p-4 flex gap-4 items-start hover:bg-gray-50 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}>
                    <div className={`mt-1 ${typeColors[n.type] || 'text-gray-400'}`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm ${!n.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                        {!n.read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400 whitespace-nowrap">{formatTime(n.createdAt)}</span>
                      {n.link && !n.read && (
                        <Link href={n.link}>
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer">View</Badge>
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </PermissionGate>
  )
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
