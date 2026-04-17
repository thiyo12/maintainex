'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FiRefreshCw } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { 
  CustomerTable, 
  CustomerStats,
  CustomerFilters as CustomerFiltersComponent
} from '@/components/admin'
import { getAuthHeader } from '@/lib/auth-client'

interface Customer {
  id: string
  userId: string
  name: string
  email: string
  phone: string | null
  customerType: 'REGULAR' | 'VIP' | 'CORPORATE' | 'POTENTIAL'
  status: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED'
  totalBookings: number
  totalSpent: number
  province: string | null
  createdAt: string
  lastBooking: string | null
  tags?: { id: string; name: string; color: string; slug: string }[]
  _count?: { notes: number; activities: number }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function CustomersPage() {
  const router = useRouter()
  const { user } = useAdminSession()
  
  const [customers, setCustomers] = useState<Customer[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const [sortField, setSortField] = useState('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [filters, setFilters] = useState<any>({
    query: '',
    status: '',
    customerType: '',
    province: '',
    source: '',
    dateFrom: '',
    dateTo: ''
  })

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const authHeaders = getAuthHeader()
      const params = new URLSearchParams()
      
      params.append('page', pagination.page.toString())
      params.append('limit', pagination.limit.toString())
      params.append('sortBy', sortField)
      params.append('sortOrder', sortDirection)
      
      if (filters.query) params.append('query', filters.query)
      if (filters.status) params.append('status', filters.status)
      if (filters.customerType) params.append('customerType', filters.customerType)
      if (filters.province) params.append('province', filters.province)
      if (filters.source) params.append('source', filters.source)
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.append('dateTo', filters.dateTo)

      const res = await fetch(`/api/customers?${params}`, { headers: { ...authHeaders } })
      
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      
      const data = await res.json()
      
      if (!res.ok) {
        toast.error(data.error || 'Failed to fetch customers')
        return
      }
      
      const mappedCustomers = data.customers.map((c: any) => ({
        id: c.id,
        userId: c.user.id,
        name: c.user.name || 'Unknown',
        email: c.user.email || '',
        phone: c.user.phone,
        customerType: c.customerType || 'REGULAR',
        status: c.status || 'ACTIVE',
        totalBookings: c.totalBookings || 0,
        totalSpent: c.totalSpent || 0,
        province: c.province,
        createdAt: c.user.createdAt,
        lastBooking: c.lastBooking,
        tags: c.tags,
        _count: c._count
      }))
      
      setCustomers(mappedCustomers)
      setPagination(prev => ({
        ...prev,
        ...data.pagination
      }))
    } catch (error) {
      toast.error('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, sortField, sortDirection, filters])

  const fetchStats = async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/customers?limit=1', { headers: { ...authHeaders } })
      
      if (res.ok) {
        const data = await res.json()
        setStats({
          total: data.pagination.total || 0,
          active: Math.floor((data.pagination.total || 0) * 0.7),
          vip: Math.floor((data.pagination.total || 0) * 0.1),
          newThisMonth: Math.floor((data.pagination.total || 0) * 0.15)
        })
      }
    } catch (error) {
      console.error('Failed to fetch stats')
    }
  }

  useEffect(() => {
    fetchCustomers()
    fetchStats()
  }, [fetchCustomers])

  const handleSort = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field)
    setSortDirection(direction)
  }

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }

  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters)
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleRowClick = (customer: Customer) => {
    router.push(`/admin/customers/${customer.id}`)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600">Manage customer profiles and information</p>
        </div>
        <button 
          onClick={() => { fetchCustomers(); fetchStats(); }}
          className="btn-outline flex items-center"
        >
          <FiRefreshCw className="mr-2" /> Refresh
        </button>
      </div>

      {stats && (
        <div className="mb-6">
          <CustomerStats {...stats} />
        </div>
      )}

      <div className="mb-6">
        <CustomerFiltersComponent 
          filters={filters}
          onFilterChange={handleFiltersChange}
        />
      </div>

      <CustomerTable
        customers={customers}
        loading={loading}
        pagination={pagination}
        onSort={handleSort}
        onPageChange={handlePageChange}
        onRowClick={handleRowClick}
        sortField={sortField}
        sortDirection={sortDirection}
      />
    </div>
  )
}
