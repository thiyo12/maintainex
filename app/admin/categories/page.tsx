'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiUpload, FiX, FiCheck } from 'react-icons/fi'
import Image from 'next/image'
import { getAuthHeader } from '@/lib/auth-client'

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  image: string | null
  isActive: boolean
  _count: {
    services: number
  }
}

interface CategoryForm {
  name: string
  slug: string
  description: string
  icon: string
  image: string
  isActive: boolean
}

const EMOJI_OPTIONS = ['🧹', '🔧', '🖼️', '📦', '🌿', '🔨', '🔥', '🪳', '❄️', '💧', '🦠', '🏠', '✨', '🛠️', '🚿', '🧽']

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState<CategoryForm>({
    name: '',
    slug: '',
    description: '',
    icon: '🧹',
    image: '',
    isActive: true
  })

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/categories', { headers: { ...authHeaders } })
      
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      
      const data = await res.json()
      setCategories(data)
    } catch (error) {
      toast.error('Failed to fetch categories')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))

    if (name === 'name' && !editingCategory) {
      const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      setFormData(prev => ({ ...prev, slug }))
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    setUploading(true)
    const formDataUpload = new FormData()
    formDataUpload.append('file', file)

    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { ...authHeaders },
        body: formDataUpload
      })

      if (!res.ok) throw new Error('Upload failed')

      const data = await res.json()
      setFormData(prev => ({ ...prev, image: data.url }))
      toast.success('Image uploaded successfully')
    } catch (error) {
      toast.error('Failed to upload image')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.slug) {
      toast.error('Name and slug are required')
      return
    }

    try {
      const authHeaders = getAuthHeader()
      const url = editingCategory 
        ? '/api/categories'
        : '/api/categories'
      const method = editingCategory ? 'PUT' : 'POST'
      const body = editingCategory 
        ? { id: editingCategory.id, ...formData }
        : formData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save category')
      }

      toast.success(editingCategory ? 'Category updated successfully' : 'Category created successfully')
      setShowModal(false)
      resetForm()
      fetchCategories()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      icon: category.icon || '🧹',
      image: category.image || '',
      isActive: category.isActive
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    const category = categories.find(c => c.id === id)
    if (category && category._count.services > 0) {
      toast.error('Cannot delete category with existing services')
      return
    }

    if (!confirm('Are you sure you want to delete this category?')) return

    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/categories?id=${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete category')
      }

      toast.success('Category deleted successfully')
      fetchCategories()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const resetForm = () => {
    setEditingCategory(null)
    setFormData({
      name: '',
      slug: '',
      description: '',
      icon: '🧹',
      image: '',
      isActive: true
    })
  }

  const openModal = () => {
    resetForm()
    setShowModal(true)
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-600 mt-1 text-sm md:text-base">Manage service categories with cover images for the slider</p>
        </div>
        <button onClick={openModal} className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
          <FiPlus size={20} />
          Add Category
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 md:h-64">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 md:p-12 text-center">
          <div className="text-4xl md:text-6xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Categories Yet</h3>
          <p className="text-gray-500 mb-4">Create your first service category to get started.</p>
          <button onClick={openModal} className="btn-primary inline-flex items-center gap-2">
            <FiPlus size={20} />
            Add First Category
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {categories.map((category) => (
            <div key={category.id} className="bg-white rounded-xl shadow-sm p-4 md:p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
                <span className="text-3xl md:text-4xl">{category.icon || '📋'}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{category.name}</h3>
                  <p className="text-xs md:text-sm text-gray-500">{category.slug}</p>
                </div>
              </div>
              
              <div className="mb-3 md:mb-4">
                {category.image ? (
                  <div className="relative w-full h-24 md:h-32 rounded-lg overflow-hidden">
                    <Image
                      src={category.image}
                      alt={category.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-24 md:h-32 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                    No image
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                    {category._count.services} services
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    category.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {category.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(category)}
                    className="text-primary-600 hover:text-primary-900 p-2"
                    title="Edit"
                  >
                    <FiEdit2 size={18} />
                  </button>
                  {category._count.services === 0 && (
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="text-red-600 hover:text-red-900 p-2"
                      title="Delete"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="Deep Cleaning"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  name="slug"
                  value={formData.slug}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="deep-cleaning"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="input-field"
                  rows={3}
                  placeholder="Professional deep cleaning services..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, icon: emoji }))}
                      className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                        formData.icon === emoji 
                          ? 'bg-primary-100 ring-2 ring-primary-500' 
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image</label>
                <div className="mt-1 flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {formData.image ? (
                      <div className="relative w-32 h-32 rounded-lg overflow-hidden">
                        <Image
                          src={formData.image}
                          alt="Cover"
                          fill
                          className="object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                        >
                          <FiX size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="btn-secondary cursor-pointer inline-flex items-center gap-2">
                      <FiUpload size={18} />
                      {uploading ? 'Uploading...' : 'Upload Image'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                    <p className="text-xs text-gray-500 mt-2">Recommended: 800x600px, Max 5MB</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isActive"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Active (visible on website)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <FiCheck size={18} />
                  {editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
