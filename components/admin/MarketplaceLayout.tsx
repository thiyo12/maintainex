'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FiHome, FiUsers, FiFileText, FiShield, FiGrid,
  FiBarChart2, FiSettings, FiLogOut, FiMenu, FiX, FiUserCheck,
  FiAlertCircle, FiList, FiBell, FiStar, FiFlag, FiZap, FiDollarSign,
  FiMessageSquare, FiAlertTriangle, FiSend,
} from 'react-icons/fi'
import { useAuth } from './AuthProvider'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

const navigation = [
  { name: 'Dashboard', href: '/admin/marketplace/dashboard', icon: FiHome, roles: ['SUPER_ADMIN', 'MANAGER', 'FINANCE', 'USER_MANAGEMENT', 'SUPPORT', 'TECHNICAL'] },
  { name: 'Users', href: '/admin/marketplace/users', icon: FiUsers, roles: ['SUPER_ADMIN', 'MANAGER', 'USER_MANAGEMENT', 'SUPPORT'] },
  { name: 'Jobs', href: '/admin/marketplace/jobs', icon: FiFileText, roles: ['SUPER_ADMIN', 'MANAGER', 'USER_MANAGEMENT', 'SUPPORT'] },
  { name: 'Disputes', href: '/admin/marketplace/disputes', icon: FiMessageSquare, roles: ['SUPER_ADMIN', 'MANAGER', 'SUPPORT'] },
  { name: 'Escrow', href: '/admin/marketplace/escrow', icon: FiShield, roles: ['SUPER_ADMIN', 'FINANCE'] },
  { name: 'Settlements', href: '/admin/marketplace/financial/settlements', icon: FiSend, roles: ['SUPER_ADMIN', 'FINANCE'] },
  { name: 'Revenue', href: '/admin/marketplace/revenue', icon: FiDollarSign, roles: ['SUPER_ADMIN', 'FINANCE'] },
  { name: 'Fraud Centre', href: '/admin/marketplace/fraud', icon: FiAlertTriangle, roles: ['SUPER_ADMIN', 'MANAGER', 'USER_MANAGEMENT', 'SUPPORT'] },
  { name: 'Offers', href: '/admin/marketplace/offers', icon: FiZap, roles: ['SUPER_ADMIN', 'MANAGER', 'USER_MANAGEMENT'] },
  { name: 'Categories', href: '/admin/marketplace/categories', icon: FiGrid, roles: ['SUPER_ADMIN', 'MANAGER'] },
  { name: 'Staff', href: '/admin/marketplace/staff', icon: FiUserCheck, roles: ['SUPER_ADMIN'] },
  { name: 'Settings', href: '/admin/marketplace/settings', icon: FiSettings, roles: ['SUPER_ADMIN'] },
  { name: 'Audit Logs', href: '/admin/marketplace/audit-logs', icon: FiList, roles: ['SUPER_ADMIN', 'MANAGER', 'FINANCE', 'USER_MANAGEMENT', 'SUPPORT', 'TECHNICAL'] },
  { name: 'Notifications', href: '/admin/marketplace/notifications', icon: FiBell, roles: ['SUPER_ADMIN', 'MANAGER', 'FINANCE', 'USER_MANAGEMENT', 'SUPPORT', 'TECHNICAL'] },
  { name: 'Reviews', href: '/admin/marketplace/reviews', icon: FiStar, roles: ['SUPER_ADMIN', 'MANAGER', 'USER_MANAGEMENT'] },
  { name: 'Properties', href: '/admin/marketplace/properties', icon: FiHome, roles: ['SUPER_ADMIN', 'MANAGER', 'USER_MANAGEMENT'] },
  { name: 'Work Queue', href: '/admin/marketplace/alerts', icon: FiAlertCircle, roles: ['SUPER_ADMIN', 'MANAGER', 'FINANCE', 'USER_MANAGEMENT', 'SUPPORT', 'TECHNICAL'] },
]

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, isLoading: loading } = useAuth()

  const handleLogout = async () => {
    localStorage.removeItem('admin_token')
    try { await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' }) } catch {}
    try { await fetch('/api/auth/logout') } catch {}
    window.location.href = '/admin/login'
  }

  const visibleNav = navigation.filter(
    (item) => user && item.roles.includes(user.role as any)
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0B0C12' }}>
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0B0C12' }}>
        <div className="text-center p-8 rounded-xl shadow-lg" style={{ backgroundColor: '#1B1D27' }}>
          <FiAlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2" style={{ color: '#F59E0B' }}>Session Expired</h2>
          <p className="text-gray-400 mb-4">Please login again.</p>
          <button onClick={() => window.location.href = '/admin/login'}
            className="px-6 py-2 rounded-lg font-medium" style={{ backgroundColor: '#F59E0B', color: '#0B0C12' }}>Go to Login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0B0C12' }}>
      <button onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg shadow-lg"
        style={{ backgroundColor: '#F59E0B', color: '#0B0C12' }}>
        {sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
      </button>

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ backgroundColor: '#1B1D27' }}>
        <div className="p-6 flex flex-col h-full">
          <Link href="/admin/marketplace/dashboard" className="flex items-center space-x-2 mb-6">
            <span className="text-xl font-bold" style={{ color: '#F59E0B' }}>
              Market<span style={{ color: '#FFFFFF' }}>place</span>
            </span>
          </Link>

          <div className="mb-4 px-3 py-2 rounded-lg flex items-center gap-2"
            style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <FiShield size={16} style={{ color: '#F59E0B' }} />
            <span className="text-xs font-medium" style={{ color: '#F59E0B' }}>{user.role?.replace('_', ' ') || 'USER'}</span>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto">
            {visibleNav.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link key={item.name} href={item.href}
                  className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'text-amber-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  style={{
                    backgroundColor: isActive ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    color: isActive ? '#F59E0B' : undefined,
                  }}
                  onClick={() => setSidebarOpen(false)}>
                  <item.icon className="text-lg" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          <div className="pt-4 border-t border-gray-700/50 space-y-2">
            <Link href="/admin/dashboard"
              className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-colors text-sm"
              onClick={() => setSidebarOpen(false)}>
              <FiHome className="text-lg" />
              <span>Back to Website Admin</span>
            </Link>
            <button onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors"
              style={{ color: '#EF4444' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
              <FiLogOut className="text-lg" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 shadow-sm"
          style={{ backgroundColor: '#15161E', borderBottom: '1px solid #23252F' }}>
          <div className="px-6 lg:px-8 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold" style={{ color: '#F59E0B' }}>
              {visibleNav.find(n => pathname.startsWith(n.href))?.name || 'Dashboard'}
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">{user.email}</span>
              <div className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#F59E0B' }}>
                <span className="font-bold" style={{ color: '#0B0C12' }}>
                  {user.firstName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'M'}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 pt-16 lg:p-6 lg:pt-20 w-full max-w-none">
          <div className="w-full max-w-none">{children}</div>
        </main>
      </div>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}
