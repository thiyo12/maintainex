'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiShield, FiAlertCircle } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface Admin {
  id: string
  email: string
  role: string
  firstName: string
  lastName: string
  totpEnabled: boolean
  assignedCountries: string[]
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

const ROLE_HIERARCHY: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MODERATOR: 'Moderator',
  SUPPORT: 'Support',
}

export default function MarketplaceAdminUsers() {
  const { user: currentUser } = useAdminSession()
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Admin | null>(null)
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'MODERATOR', assignedCountries: '' })
  const [saving, setSaving] = useState(false)
  const [tempPassword, setTempPassword] = useState('')

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'

  useEffect(() => { fetchAdmins() }, [])

  const fetchAdmins = async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/admin/marketplace/admin-users', {
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

      setAdmins(result.data)
    } catch (error) {
      console.error('Admin users fetch error:', error)
      toast.error('Failed to load admin users')
      setError('Failed to load admin users')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setForm({ email: '', firstName: '', lastName: '', role: 'MODERATOR', assignedCountries: '' })
    setEditing(null)
    setShowForm(false)
    setTempPassword('')
  }

  const openEdit = (admin: Admin) => {
    setForm({
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
      assignedCountries: (admin.assignedCountries || []).join(', ')
    })
    setEditing(admin)
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        assignedCountries: form.assignedCountries ? form.assignedCountries.split(',').map((c) => c.trim()).filter(Boolean) : []
      }

      const authHeaders = getAuthHeader()
      const headers = { ...authHeaders, 'Content-Type': 'application/json' }

      let res
      if (editing) {
        res = await fetch(`/api/admin/marketplace/admin-users/${editing.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload)
        })
      } else {
        res = await fetch('/api/admin/marketplace/admin-users', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        })
      }

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const result = await res.json()

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (!editing && result.data?.tempPassword) {
        setTempPassword(result.data.tempPassword)
        setForm({ email: '', firstName: '', lastName: '', role: 'MODERATOR', assignedCountries: '' })
        setEditing(null)
      } else {
        resetForm()
      }

      toast.success(editing ? 'Admin updated' : 'Admin created')
      await fetchAdmins()
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save admin')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (admin: Admin) => {
    if (!confirm(`Delete admin "${admin.firstName} ${admin.lastName}"?`)) return
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/admin/marketplace/admin-users/${admin.id}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const result = await res.json()

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Admin deleted')
      await fetchAdmins()
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete admin')
    }
  }

  const roleBadge = (role: string) => {
    const map: Record<string, string> = {
      SUPER_ADMIN: 'bg-red-100 text-red-800',
      ADMIN: 'bg-blue-100 text-blue-800',
      MODERATOR: 'bg-yellow-100 text-yellow-800',
      SUPPORT: 'bg-gray-100 text-gray-800',
    }
    return <span className={`px-3 py-1 rounded-full text-xs font-medium ${map[role] || 'bg-gray-100 text-gray-800'}`}>{ROLE_HIERARCHY[role] || role}</span>
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <FiShield className="w-12 h-12 text-red-500" />
        <p className="text-gray-600">This page is restricted to SUPER_ADMIN role only.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <FiAlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-gray-600">{error}</p>
        <button onClick={fetchAdmins} className="btn-primary px-4 py-2 rounded-lg text-sm">Try Again</button>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Management</h1>
          <p className="text-gray-600 mt-1">Manage sub-admin users (SUPER_ADMIN only)</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
        >
          <FiPlus className="w-4 h-4" /> Add Admin
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 md:p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Edit' : 'New'} Admin</h2>
          </div>
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">First Name</label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Last Name</label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Email</label>
                <input
                  type="email"
                  className="input-field w-full"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={!!editing}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Role</label>
                <select
                  className="input-field w-full"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MODERATOR">Moderator</option>
                  <option value="SUPPORT">Support</option>
                </select>
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-medium text-gray-500">Assigned Countries (comma-separated)</label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={form.assignedCountries}
                  onChange={(e) => setForm({ ...form, assignedCountries: e.target.value })}
                  placeholder="US, GB, CA"
                />
              </div>
            </div>

            {tempPassword && (
              <div className="mt-4 rounded border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-sm font-medium text-yellow-800">Temporary Password</p>
                <p className="mt-1 font-mono text-sm text-yellow-900">{tempPassword}</p>
                <p className="mt-1 text-xs text-yellow-700">
                  Share this securely with the new admin. They will be prompted to change it on first login.
                </p>
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !form.email || !form.firstName || !form.lastName}
                className="btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
              <button onClick={resetForm} className="btn-outline px-4 py-2 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">2FA</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Countries</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                <th className="px-4 md:px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50">
                  <td className="px-4 md:px-6 py-4 text-sm font-medium text-gray-900">{admin.firstName} {admin.lastName}</td>
                  <td className="px-4 md:px-6 py-4 text-sm text-gray-600">{admin.email}</td>
                  <td className="px-4 md:px-6 py-4">{roleBadge(admin.role)}</td>
                  <td className="px-4 md:px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${admin.totpEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {admin.totpEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 text-sm text-gray-600">{(admin.assignedCountries || []).join(', ') || '\u2014'}</td>
                  <td className="px-4 md:px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${admin.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {admin.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 text-sm text-gray-500">
                    {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(admin)} className="p-1 hover:bg-gray-100 rounded">
                        <FiEdit2 className="w-4 h-4 text-gray-500" />
                      </button>
                      <button onClick={() => handleDelete(admin)} className="p-1 hover:bg-gray-100 rounded">
                        <FiTrash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
