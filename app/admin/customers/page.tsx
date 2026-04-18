'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiUsers, FiUserPlus, FiMessageSquare, FiSend } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface Customer {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  isActive: boolean
  createdAt: Date
  _count?: { bookings: number }
}

export default function CustomersPage() {
  const { user } = useAdminSession()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    fetchCustomers()
  }, [page])

  const fetchCustomers = async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/customers?page=${page}&limit=${limit}`, {
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const data = await res.json()
      
      // Handle different response structures
      if (Array.isArray(data)) {
        setCustomers(data)
        setTotal(data.length)
      } else if (data.customers) {
        setCustomers(data.customers)
        setTotal(data.pagination?.total || data.customers.length)
      } else {
        // Need to fetch from users
        await fetchUsers()
      }
    } catch (error) {
      console.error('Fetch error:', error)
      // Fallback to users endpoint
      await fetchUsers()
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/users?role=CUSTOMER&page=${page}&limit=${limit}`, {
        headers: { ...authHeaders }
      })
      
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.users || [])
        if (data.total) setTotal(data.total)
      }
    } catch (error) {
      console.error('Users fetch error:', error)
      setCustomers([])
    }
  }

  const filteredCustomers = customers.filter(c => 
    !search || 
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  )

  const totalPages = Math.ceil(total / limit)

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
          <p className="text-gray-600 mt-1 text-sm">Manage your customer database</p>
        </div>
        <button className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
          <FiUserPlus size={20} />
          Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Customer Cards - Better for mobile */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 md:p-12 text-center">
          <div className="text-4xl md:text-6xl mb-4">👥</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Customers Yet</h3>
          <p className="text-gray-500 mb-4">Customers will appear here after booking services.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {filteredCustomers.map((customer) => (
              <div key={customer.id} className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-600 font-semibold">
                        {customer.name?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{customer.name || 'Unknown'}</h3>
                      <p className="text-sm text-gray-500">{customer.email}</p>
                    </div>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  {customer.phone && <p>📱 {customer.phone}</p>}
                  <p className="text-xs text-gray-400">
                    Joined: {new Date(customer.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <button className="flex-1 text-sm text-primary-600 hover:text-primary-700 py-1">
                    View
                  </button>
                  <button className="flex-1 text-sm text-green-600 hover:text-green-700 py-1">
                    Message
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* CRM Link - Only visible to Super Admin */}
      {isSuperAdmin && (
        <div className="mt-8 p-4 bg-purple-50 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-purple-900">Advanced CRM</h3>
              <p className="text-sm text-purple-700">Tags, segments, and bulk messaging</p>
            </div>
            <Link href="/admin/crm" className="btn-primary">
              Open CRM
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}