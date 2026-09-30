'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiUserCheck, FiPlus, FiEdit2, FiTrash2, FiX, FiSearch,
  FiShield, FiClock, FiMail, FiUser, FiActivity
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'

interface AdminUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isActive: boolean
  lastLoginAt: string | null
  createdBy: string | null
  createdByName: string | null
  createdAt: string
  totpEnabled: boolean
  actionsToday: number
  lastActiveAt: string | null
  isOnline: boolean
  assignedCountries: string[]
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'text-purple-400', bg: 'bg-purple-500/20 border-purple-500/30' },
  MANAGER: { label: 'Manager', color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30' },
  FINANCE: { label: 'Finance', color: 'text-green-400', bg: 'bg-green-500/20 border-green-500/30' },
  SUPPORT: { label: 'Support', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30' },
  USER_MANAGEMENT: { label: 'User Management', color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/30' },
  TECHNICAL: { label: 'Technical', color: 'text-cyan-400', bg: 'bg-cyan-500/20 border-cyan-500/30' },
}

const ROLES = ['SUPER_ADMIN', 'MANAGER', 'FINANCE', 'SUPPORT', 'USER_MANAGEMENT', 'TECHNICAL']

export default function AdminManagement() {
  const { user } = useAdminSession()
  const role = (user?.role || 'SUPPORT') as AdminRole
  const permissions = ROLE_PERMISSIONS[role] || []
  const canView = permissions.includes('admins:view')
  const canCreate = permissions.includes('admins:create')
  const canEdit = permissions.includes('admins:edit')
  const canDelete = permissions.includes('admins:delete')
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'SUPPORT',
    password: '',
    assignedCountries: '',
  })

  const fetchAdmins = useCallback(async () => {
    if (!canView) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/admin/admins', { headers: { } })
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const data = await res.json()
      setAdmins(data.admins || [])
    } catch {
      toast.error('Failed to load admins')
    } finally {
      setLoading(false)
    }
  }, [canView])

  useEffect(() => { fetchAdmins() }, [fetchAdmins])

  const filteredAdmins = admins.filter((a) => {
    const q = searchQuery.toLowerCase()
    return (
      a.firstName.toLowerCase().includes(q) ||
      a.lastName.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q)
    )
  })

  const openCreateModal = () => {
    if (!canCreate) return
    setEditingAdmin(null)
    setForm({ email: '', firstName: '', lastName: '', role: 'SUPPORT', password: '', assignedCountries: '' })
    setShowModal(true)
  }

  const openEditModal = (admin: AdminUser) => {
    if (!canEdit) return
    setEditingAdmin(admin)
    setForm({
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
      password: '',
      assignedCountries: (admin.assignedCountries || []).join(', '),
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingAdmin) {
        if (!canEdit) throw new Error('You do not have permission to edit staff')
        const res = await fetch('/api/admin/admins', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingAdmin.id,
            role: form.role,
            assignedCountries: form.assignedCountries,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to update admin')
        }
        toast.success('Admin updated')
      } else {
        if (!canCreate) throw new Error('You do not have permission to create staff')
        const res = await fetch('/api/admin/admins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed')
        }
        toast.success('Admin created')
      }
      setShowModal(false)
      fetchAdmins()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save admin')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (admin: AdminUser) => {
    if (!canEdit) return
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: admin.id, isActive: !admin.isActive }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update admin')
      }
      toast.success(admin.isActive ? 'Admin deactivated' : 'Admin activated')
      fetchAdmins()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update admin')
    }
  }

  const handleDelete = async (admin: AdminUser) => {
    if (!canDelete) return
    if (!confirm(`Soft delete ${admin.firstName} ${admin.lastName}?`)) return
    try {
      const res = await fetch(`/api/admin/admins?id=${admin.id}`, {
        method: 'DELETE',
        headers: { },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to remove admin')
      }
      toast.success('Admin removed')
      fetchAdmins()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove admin')
    }
  }

  const formatDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  if (!canView) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-center p-8 bg-[#15161E] rounded-xl border border-white/5">
            <FiShield className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white mb-1">Access Denied</h2>
            <p className="text-gray-400 text-sm">Super Admin privileges required.</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Management</h1>
            <p className="text-gray-400 text-sm mt-1">Manage admin users and their roles</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/admins/activity"
              className="flex items-center gap-2 px-4 py-2.5 bg-[#15161E] border border-white/10 text-gray-300 rounded-lg font-medium text-sm hover:border-amber-500/50 hover:text-white transition-colors"
            >
              <FiActivity size={16} />
              Staff Activity
            </Link>
            {canCreate && (<button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-[#0B0C12] rounded-lg font-medium text-sm hover:bg-amber-400 transition-colors"
            >
              <FiPlus size={16} />
              Add New Admin
            </button>)}
          </div>
        </div>

        {(() => {
          const totalCount = filteredAdmins.length
          const onlineCount = filteredAdmins.filter((a) => a.isOnline).length
          const totalActionsToday = filteredAdmins.reduce((sum, a) => sum + a.actionsToday, 0)
          const roleCounts = filteredAdmins.reduce<Record<string, number>>((acc, a) => {
            const label = ROLE_CONFIG[a.role]?.label || a.role
            acc[label] = (acc[label] || 0) + 1
            return acc
          }, {})
          const roleDistribution = Object.entries(roleCounts)
            .map(([role, count]) => `${count} ${role}`)
            .join(', ')

          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#15161E] border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <FiUser size={18} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{totalCount}</p>
                    <p className="text-xs text-gray-400">Total Staff</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#15161E] border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <FiActivity size={18} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{onlineCount}</p>
                    <p className="text-xs text-gray-400">Active (Online)</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#15161E] border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <FiClock size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{totalActionsToday}</p>
                    <p className="text-xs text-gray-400">Actions Today</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#15161E] border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <FiShield size={18} className="text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 mb-0.5">Roles</p>
                    <p className="text-sm font-medium text-white truncate" title={roleDistribution}>
                      {roleDistribution || '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            placeholder="Search admins by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#15161E] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 text-sm"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-[#15161E] rounded-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Email</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Role</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                    <th className="text-center px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Actions Today</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Last Active</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Last Login</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Created By</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-gray-500">
                        No admins found
                      </td>
                    </tr>
                  ) : (
                    filteredAdmins.map((admin) => {
                      const roleCfg = ROLE_CONFIG[admin.role] || ROLE_CONFIG.SUPPORT
                      return (
                        <tr key={admin.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                                <span className="text-amber-400 font-semibold text-xs">
                                  {admin.firstName[0]}{admin.lastName[0]}
                                </span>
                              </div>
                              <span className="text-white font-medium">
                                {admin.firstName} {admin.lastName}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-300">{admin.email}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${roleCfg.bg} ${roleCfg.color}`}>
                              <FiShield size={10} />
                              {roleCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              admin.isActive
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${admin.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                              {admin.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center hidden lg:table-cell">
                            <span className="inline-flex items-center gap-1 text-sm text-gray-300">
                              {admin.actionsToday}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${admin.isOnline ? 'bg-green-400' : 'bg-red-400'}`} title={admin.isOnline ? 'Online' : 'Offline'} />
                              <span className="text-gray-400 text-sm">
                                {formatDate(admin.lastActiveAt)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                            <div className="flex items-center gap-1">
                              <FiClock size={12} />
                              {formatDate(admin.lastLoginAt)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                            {admin.createdByName || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {canEdit && (<button
                                onClick={() => openEditModal(admin)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                title="Edit role"
                              >
                                <FiEdit2 size={14} />
                              </button>)}
                              {canEdit && (<button
                                onClick={() => handleToggleActive(admin)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  admin.isActive
                                    ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10'
                                    : 'text-gray-400 hover:text-green-400 hover:bg-green-500/10'
                                }`}
                                title={admin.isActive ? 'Deactivate' : 'Activate'}
                              >
                                <FiUserCheck size={14} />
                              </button>)}
                              {canDelete && (<button
                                onClick={() => handleDelete(admin)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Remove"
                              >
                                <FiTrash2 size={14} />
                              </button>)}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <div className="relative bg-[#15161E] border border-white/10 rounded-xl w-full max-w-md mx-4 p-6 shadow-2xl">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <FiX size={20} />
              </button>
              <h3 className="text-lg font-bold text-white mb-4">
                {editingAdmin ? 'Edit Admin Role' : 'Add New Admin'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingAdmin && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full px-3 py-2 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">First Name</label>
                        <input
                          type="text"
                          required
                          value={form.firstName}
                          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                          className="w-full px-3 py-2 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Last Name</label>
                        <input
                          type="text"
                          required
                          value={form.lastName}
                          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                          className="w-full px-3 py-2 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="w-full px-3 py-2 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_CONFIG[r]?.label || r}</option>
                    ))}
                  </select>
                </div>
                {form.role !== 'SUPER_ADMIN' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Assigned countries
                    </label>
                    <input
                      type="text"
                      required
                      value={form.assignedCountries}
                      onChange={(e) => setForm({ ...form, assignedCountries: e.target.value.toUpperCase() })}
                      placeholder="LK, CA"
                      className="w-full px-3 py-2 bg-[#0B0C12] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                    />
                    <p className="mt-1.5 text-[11px] text-gray-500">
                      ISO 2-letter country codes separated by commas. Example: LK, CA
                    </p>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-amber-500 text-[#0B0C12] rounded-lg font-medium text-sm hover:bg-amber-400 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingAdmin ? 'Update Role' : 'Create Admin'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}