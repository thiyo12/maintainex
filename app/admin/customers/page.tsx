'use client'

import { useEffect, useState } from 'react'
import { FiUser, FiSearch, FiEdit2, FiTrash2, FiPlus, FiMessageSquare, FiPhone, FiMail } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface Customer {
  id: string
  name: string
  email: string
  phone: string | null
  isActive: boolean
  createdAt: Date
}

export default function CustomersPage() {
  const { user } = useAdminSession()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  useEffect(() => {
    fetchCustomers()
  }, [page])

  const fetchCustomers = async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/users?role=CUSTOMER&page=${page}&limit=${limit}`, {
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const data = await res.json()
      
      if (data.users) {
        setCustomers(data.users)
        setTotal(data.total || 0)
      }
    } catch (error) {
      console.error('Fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCustomers = customers.filter(c => 
    !search || 
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  )

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
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600 mt-1 text-sm">Customers who have booked servicios</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Empty State */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 md:p-12 text-center">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Customers Yet</h3>
          <p className="text-gray-500">Customers will appear here after booking services.</p>
        </div>
      ) : (
        <>
          {/* Customer Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {filteredCustomers.map((customer) => (
              <div key={customer.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-bold text-lg">
                      {customer.name?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{customer.name || 'Unknown'}</h3>
                    <p className="text-sm text-gray-500 truncate">{customer.email}</p>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 mb-3 space-y-1">
                  {customer.phone && (
                    <p className="flex items-center gap-2">
                      <FiPhone size={14} />
                      {customer.phone}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    Joined: {new Date(customer.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex gap-2 pt-3 border-t">
                  <button className="flex-1 text-sm text-primary-600 hover:bg-primary-50 py-2 rounded flex items-center justify-center gap-1">
                    <FiEdit2 size={14} />
                    Edit
                  </button>
                  <button className="flex-1 text-sm text-green-600 hover:bg-green-50 py-2 rounded flex items-center justify-center gap-1">
                    <FiMessageSquare size={14} />
                    Message
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-gray-600">
                Page {page} of {Math.ceil(total / limit)}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / limit)}
                className="btn-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}