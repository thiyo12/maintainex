'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FiLoader, FiStar, FiMapPin, FiDollarSign, FiCheckCircle, FiSearch, FiFilter } from 'react-icons/fi'

export default function BrowseTaskersPage() {
  const [loading, setLoading] = useState(true)
  const [taskers, setTaskers] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [filter, setFilter] = useState({
    categoryId: '',
    district: '',
    minRating: '',
    maxRate: '',
    isAvailable: true,
  })

  useEffect(() => {
    fetchCategories()
    fetchTaskers()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      if (res.ok) setCategories(await res.json())
    } catch {}
  }

  const fetchTaskers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter.categoryId) params.set('categoryId', filter.categoryId)
      if (filter.district) params.set('district', filter.district)
      if (filter.minRating) params.set('minRating', filter.minRating)
      if (filter.maxRate) params.set('maxRate', filter.maxRate)
      if (filter.isAvailable) params.set('isAvailable', 'true')

      const res = await fetch(`/api/taskers?${params}`)
      const result = await res.json()
      if (result.success) setTaskers(result.data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/customer/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
            ← Back to Dashboard
          </Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">Browse Taskers</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="bg-white rounded-xl border p-4 mb-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={filter.categoryId}
                onChange={(e) => setFilter({ ...filter, categoryId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Rating</label>
              <select
                value={filter.minRating}
                onChange={(e) => setFilter({ ...filter, minRating: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Any</option>
                <option value="4">4+ Stars</option>
                <option value="4.5">4.5+ Stars</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Rate (LKR/hr)</label>
              <input
                type="number"
                value={filter.maxRate}
                onChange={(e) => setFilter({ ...filter, maxRate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Any"
                min="0"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchTaskers}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
              >
                <FiSearch size={16} />
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-16">
            <FiLoader className="animate-spin text-4xl text-indigo-600 mx-auto" />
          </div>
        ) : taskers.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {taskers.map((tasker) => (
              <Link
                key={tasker.id}
                href={`/customer/taskers/${tasker.id}`}
                className="bg-white rounded-xl border p-6 hover:border-indigo-200 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-xl font-bold text-indigo-600">
                    {tasker.user?.name?.charAt(0) || 'T'}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{tasker.user?.name}</h3>
                    <div className="flex items-center gap-1 mt-1">
                      <FiStar className="text-amber-400 fill-amber-400" size={14} />
                      <span className="text-sm font-medium">{tasker.overallRating?.toFixed(1) || 'New'}</span>
                      <span className="text-sm text-gray-500">({tasker.totalReviews})</span>
                    </div>
                  </div>
                  {tasker.isAvailable && (
                    <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                      <FiCheckCircle size={12} /> Available
                    </span>
                  )}
                </div>

                {tasker.bio && (
                  <p className="text-sm text-gray-600 mt-3 line-clamp-2">{tasker.bio}</p>
                )}

                <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <FiMapPin size={14} /> {tasker.primaryDistrict || 'Sri Lanka'}
                  </span>
                  <span className="flex items-center gap-1">
                    <FiDollarSign size={14} /> LKR {tasker.hourlyRate?.toLocaleString() || 0}/hr
                  </span>
                  <span className="flex items-center gap-1">
                    <FiCheckCircle size={14} /> {tasker.totalTasksCompleted} tasks
                  </span>
                </div>

                {tasker.skills && tasker.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {tasker.skills.slice(0, 3).map((skill: any) => (
                      <span key={skill.id} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">
                        {skill.category?.icon} {skill.category?.name}
                      </span>
                    ))}
                    {tasker.skills.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">
                        +{tasker.skills.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <FiSearch className="text-6xl text-gray-200 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No taskers found</h3>
            <p className="text-gray-500">Try adjusting your filters</p>
          </div>
        )}
      </main>
    </div>
  )
}
