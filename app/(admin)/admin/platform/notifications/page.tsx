'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiBell, FiCheck, FiRefreshCw } from 'react-icons/fi'

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
      if (!response.ok) throw new Error(body?.error || 'Unable to load notifications')
      setItems(body.notifications || [])
      setUnread(body.unreadCount || 0)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

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
    const response = await fetch('/api/admin/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!response.ok) return
    setItems(current => current.map(item => item.id === id ? { ...item, read: true } : item))
    setUnread(current => Math.max(0, current - 1))
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/admin/platform" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
            <FiArrowLeft size={15} /> Platform management
          </Link>
          <div className="mt-3 text-xs uppercase tracking-[0.16em] text-amber-600 font-semibold">Staff operations</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-slate-950">Notification Centre</h1>
          <p className="mt-1.5 text-sm text-slate-500">Admin notifications targeted to your authenticated staff account.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-600">
            <FiRefreshCw size={15} /> Refresh
          </button>
          {unread > 0 && (
            <button onClick={markAll} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-950 text-white text-sm font-semibold">
              <FiCheck size={15} /> Mark all read
            </button>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 max-w-xl">
        <Metric label="Notifications" value={items.length} />
        <Metric label="Unread" value={unread} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><div className="w-8 h-8 rounded-full border-[3px] border-amber-400 border-t-transparent animate-spin"/></div>
        ) : items.length ? (
          <div className="divide-y divide-slate-100">
            {items.map(item => {
              const content = (
                <div className={`p-4 md:p-5 flex items-start gap-4 hover:bg-slate-50 ${item.read ? '' : 'bg-amber-50/30'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.read ? 'bg-slate-100 text-slate-400' : 'bg-amber-100 text-amber-700'}`}>
                    <FiBell size={17}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-slate-900">{item.title}</div>
                      {!item.read && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">NEW</span>}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{item.message}</div>
                    <div className="mt-2 text-xs text-slate-400">{item.type.replaceAll('_',' ')} · {new Date(item.createdAt).toLocaleString('en-LK')}</div>
                  </div>
                </div>
              )
              return item.link ? (
                <Link key={item.id} href={item.link} onClick={() => markOne(item.id)}>{content}</Link>
              ) : (
                <button key={item.id} type="button" onClick={() => markOne(item.id)} className="w-full text-left">{content}</button>
              )
            })}
          </div>
        ) : (
          <div className="py-20 text-center">
            <FiBell className="mx-auto text-slate-300" size={28}/>
            <div className="mt-3 text-sm font-semibold text-slate-700">No admin notifications</div>
            <div className="mt-1 text-xs text-slate-400">New staff-targeted notifications will appear here.</div>
          </div>
        )}
      </section>
    </div>
  )
}

function Metric({label,value}:{label:string;value:number}){
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div></div>
}
