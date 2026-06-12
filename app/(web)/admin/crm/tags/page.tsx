'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { 
  FiTag, FiPlus, FiEdit2, FiTrash2, FiX, FiSearch, FiRefreshCw,
  FiHash, FiCheckCircle, FiAlertCircle
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface Tag {
  id: string
  name: string
  slug: string
  color: string
  usageCount: number
  isSystem: boolean
  isActive: boolean
  createdAt: string
}

const TAG_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E',
  '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
  '#A855F7', '#EC4899', '#F43F5E', '#6B7280'
]

export default function CRMTagsPage() {
  const { user } = useAdminSession()
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [filter, setFilter] = useState('')

  const [newTag, setNewTag] = useState({
    name: '',
    color: TAG_COLORS[0]
  })

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const fetchTags = useCallback(async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/crm/tags', {
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to load tags')
        return
      }

      setTags(data.tags || [])
      setError(null)
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  const createTag = async () => {
    if (!newTag.name.trim()) {
      toast.error('Tag name is required')
      return
    }

    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/crm/tags', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders 
        },
        body: JSON.stringify(newTag)
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to create tag')
        return
      }

      toast.success('Tag created successfully')
      setShowCreate(false)
      setNewTag({ name: '', color: TAG_COLORS[0] })
      fetchTags()
    } catch (err) {
      toast.error('Failed to create tag')
    }
  }

  const updateTag = async () => {
    if (!editingTag) return

    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/crm/tags/${editingTag.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders 
        },
        body: JSON.stringify({
          name: editingTag.name,
          color: editingTag.color
        })
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to update tag')
        return
      }

      toast.success('Tag updated successfully')
      setEditingTag(null)
      fetchTags()
    } catch (err) {
      toast.error('Failed to update tag')
    }
  }

  const deleteTag = async (id: string, tag: Tag) => {
    if (tag.isSystem) {
      toast.error('Cannot delete system tags')
      return
    }

    if (!confirm('Are you sure you want to delete this tag?')) return

    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/crm/tags/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to delete tag')
        return
      }

      toast.success('Tag deleted')
      fetchTags()
    } catch (err) {
      toast.error('Failed to delete tag')
    }
  }

  const filteredTags = tags.filter(t => 
    t.name.toLowerCase().includes(filter.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !tags.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiAlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Tags</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchTags}
            className="px-4 py-2 bg-primary-500 text-dark-900 rounded-lg font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Tags</h1>
          <p className="text-gray-600">Organize customers with labels</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchTags} className="btn-outline flex items-center">
            <FiRefreshCw className="mr-2" /> Refresh
          </button>
          {isSuperAdmin && (
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center">
              <FiPlus className="mr-2" /> Create Tag
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tags..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="text-sm text-gray-500">
          {filteredTags.length} tag{filteredTags.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredTags.length > 0 ? (
          filteredTags.map(tag => (
            <div
              key={tag.id}
              className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      <FiHash className="inline mr-0.5" />
                      {tag.name}
                    </span>
                    {tag.isSystem && (
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                        System
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {tag.usageCount} customers
                  </div>
                </div>
              </div>
              {isSuperAdmin && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingTag(tag)}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                  >
                    <FiEdit2 />
                  </button>
                  <button
                    onClick={() => deleteTag(tag.id, tag)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    disabled={tag.isSystem}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white rounded-xl shadow-sm p-12 text-center">
            <FiTag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Tags Yet</h3>
            <p className="text-gray-500 mb-4">Create tags to categorize customers</p>
            {isSuperAdmin && (
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <FiPlus className="mr-2" /> Create Tag
              </button>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Create Tag</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <FiX />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newTag.name}
                  onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Priority, Follow-up"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewTag({ ...newTag, color })}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        newTag.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: newTag.color }}
                />
                <FiHash className="text-gray-400" />
                <span className="font-medium text-gray-700">{newTag.name || 'Tag name'}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 btn-secondary">
                Cancel
              </button>
              <button onClick={createTag} className="flex-1 btn-primary">
                Create Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTag && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Edit Tag</h2>
              <button onClick={() => setEditingTag(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <FiX />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingTag.name}
                  onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={editingTag.isSystem}
                />
                {editingTag.isSystem && (
                  <p className="text-xs text-gray-500 mt-1">System tags cannot be renamed</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setEditingTag({ ...editingTag, color })}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        editingTag.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: editingTag.color }}
                />
                <FiHash className="text-gray-400" />
                <span className="font-medium text-gray-700">{editingTag.name}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setEditingTag(null)} className="flex-1 btn-secondary">
                Cancel
              </button>
              <button onClick={updateTag} className="flex-1 btn-primary">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}