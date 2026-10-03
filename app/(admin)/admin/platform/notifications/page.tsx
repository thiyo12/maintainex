'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowLeft,
  FiBell,
  FiCheck,
  FiClock,
  FiRefreshCw,
} from 'react-icons/fi'
import {
  CrmBadge,
  CrmButton,
  CrmCard,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
} from '@/components/crm/v2/CrmPrimitives'
import { crmApiError } from '@/lib/crm/api-error'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link?: string | null
  read: boolean
  createdAt: string
}

export default function AdminNotificationCentrePage() {
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/notifications?limit=100', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Unable to load notifications')
      setItems(body.notifications || [])
      setUnread(body.unreadCount || 0)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function markAll() {
    const response = await fetch('/api/admin/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })

    if (!response.ok) {
      toast.error('Unable to update notifications')
      return
    }

    setItems(current => current.map(item => ({ ...item, read: true })))
    setUnread(0)
    toast.success('Notifications marked as read')
  }

  async function markOne(id: string) {
    const item = items.find(notification => notification.id === id)
    if (!item || item.read) return

    const response = await fetch('/api/admin/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!response.ok) return

    setItems(current =>
      current.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    )
    setUnread(current => Math.max(0, current - 1))
  }

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="App & Web · Staff operations"
        title="Notification centre"
        description="Staff-targeted operational alerts for the authenticated CRM session."
        actions={
          <>
            <CrmButton variant="secondary" onClick={load}>
              <FiRefreshCw size={14} />
              Refresh
            </CrmButton>
            {unread > 0 && (
              <CrmButton variant="primary" onClick={markAll}>
                <FiCheck size={14} />
                Mark all read
              </CrmButton>
            )}
          </>
        }
        context={
          <>
            <Link
              href="/admin/platform"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              <FiArrowLeft size={12} />
              App & Web
            </Link>
            <CrmBadge tone={unread > 0 ? 'warning' : 'success'} dot>
              {unread > 0 ? `${unread} unread` : 'Inbox clear'}
            </CrmBadge>
          </>
        }
      />

      <section className="grid max-w-2xl grid-cols-2 gap-3">
        <CrmMetricCard
          label="Notifications"
          value={items.length.toLocaleString()}
          helper="Latest staff-targeted events"
          icon={<FiBell size={16} />}
          tone="info"
        />
        <CrmMetricCard
          label="Unread"
          value={unread.toLocaleString()}
          helper={unread > 0 ? 'Needs operator attention' : 'Nothing pending'}
          icon={<FiClock size={16} />}
          tone={unread > 0 ? 'warning' : 'success'}
        />
      </section>

      {loading ? (
        <CrmState
          type="loading"
          title="Loading staff notifications"
          description="Loading alerts for your authenticated CRM account."
        />
      ) : items.length === 0 ? (
        <CrmState
          type="empty"
          title="No admin notifications"
          description="New staff-targeted operational alerts will appear here."
          action={<FiBell size={18} className="text-slate-400" />}
        />
      ) : (
        <CrmCard
          title="Recent notifications"
          description="Opening a notification marks it as read for this staff account."
          action={<CrmBadge tone="neutral">{items.length} loaded</CrmBadge>}
          padding="none"
        >
          <div className="divide-y divide-[var(--crm-border)]">
            {items.map(item => {
              const content = (
                <div
                  className={`flex items-start gap-4 px-5 py-4 transition hover:bg-slate-50 ${item.read ? '' : 'bg-amber-50/40'}`}
                >
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                      item.read
                        ? 'bg-slate-100 text-slate-400'
                        : 'bg-[var(--crm-accent-soft)] text-amber-700'
                    }`}
                  >
                    <FiBell size={17} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                      {!item.read && <CrmBadge tone="amber">NEW</CrmBadge>}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-500">{item.message}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                      <span>{item.type.replaceAll('_', ' ')}</span>
                      <span aria-hidden="true">•</span>
                      <span>
                        {new Date(item.createdAt).toLocaleString('en-LK', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              )

              return item.link ? (
                <Link
                  key={item.id}
                  href={item.link}
                  onClick={() => void markOne(item.id)}
                  className="block"
                >
                  {content}
                </Link>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void markOne(item.id)}
                  className="block w-full text-left"
                >
                  {content}
                </button>
              )
            })}
          </div>
        </CrmCard>
      )}
    </div>
  )
}
