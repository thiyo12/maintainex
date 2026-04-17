'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { FiHome, FiCalendar, FiUsers, FiSettings, FiLogOut, FiMenu, FiX, FiBarChart2, FiMapPin, FiUserCheck, FiMap, FiGrid } from 'react-icons/fi'
import { AdminSessionProvider } from './AdminSessionProvider'
import { getStoredUser, clearStoredUser, type StoredUser } from '@/lib/auth-client'

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<StoredUser | null>(null)
  const [loading, setLoading] = useState(true)

  const isLoginPage = pathname === '/admin/login'
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false)
      return
    }

    const storedUser = getStoredUser()
    if (storedUser) {
      setUser(storedUser)
      setLoading(false)
    } else {
      window.location.href = '/admin/login'
    }
  }, [isLoginPage])

  const handleLogout = () => {
    clearStoredUser()
    window.location.href = '/admin/login'
  }

  if (isLoginPage) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Please Login</h2>
          <button
            onClick={() => window.location.href = '/admin/login'}
            className="px-4 py-2 bg-primary-500 text-dark-900 rounded-lg font-medium"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  const baseNavigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: FiHome },
    { name: 'Bookings', href: '/admin/bookings', icon: FiCalendar },
    { name: 'Applications', href: '/admin/applications', icon: FiUsers },
    { name: 'Reports', href: '/admin/reports', icon: FiBarChart2 },
    { name: 'Services', href: '/admin/services', icon: FiSettings },
  ]

  const superAdminNavigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: FiHome },
    { name: 'Branches', href: '/admin/branches', icon: FiMapPin },
    { name: 'Districts', href: '/admin/districts', icon: FiMap },
    { name: 'Admins', href: '/admin/admins', icon: FiUserCheck },
    { name: 'Bookings', href: '/admin/bookings', icon: FiCalendar },
    { name: 'Applications', href: '/admin/applications', icon: FiUsers },
    { name: 'Reports', href: '/admin/reports', icon: FiBarChart2 },
    { name: 'Services', href: '/admin/services', icon: FiSettings },
    { name: 'Categories', href: '/admin/categories', icon: FiGrid },
    { name: 'Settings', href: '/admin/settings', icon: FiSettings },
  ]

  const navigation = isSuperAdmin ? superAdminNavigation : baseNavigation

  return (
    <div className="min-h-screen bg-gray-100">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-dark-900 text-white rounded-lg"
      >
        {sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
      </button>

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-dark-900 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6">
          <Link href="/" className="flex items-center space-x-2 mb-8">
            <Image src="/logo.JPEG" alt="Maintainex" width={40} height={40} className="object-contain" />
            <span className="text-xl font-bold text-white">
              Main<span className="text-primary-500">tainex</span>
            </span>
          </Link>

          {isSuperAdmin && (
            <div className="mb-4 px-4 py-2 bg-purple-500/20 rounded-lg border border-purple-500/30">
              <span className="text-purple-400 text-xs font-medium">Super Admin</span>
            </div>
          )}

          <nav className="space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  pathname === item.href
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon className="text-lg" />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-white/10">
          <div className="mb-2 px-4 py-2 text-xs text-gray-400">
            {isSuperAdmin ? 'Full Access' : `Branch: ${user.branchId || 'N/A'}`}
          </div>
          <Link href="/" className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-colors mb-2">
            <FiHome className="text-lg" />
            <span>View Website</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <FiLogOut className="text-lg" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="hidden lg:block bg-white shadow-sm sticky top-0 z-30">
          <div className="px-6 lg:px-8 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Admin Dashboard</h2>
              {user.branchId && !isSuperAdmin && (
                <span className="text-sm text-gray-500">Branch ID: {user.branchId}</span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">{user.email}</span>
              {isSuperAdmin && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                  Super Admin
                </span>
              )}
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-dark-900 font-bold">
                  {user.name?.[0] || user.email?.[0] || 'A'}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-6 xl:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
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
