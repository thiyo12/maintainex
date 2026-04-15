'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiEye, FiTrash2, FiCheck, FiX, FiRefreshCw, FiMapPin, FiEdit2, FiAlertCircle } from 'react-icons/fi'
import DistrictSelector, { DISTRICTS } from '@/components/ui/DistrictSelector'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface Booking {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  district: string | null
  address: string | null
  time: string | null
  status: string
  service: { name: string }
  branch: { id: string; name: string; location: string } | null
  createdAt: string
}

interface Branch {
  id: string
  name: string
  location: string
  districts: string
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700'
}

export default function AdminBookings() {
  const { user } = useAdminSession()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [filter, setFilter] = useState('ALL')
  const [filterBranch, setFilterBranch] = useState<string>('')
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const [editDistrict, setEditDistrict] = useState('')
  const [editBranchId, setEditBranchId] = useState('')

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    fetchBookings()
    if (isSuperAdmin) {
      fetchBranches()
    }
  }, [])

  const fetchBookings = async () => {
    try {
      const authHeaders = getAuthHeader()
      const params = new URLSearchParams()
      if (filterBranch) params.append('branchId', filterBranch)
      
      const url = params.toString() ? `/api/bookings?${params}` : '/api/bookings'
      const res = await fetch(url, { headers: { ...authHeaders } })
      
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Failed to fetch bookings')
        toast.error(data.error || 'Failed to fetch bookings')
        return
      }
      
      if (Array.isArray(data)) {
        setBookings(data)
        setError(null)
      } else {
        setBookings([])
      }
    } catch (err) {
      setError('Failed to connect to server')
      toast.error('Failed to fetch bookings')
    } finally {
      setLoading(false)
    }
  }

  const fetchBranches = async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/branches', { headers: { ...authHeaders } })
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      const data = await res.json()
      if (Array.isArray(data)) {
        setBranches(data)
      }
    } catch (error) {
      console.error('Failed to fetch branches')
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ status })
      })
      
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      
      if (!res.ok) throw new Error()
      
      toast.success('Booking status updated')
      fetchBookings()
    } catch (error) {
      toast.error('Failed to update booking')
    }
  }

  const updateDistrict = async () => {
    if (!editingBooking) return
    
    try {
      const authHeaders = getAuthHeader()
      let branchId = null
      if (editBranchId) {
        branchId = editBranchId
      } else if (editDistrict) {
        const branch = branches.find(b => {
          try {
            const districts: string[] = JSON.parse(b.districts || '[]')
            return Array.isArray(districts) && districts.includes(editDistrict)
          } catch {
            return false
          }
        })
        branchId = branch?.id || null
      }

      const res = await fetch(`/api/bookings/${editingBooking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ 
          district: editDistrict,
          branchId 
        })
      })
      
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      
      if (!res.ok) throw new Error()
      
      toast.success('Booking updated')
      setEditingBooking(null)
      fetchBookings()
    } catch (error) {
      toast.error('Failed to update booking')
    }
  }

  const deleteBooking = async (id: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) return
    
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/bookings/${id}`, { 
        method: 'DELETE',
        headers: { ...authHeaders }
      })
      
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      
      if (!res.ok) throw new Error()
      
      toast.success('Booking deleted')
      fetchBookings()
    } catch (error) {
      toast.error('Failed to delete booking')
    }
  }

  const openEditModal = (booking: Booking) => {
    setEditingBooking(booking)
    setEditDistrict(booking.district)
    setEditBranchId(booking.branch?.id || '')
  }

  const filteredBookings = filter === 'ALL' 
    ? bookings 
    : bookings.filter(b => b.status === filter)

  const assignedBookings = bookings.filter(b => b.branch !== null)
  const unassignedBookings = bookings.filter(b => b.branch === null)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiAlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Bookings</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchBookings}
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
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-600">Manage all customer bookings</p>
        </div>
        <button onClick={fetchBookings} className="btn-outline flex items-center">
          <FiRefreshCw className="mr-2" /> Refresh
        </button>
      </div>

      {isSuperAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-sm text-gray-500 mb-1">Total Bookings</div>
            <div className="text-3xl font-bold text-gray-900">{bookings.length}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-sm text-gray-500 mb-1">Assigned</div>
            <div className="text-3xl font-bold text-green-600">{assignedBookings.length}</div>
          </div>
          <div className={`bg-white rounded-xl shadow-sm p-6 ${unassignedBookings.length > 0 ? 'ring-2 ring-red-500' : ''}`}>
            <div className="text-sm text-gray-500 mb-1">Unassigned</div>
            <div className={`text-3xl font-bold ${unassignedBookings.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {unassignedBookings.length}
            </div>
            {unassignedBookings.length > 0 && (
              <div className="text-xs text-red-500 mt-1">⚠️ Needs attention</div>
            )}
          </div>
        </div>
      )}

      {isSuperAdmin && unassignedBookings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">⚠️</span>
            <h2 className="text-lg font-bold text-red-800">Unassigned Bookings - Require Branch Assignment</h2>
          </div>
          <div className="bg-white rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-red-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-red-900">Customer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-red-900">District</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-red-900">Service</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-red-900">Date</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-red-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {unassignedBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-red-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{booking.name}</div>
                      <div className="text-sm text-gray-500">{booking.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{booking.district}</td>
                    <td className="px-4 py-3 text-gray-700">{booking.service?.name}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{new Date(booking.date).toLocaleDateString()}</div>
                      <div className="text-sm text-gray-500">{booking.time}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditModal(booking)}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
                      >
                        Assign Branch
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {['ALL', 'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-primary-500 text-dark-900'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>

        {isSuperAdmin && (
          <select
            value={filterBranch}
            onChange={(e) => {
              setFilterBranch(e.target.value)
              fetchBookings()
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Branches</option>
            <option value="unassigned">Unassigned</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Customer</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">District</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Branch</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Service</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Date & Time</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBookings.length > 0 ? (
                filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{booking.name}</div>
                      <div className="text-sm text-gray-500">{booking.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-gray-700">
                        <FiMapPin className="text-gray-400" />
                        {booking.district}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {booking.branch ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                          {booking.branch.name}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{booking.service?.name}</td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900">{new Date(booking.date).toLocaleDateString()}</div>
                      <div className="text-sm text-gray-500">{booking.time}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[booking.status]}`}>
                        {booking.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end space-x-2">
                        {isSuperAdmin && (
                          <button
                            onClick={() => openEditModal(booking)}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                            title="Edit District"
                          >
                            <FiEdit2 />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedBooking(booking)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="View Details"
                        >
                          <FiEye />
                        </button>
                        <div className="flex items-center gap-1 flex-wrap">
                          {['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(status => (
                            <button
                              key={status}
                              onClick={() => {
                                if (booking.status !== status) {
                                  updateStatus(booking.id, status)
                                }
                              }}
                              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                booking.status === status
                                  ? statusColors[status]
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer'
                              }`}
                              disabled={booking.status === status}
                              title={booking.status === status ? 'Current status' : `Change to ${status.replace('_', ' ')}`}
                            >
                              {status.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => deleteBooking(booking.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No bookings found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Booking Details</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Customer Name</label>
                <div className="font-medium">{selectedBooking.name}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Phone</label>
                <div className="font-medium">{selectedBooking.phone}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Email</label>
                <div className="font-medium">{selectedBooking.email}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">District</label>
                <div className="font-medium">{selectedBooking.district}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Address</label>
                <div className="font-medium">{selectedBooking.address}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Branch</label>
                <div className="font-medium">{selectedBooking.branch?.name || 'Unassigned'}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Service</label>
                <div className="font-medium">{selectedBooking.service?.title}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Date</label>
                  <div className="font-medium">{new Date(selectedBooking.date).toLocaleDateString()}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Time</label>
                  <div className="font-medium">{selectedBooking.time}</div>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 block mb-2">Status</label>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[selectedBooking.status]}`}>
                    {selectedBooking.status.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-gray-500">→</span>
                  <select
                    value={selectedBooking.status}
                    onChange={async (e) => {
                      const newStatus = e.target.value
                      if (newStatus !== selectedBooking.status) {
                        await updateStatus(selectedBooking.id, newStatus)
                        setSelectedBooking(null)
                      }
                    }}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedBooking(null)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editingBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Edit Booking</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Customer</label>
                <div className="font-medium">{editingBooking.name}</div>
              </div>
              <DistrictSelector
                value={editDistrict}
                onChange={setEditDistrict}
                required
              />
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch Override</label>
                  <select
                    value={editBranchId}
                    onChange={(e) => setEditBranchId(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Auto-assign based on district</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Leave empty to auto-assign based on district</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setEditingBooking(null)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={updateDistrict}
                className="flex-1 btn-primary"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
