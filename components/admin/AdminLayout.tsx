'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { FiHome, FiCalendar, FiUsers, FiSettings, FiLogOut, FiMenu, FiX, FiBarChart2, FiMapPin, FiUserCheck, FiMap, FiGrid, FiShield, FiFileText, FiFile } from 'react-icons/fi'
import { AdminSessionProvider } from './AdminSessionProvider'
import { getStoredUser, clearStoredUser, type StoredUser } from '@/lib/auth-client'

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<StoredUser | null>(null)
  const [loading, setLoading] = useState(true)

  const isLoginPage = pathname === '/admin/login'
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  // Security: Validate session on mount
  useEffect(() => {
    if (isLoginPage) {
      setLoading(false)
      return
    }

    // Security check: Validate stored user exists
    const storedUser = getStoredUser()
    if (storedUser && storedUser.id && storedUser.email && storedUser.role) {
      setUser(storedUser)
      setLoading(false)
    } else {
      // Security: Redirect to login if no valid session
      window.location.href = '/admin/login'
    }
  }, [isLoginPage])

  // Security: Logout with proper cleanup
  const handleLogout = () => {
    // Clear all stored data
    clearStoredUser()
    // Clear any other localStorage items
    localStorage.removeItem('admin_user')
    localStorage.removeItem('admin_token')
    // Redirect to login
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
          <p className="text-gray-500">Securing session...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg">
          <FiShield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Session Expired</h2>
          <p className="text-gray-500 mb-4">Please login again for security.</p>
          <button onClick={() => window.location.href = '/admin/login'} className="px-6 py-2 bg-primary-500 text-dark-900 rounded-lg font-medium">
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  // Full Super Admin navigation with all sections
  const superAdminNavigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: FiHome },
    { name: 'Customers', href: '/admin/customers', icon: FiUsers },
    { name: 'Bookings', href: '/admin/bookings', icon: FiCalendar },
    { name: 'Invoices', href: '/admin/invoices', icon: FiFileText },
    { name: 'Quotations', href: '/admin/quotations', icon: FiFile },
    { name: 'Applications', href: '/admin/applications', icon: FiUsers },
    { name: 'Services', href: '/admin/services', icon: FiSettings },
    { name: 'Categories', href: '/admin/categories', icon: FiGrid },
    { name: 'Branches', href: '/admin/branches', icon: FiMapPin },
    { name: 'Districts', href: '/admin/districts', icon: FiMap },
    { name: 'Staff', href: '/admin/staff', icon: FiUserCheck },
    { name: 'Careers', href: '/admin/careers', icon: FiShield },
    { name: 'Admins', href: '/admin/admins', icon: FiUserCheck },
    { name: 'Reports', href: '/admin/reports', icon: FiBarChart2 },
    { name: 'Settings', href: '/admin/settings', icon: FiSettings },
  ]

  // Regular Admin navigation
  const adminNavigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: FiHome },
    { name: 'Bookings', href: '/admin/bookings', icon: FiCalendar },
    { name: 'Invoices', href: '/admin/invoices', icon: FiFileText },
    { name: 'Quotations', href: '/admin/quotations', icon: FiFile },
    { name: 'Applications', href: '/admin/applications', icon: FiUsers },
    { name: 'Staff', href: '/admin/staff', icon: FiUserCheck },
    { name: 'Careers', href: '/admin/careers', icon: FiShield },
    { name: 'Reports', href: '/admin/reports', icon: FiBarChart2 },
    { name: 'Services', href: '/admin/services', icon: FiSettings },
  ]

  const navigation = isSuperAdmin ? superAdminNavigation : adminNavigation

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile menu button */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)} 
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-dark-900 text-white rounded-lg shadow-lg"
      >
        {sidebarOpen ? <FiX size={24} /> : <FiMenu size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-dark-900 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full">
          {/* Logo */}
          <Link href="/admin/dashboard" className="flex items-center space-x-2 mb-6">
            <Image src="/logo.JPEG" alt="Maintainex" width={40} height={40} className="object-contain" />
            <span className="text-xl font-bold text-white">
              Main<span className="text-primary-500">tainex</span>
            </span>
          </Link>

          {/* Admin Role Badge */}
          {isSuperAdmin && (
            <div className="mb-4 px-3 py-2 bg-purple-500/20 rounded-lg border border-purple-500/30 flex items-center gap-2">
              <FiShield className="text-purple-400" size={16} />
              <span className="text-purple-400 text-xs font-medium">Super Admin</span>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
              return (
                <Link 
                  key={item.name} 
                  href={item.href} 
                  className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-primary-500/20 text-primary-400' 
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="text-lg" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Bottom Section */}
          <div className="pt-4 border-t border-white/10 space-y-2">
            {/* View Website */}
            <Link 
              href="/" 
              className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <FiHome className="text-lg" />
              <span>View Website</span>
            </Link>
            
            {/* Logout Button */}
            <button 
              onClick={handleLogout} 
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <FiLogOut className="text-lg" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="hidden lg:block bg-white shadow-sm sticky top-0 z-30">
          <div className="px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {navigation.find(n => pathname.startsWith(n.href))?.name || 'Admin'}
              </h2>
              {user.province && (
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {user.province}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-600 text-sm">{user.email}</span>
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-dark-900 font-bold">
                  {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'A'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6 lg:pt-20">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Mobile Overlay */}
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