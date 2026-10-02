'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  FiAlertTriangle,
  FiBarChart2,
  FiBriefcase,
  FiChevronDown,
  FiDollarSign,
  FiGrid,
  FiHome,
  FiLock,
  FiLogOut,
  FiMapPin,
  FiMenu,
  FiMonitor,
  FiSettings,
  FiShield,
  FiTool,
  FiUserCheck,
  FiUsers,
  FiX,
} from 'react-icons/fi'
import { AdminSessionProvider, useAdminSession } from './AdminSessionProvider'
import CrmGlobalSearch from '@/components/crm/CrmGlobalSearch'
import CrmNotificationBell from '@/components/crm/CrmNotificationBell'
import {
  CrmShellProvider,
  type CrmMarketOption,
} from '@/components/crm/v2/CrmShellContext'

interface NavItem {
  name: string
  href: string
  icon: any
  permissions?: string[]
}

const NAVIGATION: NavItem[] = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: FiGrid, permissions: ['dashboard:view'] },
  { name: 'Jobs', href: '/admin/jobs', icon: FiTool, permissions: ['jobs:view'] },
  { name: 'Customers', href: '/admin/users/customers', icon: FiUsers, permissions: ['customers:view'] },
  { name: 'Taskers', href: '/admin/users/taskers', icon: FiUserCheck, permissions: ['taskers:view'] },
  { name: 'Companies', href: '/admin/users/companies', icon: FiBriefcase, permissions: ['companies:view'] },
  { name: 'Finance', href: '/admin/financial', icon: FiDollarSign, permissions: ['finance:payments:view'] },
  { name: 'Disputes', href: '/admin/jobs/disputes', icon: FiAlertTriangle, permissions: ['disputes:view'] },
  { name: 'Trust & Safety', href: '/admin/trust-safety', icon: FiShield, permissions: ['risk:view'] },
  { name: 'Analytics', href: '/admin/analytics', icon: FiBarChart2, permissions: ['audit:view'] },
  { name: 'App & Web', href: '/admin/platform', icon: FiMonitor, permissions: ['markets:view'] },
  { name: 'Real Estate', href: '/admin/real-estate', icon: FiHome, permissions: ['realestate:view'] },
  { name: 'Staff', href: '/admin/admins', icon: FiUserCheck, permissions: ['staff:view'] },
  { name: 'Settings', href: '/admin/settings', icon: FiSettings, permissions: ['settings:view'] },
]

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, loading } = useAdminSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [market, setMarketState] = useState('ALL')
  const [loggingOut, setLoggingOut] = useState(false)

  const permissions = useMemo(() => new Set(user?.permissions || []), [user?.permissions])

  const navigation = useMemo(
    () => NAVIGATION.filter(item => !item.permissions?.length || item.permissions.some(permission => permissions.has(permission))),
    [permissions]
  )

  const marketOptions = useMemo<CrmMarketOption[]>(() => {
    if (!user) return []
    const configured = user.markets || []
    return user.role === 'SUPER_ADMIN'
      ? [{ code: 'ALL', name: 'All markets' }, ...configured]
      : configured
  }, [user])

  useEffect(() => {
    if (!user) return
    const allowed = new Set(marketOptions.map(item => item.code))
    const fallback = user.role === 'SUPER_ADMIN' ? 'ALL' : marketOptions[0]?.code || 'ALL'
    const stored = typeof window !== 'undefined' ? window.sessionStorage.getItem('maintainex.crm.market') : null
    const next = stored && allowed.has(stored) ? stored : fallback
    setMarketState(next)
    window.sessionStorage.setItem('maintainex.crm.market', next)
  }, [marketOptions, user])

  const setMarket = useCallback((next: string) => {
    if (!marketOptions.some(item => item.code === next)) return
    setMarketState(next)
    window.sessionStorage.setItem('maintainex.crm.market', next)
  }, [marketOptions])

  const handleLogout = useCallback(async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' })
    } finally {
      window.location.replace('/admin/login')
    }
  }, [loggingOut])

  useEffect(() => setSidebarOpen(false), [pathname])

  if (loading) {
    return (
      <div className="crm-v2 flex min-h-screen items-center justify-center bg-[#101820]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-[3px] border-[#ffca18] border-t-transparent" />
          <p className="text-sm text-slate-400">Verifying CRM session…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="crm-v2 flex min-h-screen items-center justify-center bg-[#101820] px-4">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#17212a] p-8 text-center shadow-2xl">
          <FiLock className="mx-auto mb-4 h-11 w-11 text-red-300" />
          <h2 className="text-xl font-semibold text-white">Session unavailable</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Your CRM session is expired, revoked, or no longer authorized.</p>
          <button type="button" onClick={() => window.location.replace('/admin/login')} className="mt-5 h-10 rounded-lg bg-[#ffca18] px-5 text-sm font-bold text-[#111827] hover:bg-[#ffd644]">
            Sign in again
          </button>
        </div>
      </div>
    )
  }

  const roleLabel = user.role.replaceAll('_', ' ')
  const selectedMarketName = marketOptions.find(item => item.code === market)?.name || (market === 'ALL' ? 'All markets' : market)

  return (
    <CrmShellProvider value={{ market, setMarket, markets: marketOptions }}>
      <div className="crm-v2 min-h-screen bg-[#eef2f5] text-[#17202a]">
        <aside className={`fixed inset-y-0 left-0 z-50 w-[214px] border-r border-white/[0.06] bg-[#101820] transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex h-full flex-col">
            <Link href="/admin/dashboard" className="flex h-[64px] items-center border-b border-white/[0.06] px-5">
              <span className="text-[16px] font-extrabold tracking-[0.18em] text-white">
                M<span className="text-[#ffca18]">Λ</span>INT<span className="text-[#ffca18]">Λ</span>INEX
              </span>
            </Link>

            <nav className="crm-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {navigation.map(item => {
                const active = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href + '/'))
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`relative flex h-10 items-center gap-3 overflow-hidden rounded-lg px-3 text-[12px] font-semibold transition-colors ${active ? 'bg-[#2b2d28] text-[#ffca18]' : 'text-slate-300 hover:bg-white/[0.055] hover:text-white'}`}
                  >
                    {active && <span className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-[#ffca18]" />}
                    <item.icon size={16} className="shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                )
              })}
            </nav>

            <div className="p-3">
              <div className="rounded-xl border border-white/[0.08] bg-[#17212a] p-3">
                <div className="flex items-center gap-2">
                  <FiShield size={14} className={user.totpEnabled ? 'text-emerald-400' : 'text-amber-300'} />
                  <div className="text-[11px] font-semibold text-white">MaintainEX Control</div>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-slate-400">
                  {user.totpEnabled ? '2FA protected staff session.' : 'Enable 2FA for stronger staff protection.'}
                </p>
                <div className="mt-3 rounded-md bg-white/[0.05] px-2.5 py-2 text-[10px] text-slate-300">
                  {selectedMarketName}
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="mt-2 flex h-9 w-full items-center gap-2 rounded-lg px-3 text-[11px] font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
              >
                <FiLogOut size={14} />
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <div className="min-h-screen lg:pl-[214px]">
          <header className="sticky top-0 z-30 h-[62px] border-b border-[#dfe4e8] bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.02)] backdrop-blur">
            <div className="flex h-full items-center gap-3 px-4 lg:px-5">
              <button type="button" onClick={() => setSidebarOpen(value => !value)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#dfe4e8] bg-white text-slate-600 lg:hidden" aria-label="Toggle CRM navigation">
                {sidebarOpen ? <FiX size={17} /> : <FiMenu size={17} />}
              </button>

              <div className="min-w-0 flex-1 lg:max-w-[560px]">
                <CrmGlobalSearch market={market} />
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-2">
                {marketOptions.length > 0 && (
                  <div className="hidden h-9 items-center gap-2 rounded-lg border border-[#dfe4e8] bg-white px-2.5 sm:flex">
                    <FiMapPin size={13} className="text-slate-500" />
                    <select value={market} onChange={event => setMarket(event.target.value)} aria-label="CRM market" className="max-w-[130px] bg-transparent text-[11px] font-semibold text-slate-700 outline-none">
                      {marketOptions.map(option => <option key={option.code} value={option.code}>{option.name}</option>)}
                    </select>
                    <FiChevronDown size={12} className="text-slate-400" />
                  </div>
                )}

                <CrmNotificationBell />

                <div className="flex h-9 items-center gap-2 rounded-lg border border-[#dfe4e8] bg-white px-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-[#18232d] text-[10px] font-bold text-[#ffca18]">
                    {(user.name?.[0] || user.email?.[0] || 'A').toUpperCase()}
                  </div>
                  <div className="hidden max-w-[145px] leading-tight md:block">
                    <div className="truncate text-[11px] font-bold text-slate-900">{user.name || user.email}</div>
                    <div className="truncate text-[9px] text-slate-500">{roleLabel}</div>
                  </div>
                  <FiChevronDown size={12} className="hidden text-slate-400 md:block" />
                </div>
              </div>
            </div>
          </header>

          <main className="px-3 py-4 md:px-4 lg:px-5">
            <div className="mx-auto w-full max-w-[1660px]">{children}</div>
          </main>
        </div>
      </div>
    </CrmShellProvider>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminSessionProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AdminSessionProvider>
  )
}
