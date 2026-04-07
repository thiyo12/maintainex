'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FiCalendar, FiUsers, FiClock, FiCheckCircle, FiAlertCircle, FiArrowRight } from 'react-icons/fi'

interface DashboardData {
  stats: {
    totalBookings: number
    pendingBookings: number
    totalApplications: number
    newApplications: number
    totalServices: number
  }
  recentBookings: any[]
  recentApplications: any[]
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const stats = data?.stats || {
    totalBookings: 0,
    pendingBookings: 0,
    totalApplications: 0,
    newApplications: 0,
    totalServices: 0
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Heres an overview of your business.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <FiCalendar className="text-primary-600 text-xl" />
            </div>
            <span className="text-sm text-green-600 font-medium">+12%</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.totalBookings}</div>
          <div className="text-gray-600">Total Bookings</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <FiClock className="text-yellow-600 text-xl" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.pendingBookings}</div>
          <div className="text-gray-600">Pending Bookings</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FiUsers className="text-blue-600 text-xl" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.totalApplications}</div>
          <div className="text-gray-600">Job Applications</div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <FiCheckCircle className="text-purple-600 text-xl" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.newApplications}</div>
          <div className="text-gray-600">New Applications</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
            <Link href="/admin/bookings" className="text-primary-600 text-sm font-medium hover:text-primary-700 flex items-center">
              View All <FiArrowRight className="ml-1" />
            </Link>
          </div>
          <div className="divide-y">
            {data?.recentBookings && data.recentBookings.length > 0 ? (
              data.recentBookings.map((booking: any) => (
                <div key={booking.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{booking.name}</div>
                    <div className="text-sm text-gray-500">{booking.service?.title}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                    booking.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700' :
                    booking.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {booking.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">No bookings yet</div>
            )}
          </div>
        </div>

        {/* Recent Applications */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Applications</h2>
            <Link href="/admin/applications" className="text-primary-600 text-sm font-medium hover:text-primary-700 flex items-center">
              View All <FiArrowRight className="ml-1" />
            </Link>
          </div>
          <div className="divide-y">
            {data?.recentApplications && data.recentApplications.length > 0 ? (
              data.recentApplications.map((app: any) => (
                <div key={app.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{app.name}</div>
                    <div className="text-sm text-gray-500">{app.position}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    app.status === 'NEW' ? 'bg-blue-100 text-blue-700' :
                    app.status === 'REVIEWED' ? 'bg-purple-100 text-purple-700' :
                    app.status === 'INTERVIEW' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {app.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">No applications yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
