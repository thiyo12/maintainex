'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { FiShield, FiAlertCircle, FiRefreshCw, FiChevronDown, FiChevronRight, FiEdit2, FiLock, FiSave, FiX } from 'react-icons/fi'
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
  maxActiveJobsPerUser: number
  maxQuotesPerJob: number
  maxDisputesPerJob: number
  autoReleaseAfterDays: number
  supportEmail: string
  updatedAt: string
}

interface AppSettingItem {
  id: string
  key: string
  value: string
  type: string
  label: string
  description: string
  groupName: string
  updatedBy: string | null
  updatedAt: string
}

const GROUP_LABELS: Record<string, string> = {
  matching: 'Matching Algorithm',
  scoring: 'Scoring Weights',
  offer: 'Offer Settings',
  escrow: 'Escrow Configuration',
  reputation: 'Reputation System',
  fraud: 'Fraud Detection',
  notifications: 'Notifications',
  general: 'General',
}

const settingsSchema = z.object({
  platformFeePercent: z.string().min(1, 'Fee is required'),
  minJobAmount: z.string().min(1, 'Min amount is required'),
  maxJobAmount: z.string().min(1, 'Max amount is required'),
  escrowReleaseDays: z.string().min(1, 'Release days is required'),
  maxActiveJobsPerUser: z.string().min(1, 'Required'),
  maxQuotesPerJob: z.string().min(1, 'Required'),
  maxDisputesPerJob: z.string().min(1, 'Required'),
  autoReleaseAfterDays: z.string().min(1, 'Required'),
  supportEmail: z.string().email('Valid email is required'),
})

type SettingsForm = z.infer<typeof settingsSchema>

