'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiMapPin, FiBriefcase } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface Vacancy {
  id: string
  title: string
  description: string | null
  location: string | null
  isActive: boolean
  branchId: string | null
  branch: { name: string } | null
  createdAt: string
}

interface Branch {
  id: string
  name: string
}

export default function AdminCareers() {
  const router = useRouter()
  const { user } = useAdminSession()
  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    isActive: true,
    branchId: ''
  })

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const authHeaders = getAuthHeader()
      const [vacanciesRes, branchesRes] = await Promise.all([
        fetch('/api/vacancies', { headers: { ...authHeaders } }),
        fetch('/api/branches', { headers: { ...authHeaders } })
      ])
      
      if (vacanciesRes.status === 401) {
        router.push('/admin/login')
        return
      }

      const vacanciesData = await vacanciesRes.json()
      const branchesData = await branchesRes.json()
      
      setVacancies(vacanciesData)
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
    
    if (!formData.title || formData.title.trim().length < 2) {
      toast.error('Job title is required')
      return
    }

    try {
      const authHeaders = getAuthHeader()
      const url = editMode && selectedVacancy 
        ? `/api/vacancies/${selectedVacancy.id}`
        : '/api/vacancies'
      
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

      toast.success(editMode ? 'Vacancy updated!' : 'Vacancy added!')
      resetForm()
      fetchData()
    } catch (error) {
      toast.error('Failed to save vacancy')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this job vacancy?')) return

    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/vacancies/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        router.push('/admin/login')
        return
      }

      if (!res.ok) throw new Error()

      toast.success('Vacancy deleted')
      fetchData()
    } catch (error) {
      toast.error('Failed to delete')
    }
  }

  const editVacancy = (vacancy: Vacancy) => {
    setSelectedVacancy(vacancy)
    setFormData({
      title: vacancy.title,
      description: vacancy.description || '',
      location: vacancy.location || '',
      isActive: vacancy.isActive,
      branchId: vacancy.branchId || ''
    })
    setEditMode(true)
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      location: '',
      isActive: true,
      branchId: ''
    })
    setSelectedVacancy(null)
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
          <h1 className="text-2xl font-bold text-gray-900">Job Vacancies</h1>
          <p className="text-gray-600">Manage career opportunities</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          <FiPlus className="w-5 h-5" />
          Add Vacancy
        </button>
      </div>

      {/* Vacancies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vacancies.map((vacancy) => (
          <div key={vacancy.id} className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <FiBriefcase className="text-primary-500" />
                <span className={`px-2 py-0.5 text-xs rounded ${
                  vacancy.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {vacancy.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => editVacancy(vacancy)}
                  className="p-1.5 text-primary-600 hover:bg-primary-50 rounded"
                >
                  <FiEdit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(vacancy.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">{vacancy.title}</h3>
            {vacancy.description && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{vacancy.description}</p>
            )}
            {vacancy.location && (
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <FiMapPin className="w-4 h-4" />
                {vacancy.location}
              </div>
            )}
            {vacancy.branch && (
              <div className="text-xs text-gray-400 mt-2">
                Branch: {vacancy.branch.name}
              </div>
            )}
          </div>
        ))}
        {vacancies.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No job vacancies. Add your first position!
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editMode ? 'Edit Vacancy' : 'Add Job Vacancy'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g. Cleaner, Supervisor"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    rows={3}
                    placeholder="Job responsibilities, requirements..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g. Colombo, Kandy"
                  />
                </div>

                {isSuperAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                    <select
                      value={formData.branchId}
                      onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">All branches</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-primary-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700">
                    Active (show on website)
                  </label>
                </div>

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
                    {editMode ? 'Update' : 'Add'} Vacancy
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