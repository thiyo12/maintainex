'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiMapPin, FiPhone, FiMail, FiUsers, FiEdit2, FiTrash2, FiPlus, FiX, FiRefreshCw, FiEye, FiEyeOff } from 'react-icons/fi'

interface Admin {
  id: string
  email: string
  name: string | null
  role: string
  isActive: boolean
  createdAt: string
}

interface Branch {
  id: string
  name: string
  location: string
  phone: string | null
  email: string | null
  address: string | null
  districts: string
  isActive: boolean
  createdAt: string
  admins: Admin[]
  _count?: {
    bookings: number
    applications: number
    services: number
  }
}

interface AdminFormData {
  email: string
  password: string
  name: string
}

export default function BranchProfilePage() {
  const params = useParams()
  const router = useRouter()
  const branchId = params.id as string

  const [branch, setBranch] = useState<Branch | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'details' | 'admins' | 'stats'>('details')
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null)
  const [adminForm, setAdminForm] = useState<AdminFormData>({ email: '', password: '', name: '' })
  const [savingAdmin, setSavingAdmin] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    fetchBranch()
  }, [branchId])

  const fetchBranch = async () => {
    try {
      const res = await fetch(`/api/branches/${branchId}?includeAdmins=true`)
      if (!res.ok) throw new Error('Branch not found')
      const data = await res.json()
      setBranch(data)
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch branch')
      router.push('/admin/branches')
    } finally {
      setLoading(false)
    }
  }

  const openAdminModal = (admin?: Admin) => {
    if (admin) {
      setEditingAdmin(admin)
      setAdminForm({ email: admin.email, password: '', name: admin.name || '' })
    } else {
      setEditingAdmin(null)
      setAdminForm({ email: '', password: '', name: '' })
    }
    setShowAdminModal(true)
    setShowPassword(false)
  }

  const closeAdminModal = () => {
    setShowAdminModal(false)
    setEditingAdmin(null)
    setAdminForm({ email: '', password: '', name: '' })
  }

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingAdmin(true)

    try {
      const url = editingAdmin ? `/api/admins/${editingAdmin.id}` : '/api/admins'
      const method = editingAdmin ? 'PUT' : 'POST'

      const body: any = { name: adminForm.name, email: adminForm.email }
      if (adminForm.password) body.password = adminForm.password
      if (editingAdmin) body.branchId = branchId

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save admin')
      }

      toast.success(editingAdmin ? 'Admin updated!' : 'Admin created!')
      fetchBranch()
      closeAdminModal()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSavingAdmin(false)
    }
  }

  const toggleAdminStatus = async (admin: Admin) => {
    try {
      const res = await fetch(`/api/admins/${admin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !admin.isActive, branchId })
      })

      if (!res.ok) throw new Error()

      toast.success(`Admin ${admin.isActive ? 'deactivated' : 'activated'}!`)
      fetchBranch()
    } catch (error) {
      toast.error('Failed to update admin')
    }
  }

  const deleteAdmin = async (adminId: string) => {
    if (!confirm('Are you sure you want to delete this admin?')) return

    try {
      const res = await fetch(`/api/admins/${adminId}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to delete')

      toast.success('Admin deleted!')
      fetchBranch()
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

  if (!branch) return null

  const branchDistricts: string[] = JSON.parse(branch.districts || '[]')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/branches')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiArrowLeft className="text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{branch.name}</h1>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                branch.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {branch.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-gray-600">{branch.location}</p>
          </div>
        </div>
        <button onClick={fetchBranch} className="btn-outline flex items-center">
          <FiRefreshCw className="mr-2" /> Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b">
        {(['details', 'admins', 'stats'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'admins' && (
              <span className="ml-2 bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full text-xs">
                {branch.admins?.length || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'details' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Branch Information</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Branch Name</label>
                <p className="font-medium text-gray-900">{branch.name}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Location</label>
                <p className="font-medium text-gray-900 flex items-center gap-2">
                  <FiMapPin className="text-gray-400" /> {branch.location}
                </p>
              </div>
              {branch.address && (
                <div>
                  <label className="text-sm text-gray-500">Address</label>
                  <p className="font-medium text-gray-900">{branch.address}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {branch.phone && (
                  <div>
                    <label className="text-sm text-gray-500">Phone</label>
                    <p className="font-medium text-gray-900 flex items-center gap-2">
                      <FiPhone className="text-gray-400" /> {branch.phone}
                    </p>
                  </div>
                )}
                {branch.email && (
                  <div>
                    <label className="text-sm text-gray-500">Email</label>
                    <p className="font-medium text-gray-900 flex items-center gap-2">
                      <FiMail className="text-gray-400" /> {branch.email}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Districts Served ({branchDistricts.length})</h2>
            <div className="flex flex-wrap gap-2">
              {branchDistricts.map(district => (
                <span key={district} className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium">
                  {district}
                </span>
              ))}
            </div>
            {branchDistricts.length === 0 && (
              <p className="text-gray-500">No districts assigned</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'admins' && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Branch Administrators</h2>
            <button onClick={() => openAdminModal()} className="btn-primary flex items-center">
              <FiPlus className="mr-2" /> Add Admin
            </button>
          </div>

          {branch.admins && branch.admins.length > 0 ? (
            <div className="divide-y">
              {branch.admins.map((admin) => (
                <div key={admin.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <FiUsers className="text-primary-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{admin.name || 'No name'}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          admin.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {admin.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          admin.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {admin.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{admin.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openAdminModal(admin)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <FiEdit2 className="text-gray-600" />
                    </button>
                    <button
                      onClick={() => toggleAdminStatus(admin)}
                      className={`p-2 hover:bg-gray-100 rounded-lg transition-colors ${
                        admin.isActive ? 'text-yellow-600' : 'text-green-600'
                      }`}
                      title={admin.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {admin.isActive ? <FiEyeOff /> : <FiEye />}
                    </button>
                    <button
                      onClick={() => deleteAdmin(admin.id)}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                      title="Delete"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <FiUsers className="mx-auto text-gray-300 text-4xl mb-4" />
              <p className="text-gray-500 mb-4">No admins assigned to this branch</p>
              <button onClick={() => openAdminModal()} className="btn-primary">
                <FiPlus className="mr-2" /> Add Admin
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-sm text-gray-500 mb-2">Total Bookings</h3>
            <p className="text-3xl font-bold text-gray-900">{branch._count?.bookings || 0}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-sm text-gray-500 mb-2">Total Applications</h3>
            <p className="text-3xl font-bold text-gray-900">{branch._count?.applications || 0}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-sm text-gray-500 mb-2">Services</h3>
            <p className="text-3xl font-bold text-gray-900">{branch._count?.services || 0}</p>
          </div>
        </div>
      )}

      {showAdminModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingAdmin ? 'Edit Admin' : 'Add New Admin'}
              </h2>
              <button onClick={closeAdminModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <FiX />
              </button>
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  className="input-field"
                  placeholder="admin@maintainex.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingAdmin ? 'New Password (leave blank to keep current)' : 'Password *'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                    className="input-field pr-10"
                    placeholder={editingAdmin ? 'Enter new password' : 'Enter password'}
                    required={!editingAdmin}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  className="input-field"
                  placeholder="Admin's full name"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This admin will be assigned to <strong>{branch.name}</strong> branch.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeAdminModal} className="flex-1 btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdmin || (!editingAdmin && !adminForm.password)}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {savingAdmin ? 'Saving...' : editingAdmin ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
