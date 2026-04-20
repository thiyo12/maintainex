'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiUpload, FiX, FiCheck, FiImage, FiSave } from 'react-icons/fi'
import Image from 'next/image'
import { getAuthHeader } from '@/lib/auth-client'
import { getImageUrl } from '@/lib/images'

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

const EMOJI_OPTIONS = ['🧹', '🔧', '🖼️', '📦', '🌿', '🔨', '🔥', '🪳', '❄️', '💧', '🦠', '🏠', '✨', '🛠️', '🚿', '🧽', '🪴', '🏡']

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
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
      const res = await fetch('/api/categories')
      const data = await res.json()
      setCategories(data)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))

    // Auto-generate slug from name
    if (name === 'name') {
      const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      setFormData(prev => ({ ...prev, slug }))
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
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
      toast.success('Image uploaded')
    } catch (error) {
      toast.error('Upload failed')
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
      const isEdit = !!editingCategory

      const res = await fetch('/api/categories', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(isEdit ? { id: editingCategory.id, ...formData } : formData)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed')
      }

      toast.success(isEdit ? 'Category updated' : 'Category created')
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
      toast.error('Cannot delete category with services')
      return
    }

    if (!confirm('Delete this category?')) return

    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/categories?id=${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      })

      if (!res.ok) throw new Error('Failed')
      toast.success('Deleted')
      fetchCategories()
    } catch (error) {
      toast.error('Delete failed')
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-600 mt-1 text-sm">Manage categories for homepage slider</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true) }} 
          className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <FiPlus size={20} />
          Add Category
        </button>
      </div>

      {/* Empty State */}
      {categories.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 md:p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Categories</h3>
          <p className="text-gray-500 mb-4">Create your first category to show on homepage.</p>
          <button onClick={() => { resetForm(); setShowModal(true) }} className="btn-primary">
            Add First Category
          </button>
        </div>
      ) : (
        /* Categories Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map((category) => (
            <div key={category.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {/* Image */}
              <div className="relative h-32 sm:h-36 bg-gray-100">
                {category.image ? (
                  <Image
                    src={getImageUrl(category.image)}
                    alt={category.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl sm:text-5xl">
                    {category.icon || '📋'}
                  </div>
                )}
                {/* Status Badge */}
                <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${
                  category.isActive ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
                }`}>
                  {category.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>

              {/* Content */}
              <div className="p-3 sm:p-4">
                <h3 className="font-semibold text-gray-900 truncate">{category.name}</h3>
                <p className="text-xs sm:text-sm text-gray-500 mb-2 truncate">{category.slug}</p>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                    {category._count.services} services
                  </span>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleEdit(category)}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded"
                      title="Edit"
                    >
                      <FiEdit2 size={16} />
                    </button>
                    {category._count.services === 0 && (
                      <button 
                        onClick={() => handleDelete(category.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-bold">
                {editingCategory ? 'Edit Category' : 'New Category'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded">
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
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

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
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

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="input-field"
                  rows={2}
                  placeholder="Description..."
                />
              </div>

              {/* Icon */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
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

              {/* Cover Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image</label>
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-20 h-20 relative rounded-lg overflow-hidden bg-gray-100">
                    {formData.image ? (
                      <>
                        <Image
                          src={getImageUrl(formData.image)}
                          alt="Cover"
                          fill
                          className="object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <FiImage size={20} />
                      </div>
                    )}
                  </div>
                  <label className="btn-secondary cursor-pointer inline-flex items-center gap-2 text-sm">
                    <FiUpload size={16} />
                    {uploading ? 'Uploading...' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>

              {/* Active Checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isActive"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="isActive" className="text-sm">Active (show on website)</label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <FiSave size={18} />
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