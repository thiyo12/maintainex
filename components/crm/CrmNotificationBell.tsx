'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FiBell, FiCheck } from 'react-icons/fi'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link?: string | null
  read: boolean
  createdAt: string
}

export default function CrmNotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/notifications?limit=8', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!response.ok) return
      const body = await response.json()
      setItems(body.notifications || [])
      setUnread(body.unreadCount || 0)
    } catch {}
  }, [])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 60_000)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  async function markAll() {
    const response = await fetch('/api/admin/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    if (response.ok) {
      setItems(current => current.map(item => ({ ...item, read: true })))
      setUnread(0)
    }
  }

  async function markOne(id: string) {
    const item = items.find(entry => entry.id === id)
    if (item?.read) return
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => null)
    setItems(current => current.map(entry => entry.id === id ? { ...entry, read: true } : entry))
    setUnread(current => Math.max(0, current - 1))
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(value => !value)
          if (!open) load()
        }}
        className="relative w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50"
        aria-label="Notifications"
      >
        <FiBell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_-20px_rgba(15,23,42,0.35)] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">Notifications</div>
              <div className="text-xs text-slate-400 mt-0.5">{unread} unread</div>
            </div>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                <FiCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length ? items.map(item => {
              const body = (
                <div className={`px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${item.read ? '' : 'bg-amber-50/40'}`}>
                  <div className="flex gap-3">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${item.read ? 'bg-slate-200' : 'bg-amber-400'}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{item.title}</div>
                      <div className="text-xs text-slate-500 mt-1 line-clamp-2">{item.message}</div>
                      <div className="text-[10px] text-slate-400 mt-1.5">{new Date(item.createdAt).toLocaleString('en-LK')}</div>
                    </div>
                  </div>
                </div>
              )
              return item.link ? (
                <Link key={item.id} href={item.link} onClick={() => { markOne(item.id); setOpen(false) }}>
                  {body}
                </Link>
              ) : (
                <button key={item.id} type="button" onClick={() => markOne(item.id)} className="w-full text-left">
                  {body}
                </button>
              )
            }) : (
              <div className="py-10 text-center text-sm text-slate-400">No admin notifications.</div>
            )}
          </div>

          <Link
            href="/admin/platform/notifications"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-center text-xs font-semibold text-amber-700 border-t border-slate-100 hover:bg-slate-50"
          >
            Open notification centre
          </Link>
        </div>
      )}
    </div>
  )
}
