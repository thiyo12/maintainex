'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiUser, FiMail, FiPhone, FiMapPin } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface Staff {
  id: string
  staffId: string
  name: string
  phone: string | null
  email: string | null
  position: string | null
  photo: string | null
  branchId: string | null
  branch: { name: string } | null
  isActive: boolean
}

interface Branch {
  id: string
  name: string
}

export default function AdminStaff() {
  const router = useRouter()
  const { user } = useAdminSession()
  const [staff, setStaff] = useState<Staff[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    position: '',
    photo: '',
    branchId: '',
    isActive: true
  })

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const authHeaders = getAuthHeader()
      const [staffRes, branchesRes] = await Promise.all([
        fetch('/api/staff', { headers: { ...authHeaders } }),
        fetch('/api/branches', { headers: { ...authHeaders } })
      ])
      
      if (staffRes.status === 401) {
        router.push('/admin/login')
        return
      }

      const staffData = await staffRes.json()
      const branchesData = await branchesRes.json()
      
      setStaff(staffData)
      setBranches(branchesData)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || formData.name.trim().length < 2) {
      toast.error('Name is required (at least 2 characters)')
      return
    }

    try {
      const authHeaders = getAuthHeader()
      const url = editMode && selectedStaff 
        ? `/api/staff/${selectedStaff.id}`
        : '/api/staff'
      
      const method = editMode ? 'PATCH' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!res.ok) throw new Error()

      toast.success(editMode ? 'Staff updated successfully!' : 'Staff added successfully!')
      resetForm()
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save staff')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return

    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/staff/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!res.ok) throw new Error()

      toast.success('Staff deleted successfully')
      fetchData()
    } catch (error) {
      toast.error('Failed to delete staff')
    }
  }

  const editStaff = (staffMember: Staff) => {
    setSelectedStaff(staffMember)
    setFormData({
      name: staffMember.name,
      phone: staffMember.phone || '',
      email: staffMember.email || '',
      position: staffMember.position || '',
      photo: staffMember.photo || '',
      branchId: staffMember.branchId || '',
      isActive: staffMember.isActive
    })
    setEditMode(true)
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      position: '',
      photo: '',
      branchId: '',
      isActive: true
    })
    setSelectedStaff(null)
    setEditMode(false)
    setShowModal(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-gray-600">Manage your team members</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          <FiPlus className="w-5 h-5" />
          Add Staff
        </button>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {staff.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{member.staffId}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{member.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{member.position || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{member.branch?.name || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  <div>{member.phone}</div>
                  <div className="text-xs text-gray-400">{member.email}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    member.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {member.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => editStaff(member)}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                  >
                    <FiEdit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(member.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg ml-2"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No staff members found. Add your first staff member.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editMode ? 'Edit Staff' : 'Add New Staff'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="Enter full name"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g. Supervisor, Cleaner"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <div className="relative">
                      <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="0771234567"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <div className="relative">
                      <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>
                </div>

                {isSuperAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                    <div className="relative">
                      <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        value={formData.branchId}
                        onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Select branch</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                  >
                    {editMode ? 'Update' : 'Add'} Staff
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}