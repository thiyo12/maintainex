'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { FiMapPin, FiPlus, FiEdit2, FiTrash2, FiRefreshCw, FiX, FiPhone, FiMail, FiCheck, FiEye } from 'react-icons/fi'
import { DISTRICTS } from '@/components/ui/DistrictSelector'

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
  _count?: {
    admins: number
    bookings: number
    applications: number
    services: number
  }
}

interface BranchFormData {
  name: string
  location: string
  phone: string
  email: string
  address: string
  districts: string[]
}

export default function AdminBranches() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [formData, setFormData] = useState<BranchFormData>({
    name: '',
    location: '',
    phone: '',
    email: '',
    address: '',
    districts: []
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchBranches()
  }, [])

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/branches?includeStats=true')
      const data = await res.json()
      setBranches(data)
    } catch (error) {
      toast.error('Failed to fetch branches')
    } finally {
      setLoading(false)
    }
  }

  const openModal = (branch?: Branch) => {
    if (branch) {
      setEditingBranch(branch)
      let branchDistricts: string[] = []
      try {
        branchDistricts = JSON.parse(branch.districts || '[]')
        if (!Array.isArray(branchDistricts)) branchDistricts = []
      } catch {
        branchDistricts = []
      }
      setFormData({
        name: branch.name,
        location: branch.location,
        phone: branch.phone || '',
        email: branch.email || '',
        address: branch.address || '',
        districts: branchDistricts
      })
    } else {
      setEditingBranch(null)
      setFormData({ name: '', location: '', phone: '', email: '', address: '', districts: [] })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingBranch(null)
    setFormData({ name: '', location: '', phone: '', email: '', address: '', districts: [] })
  }

  const toggleDistrict = (district: string) => {
    if (formData.districts.includes(district)) {
      setFormData({
        ...formData,
        districts: formData.districts.filter(d => d !== district)
      })
    } else {
      setFormData({
        ...formData,
        districts: [...formData.districts, district]
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = editingBranch ? `/api/branches/${editingBranch.id}` : '/api/branches'
      const method = editingBranch ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          districts: JSON.stringify(formData.districts)
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save')
      }

      toast.success(editingBranch ? 'Branch updated!' : 'Branch created!')
      fetchBranches()
      closeModal()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (branch: Branch) => {
    try {
      const res = await fetch(`/api/branches/${branch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !branch.isActive })
      })

      if (!res.ok) throw new Error()

      toast.success(`Branch ${branch.isActive ? 'deactivated' : 'activated'}!`)
      fetchBranches()
    } catch (error) {
      toast.error('Failed to update branch')
    }
  }

  const deleteBranch = async (id: string) => {
    if (!confirm('Are you sure you want to delete this branch?')) return

    try {
      const res = await fetch(`/api/branches/${id}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete')
      }

      toast.success('Branch deleted!')
      fetchBranches()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const getUnassignedDistricts = (currentBranchId?: string) => {
    const assignedDistricts: string[] = []
    branches
      .filter(b => b.id !== currentBranchId)
      .forEach(b => {
        try {
          const parsed = JSON.parse(b.districts || '[]')
          if (Array.isArray(parsed)) {
            assignedDistricts.push(...parsed)
          }
        } catch {
          // Skip invalid JSON
        }
      })
    return DISTRICTS.filter(d => !assignedDistricts.includes(d))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branch Management</h1>
          <p className="text-gray-600">Manage company branches and their districts</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchBranches} className="btn-outline flex items-center">
            <FiRefreshCw className="mr-2" /> Refresh
          </button>
          <button onClick={() => openModal()} className="btn-primary flex items-center">
            <FiPlus className="mr-2" /> Add Branch
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((branch) => {
          let branchDistricts: string[] = []
          try {
            branchDistricts = JSON.parse(branch.districts || '[]')
            if (!Array.isArray(branchDistricts)) branchDistricts = []
          } catch {
            branchDistricts = []
          }
          return (
            <div key={branch.id} className={`bg-white rounded-xl shadow-sm overflow-hidden ${!branch.isActive ? 'opacity-60' : ''}`}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                      <FiMapPin className="text-primary-600 text-xl" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{branch.name}</h3>
                      <p className="text-sm text-gray-500">{branch.location}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    branch.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {branchDistricts.length > 0 && (
                  <div className="mb-4">
                    <label className="text-xs text-gray-500 mb-2 block">Districts Served:</label>
                    <div className="flex flex-wrap gap-1">
                      {branchDistricts.map(district => (
                        <span key={district} className="px-2 py-1 bg-primary-50 text-primary-700 rounded text-xs">
                          {district}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 text-sm mb-4">
                  {branch.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <FiPhone className="text-gray-400" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                  {branch.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <FiMail className="text-gray-400" />
                      <span>{branch.email}</span>
                    </div>
                  )}
                </div>

                {branch._count && (
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-gray-900">{branch._count.admins}</div>
                      <div className="text-xs text-gray-500">Admins</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-gray-900">{branch._count.bookings}</div>
                      <div className="text-xs text-gray-500">Bookings</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-gray-900">{branch._count.applications}</div>
                      <div className="text-xs text-gray-500">Applications</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-gray-900">{branch._count.services}</div>
                      <div className="text-xs text-gray-500">Services</div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Link
                    href={`/admin/branches/${branch.id}`}
                    className="px-3 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors text-sm font-medium flex items-center"
                  >
                    <FiEye className="inline mr-1" /> Profile</Link>
                  <button
                    onClick={() => openModal(branch)}
                    className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                  >
                    <FiEdit2 className="inline mr-1" /> Edit
                  </button>
                  <button
                    onClick={() => toggleStatus(branch)}
                    className={`px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                      branch.isActive
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {branch.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => deleteBranch(branch.id)}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {branches.length === 0 && (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <FiMapPin className="mx-auto text-gray-300 text-5xl mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No branches yet</h3>
          <p className="text-gray-500 mb-6">Create your first branch to get started</p>
          <button onClick={() => openModal()} className="btn-primary">
            <FiPlus className="mr-2" /> Add Branch
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingBranch ? 'Edit Branch' : 'Add New Branch'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Jaffna Main Branch"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Jaffna, Sri Lanka"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-field"
                    placeholder="0770867609"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                    placeholder="branch@maintainex.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input-field"
                  rows={2}
                  placeholder="Full address..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Districts Served *</label>
                <p className="text-xs text-gray-500 mb-3">
                  Select all districts that this branch will serve. Customers from these districts will be assigned to this branch automatically.
                </p>
                
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {DISTRICTS.map((district) => {
                    const isAssigned = branches.some(b => {
                      if (editingBranch && b.id === editingBranch.id) return false
                      try {
                        const bDistricts: string[] = JSON.parse(b.districts || '[]')
                        return Array.isArray(bDistricts) && bDistricts.includes(district)
                      } catch {
                        return false
                      }
                    })
                    const isSelected = formData.districts.includes(district)
                    
                    return (
                      <button
                        key={district}
                        type="button"
                        onClick={() => toggleDistrict(district)}
                        disabled={isAssigned && !isSelected}
                        className={`px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                          isSelected
                            ? 'bg-primary-500 text-white'
                            : isAssigned
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {isSelected && <FiCheck size={12} />}
                        {district}
                      </button>
                    )
                  })}
                </div>
                
                {formData.districts.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-gray-500">
                      Selected: {formData.districts.length} district(s)
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 btn-secondary">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving || formData.districts.length === 0} 
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingBranch ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
