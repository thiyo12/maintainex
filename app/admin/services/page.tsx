'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { FiPlus, FiEdit2, FiTrash2, FiImage, FiRefreshCw, FiEye, FiX, FiAlertCircle, FiTrendingUp, FiTrendingDown, FiGripVertical } from 'react-icons/fi'
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ImageUploader from '@/components/admin/ImageUploader'
import PriceSuggestion, { PriceSuggestionButton } from '@/components/admin/PriceSuggestion'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface Service {
  id: string
  name: string
  slug: string | null
  description: string
  image: string | null
  price: number | null
  duration: number | null
  categoryId: string
  category: { name: string }
  isActive: boolean
  views: number
  isTrending: boolean
  displayOrder: number
}

interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  _count: { services: number }
  services: Service[]
}

interface ServiceItemProps {
  service: Service
  onEdit: (service: Service) => void
  onDelete: (id: string) => void
  onToggleTrending: (service: Service) => void
  hasEditPermission: boolean
}

function SortableServiceItem({ service, onEdit, onDelete, onToggleTrending, hasEditPermission }: ServiceItemProps) {
  const [imgError, setImgError] = useState(false)
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: service.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border border-gray-200 rounded-xl p-4 ${isDragging ? 'shadow-lg ring-2 ring-primary-400' : 'hover:border-gray-300'}`}
    >
      <div className="flex items-center gap-3">
        {hasEditPermission && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
          >
            <FiGripVertical className="w-5 h-5" />
          </button>
        )}
        
        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
          {service.image ? (
            service.image.startsWith('/uploads/') ? (
              <img
                src={`${service.image}?t=${Date.now()}`}
                alt={service.name}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <Image
                src={service.image}
                alt={service.name}
                width={56}
                height={56}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FiImage className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900 truncate">{service.name}</h4>
            {service.isTrending && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                Trending
              </span>
            )}
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              service.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {service.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span className="font-medium text-primary-600">
              {service.price ? `Rs. ${service.price.toLocaleString()}` : 'Quote'}
            </span>
            <span className="flex items-center gap-1">
              <FiEye className="w-3 h-3" />
              {service.views} views
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasEditPermission && (
            <>
              <button
                onClick={() => onToggleTrending(service)}
                className={`p-2 rounded-lg transition-colors ${
                  service.isTrending 
                    ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' 
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                title={service.isTrending ? 'Remove from Trending' : 'Mark as Trending'}
              >
                {service.isTrending ? <FiTrendingDown className="w-4 h-4" /> : <FiTrendingUp className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onEdit(service)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                title="Edit"
              >
                <FiEdit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(service.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                title="Delete"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminServices() {
  const router = useRouter()
  const { user } = useAdminSession()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [formData, setFormData] = useState({
    name: '',
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
  const [showPriceSuggestion, setShowPriceSuggestion] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

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
        fetch('/api/services?all=true', { headers: { ...authHeaders } }),
        fetch('/api/categories', { headers: { ...authHeaders } })
      ])
      if (servicesRes.status === 401 || categoriesRes.status === 401) {
        router.push('/admin/login')
        return
      }
      const servicesData: Service[] = await servicesRes.json()
      const categoriesData: Category[] = await categoriesRes.json()
      
      const categoriesWithServices = categoriesData.map(cat => ({
        ...cat,
        services: servicesData.filter(s => s.categoryId === cat.id)
      }))
      
      setCategories(categoriesWithServices)
    } catch (err) {
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
    } catch (err) {
      toast.error('Failed to add category')
    } finally {
      setAddingCategory(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || formData.name.trim().length < 2) {
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
        name: formData.name,
        slug: formData.slug || generateSlug(formData.name),
        description: formData.description,
        image: formData.image || null,
        price: formData.price ? parseFloat(formData.price) : null,
        duration: formData.duration ? parseInt(formData.duration) : null,
        isActive: formData.isActive
      }

      if (isSuperAdmin && formData.categoryId) {
        bodyData.categoryId = formData.categoryId
      }

      const authHeaders = getAuthHeader()
      const res = await fetch(url, {
        method,
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      })

      if (res.status === 401) {
        router.push('/admin/login')
        return
      }
      
      const responseData = await res.json()
      if (!res.ok) {
        throw new Error(responseData.error || 'Failed to save')
      }

      toast.success(editingService ? 'Service updated successfully' : 'Service created successfully')
      setShowModal(false)
      setEditingService(null)
      resetForm()
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save service')
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete service')
    }
  }

  const handleToggleTrending = async (service: Service) => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/services/${service.id}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'service',
          isTrending: !service.isTrending
        })
      })
      
      if (res.status === 401) {
        router.push('/admin/login')
        return
      }
      
      if (!res.ok) throw new Error()
      
      toast.success(service.isTrending ? 'Removed from trending' : 'Marked as trending')
      fetchData()
    } catch (err) {
      toast.error('Failed to update trending status')
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over || active.id === over.id) return
    
    const draggedServiceId = active.id as string
    const targetCategoryId = over.id as string
    
    if (draggedServiceId === targetCategoryId) return
    
    const draggedService = categories
      .flatMap(cat => cat.services)
      .find(s => s.id === draggedServiceId)
    
    if (!draggedService || draggedService.categoryId === targetCategoryId) return
    
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/services/${draggedServiceId}`, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'service',
          categoryId: targetCategoryId
        })
      })
      
      if (!res.ok) throw new Error()
      
      toast.success(`Moved "${draggedService.name}" to new category`)
      fetchData()
    } catch (err) {
      toast.error('Failed to move service')
    }
  }

  const editService = (service: Service) => {
    if (!hasEditPermission) {
      toast.error('You do not have permission to edit services')
      return
    }
    setEditingService(service)
    setFormData({
      name: service.name,
      slug: service.slug || '',
      description: service.description,
      image: service.image || '',
      price: service.price?.toString() || '',
      duration: service.duration?.toString() || '',
      categoryId: service.categoryId,
      isActive: service.isActive
    })
    setShowModal(true)
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
      name: '',
      slug: '',
      description: '',
      image: '',
      price: '',
      duration: '',
      categoryId: '',
      isActive: true
    })
  }

  const allServices = categories.flatMap(cat => cat.services)
  const trendingServices = [...allServices]
    .filter(s => s.isTrending || s.views > 0)
    .sort((a, b) => {
      if (a.isTrending !== b.isTrending) return a.isTrending ? -1 : 1
      return b.views - a.views
    })
    .slice(0, 5)

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
            {hasEditPermission ? 'Manage your services, drag to reorder categories' : 'View services and pricing'}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} className="btn-outline flex items-center">
            <FiRefreshCw className="mr-2" /> Refresh
          </button>
          {hasEditPermission && (
            <button onClick={openAddModal} className="btn-primary flex items-center">
              <FiPlus className="mr-2" /> Add Service
            </button>
          )}
        </div>
      </div>

      {!hasEditPermission && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-700">
            You have view-only access. Contact Super Admin to get permission for editing services.
          </p>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        {trendingServices.length > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-500 rounded-lg">
                <FiTrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Top Trending Services</h3>
                <p className="text-sm text-gray-600">Services with most views or marked as trending</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {trendingServices.map((service, index) => (
                <div key={service.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    {service.isTrending && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                        Trending
                      </span>
                    )}
                  </div>
                  <h4 className="font-medium text-gray-900 truncate text-sm">{service.name}</h4>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                    <FiEye className="w-3 h-3" />
                    <span>{service.views} views</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {categories.length > 0 ? (
            categories.map((category) => (
              <div
                key={category.id}
                id={category.id}
                className="bg-gray-50 rounded-2xl p-6 border-2 border-transparent hover:border-gray-200 transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <span className="text-xl">{category.icon || '📦'}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{category.name}</h3>
                      <p className="text-sm text-gray-500">{category.services.length} services</p>
                    </div>
                  </div>
                  {hasEditPermission && (
                    <button
                      onClick={() => {
                        resetForm()
                        setEditingService(null)
                        setFormData(prev => ({ ...prev, categoryId: category.id }))
                        setShowModal(true)
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary-500 text-dark-900 rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
                    >
                      <FiPlus className="w-4 h-4" /> Add to {category.name}
                    </button>
                  )}
                </div>
                
                <SortableContext
                  id={category.id}
                  items={category.services.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {category.services.length > 0 ? (
                      category.services.map((service) => (
                        <SortableServiceItem
                          key={service.id}
                          service={service}
                          onEdit={editService}
                          onDelete={handleDelete}
                          onToggleTrending={handleToggleTrending}
                          hasEditPermission={hasEditPermission}
                        />
                      ))
                    ) : (
                      <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
                        <p className="text-gray-500">No services in this category yet</p>
                        {hasEditPermission && (
                          <button
                            onClick={() => {
                              resetForm()
                              setEditingService(null)
                              setFormData(prev => ({ ...prev, categoryId: category.id }))
                              setShowModal(true)
                            }}
                            className="mt-2 text-primary-600 font-medium"
                          >
                            Add your first service
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-xl p-12 text-center">
              <p className="text-gray-500 mb-4">No categories found</p>
              {hasEditPermission && (
                <button
                  onClick={() => setShowAddCategory(true)}
                  className="btn-primary"
                >
                  Add First Category
                </button>
              )}
            </div>
          )}
        </div>
      </DndContext>

      <div className="mt-6">
        {hasEditPermission && categories.length > 0 && (
          <button onClick={openAddModal} className="btn-outline w-full py-4">
            <FiPlus className="inline mr-2" /> Add New Service (General)
          </button>
        )}
      </div>

      {showAddCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Category</h3>
            <div className="space-y-4">
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
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddCategory(false)
                    setNewCategoryName('')
                    setNewCategoryDesc('')
                  }}
                  className="flex-1 btn-outline"
                >
                  Cancel
                </button>
                <button
                  onClick={addNewCategory}
                  disabled={addingCategory}
                  className="flex-1 btn-primary"
                >
                  {addingCategory ? 'Adding...' : 'Add Category'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  value={formData.name}
                  onChange={(e) => {
                    setFormData(prev => ({ 
                      ...prev, 
                      name: e.target.value,
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (Rs.)</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  className="input-field"
                  placeholder="e.g., 3500"
                />
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
                  {editingService ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}