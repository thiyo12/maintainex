'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiUserCheck, FiPlus, FiTrash2, FiRefreshCw, FiX, FiShield, FiAlertCircle, FiCopy } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface AppAdmin {
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

interface CreateResult {
  id: string
  email: string
  role: string
  firstName: string
  lastName: string
  tempPassword: string
}

export default function AppAdmins() {
  const { user } = useAdminSession()
  const [admins, setAdmins] = useState<AppAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [createResult, setCreateResult] = useState<CreateResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/admin/app-admins', { headers: authHeaders })
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const data = await res.json()
      if (data.success) setAdmins(data.data)
      else setError(data.error)
    } catch {
      toast.error('Failed to fetch')
      setError('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setCreateResult(null)

    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/admin/app-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(formData),
      })
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setCreateResult(data.data)
      toast.success('App Super Admin created!')
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (admin: AppAdmin) => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/admin/app-admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ id: admin.id, isActive: !admin.isActive }),
      })
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) throw new Error()
      toast.success(`Admin ${admin.isActive ? 'deactivated' : 'activated'}!`)
      fetchData()
    } catch {
      toast.error('Failed to update')
    }
  }

  const deleteAdmin = async (id: string) => {
    if (!confirm('Are you sure? This soft-deletes the admin.')) return
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/admin/app-admins', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ id }),
      })
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      if (!res.ok) throw new Error()
      toast.success('Admin deleted!')
      fetchData()
    } catch {
      toast.error('Failed to delete')
    }
  }

  const copyPassword = (pw: string) => {
    navigator.clipboard.writeText(pw)
    toast.success('Password copied!')
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
      <div className="flex flex-col items-center justify-center h-64">
        <FiAlertCircle className="text-red-500 text-4xl mb-4" />
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={fetchData} className="btn-primary"><FiRefreshCw className="mr-2" /> Try Again</button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">App Super Admins</h1>
          <p className="text-gray-600">Manage marketplace admin accounts (App SUPER ADMINs)</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} className="btn-outline flex items-center"><FiRefreshCw className="mr-2" /> Refresh</button>
          <button onClick={() => { setShowModal(true); setCreateResult(null) }} className="btn-primary flex items-center">
            <FiPlus className="mr-2" /> Create App Super Admin
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Admin</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Role</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">2FA</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Countries</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Last Login</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Created</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-purple-700 font-bold">
                          {(admin.firstName?.[0] || admin.email[0]).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{admin.firstName} {admin.lastName}</div>
                        <div className="text-sm text-gray-500">{admin.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 flex items-center gap-1 w-fit">
                      <FiShield size={12} /> SUPER ADMIN
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${admin.totpEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {admin.totpEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {admin.assignedCountries?.length ? admin.assignedCountries.join(', ') : 'All'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${admin.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {admin.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => toggleStatus(admin)}
                        className={`p-2 rounded-lg ${admin.isActive ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}>
                        {admin.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => deleteAdmin(admin.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {admins.length === 0 && (
          <div className="p-12 text-center">
            <FiUserCheck className="mx-auto text-gray-300 text-5xl mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No App Super Admins</h3>
            <p className="text-gray-500 mb-6">Create your first marketplace super admin</p>
            <button onClick={() => { setShowModal(true); setCreateResult(null) }} className="btn-primary">
              <FiPlus className="mr-2" /> Create App Super Admin
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            {createResult ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">App Super Admin Created</h2>
                  <button onClick={() => { setShowModal(false); setCreateResult(null); setFormData({ email: '', firstName: '', lastName: '', password: '' }) }}
                    className="p-2 hover:bg-gray-100 rounded-lg"><FiX /></button>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-green-800 font-medium mb-1">Account created successfully!</p>
                  <p className="text-green-700 text-sm mb-3">Share these credentials securely with the new admin.</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg text-gray-900 font-mono">{createResult.email}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Temporary Password</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                      <span className="text-gray-900 font-mono">{createResult.tempPassword}</span>
                      <button onClick={() => copyPassword(createResult.tempPassword)}
                        className="text-primary-600 hover:text-primary-800"><FiCopy /></button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    They can log in at /admin/login with these credentials.
                  </p>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => { setShowModal(false); setCreateResult(null); setFormData({ email: '', firstName: '', lastName: '', password: '' }) }}
                    className="flex-1 btn-primary">Done</button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Create App Super Admin</h2>
                  <button onClick={() => setShowModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"><FiX /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input-field" placeholder="admin@example.com" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                    <input type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="input-field" placeholder="John" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                    <input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="input-field" placeholder="Doe" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input type="text" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="input-field" placeholder="Leave empty for auto-generated" />
                    <p className="text-xs text-gray-500 mt-1">Leave empty to auto-generate a secure password.</p>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 btn-secondary">Cancel</button>
                    <button type="submit" disabled={saving} className="flex-1 btn-primary">
                      {saving ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
