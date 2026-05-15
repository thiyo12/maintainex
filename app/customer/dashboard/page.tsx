'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FiCalendar, FiClipboard, FiCheckCircle, FiDollarSign, FiBell,
  FiPlus, FiLoader, FiUser, FiSettings, FiLogOut, FiBriefcase,
  FiClock, FiStar, FiMessageSquare
} from 'react-icons/fi'

export default function CustomerDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/session')
      const sessionData = await res.json()

      if (!sessionData.user) {
        router.push('/auth/login')
        return
      }

      if (sessionData.user.role !== 'CUSTOMER') {
        router.push('/auth/login')
        return
      }

      setUser(sessionData.user)
      fetchDashboard()
    } catch {
      router.push('/auth/login')
    }
  }

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard')
      const result = await res.json()
      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Dashboard error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FiLoader className="animate-spin text-4xl text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const stats = data?.stats || {}

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-xl font-bold text-indigo-600">
              Maintain<span className="text-gray-900">ex</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link href="/customer/post-task" className="hidden sm:flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all">
                <FiPlus size={16} />
                Post a Task
              </Link>

              <button className="relative p-2 text-gray-500 hover:text-gray-700">
                <FiBell size={20} />
                {data?.unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {data.unreadNotifications}
                  </span>
                )}
              </button>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                  <FiUser size={16} className="text-indigo-600" />
                </div>
                <span className="hidden sm:block text-sm font-medium">{user?.name}</span>
                <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600">
                  <FiLogOut size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-gray-600 mt-1">Here's what's happening with your tasks and bookings</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<FiCalendar className="text-blue-600" />}
            label="Active Bookings"
            value={stats.activeBookings || 0}
            color="bg-blue-50"
          />
          <StatCard
            icon={<FiClipboard className="text-indigo-600" />}
            label="Active Tasks"
            value={stats.activeTasks || 0}
            color="bg-indigo-50"
          />
          <StatCard
            icon={<FiCheckCircle className="text-green-600" />}
            label="Completed"
            value={stats.completedTasks || 0}
            color="bg-green-50"
          />
          <StatCard
            icon={<FiDollarSign className="text-amber-600" />}
            label="Total Spent"
            value={`LKR ${(stats.totalSpent || 0).toLocaleString()}`}
            color="bg-amber-50"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent Tasks */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Recent Tasks</h2>
                <Link href="/customer/tasks" className="text-sm text-indigo-600 hover:text-indigo-700">
                  View All
                </Link>
              </div>

              {data?.recentTasks?.length > 0 ? (
                <div className="space-y-4">
                  {data.recentTasks.map((task: any) => (
                    <Link
                      key={task.id}
                      href={`/customer/tasks/${task.id}`}
                      className="block p-4 border rounded-xl hover:border-indigo-200 hover:bg-indigo-50/50 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{task.title}</h3>
                          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                            {task.category && (
                              <span className="flex items-center gap-1">
                                {task.category.icon} {task.category.name}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <FiDollarSign size={12} /> {task.budget ? `LKR ${task.budget.toLocaleString()}` : 'Negotiable'}
                            </span>
                            {task.district && (
                              <span>{task.district}</span>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={task.status} />
                      </div>
                      {task.assignment?.tasker && (
                        <div className="mt-3 flex items-center gap-2 text-sm">
                          <FiUser size={14} className="text-gray-400" />
                          <span className="text-gray-600">Assigned to {task.assignment.tasker.user.name}</span>
                          <FiStar size={14} className="text-amber-400 ml-2" />
                          <span className="text-gray-600">{task.assignment.tasker.overallRating?.toFixed(1)}</span>
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FiClipboard className="text-4xl text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No tasks yet</p>
                  <Link
                    href="/customer/post-task"
                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                  >
                    <FiPlus size={16} />
                    Post Your First Task
                  </Link>
                </div>
              )}
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-2xl shadow-sm border p-6 mt-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
                <Link href="/customer/bookings" className="text-sm text-indigo-600 hover:text-indigo-700">
                  View All
                </Link>
              </div>

              {data?.recentBookings?.length > 0 ? (
                <div className="space-y-3">
                  {data.recentBookings.map((booking: any) => (
                    <div key={booking.id} className="flex items-center justify-between p-4 border rounded-xl">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {booking.service?.name || 'Service Booking'}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          <span>{new Date(booking.date).toLocaleDateString()}</span>
                          <span>{booking.timeSlot}</span>
                          <span>{booking.district}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-gray-900">LKR {booking.totalPrice.toLocaleString()}</span>
                        <div className="mt-1">
                          <StatusBadge status={booking.status} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No bookings yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link href="/customer/post-task" className="flex items-center gap-3 p-3 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-all">
                  <FiPlus size={18} />
                  <span className="font-medium">Post a New Task</span>
                </Link>
                <Link href="/customer/taskers" className="flex items-center gap-3 p-3 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 transition-all">
                  <FiUser size={18} />
                  <span>Browse Taskers</span>
                </Link>
                <Link href="/booking" className="flex items-center gap-3 p-3 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 transition-all">
                  <FiCalendar size={18} />
                  <span>Book a Service</span>
                </Link>
                <Link href="/customer/settings" className="flex items-center gap-3 p-3 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 transition-all">
                  <FiSettings size={18} />
                  <span>Settings</span>
                </Link>
              </div>
            </div>

            {/* Wallet */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white">
              <h3 className="text-sm font-medium opacity-80 mb-1">Wallet Balance</h3>
              <p className="text-3xl font-bold">
                LKR {(stats.walletBalance || 0).toLocaleString()}
              </p>
              <div className="mt-4 pt-4 border-t border-white/20">
                <p className="text-sm opacity-80">Total Spent: LKR {(stats.totalSpent || 0).toLocaleString()}</p>
              </div>
            </div>

            {/* Need Help */}
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Need Help?</h3>
              <div className="space-y-3">
                <a
                  href="https://wa.me/94770867609"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-green-600 hover:text-green-700"
                >
                  <FiMessageSquare size={18} />
                  <span>Chat on WhatsApp</span>
                </a>
                <a href="tel:0770867609" className="flex items-center gap-2 text-gray-600 hover:text-gray-700">
                  <FiClock size={18} />
                  <span>Call: 0770867609</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string | number, color: string }) {
  return (
    <div className={`${color} rounded-2xl p-5 border`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-600 mt-1">{label}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    PENDING_REVIEW: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-blue-100 text-blue-700',
    OPEN: 'bg-green-100 text-green-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
    CONFIRMED: 'bg-blue-100 text-blue-700',
    DISPUTED: 'bg-orange-100 text-orange-700',
  }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
