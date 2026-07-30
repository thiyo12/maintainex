'use client'

import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '@/components/admin/AdminLayout'
import { getAuthHeader } from '@/lib/auth-client'
import {
  FiSearch, FiEye, FiUsers, FiRefreshCw, FiChevronLeft, FiChevronRight,
  FiChevronsLeft, FiChevronsRight, FiX, FiUserX, FiUserCheck, FiClock,
  FiFilter, FiArrowDown, FiArrowUp, FiCheckCircle, FiXCircle, FiStar,
  FiExternalLink, FiShield
} from 'react-icons/fi'
import toast from 'react-hot-toast'

interface TaskerUser {
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
  taskerProfile?: {
    id: string
    mxId?: string | null
    verificationStatus: string
    verificationNote?: string | null
    verifiedAt?: string | null
    bio?: string | null
    rating: number
    completedJobs: number
    isVerified: boolean
    experienceProofUrl?: string | null
    hasDrivingLicense: boolean
    drivingLicenseUrl?: string | null
    skills?: string | null
    serviceAreas?: string | null
    hourlyRate: number
  } | null
}

interface ApiResponse {
  users: TaskerUser[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type SortField = 'name' | 'email' | 'createdAt' | 'mxId' | 'rating'
type SortDir = 'asc' | 'desc'

function TaskerPageContent() {
  const [taskers, setTaskers] = useState<TaskerUser[]>([])
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
  const [viewUser, setViewUser] = useState<TaskerUser | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ userId: string; action: string; label: string } | null>(null)
  const [reason, setReason] = useState('')

  const fetchTaskers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: 'tasker',
        page: page.toString(),
        pageSize: '20',
      })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { ...getAuthHeader() },
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const data: ApiResponse = await res.json()
      setTaskers(data.users)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Failed to fetch taskers:', error)
      toast.error('Failed to load taskers')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => {
    fetchTaskers()
  }, [fetchTaskers])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  const handleAction = async () => {
    if (!confirmAction) return
    setActionLoading(confirmAction.userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
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

      toast.success(`Tasker ${confirmAction.action === 'ban' || confirmAction.action === 'unban' ? confirmAction.action + 'ned' : confirmAction.action === 'suspend' || confirmAction.action === 'unsuspend' ? confirmAction.action + 'ed' : confirmAction.action + 'd'} successfully`)
      setConfirmAction(null)
      setReason('')
      fetchTaskers()
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

  const sortedTaskers = [...taskers].sort((a, b) => {
    let valA: any = ''
    let valB: any = ''
    if (sortField === 'name') { valA = a.name; valB = b.name }
    else if (sortField === 'email') { valA = a.email; valB = b.email }
    else if (sortField === 'mxId') { valA = a.mxId || ''; valB = b.mxId || '' }
    else if (sortField === 'rating') { valA = a.taskerProfile?.rating || 0; valB = b.taskerProfile?.rating || 0 }
    else if (sortField === 'createdAt') { valA = a.createdAt; valB = b.createdAt }
    if (typeof valA === 'number' && typeof valB === 'number') return sortDir === 'asc' ? valA - valB : valB - valA
    const cmp = String(valA).localeCompare(String(valB))
    return sortDir === 'asc' ? cmp : -cmp
  })

  const getStatus = (u: TaskerUser) => {
    if (u.isBanned) return { label: 'Banned', color: 'bg-red-500/20 text-red-400 border border-red-500/30' }
    if (u.isSuspended) return { label: 'Suspended', color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' }
    return { label: 'Active', color: 'bg-green-500/20 text-green-400 border border-green-500/30' }
  }

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return { label: 'Verified', color: 'bg-green-500/20 text-green-400 border border-green-500/30', icon: FiCheckCircle }
      case 'REJECTED':
        return { label: 'Rejected', color: 'bg-red-500/20 text-red-400 border border-red-500/30', icon: FiXCircle }
      default:
        return { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', icon: FiClock }
    }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <FiArrowDown className="text-gray-600 ml-1" size={12} />
    return sortDir === 'asc'
      ? <FiArrowUp className="text-amber-500 ml-1" size={12} />
      : <FiArrowDown className="text-amber-500 ml-1" size={12} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasker Management</h1>
          <p className="text-gray-400 text-sm mt-1">{total} taskers registered on the platform</p>
        </div>
        <button
          onClick={fetchTaskers}
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
                placeholder="Search by name, email, MXT ID, or phone..."
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
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-16 text-center">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading taskers...</p>
          </div>
        ) : sortedTaskers.length === 0 ? (
          <div className="p-16 text-center">
            <FiUsers className="w-14 h-14 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No taskers found</p>
            <p className="text-gray-600 text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('mxId')} className="flex items-center hover:text-white transition-colors">
                        MXT ID <SortIcon field="mxId" />
                      </button>
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('name')} className="flex items-center hover:text-white transition-colors">
                        Name <SortIcon field="name" />
                      </button>
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Phone</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Verification</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      <button onClick={() => handleSort('rating')} className="flex items-center hover:text-white transition-colors">
                        Rating <SortIcon field="rating" />
                      </button>
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Jobs</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTaskers.map((tasker) => {
                    const status = getStatus(tasker)
                    const verification = getVerificationBadge(tasker.taskerProfile?.verificationStatus || 'PENDING')
                    const VerificationIcon = verification.icon
                    return (
                      <tr key={tasker.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-4">
                          <span className="text-amber-400 font-mono text-sm font-medium">{tasker.taskerProfile?.mxId || tasker.mxId || '—'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-amber-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-amber-400 font-semibold text-sm">{tasker.name[0]?.toUpperCase()}</span>
                            </div>
                            <span className="text-white font-medium text-sm">{tasker.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-400 text-sm">{tasker.email}</td>
                        <td className="px-5 py-4 text-gray-400 text-sm">{tasker.phone || '—'}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${verification.color}`}>
                            <VerificationIcon size={12} />
                            {verification.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <FiStar size={14} className="text-amber-400" />
                            <span className="text-white text-sm font-medium">{tasker.taskerProfile?.rating?.toFixed(1) || '0.0'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-white text-sm">{tasker.taskerProfile?.completedJobs || 0}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setViewUser(tasker)}
                              className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <FiEye size={16} />
                            </button>
                            {tasker.taskerProfile?.verificationStatus === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => setConfirmAction({ userId: tasker.id, action: 'verify_tasker', label: 'Verify' })}
                                  className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                                  title="Verify"
                                >
                                  <FiCheckCircle size={16} />
                                </button>
                                <button
                                  onClick={() => setConfirmAction({ userId: tasker.id, action: 'reject_tasker', label: 'Reject' })}
                                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                  title="Reject"
                                >
                                  <FiXCircle size={16} />
                                </button>
                              </>
                            )}
                            {!tasker.isBanned && !tasker.isSuspended && (
                              <button
                                onClick={() => setConfirmAction({ userId: tasker.id, action: 'suspend', label: 'Suspend' })}
                                className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors"
                                title="Suspend"
                              >
                                <FiClock size={16} />
                              </button>
                            )}
                            {tasker.isSuspended && (
                              <button
                                onClick={() => setConfirmAction({ userId: tasker.id, action: 'unsuspend', label: 'Unsuspend' })}
                                className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                                title="Unsuspend"
                              >
                                <FiUserCheck size={16} />
                              </button>
                            )}
                            {!tasker.isBanned && (
                              <button
                                onClick={() => setConfirmAction({ userId: tasker.id, action: 'ban', label: 'Ban' })}
                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Ban"
                              >
                                <FiUserX size={16} />
                              </button>
                            )}
                            {tasker.isBanned && (
                              <button
                                onClick={() => setConfirmAction({ userId: tasker.id, action: 'unban', label: 'Unban' })}
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
                Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total} taskers
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
              <h3 className="text-lg font-bold text-white">Tasker Details</h3>
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
                  <p className="text-amber-400 font-mono text-sm">{viewUser.taskerProfile?.mxId || viewUser.mxId || 'No MXT ID'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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

              {viewUser.taskerProfile && (
                <div className="mt-4">
                  <h5 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Tasker Profile</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#0B0C12] rounded-lg p-3 border border-white/5">
                      <p className="text-gray-500 text-xs mb-1">Rating</p>
                      <div className="flex items-center gap-1">
                        <FiStar size={14} className="text-amber-400" />
                        <span className="text-white text-sm font-medium">{viewUser.taskerProfile.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="bg-[#0B0C12] rounded-lg p-3 border border-white/5">
                      <p className="text-gray-500 text-xs mb-1">Completed Jobs</p>
                      <p className="text-white text-sm">{viewUser.taskerProfile.completedJobs}</p>
                    </div>
                    <div className="bg-[#0B0C12] rounded-lg p-3 border border-white/5">
                      <p className="text-gray-500 text-xs mb-1">Hourly Rate</p>
                      <p className="text-white text-sm">LKR {viewUser.taskerProfile.hourlyRate}</p>
                    </div>
                    <div className="bg-[#0B0C12] rounded-lg p-3 border border-white/5">
                      <p className="text-gray-500 text-xs mb-1">Driving License</p>
                      <div className="flex items-center gap-1">
                        {viewUser.taskerProfile.hasDrivingLicense ? (
                          <FiCheckCircle size={14} className="text-green-400" />
                        ) : (
                          <FiXCircle size={14} className="text-gray-500" />
                        )}
                        <span className="text-white text-sm">{viewUser.taskerProfile.hasDrivingLicense ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>

                  {viewUser.taskerProfile.experienceProofUrl && (
                    <div className="mt-3 bg-[#0B0C12] rounded-lg p-3 border border-white/5">
                      <p className="text-gray-500 text-xs mb-1">Experience Proof</p>
                      <a
                        href={viewUser.taskerProfile.experienceProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm"
                      >
                        <FiExternalLink size={14} />
                        View Document
                      </a>
                    </div>
                  )}

                  {viewUser.taskerProfile.drivingLicenseUrl && (
                    <div className="mt-3 bg-[#0B0C12] rounded-lg p-3 border border-white/5">
                      <p className="text-gray-500 text-xs mb-1">Driving License</p>
                      <a
                        href={viewUser.taskerProfile.drivingLicenseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm"
                      >
                        <FiExternalLink size={14} />
                        View License
                      </a>
                    </div>
                  )}

                  {viewUser.taskerProfile.skills && (
                    <div className="mt-3 bg-[#0B0C12] rounded-lg p-3 border border-white/5">
                      <p className="text-gray-500 text-xs mb-1">Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {viewUser.taskerProfile.skills.split(',').map((skill, i) => (
                          <span key={i} className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-xs rounded-full border border-amber-500/20">
                            {skill.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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
                Are you sure you want to {confirmAction.action.replace('_', ' ')} this tasker?
              </p>
              {(confirmAction.action === 'suspend' || confirmAction.action === 'ban' || confirmAction.action === 'reject_tasker') && (
                <div className="mb-4">
                  <label className="block text-gray-400 text-xs font-semibold mb-1.5">Reason (optional)</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason..."
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
                    confirmAction.action === 'ban' || confirmAction.action === 'reject_tasker'
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

export default function TaskersPage() {
  return (
    <AdminLayout>
      <TaskerPageContent />
    </AdminLayout>
  )
}
