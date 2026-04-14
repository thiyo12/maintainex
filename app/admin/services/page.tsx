'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { FiPlus, FiEdit2, FiTrash2, FiImage, FiRefreshCw, FiClock, FiLock, FiEye, FiX, FiAlertCircle } from 'react-icons/fi'
import ImageUploader from '@/components/admin/ImageUploader'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface Service {
  id: string
  title: string
  slug: string
  description: string
  image: string | null
  price: number | null
  duration: number | null
  categoryId: string
  category: { name: string }
  isActive: boolean
}

interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  _count: { services: number }
}

export default function AdminServices() {
  const router = useRouter()
  const { user } = useAdminSession()
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [viewingService, setViewingService] = useState<Service | null>(null)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    image: '',
    price: '',
    duration: '',
    categoryId: '',
    isActive: true
  })
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryDesc, setNewCategoryDesc] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const canEditServices = user?.canEditServices === true
  const hasEditPermission = isSuperAdmin || canEditServices

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setError(null)
      const authHeaders = getAuthHeader()
      const [servicesRes, categoriesRes] = await Promise.all([
        fetch('/api/services', { headers: { ...authHeaders } }),
        fetch('/api/categories', { headers: { ...authHeaders } })
      ])
      if (servicesRes.status === 401 || categoriesRes.status === 401) {
        router.push('/admin/login')
        return
      }
      const servicesData = await servicesRes.json()
      const categoriesData = await categoriesRes.json()
      setServices(servicesData)
      setCategories(categoriesData)
    } catch (error) {
      setError('Failed to fetch data')
      toast.error('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

  const addNewCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required')
      return
    }
    
    setAddingCategory(true)
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'category',
          name: newCategoryName,
          description: newCategoryDesc
        })
      })
      
      if (res.status === 401) {
        router.push('/admin/login')
        return
      }
      if (!res.ok) throw new Error()
      
      toast.success('Category added successfully!')
      setNewCategoryName('')
      setNewCategoryDesc('')
      setShowAddCategory(false)
      fetchData()
    } catch (error) {
      toast.error('Failed to add category')
    } finally {
      setAddingCategory(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('Form submission started')
    console.log('Form data:', JSON.stringify(formData, null, 2))
    
    if (!formData.title || formData.title.trim().length < 2) {
      toast.error('Service title is required (at least 2 characters)')
      return
    }
    
    if (!formData.categoryId && isSuperAdmin) {
      toast.error('Please select a category')
      return
    }
    
    try {
      const url = editingService ? `/api/services/${editingService.id}` : '/api/services'
      const method = editingService ? 'PUT' : 'POST'
      
      const bodyData: any = {
        type: 'service',
        title: formData.title,
        slug: formData.slug || generateSlug(formData.title),
        description: formData.description,
        image: formData.image || null,
        price: formData.price ? parseFloat(formData.price) : null,
        duration: formData.duration ? parseInt(formData.duration) : null,
        isActive: formData.isActive
      }

      if (isSuperAdmin && formData.categoryId) {
        bodyData.categoryId = formData.categoryId
      }

      console.log('Sending request to:', url)
      console.log('Request body:', JSON.stringify(bodyData, null, 2))

      const authHeaders = getAuthHeader()
      const res = await fetch(url, {
        method,
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      })

      console.log('Response status:', res.status)

      if (res.status === 401) {
        console.log('Unauthorized - redirecting to login')
        router.push('/admin/login')
        return
      }
      
      const responseData = await res.json()
      console.log('Response data:', JSON.stringify(responseData, null, 2))

      if (!res.ok) {
        throw new Error(responseData.error || 'Failed to save')
      }

      toast.success(editingService ? 'Service updated successfully' : 'Service created successfully')
      setShowModal(false)
      setEditingService(null)
      resetForm()
      fetchData()
    } catch (error: any) {
      console.error('Save error:', error)
      toast.error(error.message || 'Failed to save service')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return

    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE', headers: { ...authHeaders } })
      if (res.status === 401) {
        router.push('/admin/login')
        return
      }
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to delete')
      }
      
      toast.success('Service deleted successfully')
      fetchData()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete service')
    }
  }

  const editService = (service: Service) => {
    if (!hasEditPermission) {
      toast.error('You do not have permission to edit services')
      return
    }
    setEditingService(service)
    setFormData({
      title: service.title,
      slug: service.slug,
      description: service.description,
      image: service.image || '',
      price: service.price?.toString() || '',
      duration: service.duration?.toString() || '',
      categoryId: service.categoryId,
      isActive: service.isActive
    })
    setShowModal(true)
  }

  const viewService = (service: Service) => {
    setViewingService(service)
  }

  const openAddModal = () => {
    if (!hasEditPermission) {
      toast.error('You do not have permission to add services')
      return
    }
    resetForm()
    setEditingService(null)
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      slug: '',
      description: '',
      image: '',
      price: '',
      duration: '',
      categoryId: '',
      isActive: true
    })
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
        <FiAlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-900 font-medium mb-2">{error}</p>
        <button onClick={fetchData} className="btn-outline">
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-gray-600">
            {hasEditPermission ? 'Manage your services and pricing' : 'View services and pricing'}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} className="btn-outline flex items-center">
            <FiRefreshCw className="mr-2" /> Refresh
          </button>
          {hasEditPermission && (
            <button
              onClick={openAddModal}
              className="btn-primary flex items-center"
            >
              <FiPlus className="mr-2" /> Add Service
            </button>
          )}
        </div>
      </div>

      {!hasEditPermission && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-amber-800">
            <FiLock className="w-5 h-5" />
            <span className="font-medium">Read-Only Mode</span>
          </div>
          <p className="text-sm text-amber-700 mt-1">
            You have view-only access. Contact Super Admin to get permission for editing services.
          </p>
        </div>
      )}

      {/* Services Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Service</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Category</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Price</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Duration</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {services.length > 0 ? (
                services.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {service.image ? (
                          service.image.startsWith('/uploads/') ? (
                            <img
                              src={`${service.image}?t=${Date.now()}`}
                              alt={service.title}
                              className="w-12 h-12 rounded-lg object-cover mr-4"
                            />
                          ) : (
                            <Image
                              src={service.image}
                              alt={service.title}
                              width={48}
                              height={48}
                              className="w-12 h-12 rounded-lg object-cover mr-4"
                            />
                          )
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center mr-4">
                            <FiImage className="text-gray-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{service.title}</div>
                          <div className="text-sm text-gray-500 line-clamp-1">{service.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="flex items-center gap-1">
                        {service.category?.name}
                        {!isSuperAdmin && (
                          <FiLock className="w-3 h-3 text-gray-400" title="Only Super Admin can change" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {service.price ? `Rs. ${service.price.toLocaleString()}+` : 'Contact for quote'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {service.duration ? (
                        <span className="flex items-center gap-1">
                          <FiClock className="w-4 h-4" />
                          {service.duration} min
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        service.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {service.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => viewService(service)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="View Details"
                        >
                          <FiEye />
                        </button>
                        {hasEditPermission && (
                          <>
                            <button
                              onClick={() => editService(service)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Edit"
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              onClick={() => handleDelete(service.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete"
                            >
                              <FiTrash2 />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No services found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      {viewingService && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Service Details</h2>
            
            {viewingService.image && (
              viewingService.image.startsWith('/uploads/') ? (
                <img
                  src={`${viewingService.image}?t=${Date.now()}`}
                  alt={viewingService.title}
                  className="w-full h-48 object-cover rounded-xl mb-4"
                />
              ) : (
                <Image
                  src={viewingService.image}
                  alt={viewingService.title}
                  width={600}
                  height={192}
                  className="w-full h-48 object-cover rounded-xl mb-4"
                />
              )
            )}
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Title</label>
                <div className="font-medium">{viewingService.title}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Category</label>
                <div className="font-medium">{viewingService.category?.name}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Description</label>
                <div className="text-gray-700">{viewingService.description}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Price</label>
                  <div className="font-medium">
                    {viewingService.price ? `Rs. ${viewingService.price.toLocaleString()}+` : 'Contact for quote'}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Duration</label>
                  <div className="font-medium">
                    {viewingService.duration ? `${viewingService.duration} min` : '-'}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    viewingService.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {viewingService.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setViewingService(null)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {editingService ? 'Edit Service' : 'Add New Service'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => {
                    setFormData(prev => ({ 
                      ...prev, 
                      title: e.target.value,
                      slug: prev.slug || generateSlug(e.target.value)
                    }))
                  }}
                  className="input-field"
                  placeholder="e.g., Furniture Assembly"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  className="input-field"
                  placeholder="furniture-assembly"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to auto-generate from title</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                {hasEditPermission ? (
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="input-field"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="relative">
                    <select
                      value={formData.categoryId}
                      disabled
                      className="input-field bg-gray-100 cursor-not-allowed"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    <FiLock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                )}
                
                {hasEditPermission && !showAddCategory && (
                  <button
                    type="button"
                    onClick={() => setShowAddCategory(true)}
                    className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                  >
                    <FiPlus className="w-4 h-4" /> Add New Category
                  </button>
                )}
                
                {showAddCategory && (
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-700">Add New Category</h4>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddCategory(false)
                          setNewCategoryName('')
                          setNewCategoryDesc('')
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <FiX className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Category name (e.g., Plumbing)"
                          className="input-field"
                        />
                      </div>
                      <div>
                        <textarea
                          value={newCategoryDesc}
                          onChange={(e) => setNewCategoryDesc(e.target.value)}
                          placeholder="Description (optional)"
                          rows={2}
                          className="input-field resize-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddCategory(false)
                            setNewCategoryName('')
                            setNewCategoryDesc('')
                          }}
                          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={addNewCategory}
                          disabled={addingCategory}
                          className="px-4 py-2 text-sm bg-primary-500 text-dark-900 rounded-lg hover:bg-primary-600 font-medium disabled:opacity-50"
                        >
                          {addingCategory ? 'Adding...' : 'Add Category'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  {hasEditPermission ? 'You can select or add categories' : 'Only Super Admin can change category'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="input-field resize-none"
                  placeholder="Describe the service..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (Rs.)</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="input-field"
                    placeholder="e.g., 3500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty for &quot;Contact for quote&quot;</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                    className="input-field"
                    placeholder="e.g., 120"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Image</label>
                <ImageUploader
                  key={editingService?.id || 'new'}
                  value={formData.image}
                  onChange={(url) => setFormData(prev => ({ ...prev, image: url }))}
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <label htmlFor="isActive" className="ml-2 text-sm text-gray-700 cursor-pointer">
                  Active (visible on website)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    setEditingService(null)
                    resetForm()
                  }}
                  className="flex-1 btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingService ? 'Update Service' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
