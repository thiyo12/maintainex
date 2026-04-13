'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiUserCheck, FiPlus, FiEdit2, FiTrash2, FiRefreshCw, FiX, FiShield, FiUser, FiSettings, FiAlertCircle } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface Branch {
  id: string
  name: string
  location: string
}

interface Admin {
  id: string
  email: string
  name: string | null
  role: string
  branchId: string | null
  branch: Branch | null
  canEditServices: boolean
  isActive: boolean
  createdAt: string
}

interface AdminFormData {
  email: string
  password: string
  name: string
  role: string
  branchId: string
}

export default function AdminAdmins() {
  const { user } = useAdminSession()
  const [admins, setAdmins] = useState<Admin[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const authHeaders = getAuthHeader()
  const [showModal, setShowModal] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null)
  const [formData, setFormData] = useState<AdminFormData>({
    email: '',
    password: '',
    name: '',
    role: 'ADMIN',
    branchId: ''
  })
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'ALL' | 'SUPER_ADMIN' | 'ADMIN'>('ALL')
  const [error, setError] = useState<string | null>(null)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [adminsRes, branchesRes] = await Promise.all([
        fetch('/api/admins', { headers: authHeaders }),
        fetch('/api/branches', { headers: authHeaders })
      ])

      if (adminsRes.status === 401 || branchesRes.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      
      const adminsData = await adminsRes.json()
      const branchesData = await branchesRes.json()
      
      setAdmins(adminsData)
      setBranches(branchesData)
    } catch (error) {
      toast.error('Failed to fetch data')
      setError('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const filteredAdmins = filter === 'ALL' 
    ? admins 
    : admins.filter(a => a.role === filter)

  const openModal = (admin?: Admin) => {
    if (admin) {
      setEditingAdmin(admin)
      setFormData({
        email: admin.email,
        password: '',
        name: admin.name || '',
        role: admin.role,
        branchId: admin.branchId || ''
      })
    } else {
      setEditingAdmin(null)
      setFormData({ email: '', password: '', name: '', role: 'ADMIN', branchId: '' })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingAdmin(null)
    setFormData({ email: '', password: '', name: '', role: 'ADMIN', branchId: '' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = editingAdmin ? `/api/admins/${editingAdmin.id}` : '/api/admins'
      const method = editingAdmin ? 'PUT' : 'POST'

      const body: any = {
        email: formData.email,
        name: formData.name || null,
        role: formData.role
      }

      if (formData.role === 'ADMIN') {
        body.branchId = formData.branchId || null
      }

      if (formData.password) {
        body.password = formData.password
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body)
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save')
      }

      toast.success(editingAdmin ? 'Admin updated!' : 'Admin created!')
      fetchData()
      closeModal()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (admin: Admin) => {
    try {
      const res = await fetch(`/api/admins/${admin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ isActive: !admin.isActive })
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      if (!res.ok) throw new Error()

      toast.success(`Admin ${admin.isActive ? 'deactivated' : 'activated'}!`)
      fetchData()
    } catch (error) {
      toast.error('Failed to update admin')
    }
  }

  const toggleServicePermission = async (admin: Admin) => {
    try {
      const res = await fetch(`/api/admins/${admin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ canEditServices: !admin.canEditServices })
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      if (!res.ok) throw new Error()

      toast.success(`Service editing ${admin.canEditServices ? 'revoked' : 'granted'}!`)
      fetchData()
    } catch (error) {
      toast.error('Failed to update permission')
    }
  }

  const deleteAdmin = async (id: string) => {
    if (!confirm('Are you sure you want to delete this admin?')) return

    try {
      const res = await fetch(`/api/admins/${id}`, { method: 'DELETE', headers: authHeaders })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }

      toast.success('Admin deleted!')
      fetchData()
    } catch (error: any) {
      toast.error(error.message)
    }
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
        <button onClick={fetchData} className="btn-primary">
          <FiRefreshCw className="mr-2" /> Try Again
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Management</h1>
          <p className="text-gray-600">Manage admin users and their permissions</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} className="btn-outline flex items-center">
            <FiRefreshCw className="mr-2" /> Refresh
          </button>
          <button onClick={() => openModal()} className="btn-primary flex items-center">
            <FiPlus className="mr-2" /> Add Admin
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {(['ALL', 'SUPER_ADMIN', 'ADMIN'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-primary-500 text-dark-900'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'ALL' ? 'All' : f === 'SUPER_ADMIN' ? 'Super Admins' : 'Admins'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Admin</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Role</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Branch</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Service Edit</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Created</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAdmins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-700 font-bold">
                          {admin.name?.[0] || admin.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{admin.name || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{admin.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                      admin.role === 'SUPER_ADMIN' 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {admin.role === 'SUPER_ADMIN' ? (
                        <><FiShield size={12} /> Super Admin</>
                      ) : (
                        <><FiUser size={12} /> Admin</>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {admin.branch ? (
                      <div>
                        <div className="font-medium text-gray-900">{admin.branch.name}</div>
                        <div className="text-sm text-gray-500">{admin.branch.location}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {admin.role === 'SUPER_ADMIN' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 flex items-center gap-1 w-fit">
                        <FiShield size={10} /> Full Access
                      </span>
                    ) : (
                      <button
                        onClick={() => toggleServicePermission(admin)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          admin.canEditServices
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={admin.canEditServices ? 'Click to revoke' : 'Click to grant'}
                      >
                        <span className="flex items-center gap-1">
                          <FiSettings size={10} />
                          {admin.canEditServices ? 'Can Edit' : 'No Access'}
                        </span>
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      admin.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {admin.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openModal(admin)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Edit"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        onClick={() => toggleStatus(admin)}
                        className={`p-2 rounded-lg ${
                          admin.isActive
                            ? 'text-yellow-600 hover:bg-yellow-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title={admin.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {admin.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => deleteAdmin(admin.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAdmins.length === 0 && (
          <div className="p-12 text-center">
            <FiUserCheck className="mx-auto text-gray-300 text-5xl mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No admins found</h3>
            <p className="text-gray-500 mb-6">Create your first admin to get started</p>
            <button onClick={() => openModal()} className="btn-primary">
              <FiPlus className="mr-2" /> Add Admin
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingAdmin ? 'Edit Admin' : 'Add New Admin'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                  placeholder="admin@maintainex.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editingAdmin && '(leave blank to keep current)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-field"
                  placeholder={editingAdmin ? '••••••••' : 'Enter password'}
                  required={!editingAdmin}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="Admin name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="input-field"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.role === 'SUPER_ADMIN' 
                    ? 'Super Admin has full access to all branches and settings'
                    : 'Admin has access only to assigned branch'
                  }
                </p>
              </div>

              {formData.role === 'ADMIN' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch *</label>
                  <select
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="">Select a branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} - {branch.location}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 btn-primary">
                  {saving ? 'Saving...' : editingAdmin ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
