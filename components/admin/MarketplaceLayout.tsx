'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FiHome, FiUsers, FiFileText, FiClock, FiShield, FiGrid,
  FiBarChart2, FiSettings, FiLogOut, FiMenu, FiX, FiUserCheck,
  FiAlertCircle, FiList,
} from 'react-icons/fi'
import { getStoredUser, clearStoredUser, type StoredUser } from '@/lib/auth-client'

const navigation = [
  { name: 'Dashboard', href: '/admin/marketplace/dashboard', icon: FiHome },
  { name: 'Users', href: '/admin/marketplace/users', icon: FiUsers },
  { name: 'KYC Reviews', href: '/admin/marketplace/kyc', icon: FiShield },
  { name: 'Jobs', href: '/admin/marketplace/jobs', icon: FiFileText },
  { name: 'Escrows & Disputes', href: '/admin/marketplace/escrow', icon: FiClock },
  { name: 'Categories', href: '/admin/marketplace/categories', icon: FiGrid },
  { name: 'Reports', href: '/admin/marketplace/reports', icon: FiBarChart2 },
  { name: 'Admin Users', href: '/admin/marketplace/admin-users', icon: FiUserCheck },
  { name: 'Audit Logs', href: '/admin/marketplace/audit-logs', icon: FiList },
  { name: 'Settings', href: '/admin/marketplace/settings', icon: FiSettings },
]

const roleAccess: Record<string, string[]> = {
  SUPER_ADMIN: navigation.map(n => n.href),
  ADMIN: navigation.map(n => n.href).filter(h => !h.includes('/settings') && !h.includes('/admin-users') && !h.includes('/audit-logs')),
  MODERATOR: navigation.map(n => n.href).filter(h => !h.includes('/escrow') && !h.includes('/settings') && !h.includes('/admin-users') && !h.includes('/audit-logs')),
  SUPPORT: ['/admin/marketplace/dashboard', '/admin/marketplace/users', '/admin/marketplace/jobs', '/admin/marketplace/reports'],
}

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<StoredUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUser = getStoredUser()
    if (storedUser && storedUser.id && storedUser.email && storedUser.role) {
      setUser(storedUser)
      setLoading(false)
    } else {
      window.location.href = '/admin/login'
    }
  }, [])

  const handleLogout = async () => {
    clearStoredUser()
    localStorage.removeItem('admin_user')
    localStorage.removeItem('admin_token')
    try { await fetch('/api/auth/logout') } catch {}
    window.location.href = '/admin/login'
  }

  const allowedPaths = roleAccess[user?.role || ''] || roleAccess.SUPPORT

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg">
          <FiAlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Session Expired</h2>
          <p className="text-gray-500 mb-4">Please login again.</p>
          <button onClick={() => window.location.href = '/admin/login'}
            className="px-6 py-2 bg-primary-500 text-dark-900 rounded-lg font-medium">Go to Login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <button onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-dark-900 text-white rounded-lg shadow-lg">
        {sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
      </button>

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-dark-900 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full">
          <Link href="/admin/marketplace/dashboard" className="flex items-center space-x-2 mb-6">
            <span className="text-xl font-bold text-white">
              Market<span className="text-primary-500">place</span>
            </span>
          </Link>

          <div className="mb-4 px-3 py-2 bg-blue-500/20 rounded-lg border border-blue-500/30 flex items-center gap-2">
            <FiShield className="text-blue-400" size={16} />
            <span className="text-blue-400 text-xs font-medium">{user.role.replace('_', ' ')}</span>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto">
            {navigation.filter(n => allowedPaths.includes(n.href)).map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link key={item.name} href={item.href}
                  className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${
                    isActive ? 'bg-primary-500/20 text-primary-400' : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                  onClick={() => setSidebarOpen(false)}>
                  <item.icon className="text-lg" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          <div className="pt-4 border-t border-white/10 space-y-2">
            <Link href="/admin/dashboard"
              className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-colors text-sm"
              onClick={() => setSidebarOpen(false)}>
              <FiHome className="text-lg" />
              <span>Back to Website Admin</span>
            </Link>
            <button onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
              <FiLogOut className="text-lg" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="hidden lg:block bg-white shadow-sm sticky top-0 z-30">
          <div className="px-6 lg:px-8 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">
              {navigation.find(n => pathname.startsWith(n.href))?.name || 'Marketplace'}
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-gray-600 text-sm">{user.email}</span>
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-dark-900 font-bold">
                  {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'M'}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-6 lg:pt-20">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}
