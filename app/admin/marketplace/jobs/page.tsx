'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { FiSearch, FiChevronLeft, FiChevronRight, FiEye, FiAlertCircle, FiBriefcase } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface Job {
  id: string
  title: string
  status: string
  budgetCents: number | null
  currency: string
  categoryId: string | null
  client: { name: string | null; email: string }
  createdAt: string
}

interface PaginatedMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function MarketplaceJobs() {
  const { user } = useAdminSession()
  const [jobs, setJobs] = useState<Job[]>([])
  const [meta, setMeta] = useState<PaginatedMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchJobs = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(page))
      params.set('limit', '20')

      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/admin/marketplace/jobs?${params}`, {
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const result = await res.json()

      if (result.error) {
        toast.error(result.error)
        setError(result.error)
        return
      }

      setJobs(result.data)
      setMeta(result.meta)
    } catch (error) {
      console.error('Jobs fetch error:', error)
      toast.error('Failed to load jobs')
      setError('Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const formatMoney = (cents: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      OPEN: 'bg-green-100 text-green-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-gray-100 text-gray-800',
      CANCELLED: 'bg-red-100 text-red-800',
      ON_HOLD: 'bg-yellow-100 text-yellow-800',
    }
    return <span className={`px-3 py-1 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketplace Jobs</h1>
          <p className="text-gray-600 mt-1">{meta.total} total jobs</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="p-4 md:p-6 border-b">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search jobs..."
                className="input-field pl-9 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="input-field w-40"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="ON_HOLD">On Hold</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <FiAlertCircle className="w-12 h-12 text-red-500" />
              <p className="text-gray-600">{error}</p>
              <button onClick={() => fetchJobs()} className="btn-primary px-4 py-2 rounded-lg text-sm">Try Again</button>
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <FiBriefcase className="w-12 h-12 text-gray-300" />
              <p className="text-gray-500">No jobs found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Budget</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-4 md:px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-4 text-sm font-medium text-gray-900">{job.title}</td>
                    <td className="px-4 md:px-6 py-4 text-sm text-gray-600">{job.client.name || job.client.email}</td>
                    <td className="px-4 md:px-6 py-4 text-sm font-medium text-gray-900">
                      {job.budgetCents ? formatMoney(job.budgetCents) : '\u2014'}
                    </td>
                    <td className="px-4 md:px-6 py-4">{statusBadge(job.status)}</td>
                    <td className="px-4 md:px-6 py-4 text-sm text-gray-500">{new Date(job.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 md:px-6 py-4">
                      <a
                        href={`/admin/marketplace/jobs/${job.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        <FiEye className="w-4 h-4" /> View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {meta.page} of {meta.totalPages}</p>
          <div className="flex gap-2">
            <button
              className="btn-outline px-3 py-2 rounded-lg text-sm disabled:opacity-50"
              disabled={meta.page <= 1}
              onClick={() => fetchJobs(meta.page - 1)}
            >
              <FiChevronLeft className="w-4 h-4" />
            </button>
            <button
              className="btn-outline px-3 py-2 rounded-lg text-sm disabled:opacity-50"
              disabled={meta.page >= meta.totalPages}
              onClick={() => fetchJobs(meta.page + 1)}
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
