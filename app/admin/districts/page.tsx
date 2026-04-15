'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiMapPin, FiSearch, FiRefreshCw, FiAlertCircle, FiUsers, FiCalendar } from 'react-icons/fi'
import { getAuthHeader } from '@/lib/auth-client'

interface BranchInfo {
  id: string
  name: string
  isActive: boolean
}

interface District {
  name: string
  branchCount: number
  branches: BranchInfo[]
  activeBookings: number
}

export default function AdminDistricts() {
  const router = useRouter()
  const [districts, setDistricts] = useState<District[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchDistricts()
  }, [])

  const fetchDistricts = async () => {
    setError(null)
    try {
      const res = await fetch('/api/districts', { headers: { ...getAuthHeader() } })
      if (res.status === 401) {
        router.push('/admin/login')
        return
      }
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setDistricts(data)
    } catch (err) {
      setError('Failed to load district data')
    } finally {
      setLoading(false)
    }
  }

  const filteredDistricts = districts.filter(district =>
    district.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalBranches = districts.reduce((sum, d) => sum + d.branchCount, 0)
  const totalActiveBookings = districts.reduce((sum, d) => sum + d.activeBookings, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm">
        <div className="flex items-center gap-3 text-red-600 mb-4">
          <FiAlertCircle className="text-2xl" />
          <span className="font-medium">{error}</span>
        </div>
        <button onClick={fetchDistricts} className="btn-primary">
          <FiRefreshCw className="inline mr-2" /> Try Again
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">District Management</h1>
          <p className="text-gray-600">View all Sri Lanka districts and their service coverage</p>
        </div>
        <button onClick={fetchDistricts} className="btn-outline flex items-center">
          <FiRefreshCw className="mr-2" /> Refresh
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <FiMapPin className="text-primary-600 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Districts</p>
              <p className="text-2xl font-bold text-gray-900">{districts.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FiUsers className="text-blue-600 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Serving Branches</p>
              <p className="text-2xl font-bold text-gray-900">{totalBranches}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <FiCalendar className="text-green-600 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Bookings</p>
              <p className="text-2xl font-bold text-gray-900">{totalActiveBookings}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search districts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">District</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Serving Branches</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Active Bookings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDistricts.map((district) => (
                <tr key={district.name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                        <FiMapPin className="text-primary-600" />
                      </div>
                      <span className="font-medium text-gray-900">{district.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                      district.branchCount > 0
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      <FiUsers className="text-xs" />
                      {district.branchCount} {district.branchCount === 1 ? 'branch' : 'branches'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                      district.activeBookings > 0
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      <FiCalendar className="text-xs" />
                      {district.activeBookings}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredDistricts.length === 0 && (
          <div className="p-12 text-center">
            <FiMapPin className="mx-auto text-gray-300 text-4xl mb-3" />
            <p className="text-gray-500">No districts found matching "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden grid gap-4">
        {filteredDistricts.map((district) => (
          <div key={district.name} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <FiMapPin className="text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900">{district.name}</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-blue-700">{district.branchCount}</div>
                <div className="text-xs text-gray-500">Branches</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-green-700">{district.activeBookings}</div>
                <div className="text-xs text-gray-500">Active Bookings</div>
              </div>
            </div>
            {district.branches.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Serving branches:</p>
                <div className="flex flex-wrap gap-1">
                  {district.branches.map(branch => (
                    <span
                      key={branch.id}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        branch.isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {branch.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredDistricts.length === 0 && (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <FiMapPin className="mx-auto text-gray-300 text-4xl mb-3" />
            <p className="text-gray-500">No districts found matching "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  )
}
