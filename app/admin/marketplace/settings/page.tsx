'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { FiShield, FiAlertCircle, FiRefreshCw } from 'react-icons/fi'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'
import { can, PERMISSION } from '@/lib/permissions'
import { formatMoney, dollarsToCents, formatBps } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

interface PlatformSettings {
  platformFeeBps: number
  minJobAmountCents: number
  maxJobAmountCents: number
  escrowReleaseDays: number
  supportEmail: string
  updatedAt: string
}

const settingsSchema = z.object({
  platformFeePercent: z.string().min(1, 'Fee is required'),
  minJobAmount: z.string().min(1, 'Min amount is required'),
  maxJobAmount: z.string().min(1, 'Max amount is required'),
  escrowReleaseDays: z.string().min(1, 'Release days is required'),
  supportEmail: z.string().email('Valid email is required'),
})

type SettingsForm = z.infer<typeof settingsSchema>

export default function MarketplaceSettings() {
  const adminUser = useAuthStore((s) => s.adminUser)
  const queryClient = useQueryClient()

  const isSuperAdmin = adminUser?.role === 'SUPER_ADMIN'

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      platformFeePercent: '',
      minJobAmount: '',
      maxJobAmount: '',
      escrowReleaseDays: '',
      supportEmail: '',
    },
  })

  const { data: settings, isLoading, error, refetch } = useQuery<PlatformSettings>({
    queryKey: ['admin-marketplace-settings'],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/settings')
      const body = res.data
      if (body.error) throw new Error(body.error)
      return body.data
    },
    enabled: isSuperAdmin,
  })

  useEffect(() => {
    if (settings) {
      form.reset({
        platformFeePercent: (settings.platformFeeBps / 100).toFixed(2),
        minJobAmount: (Number(settings.minJobAmountCents) / 100).toFixed(2),
        maxJobAmount: (Number(settings.maxJobAmountCents) / 100).toFixed(2),
        escrowReleaseDays: String(settings.escrowReleaseDays || 14),
        supportEmail: settings.supportEmail || '',
      })
    }
  }, [settings, form])

  const saveMutation = useMutation({
    mutationFn: async (data: SettingsForm) => {
      const payload = {
        platformFeeBps: Math.round(parseFloat(data.platformFeePercent) * 100),
        minJobAmountCents: dollarsToCents(data.minJobAmount),
        maxJobAmountCents: dollarsToCents(data.maxJobAmount),
        escrowReleaseDays: parseInt(data.escrowReleaseDays) || 14,
        supportEmail: data.supportEmail,
      }
      const res = await api.patch('/api/admin/marketplace/settings', payload)
      return res.data
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-settings'] })
      toast.success('Settings saved successfully')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to save settings')
    },
  })

  const onSubmit = (data: SettingsForm) => {
    saveMutation.mutate(data)
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
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <FiAlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-gray-600">{error instanceof Error ? error.message : 'Failed to load settings'}</p>
          <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    )
  }

  const feeValue = parseFloat(form.watch('platformFeePercent') || '0')
  const displayBps = formatBps(Math.round(feeValue * 100))

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-end flex-wrap gap-2">
        <Button variant="outline" onClick={() => refetch()}><FiRefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Fee Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Platform Fee (%)</label>
                <Input
                  {...form.register('platformFeePercent')}
                  placeholder="5.00"
                />
                {form.formState.errors.platformFeePercent ? (
                  <p className="text-xs text-red-500">{form.formState.errors.platformFeePercent.message}</p>
                ) : (
                  <p className="text-xs text-gray-500">{displayBps}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Escrow Release (days)</label>
                <Input
                  type="number"
                  {...form.register('escrowReleaseDays')}
                />
                {form.formState.errors.escrowReleaseDays && <p className="text-xs text-red-500">{form.formState.errors.escrowReleaseDays.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Min Job Amount ($)</label>
                <Input
                  {...form.register('minJobAmount')}
                  placeholder="5.00"
                />
                {form.formState.errors.minJobAmount && <p className="text-xs text-red-500">{form.formState.errors.minJobAmount.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Max Job Amount ($)</label>
                <Input
                  {...form.register('maxJobAmount')}
                  placeholder="10000.00"
                />
                {form.formState.errors.maxJobAmount && <p className="text-xs text-red-500">{form.formState.errors.maxJobAmount.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">Support Email</label>
              <Input
                {...form.register('supportEmail')}
                placeholder="support@maintainex.com"
              />
              {form.formState.errors.supportEmail && <p className="text-xs text-red-500">{form.formState.errors.supportEmail.message}</p>}
            </div>
          </CardContent>
        </Card>

        {settings && (
          <Card>
            <CardHeader><CardTitle>Current Values</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Fee:</span> <span className="font-medium">{formatBps(settings.platformFeeBps)}</span></div>
                <div><span className="text-gray-500">Release Days:</span> <span className="font-medium">{settings.escrowReleaseDays}</span></div>
                <div><span className="text-gray-500">Min Amount:</span> <span className="font-medium">{formatMoney(Number(settings.minJobAmountCents))}</span></div>
                <div><span className="text-gray-500">Max Amount:</span> <span className="font-medium">{formatMoney(Number(settings.maxJobAmountCents))}</span></div>
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Last updated: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : 'Never'}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  )
}
