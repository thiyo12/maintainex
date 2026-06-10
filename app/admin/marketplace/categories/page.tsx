'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiGrid, FiAlertCircle } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface Category {
  id: string
  name: string
  iconName: string
  colorHex: string
  sortOrder: number
  isActive: boolean
  countries: string[]
}

export default function MarketplaceCategories() {
  const { user: currentUser } = useAdminSession()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Category | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', iconName: '', colorHex: '#6366f1', sortOrder: 0, countries: '' })
  const [saving, setSaving] = useState(false)

  const canEdit = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN' || currentUser?.role === 'MODERATOR'

  useEffect(() => { fetchCategories() }, [])

  const fetchCategories = async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/admin/marketplace/categories', {
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const result = await res.json()

      if (result.error) {
        toast.error(result.error)
        setError(result.error)
        return
      }

      setCategories(result.data)
    } catch (error) {
      console.error('Categories fetch error:', error)
      toast.error('Failed to load categories')
      setError('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setForm({ name: '', iconName: '', colorHex: '#6366f1', sortOrder: 0, countries: '' })
    setEditing(null)
    setShowForm(false)
  }

  const openEdit = (cat: Category) => {
    setForm({
      name: cat.name,
      iconName: cat.iconName,
      colorHex: cat.colorHex,
      sortOrder: cat.sortOrder,
      countries: (cat.countries || []).join(', ')
    })
    setEditing(cat)
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        countries: form.countries ? form.countries.split(',').map((c) => c.trim()).filter(Boolean) : []
      }

      const authHeaders = getAuthHeader()
      const headers = { ...authHeaders, 'Content-Type': 'application/json' }

      let res
      if (editing) {
        res = await fetch(`/api/admin/marketplace/categories/${editing.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload)
        })
      } else {
        res = await fetch('/api/admin/marketplace/categories', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        })
      }

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const result = await res.json()

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(editing ? 'Category updated' : 'Category created')
      resetForm()
      await fetchCategories()
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Delete "${cat.name}"?`)) return
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/admin/marketplace/categories/${cat.id}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const result = await res.json()

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Category deleted')
      await fetchCategories()
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete category')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <FiAlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-gray-600">{error}</p>
        <button onClick={fetchCategories} className="btn-primary px-4 py-2 rounded-lg text-sm">Try Again</button>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-600 mt-1">Manage job categories</p>
        </div>
        {canEdit && (
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
          >
            <FiPlus className="w-4 h-4" /> Add Category
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 md:p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Edit' : 'New'} Category</h2>
          </div>
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Name</label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Icon Name</label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={form.iconName}
                  onChange={(e) => setForm({ ...form, iconName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.colorHex}
                    onChange={(e) => setForm({ ...form, colorHex: e.target.value })}
                    className="h-10 w-10 cursor-pointer rounded border"
                  />
                  <input
                    type="text"
                    className="input-field flex-1"
                    value={form.colorHex}
                    onChange={(e) => setForm({ ...form, colorHex: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">Sort Order</label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-xs font-medium text-gray-500">Countries (comma-separated)</label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={form.countries}
                  onChange={(e) => setForm({ ...form, countries: e.target.value })}
                  placeholder="US, GB, CA"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !form.name}
                className="btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={resetForm} className="btn-outline px-4 py-2 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-10" />
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Icon</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Countries</th>
                {canEdit && <th className="px-4 md:px-6 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-4 md:px-6 py-4">
                    <FiGrid className="w-4 h-4 text-gray-300" />
                  </td>
                  <td className="px-4 md:px-6 py-4 text-sm font-medium text-gray-900">{cat.name}</td>
                  <td className="px-4 md:px-6 py-4 text-sm text-gray-600 font-mono">{cat.iconName}</td>
                  <td className="px-4 md:px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded border" style={{ backgroundColor: cat.colorHex }} />
                      <span className="text-xs text-gray-500">{cat.colorHex}</span>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 text-sm text-gray-600">{cat.sortOrder}</td>
                  <td className="px-4 md:px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${cat.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {cat.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 text-sm text-gray-600">{(cat.countries || []).join(', ') || '\u2014'}</td>
                  {canEdit && (
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(cat)} className="p-1 hover:bg-gray-100 rounded">
                          <FiEdit2 className="w-4 h-4 text-gray-500" />
                        </button>
                        {cat.isActive && (
                          <button onClick={() => handleDelete(cat)} className="p-1 hover:bg-gray-100 rounded">
                            <FiTrash2 className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
