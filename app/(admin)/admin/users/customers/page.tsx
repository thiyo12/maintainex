'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  FiSearch, FiEye, FiUsers, FiRefreshCw, FiChevronLeft, FiChevronRight,
  FiChevronsLeft, FiChevronsRight, FiX, FiUserX, FiUserCheck, FiClock,
  FiFilter, FiArrowDown, FiArrowUp
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'

interface CustomerUser {
  id: string
  mxId?: string | null
  name: string
  email: string
  phone?: string | null
  isActive: boolean
  isSuspended: boolean
  isBanned: boolean
  banReason?: string | null
  suspensionReason?: string | null
  createdAt: string
  customerProfile?: {
    id: string
    customerType: string
    status: string
    totalBookings: number
    totalSpent: number
    lifetimeValue: number
    lastBooking?: string | null
    province?: string | null
  } | null
}

interface ApiResponse {
  users: CustomerUser[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type SortField = 'name' | 'email' | 'createdAt' | 'mxId'
type SortDir = 'asc' | 'desc'

function CustomerPageContent() {
  const { user: admin } = useAdminSession()
  const role = (admin?.role || 'SUPPORT') as AdminRole
  const permissions = ROLE_PERMISSIONS[role] || []
  const canSuspend = permissions.includes('users:suspend')
  const canBan = permissions.includes('users:ban')
  const [customers, setCustomers] = useState<CustomerUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewUser, setViewUser] = useState<CustomerUser | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ userId: string; action: string; label: string } | null>(null)
  const [reason, setReason] = useState('')

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: 'customer',
        page: page.toString(),
        pageSize: '20',
      })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { },
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const data: ApiResponse = await res.json()
      setCustomers(data.users)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Failed to fetch customers:', error)
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  const handleAction = async () => {
    if (!confirmAction) return
    const isSuspendAction = confirmAction.action === 'suspend' || confirmAction.action === 'unsuspend'
    const isBanAction = confirmAction.action === 'ban' || confirmAction.action === 'unban'
    if ((isSuspendAction && !canSuspend) || (isBanAction && !canBan)) return
    setActionLoading(confirmAction.userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: confirmAction.userId,
          action: confirmAction.action,
          reason: reason || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Action failed')
      }

      toast.success(`User ${confirmAction.action}d successfully`)
      setConfirmAction(null)
      setReason('')
      fetchCustomers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to perform action')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sortedCustomers = [...customers].sort((a, b) => {
    let valA = ''
    let valB = ''
    if (sortField === 'name') { valA = a.name; valB = b.name }
    else if (sortField === 'email') { valA = a.email; valB = b.email }
    else if (sortField === 'mxId') { valA = a.mxId || ''; valB = b.mxId || '' }
    else if (sortField === 'createdAt') { valA = a.createdAt; valB = b.createdAt }
    const cmp = valA.localeCompare(valB)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const getStatus = (u: CustomerUser) => {
    if (u.isBanned) return { label: 'Banned', color: 'bg-red-500/20 text-red-400 border border-red-500/30' }
    if (u.isSuspended) return { label: 'Suspended', color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' }
    return { label: 'Active', color: 'bg-green-500/20 text-green-400 border border-green-500/30' }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <FiArrowDown className="text-gray-600 ml-1" size={12} />
    return sortDir === 'asc'
      ? <FiArrowUp className="text-amber-500 ml-1" size={12} />
      : <FiArrowDown className="text-amber-500 ml-1" size={12} />
  }

  const countries = [...new Set(customers.map(c => c.customerProfile?.province).filter(Boolean))] as string[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Customer Management</h1>
          <p className="text-gray-400 text-sm mt-1">{total} customers registered on the platform</p>
        </div>
        <button
          onClick={fetchCustomers}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#15161E] text-amber-400 border border-white/10 hover:bg-white/5 transition-colors"
        >
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="bg-[#15161E] rounded-xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name, email, MXU ID, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm bg-[#0B0C12] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                showFilters || statusFilter
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-[#0B0C12] text-gray-400 border-white/10 hover:text-white'
              }`}
            >
              <FiFilter size={16} />
              Filters
              {statusFilter && (
                <span className="w-5 h-5 bg-amber-500 text-[#0B0C12] rounded-full text-xs flex items-center justify-center font-bold">1</span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 flex flex-wrap gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm bg-[#0B0C12] border border-white/10 text-white focus:outline-none focus:border-amber-500/50"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
              </select>
              {statusFilter && (
                <button
                  onClick={() => setStatusFilter('')}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 border border-red-500/20"
                >
                  <FiX size={14} />
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-16 text-center">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading customers...</p>
          </div>
        ) : sortedCustomers.length === 0 ? (
          <div className="p-16 text-center">
            <FiUsers className="w-14 h-14 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No customers found</p>
            <p className="text-gray-600 text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('mxId')} className="flex items-center hover:text-white transition-colors">
                        MXU ID <SortIcon field="mxId" />
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('name')} className="flex items-center hover:text-white transition-colors">
                        Name <SortIcon field="name" />
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('email')} className="flex items-center hover:text-white transition-colors">
                        Email <SortIcon field="email" />
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Country</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('createdAt')} className="flex items-center hover:text-white transition-colors">
                        Joined <SortIcon field="createdAt" />
                      </button>
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCustomers.map((customer) => {
                    const status = getStatus(customer)
                    return (
                      <tr
                        key={customer.id}
                        className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="text-amber-400 font-mono text-sm font-medium">{customer.mxId || '—'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-amber-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-amber-400 font-semibold text-sm">{customer.name[0]?.toUpperCase()}</span>
                            </div>
                            <span className="text-white font-medium text-sm">{customer.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-sm">{customer.email}</td>
                        <td className="px-6 py-4 text-gray-400 text-sm">{customer.phone || '—'}</td>
                        <td className="px-6 py-4 text-gray-400 text-sm">{customer.customerProfile?.province || '—'}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-sm">{formatDate(customer.createdAt)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/admin/users/${customer.id}`}
                              className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                              title="Open 360"
                            >
                              <FiEye size={16} />
                            </Link>
                            {canSuspend && !customer.isBanned && !customer.isSuspended && (
                              <button
                                onClick={() => setConfirmAction({ userId: customer.id, action: 'suspend', label: 'Suspend' })}
                                className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors"
                                title="Suspend"
                              >
                                <FiClock size={16} />
                              </button>
                            )}
                            {canSuspend && customer.isSuspended && (
                              <button
                                onClick={() => setConfirmAction({ userId: customer.id, action: 'unsuspend', label: 'Unsuspend' })}
                                className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                                title="Unsuspend"
                              >
                                <FiUserCheck size={16} />
                              </button>
                            )}
                            {canBan && !customer.isBanned && (
                              <button
                                onClick={() => setConfirmAction({ userId: customer.id, action: 'ban', label: 'Ban' })}
                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Ban"
                              >
                                <FiUserX size={16} />
                              </button>
                            )}
                            {canBan && customer.isBanned && (
                              <button
                                onClick={() => setConfirmAction({ userId: customer.id, action: 'unban', label: 'Unban' })}
                                className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                                title="Unban"
                              >
                                <FiUserCheck size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between p-4 border-t border-white/5">
              <div className="text-sm text-gray-400">
                Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total} customers
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <FiChevronsLeft size={16} />
                </button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <FiChevronLeft size={16} />
                </button>
                <span className="px-3 py-1 text-sm text-white bg-amber-500/10 rounded-lg border border-amber-500/20">
                  {page} / {totalPages}
                </span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <FiChevronRight size={16} />
                </button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <FiChevronsRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {viewUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewUser(null)}>
          <div className="bg-[#15161E] rounded-2xl border border-white/10 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h3 className="text-lg font-bold text-white">Customer Details</h3>
              <button onClick={() => setViewUser(null)} className="text-gray-400 hover:text-white transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center">
                  <span className="text-amber-400 font-bold text-xl">{viewUser.name[0]?.toUpperCase()}</span>
                </div>
                <div>
                  <h4 className="text-white font-semibold text-lg">{viewUser.name}</h4>
                  <p className="text-amber-400 font-mono text-sm">{viewUser.mxId || 'No MXU ID'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0B0C12] rounded-lg p-3 border border-white/5">
                  <p className="text-gray-500 text-xs mb-1">Email</p>
                  <p className="text-white text-sm break-all">{viewUser.email}</p>
                </div>
                <div className="bg-[#0B0C12] rounded-lg p-3 border border-white/5">
                  <p className="text-gray-500 text-xs mb-1">Phone</p>
                  <p className="text-white text-sm">{viewUser.phone || '—'}</p>
                </div>
                <div className="bg-[#0B0C12] rounded-lg p-3 border border-white/5">
                  <p className="text-gray-500 text-xs mb-1">Status</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatus(viewUser).color}`}>
                    {getStatus(viewUser).label}
                  </span>
                </div>
                <div className="bg-[#0B0C12] rounded-lg p-3 border border-white/5">
                  <p className="text-gray-500 text-xs mb-1">Joined</p>
                  <p className="text-white text-sm">{formatDate(viewUser.createdAt)}</p>
                </div>
              </div>

              {viewUser.customerProfile && (
                <div className="mt-4">
                  <h5 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Profile</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#0B0C12] rounded-lg p-3 border border-white/5">
                      <p className="text-gray-500 text-xs mb-1">Type</p>
                      <p className="text-white text-sm">{viewUser.customerProfile.customerType}</p>
                    </div>
                    <div className="bg-[#0B0C12] rounded-lg p-3 border border-white/5">
                      <p className="text-gray-500 text-xs mb-1">Bookings</p>
                      <p className="text-white text-sm">{viewUser.customerProfile.totalBookings}</p>
                    </div>
                    <div className="bg-[#0B0C12] rounded-lg p-3 border border-white/5">
                      <p className="text-gray-500 text-xs mb-1">Total Spent</p>
                      <p className="text-white text-sm">LKR {viewUser.customerProfile.totalSpent.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#0B0C12] rounded-lg p-3 border border-white/5">
                      <p className="text-gray-500 text-xs mb-1">Province</p>
                      <p className="text-white text-sm">{viewUser.customerProfile.province || '—'}</p>
                    </div>
                  </div>
                </div>
              )}

              {viewUser.banReason && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-red-400 text-xs font-semibold mb-1">Ban Reason</p>
                  <p className="text-red-300 text-sm">{viewUser.banReason}</p>
                </div>
              )}
              {viewUser.suspensionReason && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <p className="text-yellow-400 text-xs font-semibold mb-1">Suspension Reason</p>
                  <p className="text-yellow-300 text-sm">{viewUser.suspensionReason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setConfirmAction(null); setReason('') }}>
          <div className="bg-[#15161E] rounded-2xl border border-white/10 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-white mb-2">
                Confirm {confirmAction.label}
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Are you sure you want to {confirmAction.action.toLowerCase()} this customer? This action can be reversed later.
              </p>
              {(confirmAction.action === 'suspend' || confirmAction.action === 'ban') && (
                <div className="mb-4">
                  <label className="block text-gray-400 text-xs font-semibold mb-1.5">Reason (optional)</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for this action..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-[#0B0C12] border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setConfirmAction(null); setReason('') }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white border border-white/10 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={actionLoading === confirmAction.userId}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    confirmAction.action === 'ban'
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : confirmAction.action === 'suspend'
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-[#0B0C12]'
                      : 'bg-green-500 hover:bg-green-600 text-[#0B0C12]'
                  } disabled:opacity-50`}
                >
                  {actionLoading === confirmAction.userId ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    `Confirm ${confirmAction.label}`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CustomersPage() {
  return (
    <>
      <CustomerPageContent />
    </>
  )
}