function AppSettingRow({
  setting,
  isSuperAdmin,
  onSave,
  isSaving,
}: {
  setting: AppSettingItem
  isSuperAdmin: boolean
  onSave: (key: string, value: string) => void
  isSaving: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(setting.value)

  const handleSave = () => {
    onSave(setting.key, editValue)
    setEditing(false)
  }

  const handleCancel = () => {
    setEditValue(setting.value)
    setEditing(false)
  }

  return (
    <div
      className={`flex items-center justify-between gap-4 py-3 px-4 rounded-lg border transition-colors ${
        isSuperAdmin
          ? 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/30'
          : 'border-gray-100 bg-gray-50 opacity-60'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 truncate">{setting.label || setting.key}</span>
          {!isSuperAdmin && <FiLock className="w-3 h-3 text-gray-400 flex-shrink-0" />}
        </div>
        {setting.description && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{setting.description}</p>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8 w-48 text-sm border-amber-300 focus:ring-amber-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-8 px-2 bg-amber-500 hover:bg-amber-600 text-white"
          >
            <FiSave className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            className="h-8 px-2"
          >
            <FiX className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
            {setting.value}
          </span>
          {isSuperAdmin && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              className="h-8 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
            >
              <FiEdit2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function AppSettingGroup({
  groupName,
  settings,
  isSuperAdmin,
  onSave,
  isSaving,
  defaultOpen,
}: {
  groupName: string
  settings: AppSettingItem[]
  isSuperAdmin: boolean
  onSave: (key: string, value: string) => void
  isSaving: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? true)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-50 to-white hover:from-amber-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">
            {GROUP_LABELS[groupName] || groupName}
          </span>
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
            {settings.length}
          </span>
        </div>
        {open ? (
          <FiChevronDown className="w-4 h-4 text-amber-600" />
        ) : (
          <FiChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {open && (
        <div className="divide-y divide-gray-100">
          {settings.map((s) => (
            <AppSettingRow
              key={s.key}
              setting={s}
              isSuperAdmin={isSuperAdmin}
              onSave={onSave}
              isSaving={isSaving}
            />
          ))}
        </div>
      )}
    </div>
  )
}

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

  const { data: appSettings, isLoading: isLoadingAppSettings } = useQuery<Record<string, AppSettingItem[]>>({
    queryKey: ['admin-app-settings'],
    queryFn: async () => {
      const res = await api.get('/api/admin/marketplace/app-settings')
      const body = res.data
      if (body.error) throw new Error(body.error)
      return body.data
    },
  })

  const updateAppSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await api.patch('/api/admin/marketplace/app-settings', { key, value })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-app-settings'] })
      toast.success('Setting updated. Takes effect within 60 seconds.')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update setting')
    },
  })

  useEffect(() => {
    if (settings) {
      form.reset({
        platformFeePercent: (settings.platformFeeBps / 100).toFixed(2),
        minJobAmount: (Number(settings.minJobAmountCents) / 100).toFixed(2),
        maxJobAmount: (Number(settings.maxJobAmountCents) / 100).toFixed(2),
        escrowReleaseDays: String(settings.escrowReleaseDays || 14),
        maxActiveJobsPerUser: String(settings.maxActiveJobsPerUser || 10),
        maxQuotesPerJob: String(settings.maxQuotesPerJob || 10),
        maxDisputesPerJob: String(settings.maxDisputesPerJob || 1),
        autoReleaseAfterDays: String(settings.autoReleaseAfterDays || 14),
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
        maxActiveJobsPerUser: parseInt(data.maxActiveJobsPerUser) || 10,
        maxQuotesPerJob: parseInt(data.maxQuotesPerJob) || 10,
        maxDisputesPerJob: parseInt(data.maxDisputesPerJob) || 1,
        autoReleaseAfterDays: parseInt(data.autoReleaseAfterDays) || 14,
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

  const appSettingGroups = appSettings ? Object.entries(appSettings) : []
  const sortedGroups = appSettingGroups.sort(([a], [b]) => {
    const order = ['matching', 'scoring', 'offer', 'escrow', 'reputation', 'fraud', 'notifications', 'general']
    return order.indexOf(a) - order.indexOf(b)
  })

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-end flex-wrap gap-2">
        <Button variant="outline" onClick={() => refetch()}><FiRefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      {/* Algorithm Settings Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900">Algorithm Settings</h2>
          <span className="text-xs text-gray-400">AppSetting</span>
        </div>
        <p className="text-sm text-gray-500">
          Fine-tune matching, scoring, and platform behavior. Changes take effect within 60 seconds.
        </p>

        {isLoadingAppSettings ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : sortedGroups.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-gray-400">
              No algorithm settings configured yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedGroups.map(([groupName, items], idx) => (
              <AppSettingGroup
                key={groupName}
                groupName={groupName}
                settings={items}
                isSuperAdmin={isSuperAdmin}
                onSave={(key, value) => updateAppSettingMutation.mutate({ key, value })}
                isSaving={updateAppSettingMutation.isPending}
                defaultOpen={idx < 3}
              />
            ))}
          </div>
        )}
      </div>

      {/* Platform Settings Section (existing) */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900">Platform Settings</h2>
          </div>
        </div>

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

        <Card>
          <CardHeader><CardTitle>Platform Limits</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Max Active Jobs / User</label>
                <Input type="number" {...form.register('maxActiveJobsPerUser')} />
                {form.formState.errors.maxActiveJobsPerUser && <p className="text-xs text-red-500">{form.formState.errors.maxActiveJobsPerUser.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Max Quotes / Job</label>
                <Input type="number" {...form.register('maxQuotesPerJob')} />
                {form.formState.errors.maxQuotesPerJob && <p className="text-xs text-red-500">{form.formState.errors.maxQuotesPerJob.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Max Disputes / Job</label>
                <Input type="number" {...form.register('maxDisputesPerJob')} />
                {form.formState.errors.maxDisputesPerJob && <p className="text-xs text-red-500">{form.formState.errors.maxDisputesPerJob.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Auto-Release After (days)</label>
                <Input type="number" {...form.register('autoReleaseAfterDays')} />
                {form.formState.errors.autoReleaseAfterDays && <p className="text-xs text-red-500">{form.formState.errors.autoReleaseAfterDays.message}</p>}
              </div>
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
                <div><span className="text-gray-500">Max Active Jobs:</span> <span className="font-medium">{settings.maxActiveJobsPerUser}</span></div>
                <div><span className="text-gray-500">Max Quotes/Job:</span> <span className="font-medium">{settings.maxQuotesPerJob}</span></div>
                <div><span className="text-gray-500">Max Disputes/Job:</span> <span className="font-medium">{settings.maxDisputesPerJob}</span></div>
                <div><span className="text-gray-500">Auto-Release:</span> <span className="font-medium">{settings.autoReleaseAfterDays}d</span></div>
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
