'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  FiActivity,
  FiAlertTriangle,
  FiBarChart2,
  FiBriefcase,
  FiChevronDown,
  FiChevronRight,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiGrid,
  FiHome,
  FiLayers,
  FiLogOut,
  FiMenu,
  FiSettings,
  FiShield,
  FiTool,
  FiUserCheck,
  FiUsers,
  FiX,
} from 'react-icons/fi'
import { AdminSessionProvider, useAdminSession } from './AdminSessionProvider'
import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'
import CrmGlobalSearch from '@/components/crm/CrmGlobalSearch'
import CrmNotificationBell from '@/components/crm/CrmNotificationBell'

interface NavItem {
  name: string
  href: string
  icon: any
  permission?: string
  children?: NavItem[]
  badge?: string
}

function hasPermission(role: AdminRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

function filterNavByRole(items: NavItem[], role: AdminRole): NavItem[] {
  return items.reduce<NavItem[]>((acc, item) => {
    if (item.permission && !hasPermission(role, item.permission)) return acc
    const children = item.children ? filterNavByRole(item.children, role) : undefined
    if (item.children && (!children || children.length === 0)) return acc
    acc.push({ ...item, children })
    return acc
  }, [])
}

const NAVIGATION: NavItem[] = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: FiHome },
  {
    name: 'Operations',
    href: '/admin/jobs',
    icon: FiActivity,
    children: [
      { name: 'Jobs', href: '/admin/jobs', icon: FiTool, permission: 'jobs:view' },
      { name: 'Disputes', href: '/admin/jobs/disputes', icon: FiAlertTriangle, permission: 'disputes:view' },
      { name: 'KYC Verification', href: '/admin/kyc', icon: FiShield, permission: 'kyc:view', badge: 'Queue' },
    ],
  },
  {
    name: 'People',
    href: '/admin/users',
    icon: FiUsers,
    children: [
      { name: 'Customers', href: '/admin/users/customers', icon: FiUsers, permission: 'users:view' },
      { name: 'Taskers', href: '/admin/users/taskers', icon: FiUserCheck, permission: 'taskers:view' },
      { name: 'Companies', href: '/admin/users/companies', icon: FiBriefcase, permission: 'companies:view' },
    ],
  },
  {
    name: 'Finance',
    href: '/admin/financial',
    icon: FiDollarSign,
    children: [
      { name: 'Commission', href: '/admin/financial/commission', icon: FiDollarSign, permission: 'commission:view' },
      { name: 'Wallets & Payouts', href: '/admin/financial/wallets', icon: FiCreditCard, permission: 'wallets:view' },
      { name: 'Settlements', href: '/admin/financial/settlements', icon: FiFileText, permission: 'commission:view' },
    ],
  },
  {
    name: 'Platform Management',
    href: '/admin/platform',
    icon: FiLayers,
    children: [
      { name: 'Website & App', href: '/admin/platform', icon: FiLayers, permission: 'settings:view' },
      { name: 'Market & Pricing', href: '/admin/pricing/market-config', icon: FiDollarSign, permission: 'market_config:read' },
      { name: 'Wishlist', href: '/admin/wishlist', icon: FiGrid, permission: 'wishlist:view' },
    ],
  },
  {
    name: 'Trust & Safety',
    href: '/admin/trust-safety',
    icon: FiShield,
    children: [
      { name: 'Credentials', href: '/admin/trust-safety/credentials', icon: FiFileText, permission: 'credentials:read' },
      { name: 'Risk Events', href: '/admin/trust-safety/risk-events', icon: FiAlertTriangle, permission: 'risk_events:read' },
      { name: 'Cheating Reports', href: '/admin/cheating', icon: FiAlertTriangle, permission: 'cheating:view' },
    ],
  },
  {
    name: 'Insights',
    href: '/admin/analytics',
    icon: FiBarChart2,
    children: [
      { name: 'Analytics', href: '/admin/analytics', icon: FiBarChart2, permission: 'analytics:view' },
      { name: 'Audit Log', href: '/admin/analytics/audit', icon: FiFileText, permission: 'audit:read' },
      { name: 'Security Logs', href: '/admin/analytics/security', icon: FiShield, permission: 'security:view' },
      { name: 'Security Monitor', href: '/admin/analytics/security-monitor', icon: FiActivity, permission: 'security:view' },
    ],
  },
  {
    name: 'Staff & Administration',
    href: '/admin/admins',
    icon: FiUserCheck,
    children: [
      { name: 'Admins & Staff', href: '/admin/admins', icon: FiUserCheck, permission: 'admins:view' },
      { name: 'Settings', href: '/admin/settings', icon: FiSettings, permission: 'settings:view' },
    ],
  },
]

