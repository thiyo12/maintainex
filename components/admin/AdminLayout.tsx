'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  FiHome, FiUsers, FiUserCheck, FiSettings, FiLogOut, FiMenu, FiX,
  FiShield, FiFileText, FiGrid, FiDollarSign, FiBriefcase, FiTool,
  FiAlertTriangle, FiMessageSquare, FiBarChart2, FiChevronDown,
  FiChevronRight, FiCreditCard, FiFile, FiClock, FiSearch, FiBell
} from 'react-icons/fi'
import { AdminSessionProvider, useAdminSession } from './AdminSessionProvider'
import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'

interface NavItem {
  name: string
  href: string
  icon: any
  permission?: string
  children?: NavItem[]
  badge?: string
  badgeColor?: string
}

function hasPermission(role: AdminRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

function filterNavByRole(items: NavItem[], role: AdminRole): NavItem[] {
  return items.filter(item => {
    if (item.permission && !hasPermission(role, item.permission)) return false
    if (item.children) {
      item.children = filterNavByRole(item.children, role)
      return item.children.length > 0
    }
    return true
  })
}

const NAVIGATION: NavItem[] = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: FiHome },
  {
    name: 'User Management', href: '/admin/users', icon: FiUsers, permission: 'users:view',
    children: [
      { name: 'Customers', href: '/admin/users/customers', icon: FiUsers, permission: 'users:view' },
      { name: 'Taskers', href: '/admin/users/taskers', icon: FiUserCheck, permission: 'taskers:view' },
      { name: 'Companies', href: '/admin/users/companies', icon: FiBriefcase, permission: 'companies:view' },
    ]
  },
  { name: 'KYC Verification', href: '/admin/kyc', icon: FiShield, permission: 'kyc:view', badge: 'New', badgeColor: 'red' },
  {
    name: 'Jobs', href: '/admin/jobs', icon: FiTool, permission: 'jobs:view',
    children: [
      { name: 'All Jobs', href: '/admin/jobs', icon: FiTool, permission: 'jobs:view' },
      { name: 'Disputes', href: '/admin/jobs/disputes', icon: FiAlertTriangle, permission: 'disputes:view' },
    ]
  },
  {
    name: 'Financial', href: '/admin/financial', icon: FiDollarSign, permission: 'commission:view',
    children: [
      { name: 'Commission', href: '/admin/financial/commission', icon: FiDollarSign, permission: 'commission:view' },
      { name: 'Wallets & Payouts', href: '/admin/financial/wallets', icon: FiCreditCard, permission: 'wallets:view' },
      { name: 'Settlements', href: '/admin/financial/settlements', icon: FiFileText, permission: 'commission:view' },
    ]
  },
  { name: 'Cheating Reports', href: '/admin/cheating', icon: FiAlertTriangle, permission: 'cheating:view', badge: 'Reports', badgeColor: 'red' },
  { name: 'Wishlist', href: '/admin/wishlist', icon: FiGrid, permission: 'wishlist:view' },
  {
    name: 'Analytics', href: '/admin/analytics', icon: FiBarChart2, permission: 'analytics:view',
    children: [
      { name: 'Overview', href: '/admin/analytics', icon: FiBarChart2, permission: 'analytics:view' },
      { name: 'Security Logs', href: '/admin/analytics/security', icon: FiShield, permission: 'security:view' },
      { name: 'Security Monitor', href: '/admin/analytics/security-monitor', icon: FiShield, permission: 'security:view' },
    ]
  },
  { name: 'Admin Management', href: '/admin/admins', icon: FiUserCheck, permission: 'admins:view' },
  { name: 'Settings', href: '/admin/settings', icon: FiSettings, permission: 'settings:view' },
]

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const { user, loading } = useAdminSession()

  const isLoginPage = pathname === '/admin/login'
  const adminRole = (user?.role || 'SUPPORT') as AdminRole

  const handleLogout = useCallback(() => {
    localStorage.removeItem('admin_token')
    document.cookie = 'admin_token=; path=/; max-age=0'
    window.location.href = '/admin/login'
  }, [])

  const toggleExpand = useCallback((name: string) => {
    setExpandedItems(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }, [])

  useEffect(() => {
    const activeParent = NAVIGATION.find(item =>
      item.children?.some(child => pathname.startsWith(child.href))
    )
    if (activeParent && !expandedItems.includes(activeParent.name)) {
      setExpandedItems(prev => [...prev, activeParent.name])
    }
  }, [pathname])

  if (isLoginPage) return <>{children}</>

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0C12]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Securing session...</p>
      </div>
    </div>
  )

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0C12]">
      <div className="text-center p-8 bg-[#15161E] rounded-xl shadow-lg">
        <FiShield className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Session Expired</h2>
        <p className="text-gray-400 mb-4">Please login again for security.</p>
        <button onClick={() => window.location.href = '/admin/login'} className="px-6 py-2 bg-amber-500 text-[#0B0C12] rounded-lg font-medium">
          Go to Login
        </button>
      </div>
    </div>
  )

  const navigation = filterNavByRole(NAVIGATION, adminRole)

  const roleLabels: Record<string, { label: string; color: string }> = {
    SUPER_ADMIN: { label: 'Super Admin', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    MANAGER: { label: 'Manager', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    FINANCE: { label: 'Finance', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    USER_MANAGEMENT: { label: 'User Management', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    SUPPORT: { label: 'Support', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    TECHNICAL: { label: 'Technical', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    ADMIN: { label: 'Admin', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  }

  const currentRole = roleLabels[adminRole] || roleLabels.ADMIN

  function renderNavItem(item: NavItem) {
    const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && item.href !== '/admin' && pathname.startsWith(item.href))
    const isExpanded = expandedItems.includes(item.name)
    const hasChildren = item.children && item.children.length > 0

    if (hasChildren) {
      return (
        <div key={item.name}>
          <button
            onClick={() => toggleExpand(item.name)}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-colors ${
              isActive ? 'bg-amber-500/20 text-amber-400' : 'text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-3">
              <item.icon className="text-lg" />
              <span className="font-medium text-sm">{item.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  item.badgeColor === 'red' ? 'bg-red-500 text-white' : 'bg-amber-500 text-dark-900'
                }`}>{item.badge}</span>
              )}
              {isExpanded ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
            </div>
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1">
              {item.children!.map(child => renderNavItem(child))}
            </div>
          )}
        </div>
      )
    }

    return (
      <Link
        key={item.name}
        href={item.href}
        className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${
          isActive ? 'bg-amber-500/20 text-amber-400' : 'text-gray-300 hover:bg-white/10 hover:text-white'
        }`}
        onClick={() => setSidebarOpen(false)}
      >
        <item.icon className="text-lg" />
        <span className="font-medium text-sm">{item.name}</span>
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B0C12]">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#15161E] text-white rounded-lg shadow-lg border border-white/10"
      >
        {sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
      </button>

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#15161E] border-r border-white/5 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 flex flex-col h-full">
          <Link href="/admin/dashboard" className="flex items-center space-x-2 mb-6 px-2">
            <Image src="/logo.JPEG" alt="Maintainex" width={36} height={36} className="object-contain" />
            <span className="text-lg font-bold text-white">
              Main<span className="text-amber-500">tainex</span>
            </span>
          </Link>

          <div className={`mb-4 px-3 py-2 rounded-lg border ${currentRole.color}`}>
            <div className="flex items-center gap-2">
              <FiShield size={14} />
              <span className="text-xs font-semibold">{currentRole.label}</span>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto">
            {navigation.map(item => renderNavItem(item))}
          </nav>

          <div className="pt-4 border-t border-white/10 space-y-1">
            <div className="px-4 py-2 text-xs text-gray-500 truncate">{user.email}</div>
            <Link
              href={user.region === 'CA' ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'}
              target="_blank"
              className="flex items-center space-x-3 px-4 py-2.5 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-colors text-sm"
              onClick={() => setSidebarOpen(false)}
            >
              <FiHome className="text-lg" />
              <span>View Website</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors text-sm"
            >
              <FiLogOut className="text-lg" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="hidden lg:block bg-[#15161E] border-b border-white/5 sticky top-0 z-30">
          <div className="px-6 lg:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-white">
                {navigation.find(n => pathname.startsWith(n.href))?.name || 'Admin'}
              </h2>
              {user.region && user.region !== 'LK' && (
                <span className="text-xs text-white bg-blue-600 px-2 py-0.5 rounded-full font-medium">
                  {user.region}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
                <FiBell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">{user.email}</span>
                <div className="w-9 h-9 bg-amber-500 rounded-full flex items-center justify-center">
                  <span className="text-[#0B0C12] font-bold text-sm">
                    {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 pt-16 lg:p-6 lg:pt-6 w-full max-w-none">
          <div className="w-full max-w-none">{children}</div>
        </main>
      </div>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setSidebarOpen(false)} />
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
