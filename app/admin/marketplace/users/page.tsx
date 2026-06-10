'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { FiSearch, FiChevronLeft, FiChevronRight, FiEye, FiAlertCircle, FiUsers } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface User {
  id: string
  name: string | null
  email: string
  role: string
  identityStatus: string
  isActive: boolean
  isBanned: boolean
  country: string | null
  createdAt: string
}

interface PaginatedMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function MarketplaceUsers() {
  const { user } = useAdminSession()
  const [users, setUsers] = useState<User[]>([])
  const [meta, setMeta] = useState<PaginatedMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [kycFilter, setKycFilter] = useState('')

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (roleFilter) params.set('role', roleFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (kycFilter) params.set('kyc_status', kycFilter)
      params.set('page', String(page))
      params.set('limit', '20')

      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/admin/marketplace/users?${params}`, {
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

      setUsers(result.data)
      setMeta(result.meta)
    } catch (error) {
      console.error('Users fetch error:', error)
      toast.error('Failed to load users')
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, statusFilter, kycFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const statusBadge = (u: User) => {
    if (u.isBanned) return <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Banned</span>
    if (!u.isActive) return <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Suspended</span>
    return <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
  }

  const kycBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED': return <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Verified</span>
      case 'PENDING': return <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>
      case 'REJECTED': return <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Rejected</span>
      default: return <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Not Submitted</span>
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketplace Users</h1>
          <p className="text-gray-600 mt-1">{meta.total} total users</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="p-4 md:p-6 border-b">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                className="input-field pl-9 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="input-field w-36"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="CLIENT">Client</option>
              <option value="WORKER">Worker</option>
              <option value="BOTH">Both</option>
            </select>
            <select
              className="input-field w-36"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
            <select
              className="input-field w-40"
              value={kycFilter}
              onChange={(e) => setKycFilter(e.target.value)}
            >
              <option value="">All KYC</option>
              <option value="VERIFIED">Verified</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
              <option value="NOT_SUBMITTED">Not Submitted</option>
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
              <button onClick={() => fetchUsers()} className="btn-primary px-4 py-2 rounded-lg text-sm">
                Try Again
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2">
              <FiUsers className="w-12 h-12 text-gray-300" />
              <p className="text-gray-500">No users found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">KYC</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                  <th className="px-4 md:px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-4 text-sm font-medium text-gray-900">{u.name || '\u2014'}</td>
                    <td className="px-4 md:px-6 py-4 text-sm text-gray-600">{u.email}</td>
                    <td className="px-4 md:px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{u.role}</span>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm text-gray-600">{u.country || '\u2014'}</td>
                    <td className="px-4 md:px-6 py-4">{kycBadge(u.identityStatus)}</td>
                    <td className="px-4 md:px-6 py-4">{statusBadge(u)}</td>
                    <td className="px-4 md:px-6 py-4 text-sm text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <a
                        href={`/admin/marketplace/users/${u.id}`}
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
          <p className="text-sm text-gray-500">
            Page {meta.page} of {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              className="btn-outline px-3 py-2 rounded-lg text-sm disabled:opacity-50"
              disabled={meta.page <= 1}
              onClick={() => fetchUsers(meta.page - 1)}
            >
              <FiChevronLeft className="w-4 h-4" />
            </button>
            <button
              className="btn-outline px-3 py-2 rounded-lg text-sm disabled:opacity-50"
              disabled={meta.page >= meta.totalPages}
              onClick={() => fetchUsers(meta.page + 1)}
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
