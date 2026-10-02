'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  FiAlertTriangle,
  FiBarChart2,
  FiBriefcase,
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
  href?: string
  icon: any
  permissions?: string[]
  disabled?: boolean
  badge?: string
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
  const [marketReady, setMarketReady] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const permissions = useMemo(
    () => new Set(user?.permissions || []),
    [user?.permissions]
  )

  const navigation = useMemo(
    () => NAVIGATION.filter(item => {
      if (!item.permissions?.length) return true
      return item.permissions.some(permission => permissions.has(permission))
    }),
    [permissions]
  )

  const marketOptions = useMemo<CrmMarketOption[]>(() => {
    if (!user) return []
    const configured = user.markets || []
    return [
      {
        code: 'ALL',
        name: user.role === 'SUPER_ADMIN' ? 'All markets' : 'All assigned markets',
      },
      ...configured,
    ]
  }, [user])

  useEffect(() => {
    if (!user) return

    const allowed = new Set(marketOptions.map(item => item.code))
    const fallback = 'ALL'

    const stored =
      typeof window !== 'undefined'
        ? window.sessionStorage.getItem('maintainex.crm.market')
        : null

    const next = stored && allowed.has(stored) ? stored : fallback
    setMarketReady(false)
    setMarketState(next)
    window.sessionStorage.setItem('maintainex.crm.market', next)
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `maintainex_crm_market=${encodeURIComponent(next)}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`
    setMarketReady(true)
  }, [marketOptions, user])

  const setMarket = useCallback((next: string) => {
    if (!marketOptions.some(item => item.code === next)) return
    setMarketState(next)
    window.sessionStorage.setItem('maintainex.crm.market', next)
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `maintainex_crm_market=${encodeURIComponent(next)}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`

    // Reload once so every guarded CRM read/mutation shares the same server-validated
    // market scope, including modules that do not carry an explicit ?market= parameter.
    window.location.reload()
  }, [marketOptions])

  const handleLogout = useCallback(async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Redirect regardless; the server route clears cookies whenever reachable.
    } finally {
      window.location.replace('/admin/login')
    }
  }, [loggingOut])

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  if (loading || (user && !marketReady)) {
    return (
      <div className="crm-v2 flex min-h-screen items-center justify-center bg-[var(--crm-rail)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--crm-accent)] border-t-transparent" />
          <p className="text-sm text-slate-400">Verifying CRM session…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="crm-v2 flex min-h-screen items-center justify-center bg-[var(--crm-rail)] px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1d20] p-8 text-center shadow-2xl">
          <FiLock className="mx-auto mb-4 h-12 w-12 text-red-300" />
          <h2 className="text-xl font-semibold text-white">Session unavailable</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Your CRM session is expired, revoked, or no longer authorized.
          </p>
          <button
            type="button"
            onClick={() => window.location.replace('/admin/login')}
            className="mt-5 h-10 rounded-xl bg-[var(--crm-accent)] px-5 text-sm font-semibold text-[#17191b]"
          >
            Sign in again
          </button>
        </div>
      </div>
    )
  }

  const roleLabel = user.role.replaceAll('_', ' ')
  const selectedMarketName =
    marketOptions.find(item => item.code === market)?.name ||
    (market === 'ALL' ? 'All markets' : market)

  return (
    <CrmShellProvider value={{ market, setMarket, markets: marketOptions }}>
      <div className="crm-v2 min-h-screen bg-[var(--crm-canvas)] text-[var(--crm-text)]">
        <aside
          className={`crm-reference-rail fixed inset-y-0 left-0 z-50 w-[218px] border-r border-white/[0.06] transition-transform duration-200 lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col px-3 py-3">
            <Link href="/admin/dashboard" className="flex items-center gap-3 px-3 py-3">
              <div className="min-w-0">
                <div className="text-[16px] font-black tracking-[0.15em] text-white">
                  M<span className="text-[var(--crm-accent)]">Λ</span>INTΛINEX
                </div>
              </div>
            </Link>

            <div className="mx-2 mb-3 mt-2 h-px bg-white/[0.07]" />

            <nav className="crm-scrollbar flex-1 space-y-0.5 overflow-y-auto px-1">
              {navigation.map(item => {
                const active = Boolean(
                  item.href &&
                  (pathname === item.href ||
                    (item.href !== '/admin/dashboard' && pathname.startsWith(item.href + '/')))
                )

                if (item.disabled) {
                  return (
                    <div
                      key={item.name}
                      className="flex h-[38px] items-center gap-3 rounded-[9px] px-3 text-slate-600"
                      title="Module migration is scheduled for a later CRM V2 phase."
                    >
                      <item.icon size={16} className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{item.name}</span>
                      {item.badge && (
                        <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-slate-600">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )
                }

                return (
                  <Link
                    key={item.name}
                    href={item.href!}
                    className={`group flex h-[38px] items-center gap-3 rounded-[9px] px-3 text-[12px] font-medium transition-colors ${
                      active
                        ? 'border-l-2 border-[var(--crm-accent)] bg-[#2a291e] pl-[10px] text-[var(--crm-accent)]'
                        : 'border-l-2 border-transparent text-slate-400 hover:bg-white/[0.055] hover:text-white'
                    }`}
                  >
                    <item.icon size={16} className="shrink-0" />
                    <span className="truncate">{item.name}</span>
                    {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--crm-accent)]" />}
                  </Link>
                )
              })}
            </nav>

            <div className="mt-3 border-t border-white/[0.07] px-1 pt-3">
              <div className="mb-2 rounded-[10px] border border-white/[0.08] bg-white/[0.035] p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--crm-accent)]">
                  MaintainEX Control
                </div>
                <div className="mt-1 text-[11px] leading-4 text-slate-400">
                  Marketplace operations, finance and trust controls.
                </div>
                <Link
                  href="/admin/platform"
                  className="mt-3 flex h-8 items-center justify-center rounded-[8px] bg-[var(--crm-accent)] px-3 text-[10px] font-bold text-[#111315] transition-colors hover:bg-[#ffc943]"
                >
                  Platform settings
                </Link>
              </div>

              <div className="mb-2 rounded-[10px] border border-white/[0.07] bg-white/[0.035] p-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${user.totpEnabled ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span className="text-[11px] font-semibold text-slate-300">
                    {user.totpEnabled ? '2FA protected' : '2FA not enabled'}
                  </span>
                </div>
                <div className="mt-1.5 truncate text-[11px] text-slate-500">{user.email}</div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[13px] font-medium text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
              >
                <FiLogOut size={16} />
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-slate-950/55 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="min-h-screen lg:pl-[218px]">
          <header className="crm-reference-topbar sticky top-0 z-30 border-b border-[var(--crm-border)] backdrop-blur">
            <div className="flex min-h-[58px] items-center gap-3 px-4 md:px-5">
              <button
                type="button"
                onClick={() => setSidebarOpen(value => !value)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--crm-border)] bg-white text-slate-600 lg:hidden"
                aria-label="Toggle CRM navigation"
              >
                {sidebarOpen ? <FiX size={18} /> : <FiMenu size={18} />}
              </button>

              <div className="min-w-0 flex-1 lg:max-w-[720px]">
                <CrmGlobalSearch market={market} />
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-2">
                {marketOptions.length > 0 && (
                  <div className="hidden h-9 items-center gap-2 rounded-[9px] border border-[var(--crm-border)] bg-white px-2.5 sm:flex">
                    <FiMapPin size={14} className="text-slate-400" />
                    <select
                      aria-label="CRM market"
                      value={market}
                      onChange={event => setMarket(event.target.value)}
                      className="max-w-[150px] bg-transparent pr-1 text-xs font-semibold text-slate-700 outline-none"
                    >
                      {marketOptions.map(option => (
                        <option key={option.code} value={option.code}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <CrmNotificationBell />

                <div className="flex h-9 items-center gap-2 rounded-[9px] border border-[var(--crm-border)] bg-white px-2 pl-1">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-[#171d22] text-[11px] font-bold text-[var(--crm-accent)]">
                    {(user.name?.[0] || user.email?.[0] || 'A').toUpperCase()}
                  </div>
                  <div className="hidden max-w-[150px] leading-tight xl:block">
                    <div className="truncate text-xs font-semibold text-slate-800">{user.name || user.email}</div>
                    <div className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
                      {roleLabel}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--crm-border)] px-4 py-2 sm:hidden">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <FiMapPin size={13} />
                <span>{selectedMarketName}</span>
              </div>
              <div className={`text-[10px] font-semibold ${user.totpEnabled ? 'text-emerald-700' : 'text-amber-700'}`}>
                {user.totpEnabled ? '2FA protected' : '2FA off'}
              </div>
            </div>
          </header>

          <main className="px-4 py-4 md:px-5 md:py-4">
            <div className="mx-auto w-full max-w-[1580px]">{children}</div>
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
