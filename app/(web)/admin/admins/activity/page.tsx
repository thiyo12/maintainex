'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  FiActivity, FiUsers, FiClock, FiShield, FiFilter, FiRefreshCw,
  FiEye, FiArrowRight, FiCircle, FiSearch, FiCalendar, FiChevronDown,
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import AdminLayout from '@/components/admin/AdminLayout'

interface StaffMember {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  lastLoginAt: string | null
  actionsToday: number
  actionsThisWeek: number
  lastActiveAt: string | null
  isOnline: boolean
  actionBreakdown: {
    kycReviews: number
    userActions: number
    jobActions: number
  }
}

interface ActivityEntry {
  id: string
  adminUserId: string
  adminEmail: string
  adminName: string
  adminRole: string
  action: string
  targetTable: string | null
  targetId: string | null
  targetLabel: string | null
  ipAddress: string
  createdAt: string
}

interface ActivityData {
  staff: StaffMember[]
  recentActivity: ActivityEntry[]
  summary: {
    totalStaff: number
    onlineNow: number
    actionsToday: number
    actionsThisWeek: number
  }
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'text-purple-400', bg: 'bg-purple-500/20 border-purple-500/30' },
  OPERATIONS: { label: 'Operations', color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30' },
  FINANCE: { label: 'Finance', color: 'text-green-400', bg: 'bg-green-500/20 border-green-500/30' },
  SUPPORT: { label: 'Support', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30' },
  MODERATOR: { label: 'Moderator', color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/30' },
}

const ACTION_COLORS: Record<string, { text: string; bg: string }> = {
  KYC_APPROVE: { text: 'text-green-400', bg: 'bg-green-500/10' },
  CREATE: { text: 'text-green-400', bg: 'bg-green-500/10' },
  UNSUSPEND: { text: 'text-green-400', bg: 'bg-green-500/10' },
  UNBAN: { text: 'text-green-400', bg: 'bg-green-500/10' },
  BAN: { text: 'text-red-400', bg: 'bg-red-500/10' },
  SUSPEND: { text: 'text-red-400', bg: 'bg-red-500/10' },
  DELETE: { text: 'text-red-400', bg: 'bg-red-500/10' },
  KYC_REJECT: { text: 'text-red-400', bg: 'bg-red-500/10' },
  UPDATE: { text: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  SETTINGS_UPDATE: { text: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  LOGIN: { text: 'text-blue-400', bg: 'bg-blue-500/10' },
  VIEW: { text: 'text-blue-400', bg: 'bg-blue-500/10' },
  EXPORT: { text: 'text-blue-400', bg: 'bg-blue-500/10' },
}

const ACTION_TYPES = [
  'ALL', 'KYC_APPROVE', 'KYC_REJECT', 'CREATE', 'UPDATE', 'DELETE',
  'BAN', 'UNBAN', 'SUSPEND', 'UNSUSPEND', 'LOGIN', 'VIEW', 'EXPORT',
  'SETTINGS_UPDATE',
]

function getActionColor(action: string) {
  return ACTION_COLORS[action] || { text: 'text-gray-400', bg: 'bg-gray-500/10' }
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export default function StaffActivityMonitor() {
  const { user } = useAdminSession()
  const [data, setData] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [filterAdmin, setFilterAdmin] = useState('ALL')
  const [filterAction, setFilterAction] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      const res = await fetch('/api/admin/staff/activity', { headers: { } })
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      const result = await res.json()
      if (result.error) {
        toast.error(result.error)
        return
      }
      setData(result)
    } catch {
      toast.error('Failed to load staff activity')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const filteredActivity = (data?.recentActivity || []).filter((entry) => {
    if (filterAdmin !== 'ALL' && entry.adminUserId !== filterAdmin) return false
    if (filterAction !== 'ALL' && entry.action !== filterAction) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const searchable = [
        entry.adminName, entry.adminEmail, entry.action,
        entry.targetTable, entry.targetLabel, entry.targetId,
      ].filter(Boolean).join(' ').toLowerCase()
      if (!searchable.includes(q)) return false
    }
    return true
  })

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center p-8 bg-[#15161E] rounded-xl border border-white/5">
            <FiShield className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white mb-1">Access Denied</h2>
            <p className="text-gray-400 text-sm">Super Admin privileges required.</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Staff Activity Monitor</h1>
            <p className="text-gray-400 text-sm mt-1">Real-time overview of all admin staff actions</p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#15161E] border border-white/10 text-gray-300 rounded-lg text-sm hover:border-amber-500/50 hover:text-amber-400 transition-colors disabled:opacity-50"
          >
            <FiRefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#15161E] border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <FiUsers className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{data.summary.totalStaff}</p>
                    <p className="text-xs text-gray-400">Total Staff</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#15161E] border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <FiCircle className="w-5 h-5 text-green-400 fill-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{data.summary.onlineNow}</p>
                    <p className="text-xs text-gray-400">Online Now</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#15161E] border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <FiActivity className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{data.summary.actionsToday}</p>
                    <p className="text-xs text-gray-400">Actions Today</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#15161E] border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <FiCalendar className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{data.summary.actionsThisWeek}</p>
                    <p className="text-xs text-gray-400">Actions This Week</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Staff Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {data.staff.map((member) => {
                  const roleCfg = ROLE_CONFIG[member.role] || ROLE_CONFIG.SUPPORT
                  return (
                    <div
                      key={member.id}
                      className="bg-[#15161E] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                              <span className="text-amber-400 font-semibold text-sm">
                                {member.name.split(' ').map((n) => n[0]).join('')}
                              </span>
                            </div>
                            {member.isOnline && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[#15161E]" />
                            )}
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">{member.name}</p>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${roleCfg.bg} ${roleCfg.color}`}>
                              <FiShield size={8} />
                              {roleCfg.label}
                            </span>
                          </div>
                        </div>
                        <a
                          href={`/admin/admins/activity?view=${member.id}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                          title="View full activity log"
                        >
                          <FiArrowRight size={14} />
                        </a>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="text-center">
                          <p className="text-lg font-bold text-white">{member.actionsToday}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Today</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-white">{member.actionsThisWeek}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Week</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-white">
                            {member.isOnline ? (
                              <span className="text-green-400">Online</span>
                            ) : (
                              <span className="text-gray-500">Offline</span>
                            )}
                          </p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Status</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <FiClock size={10} />
                        Last active: {member.lastActiveAt ? formatRelativeTime(member.lastActiveAt) : 'Never'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-white">Live Activity Feed</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      showFilters
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-[#15161E] text-gray-400 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <FiFilter size={12} />
                    Filters
                  </button>
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    Auto-refresh 30s
                  </span>
                </div>
              </div>

              {showFilters && (
                <div className="bg-[#15161E] border border-white/5 rounded-xl p-4 mb-4 flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Search</label>
                    <div className="relative">
                      <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
                      <input
                        type="text"
                        placeholder="Search actions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Staff Member</label>
                    <div className="relative">
                      <select
                        value={filterAdmin}
                        onChange={(e) => setFilterAdmin(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500/50 appearance-none"
                      >
                        <option value="ALL">All Staff</option>
                        {data.staff.map((s) => (
                          <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                        ))}
                      </select>
                      <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={12} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Action Type</label>
                    <div className="relative">
                      <select
                        value={filterAction}
                        onChange={(e) => setFilterAction(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-amber-500/50 appearance-none"
                      >
                        {ACTION_TYPES.map((a) => (
                          <option key={a} value={a}>{a === 'ALL' ? 'All Actions' : a.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                      <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={12} />
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-[#15161E] border border-white/5 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Time</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Staff Member</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Action</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs hidden lg:table-cell">Target</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs hidden md:table-cell">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActivity.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-gray-500 text-sm">
                            No activity found matching your filters
                          </td>
                        </tr>
                      ) : (
                        filteredActivity.map((entry) => {
                          const actionColor = getActionColor(entry.action)
                          const roleCfg = ROLE_CONFIG[entry.adminRole] || ROLE_CONFIG.SUPPORT
                          return (
                            <tr key={entry.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="text-white text-xs">{formatTime(entry.createdAt)}</span>
                                  <span className="text-gray-500 text-[10px]">{formatRelativeTime(entry.createdAt)}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 bg-amber-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-amber-400 font-semibold text-[10px]">
                                      {entry.adminName.split(' ').map((n) => n[0]).join('')}
                                    </span>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-white text-xs font-medium truncate">{entry.adminName}</p>
                                    <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium border ${roleCfg.bg} ${roleCfg.color}`}>
                                      {roleCfg.label}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${actionColor.bg} ${actionColor.text}`}>
                                  {entry.action.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell">
                                <div className="text-xs">
                                  {entry.targetTable && (
                                    <span className="text-gray-300">{entry.targetTable}</span>
                                  )}
                                  {entry.targetLabel && (
                                    <p className="text-gray-500 text-[10px] truncate max-w-[200px]">{entry.targetLabel}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <span className="text-gray-500 text-xs font-mono">{entry.ipAddress}</span>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Workload Distribution</h2>
              <div className="bg-[#15161E] border border-white/5 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Staff Member</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs">Role</th>
                        <th className="text-center px-4 py-3 text-gray-400 font-medium text-xs">Actions Today</th>
                        <th className="text-center px-4 py-3 text-gray-400 font-medium text-xs hidden sm:table-cell">Actions This Week</th>
                        <th className="text-center px-4 py-3 text-gray-400 font-medium text-xs hidden md:table-cell">KYC Reviews</th>
                        <th className="text-center px-4 py-3 text-gray-400 font-medium text-xs hidden md:table-cell">User Actions</th>
                        <th className="text-center px-4 py-3 text-gray-400 font-medium text-xs hidden lg:table-cell">Job Actions</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs hidden lg:table-cell">Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.staff.map((member) => {
                        const roleCfg = ROLE_CONFIG[member.role] || ROLE_CONFIG.SUPPORT
                        const maxActions = Math.max(...data.staff.map((s) => s.actionsToday), 1)
                        const barWidth = (member.actionsToday / maxActions) * 100
                        return (
                          <tr key={member.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="relative">
                                  <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                                    <span className="text-amber-400 font-semibold text-[10px]">
                                      {member.name.split(' ').map((n) => n[0]).join('')}
                                    </span>
                                  </div>
                                  {member.isOnline && (
                                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#15161E]" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-white text-xs font-medium">{member.name}</p>
                                  <p className="text-gray-500 text-[10px]">{member.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${roleCfg.bg} ${roleCfg.color}`}>
                                <FiShield size={8} />
                                {roleCfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-white font-bold text-sm">{member.actionsToday}</span>
                                <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-amber-500 rounded-full transition-all"
                                    style={{ width: `${barWidth}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-white font-medium hidden sm:table-cell">
                              {member.actionsThisWeek}
                            </td>
                            <td className="px-4 py-3 text-center hidden md:table-cell">
                              <span className="text-blue-400 font-medium">{member.actionBreakdown.kycReviews}</span>
                            </td>
                            <td className="px-4 py-3 text-center hidden md:table-cell">
                              <span className="text-yellow-400 font-medium">{member.actionBreakdown.userActions}</span>
                            </td>
                            <td className="px-4 py-3 text-center hidden lg:table-cell">
                              <span className="text-green-400 font-medium">{member.actionBreakdown.jobActions}</span>
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              <div className="flex items-center gap-1 text-xs text-gray-400">
                                <FiClock size={10} />
                                {member.lastActiveAt ? formatRelativeTime(member.lastActiveAt) : 'Never'}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}