const ROLE_LABELS: Record<string, { label: string; classes: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', classes: 'bg-violet-50 text-violet-700 border-violet-200' },
  MANAGER: { label: 'Manager', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  FINANCE: { label: 'Finance', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  USER_MANAGEMENT: { label: 'User Management', classes: 'bg-orange-50 text-orange-700 border-orange-200' },
  SUPPORT: { label: 'Support', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  TECHNICAL: { label: 'Technical', classes: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  ADMIN: { label: 'Admin', classes: 'bg-slate-50 text-slate-700 border-slate-200' },
}

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const { user, loading } = useAdminSession()

  const isLoginPage = pathname === '/admin/login'
  const adminRole = (user?.role || 'SUPPORT') as AdminRole
  const navigation = useMemo(() => filterNavByRole(NAVIGATION, adminRole), [adminRole])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('admin_token')
    document.cookie = 'admin_token=; path=/; max-age=0'
    window.location.href = '/admin/login'
  }, [])

  const toggleExpand = useCallback((name: string) => {
    setExpandedItems(prev =>
      prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name]
    )
  }, [])

  useEffect(() => {
    const activeParents = NAVIGATION
      .filter(item => item.children?.some(child => pathname === child.href || pathname.startsWith(child.href + '/')))
      .map(item => item.name)

    if (activeParents.length > 0) {
      setExpandedItems(prev => Array.from(new Set([...prev, ...activeParents])))
    }
  }, [pathname])

  if (isLoginPage) return <>{children}</>

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
        <div className="text-center">
          <div className="w-11 h-11 border-[3px] border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-400">Securing CRM session...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
        <div className="text-center p-8 bg-[#141922] rounded-2xl border border-white/10 shadow-2xl">
          <FiShield className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Session expired</h2>
          <p className="text-slate-400 mb-5">Sign in again to continue to MaintainEX CRM.</p>
          <button
            onClick={() => { window.location.href = '/admin/login' }}
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg font-semibold"
          >
            Go to login
          </button>
        </div>
      </div>
    )
  }

  const role = ROLE_LABELS[adminRole] || ROLE_LABELS.ADMIN
  const marketLabel = user.region || 'All markets'

  function isNavActive(item: NavItem): boolean {
    if (pathname === item.href) return true
    return item.href !== '/admin/dashboard' && pathname.startsWith(item.href + '/')
  }

  function renderNavItem(item: NavItem, nested = false) {
    const active = isNavActive(item)
    const expanded = expandedItems.includes(item.name)
    const hasChildren = Boolean(item.children?.length)

    if (hasChildren) {
      return (
        <div key={item.name} className="space-y-1">
          <button
            type="button"
            onClick={() => toggleExpand(item.name)}
            className={`w-full flex items-center justify-between rounded-xl transition-all ${
              nested ? 'px-3 py-2' : 'px-3 py-2.5'
            } ${active ? 'bg-amber-400/10 text-amber-300' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'}`}
          >
            <span className="flex items-center gap-3 min-w-0">
              <item.icon className="text-[17px] shrink-0" />
              <span className="text-sm font-medium truncate">{item.name}</span>
            </span>
            {expanded ? <FiChevronDown size={15} /> : <FiChevronRight size={15} />}
          </button>
          {expanded && (
            <div className="ml-4 pl-3 border-l border-white/10 space-y-1">
              {item.children!.map(child => renderNavItem(child, true))}
            </div>
          )}
        </div>
      )
    }

    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center justify-between rounded-xl px-3 py-2.5 transition-all ${
          active
            ? 'bg-amber-400 text-slate-950 shadow-[0_8px_22px_-14px_rgba(251,191,36,0.9)]'
            : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
        }`}
      >
        <span className="flex items-center gap-3 min-w-0">
          <item.icon className="text-[17px] shrink-0" />
          <span className="text-sm font-medium truncate">{item.name}</span>
        </span>
        {item.badge && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
            active ? 'bg-slate-950/10 text-slate-950' : 'bg-red-500/15 text-red-300'
          }`}>
            {item.badge}
          </span>
        )}
      </Link>
    )
  }

  const activeTitle = (() => {
    for (const item of navigation) {
      if (pathname === item.href) return item.name
      const child = item.children?.find(entry => pathname === entry.href || pathname.startsWith(entry.href + '/'))
      if (child) return child.name
    }
    return 'MaintainEX CRM'
  })()

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-slate-950">
      <button
        type="button"
        onClick={() => setSidebarOpen(open => !open)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-[#141922] text-white rounded-xl shadow-xl border border-white/10"
        aria-label="Toggle CRM navigation"
      >
        {sidebarOpen ? <FiX size={21} /> : <FiMenu size={21} />}
      </button>

      <aside className={`fixed inset-y-0 left-0 z-40 w-[280px] bg-[#10151d] border-r border-white/[0.06] transform transition-transform duration-200 lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-full flex flex-col px-4 py-5">
          <Link href="/admin/dashboard" className="flex items-center gap-3 px-2 mb-5">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden">
              <Image src="/logo.JPEG" alt="MaintainEX" width={40} height={40} className="object-cover" />
            </div>
            <div className="min-w-0">
              <div className="text-white font-semibold tracking-[0.16em] text-[15px]">MΛINTΛINEX</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Operations CRM</div>
            </div>
          </Link>

          <div className="mx-1 mb-4 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Workspace</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.08)]" />
            </div>
            <div className="text-sm font-medium text-slate-200 mt-1">Marketplace operations</div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
            {navigation.map(item => renderNavItem(item))}
          </nav>

          <div className="pt-4 mt-4 border-t border-white/[0.08]">
            <div className="rounded-xl bg-white/[0.035] border border-white/[0.07] p-3 mb-2">
              <div className="text-xs text-slate-500">Signed in as</div>
              <div className="text-sm text-slate-200 truncate mt-1">{user.email}</div>
              <div className="text-xs text-slate-500 mt-1">{marketLabel}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-300 hover:bg-red-500/10 transition-colors text-sm"
            >
              <FiLogOut className="text-lg" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[280px] min-h-screen">
        <header className="sticky top-0 z-30 h-[72px] bg-white/95 backdrop-blur border-b border-slate-200/80">
          <div className="h-full px-4 pl-16 lg:px-7 flex items-center gap-4">
            <div className="min-w-[150px] hidden md:block">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">CRM workspace</div>
              <div className="text-base font-semibold text-slate-900">{activeTitle}</div>
            </div>

            <div className="flex-1 max-w-2xl">
              <CrmGlobalSearch />
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex h-10 px-3 rounded-xl border border-slate-200 bg-white items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-slate-700">{marketLabel}</span>
              </div>

              <CrmNotificationBell />

              <div className="flex items-center gap-2 pl-1">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-amber-300 flex items-center justify-center text-sm font-semibold">
                  {(user.name?.[0] || user.email?.[0] || 'A').toUpperCase()}
                </div>
                <div className="hidden xl:block leading-tight">
                  <div className="text-sm font-semibold text-slate-800">{user.name || 'Admin'}</div>
                  <div className={`inline-flex mt-0.5 text-[10px] px-1.5 py-0.5 rounded border ${role.classes}`}>{role.label}</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 md:px-6 lg:px-7 lg:py-6">
          <div className="max-w-[1680px] mx-auto">{children}</div>
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-slate-950/60 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminSessionProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AdminSessionProvider>
  )
}
