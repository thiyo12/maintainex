'use client'

import { useState, useEffect } from 'react'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'

interface WishlistItem {
  id: string
  title: string
  description: string
  category: string
  status: string
  priority: string
  assignedTo?: string
  notes?: string
  requestedBy?: string
  completedAt?: string
  createdAt: string
}

interface WaitlistEntry {
  id: string
  name: string
  email: string | null
  phone: string
  role: string
  location: string | null
  createdAt: string
}

export default function WishlistPage() {
  const { user: admin } = useAdminSession()
  const canManageWishlist = !!admin && (ROLE_PERMISSIONS[admin.role as AdminRole] || []).includes('wishlist:manage')
  const [activeTab, setActiveTab] = useState<'wishlist' | 'waitlist'>('wishlist')
  const [items, setItems] = useState<WishlistItem[]>([])
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('NEW')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [summary, setSummary] = useState({
    new: 0,
    planned: 0,
    inProgress: 0,
    completed: 0,
    rejected: 0
  })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<WishlistItem | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'GENERAL',
    priority: 'MEDIUM'
  })
  const [actionLoading, setActionLoading] = useState(false)
  const [waitlistPage, setWaitlistPage] = useState(1)
  const [waitlistPagination, setWaitlistPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 })

  useEffect(() => {
    if (activeTab === 'wishlist') {
      fetchItems()
    } else {
      fetchWaitlist()
    }
  }, [filter, categoryFilter, activeTab, waitlistPage])

  const fetchItems = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter) params.set('status', filter)
      if (categoryFilter) params.set('category', categoryFilter)
      
      const res = await fetch(`/api/admin/wishlist?${params}`)
      const data = await res.json()
      setItems(data.items || [])
      setSummary(data.summary || {
        new: 0,
        planned: 0,
        inProgress: 0,
        completed: 0,
        rejected: 0
      })
    } catch (error) {
      console.error('Failed to fetch wishlist items:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWaitlist = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ view: 'waitlist', page: String(waitlistPage), limit: '20' })
      const res = await fetch(`/api/admin/wishlist?${params}`)
      const data = await res.json()
      setWaitlistEntries(data.entries || [])
      setWaitlistPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 })
    } catch (error) {
      console.error('Failed to fetch waitlist entries:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!canManageWishlist) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setShowCreateModal(false)
        setFormData({ title: '', description: '', category: 'GENERAL', priority: 'MEDIUM' })
        fetchItems()
      }
    } catch (error) {
      console.error('Failed to create item:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdate = async (itemId: string, updates: Partial<WishlistItem>) => {
    if (!canManageWishlist) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/wishlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, ...updates })
      })

      if (res.ok) {
        setSelectedItem(null)
        fetchItems()
      }
    } catch (error) {
      console.error('Failed to update item:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (itemId: string) => {
    if (!canManageWishlist) return
    if (!confirm('Are you sure you want to delete this item?')) return
    
    try {
      const res = await fetch(`/api/admin/wishlist?itemId=${itemId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        fetchItems()
      }
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-blue-100 text-blue-800'
      case 'PLANNED': return 'bg-purple-100 text-purple-800'
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-100 text-red-800'
      case 'HIGH': return 'bg-orange-100 text-orange-800'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800'
      case 'LOW': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'GENERAL': 'General',
      'APP': 'Mobile App',
      'WEBSITE': 'Website',
      'ADMIN': 'Admin Panel',
      'API': 'API'
    }
    return labels[category] || category
  }

  return (
    <>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Website & App Wishlist</h1>
          {activeTab === 'wishlist' && canManageWishlist && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
            >
              + Add Item
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('wishlist')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === 'wishlist'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Wishlist Items
          </button>
          <button
            onClick={() => setActiveTab('waitlist')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === 'waitlist'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Waitlist Signups
          </button>
        </div>

        {activeTab === 'wishlist' ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-blue-600 text-sm font-medium">New</div>
                <div className="text-2xl font-bold text-blue-700">{summary.new}</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-purple-600 text-sm font-medium">Planned</div>
                <div className="text-2xl font-bold text-purple-700">{summary.planned}</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="text-yellow-600 text-sm font-medium">In Progress</div>
                <div className="text-2xl font-bold text-yellow-700">{summary.inProgress}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-green-600 text-sm font-medium">Completed</div>
                <div className="text-2xl font-bold text-green-700">{summary.completed}</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-red-600 text-sm font-medium">Rejected</div>
                <div className="text-2xl font-bold text-red-700">{summary.rejected}</div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-6">
              <div className="flex gap-2">
                {['NEW', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                      filter === status
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Categories</option>
                <option value="GENERAL">General</option>
                <option value="APP">Mobile App</option>
                <option value="WEBSITE">Website</option>
                <option value="ADMIN">Admin Panel</option>
                <option value="API">API</option>
              </select>
            </div>

            {/* Items List */}
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No items found</div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                            {item.status.replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(item.priority)}`}>
                            {item.priority}
                          </span>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            {getCategoryLabel(item.category)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                        <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                        <div className="text-xs text-gray-400">
                          Created: {formatDate(item.createdAt)}
                          {item.requestedBy && ` | Requested by: ${item.requestedBy}`}
                        </div>
                        {item.notes && (
                          <div className="text-sm text-gray-500 mt-2">
                            <span className="font-medium">Notes:</span> {item.notes}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {canManageWishlist ? <>
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Delete
                        </button>
                        </> : <span className="text-xs text-gray-400">Read only</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Waitlist Signups Table */}
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : waitlistEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No waitlist signups yet</div>
            ) : (
              <>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Phone</th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Email</th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Role</th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Date Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waitlistEntries.map((entry) => (
                        <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{entry.phone}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{entry.email || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              {entry.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDate(entry.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {waitlistPagination.pages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-6">
                    <button
                      onClick={() => setWaitlistPage(p => Math.max(1, p - 1))}
                      disabled={waitlistPage === 1}
                      className="px-3 py-1 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {waitlistPage} of {waitlistPagination.pages} ({waitlistPagination.total} total)
                    </span>
                    <button
                      onClick={() => setWaitlistPage(p => Math.min(waitlistPagination.pages, p + 1))}
                      disabled={waitlistPage === waitlistPagination.pages}
                      className="px-3 py-1 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Create Modal */}
        {canManageWishlist && showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold mb-4">Add Wishlist Item</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    placeholder="Feature title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    rows={3}
                    placeholder="Describe the feature..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2"
                    >
                      <option value="GENERAL">General</option>
                      <option value="APP">Mobile App</option>
                      <option value="WEBSITE">Website</option>
                      <option value="ADMIN">Admin Panel</option>
                      <option value="API">API</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleCreate}
                  disabled={actionLoading || !formData.title || !formData.description}
                  className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {canManageWishlist && selectedItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold mb-4">Edit Wishlist Item</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={selectedItem.status}
                    onChange={(e) => setSelectedItem({ ...selectedItem, status: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  >
                    <option value="NEW">New</option>
                    <option value="PLANNED">Planned</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={selectedItem.priority}
                    onChange={(e) => setSelectedItem({ ...selectedItem, priority: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
                  <textarea
                    value={selectedItem.notes || ''}
                    onChange={(e) => setSelectedItem({ ...selectedItem, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    rows={3}
                    placeholder="Internal notes..."
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => handleUpdate(selectedItem.id, {
                    status: selectedItem.status,
                    priority: selectedItem.priority,
                    notes: selectedItem.notes
                  })}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}