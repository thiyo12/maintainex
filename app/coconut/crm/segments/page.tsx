'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { 
  FiUsers, FiPlus, FiEdit2, FiTrash2, FiEye, FiX, FiFilter,
  FiCheckCircle, FiAlertCircle, FiSearch, FiRefreshCw
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface Segment {
  id: string
  name: string
  slug: string
  description: string | null
  type: string
  criteria: string | null
  isActive: boolean
  memberCount: number
  createdAt: string
  updatedAt: string
}

interface SegmentCustomer {
  id: string
  userId: string
  user: { name: string | null; email: string | null; phone: string | null }
  totalBookings: number
  totalSpent: number
  customerType: string
  status: string
}

export default function CRMSegmentsPage() {
  const { user } = useAdminSession()
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null)
  const [segmentCustomers, setSegmentCustomers] = useState<SegmentCustomer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null)
  const [filter, setFilter] = useState('')

  const [newSegment, setNewSegment] = useState({
    name: '',
    description: '',
    type: 'DYNAMIC'
  })

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const fetchSegments = useCallback(async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/crm/segments', {
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to load segments')
        return
      }

      setSegments(data.segments || [])
      setError(null)
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSegments()
  }, [fetchSegments])

  const fetchSegmentCustomers = async (segmentId: string) => {
    setLoadingCustomers(true)
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/crm/segments/${segmentId}/customers`, {
        headers: { ...authHeaders }
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to load customers')
        return
      }

      const data = await res.json()
      setSegmentCustomers(data.customers || [])
    } catch (err) {
      toast.error('Failed to load customers')
    } finally {
      setLoadingCustomers(false)
    }
  }

  const createSegment = async () => {
    if (!newSegment.name.trim()) {
      toast.error('Segment name is required')
      return
    }

    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/crm/segments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders 
        },
        body: JSON.stringify(newSegment)
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to create segment')
        return
      }

      toast.success('Segment created successfully')
      setShowCreate(false)
      setNewSegment({ name: '', description: '', type: 'DYNAMIC' })
      fetchSegments()
    } catch (err) {
      toast.error('Failed to create segment')
    }
  }

  const updateSegment = async () => {
    if (!editingSegment) return

    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/crm/segments/${editingSegment.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders 
        },
        body: JSON.stringify({
          name: editingSegment.name,
          description: editingSegment.description,
          isActive: editingSegment.isActive
        })
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to update segment')
        return
      }

      toast.success('Segment updated successfully')
      setEditingSegment(null)
      fetchSegments()
    } catch (err) {
      toast.error('Failed to update segment')
    }
  }

  const deleteSegment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this segment?')) return

    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/crm/segments/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete segment')
        return
      }

      toast.success('Segment deleted')
      setSelectedSegment(null)
      fetchSegments()
    } catch (err) {
      toast.error('Failed to delete segment')
    }
  }

  const openSegmentDetail = (segment: Segment) => {
    setSelectedSegment(segment)
    fetchSegmentCustomers(segment.id)
  }

  const filteredSegments = segments.filter(s => 
    s.name.toLowerCase().includes(filter.toLowerCase()) ||
    s.description?.toLowerCase().includes(filter.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !segments.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiAlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Segments</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchSegments}
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
          <h1 className="text-2xl font-bold text-gray-900">Customer Segments</h1>
          <p className="text-gray-600">Organize customers into targeted groups</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchSegments} className="btn-outline flex items-center">
            <FiRefreshCw className="mr-2" /> Refresh
          </button>
          {isSuperAdmin && (
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center">
              <FiPlus className="mr-2" /> Create Segment
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search segments..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="text-sm text-gray-500">
          {filteredSegments.length} segment{filteredSegments.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSegments.length > 0 ? (
          filteredSegments.map(segment => (
            <div
              key={segment.id}
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => openSegmentDetail(segment)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{segment.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {segment.description || 'No description'}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  segment.type === 'DYNAMIC' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {segment.type}
                </span>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <FiUsers className="text-gray-400" />
                  <span className="font-medium text-gray-900">{segment.memberCount}</span>
                  <span className="text-sm text-gray-500">customers</span>
                </div>
                {isSuperAdmin && (
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setEditingSegment(segment)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      onClick={() => deleteSegment(segment.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white rounded-xl shadow-sm p-12 text-center">
            <FiFilter className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Segments Yet</h3>
            <p className="text-gray-500 mb-4">Create your first segment to organize customers</p>
            {isSuperAdmin && (
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <FiPlus className="mr-2" /> Create Segment
              </button>
            )}
          </div>
        )}
      </div>

      {selectedSegment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedSegment.name}</h2>
                <p className="text-gray-500">{selectedSegment.description || 'No description'}</p>
              </div>
              <button
                onClick={() => setSelectedSegment(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <FiX />
              </button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium">
                  {selectedSegment.memberCount} customers
                </div>
                <div className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                  {selectedSegment.type}
                </div>
              </div>
            </div>

            {loadingCustomers ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Customer</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Bookings</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Total Spent</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {segmentCustomers.length > 0 ? (
                      segmentCustomers.map(customer => (
                        <tr key={customer.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{customer.user.name || 'Unknown'}</div>
                            <div className="text-sm text-gray-500">{customer.user.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                              {customer.customerType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{customer.totalBookings}</td>
                          <td className="px-4 py-3 text-gray-700">฿{customer.totalSpent.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              customer.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {customer.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          No customers in this segment
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button onClick={() => setSelectedSegment(null)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Create Segment</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <FiX />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newSegment.name}
                  onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., VIP Customers, New Signups"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newSegment.description}
                  onChange={(e) => setNewSegment({ ...newSegment, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="What is this segment for?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newSegment.type}
                  onChange={(e) => setNewSegment({ ...newSegment, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="DYNAMIC">Dynamic (auto-updated)</option>
                  <option value="STATIC">Static (manual)</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 btn-secondary">
                Cancel
              </button>
              <button onClick={createSegment} className="flex-1 btn-primary">
                Create Segment
              </button>
            </div>
          </div>
        </div>
      )}

      {editingSegment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Edit Segment</h2>
              <button onClick={() => setEditingSegment(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <FiX />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingSegment.name}
                  onChange={(e) => setEditingSegment({ ...editingSegment, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editingSegment.description || ''}
                  onChange={(e) => setEditingSegment({ ...editingSegment, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingSegment.isActive}
                  onChange={(e) => setEditingSegment({ ...editingSegment, isActive: e.target.checked })}
                  className="w-4 h-4 text-primary-500 rounded"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setEditingSegment(null)} className="flex-1 btn-secondary">
                Cancel
              </button>
              <button onClick={updateSegment} className="flex-1 btn-primary">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}