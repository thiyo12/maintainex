'use client'

import { useState } from 'react'
import { FiChevronUp, FiChevronDown, FiChevronLeft, FiChevronRight, FiEye, FiEdit2, FiMoreVertical } from 'react-icons/fi'
import toast from 'react-hot-toast'

export interface Customer {
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
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface CustomerTableProps {
  customers: Customer[]
  loading?: boolean
  pagination?: PaginationInfo
  onSort?: (field: string, direction: 'asc' | 'desc') => void
  onPageChange?: (page: number) => void
  onRowClick?: (customer: Customer) => void
  sortField?: string
  sortDirection?: 'asc' | 'desc'
}

const statusStyles = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-700',
  BLACKLISTED: 'bg-red-100 text-red-700',
}

const customerTypeStyles = {
  VIP: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  CORPORATE: 'bg-blue-100 text-blue-700 border-blue-300',
  REGULAR: 'bg-gray-100 text-gray-700 border-gray-300',
  POTENTIAL: 'bg-purple-100 text-purple-700 border-purple-300',
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const formatDate = (date: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-LK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function CustomerTable({
  customers,
  loading = false,
  pagination,
  onSort,
  onPageChange,
  onRowClick,
  sortField,
  sortDirection,
}: CustomerTableProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  const handleSort = (field: string) => {
    if (!onSort) return
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc'
    onSort(field, newDirection)
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? (
      <FiChevronUp className="w-4 h-4" />
    ) : (
      <FiChevronDown className="w-4 h-4" />
    )
  }

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'phone', label: 'Phone', sortable: false },
    { key: 'customerType', label: 'Type', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'totalBookings', label: 'Bookings', sortable: true },
    { key: 'totalSpent', label: 'Spent', sortable: true },
    { key: 'province', label: 'Province', sortable: true },
    { key: 'actions', label: 'Actions', sortable: false },
  ]

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-100 border-b border-gray-200" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-b border-gray-100 flex items-center px-4 gap-4">
              <div className="h-4 bg-gray-200 rounded w-32" />
              <div className="h-4 bg-gray-200 rounded w-40" />
              <div className="h-4 bg-gray-200 rounded w-28" />
              <div className="h-4 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : ''
                  }`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-1">
                    {column.label}
                    {column.sortable && <SortIcon field={column.key} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <FiMoreVertical className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="font-medium">No customers found</p>
                    <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => onRowClick?.(customer)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-600 font-semibold text-sm">
                          {customer.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">{customer.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{customer.email}</td>
                  <td className="px-4 py-3 text-gray-600">{customer.phone || '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${
                        customerTypeStyles[customer.customerType]
                      }`}
                    >
                      {customer.customerType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        statusStyles[customer.status]
                      }`}
                    >
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{customer.totalBookings}</td>
                  <td className="px-4 py-3 text-gray-600">{formatCurrency(customer.totalSpent)}</td>
                  <td className="px-4 py-3 text-gray-600">{customer.province || '-'}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === customer.id ? null : customer.id)}
                        className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <FiMoreVertical className="w-5 h-5 text-gray-500" />
                      </button>
                      {activeMenu === customer.id && (
                        <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                          <button
                            onClick={() => {
                              setActiveMenu(null)
                              onRowClick?.(customer)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <FiEye className="w-4 h-4" />
                            View Details
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenu(null)
                              toast.success('Edit feature coming soon')
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <FiEdit2 className="w-4 h-4" />
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <FiChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                const pageNum = i + 1
                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange?.(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      pagination.page === pageNum
                        ? 'bg-primary-500 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              {pagination.totalPages > 5 && (
                <>
                  <span className="text-gray-400">...</span>
                  <button
                    onClick={() => onPageChange?.(pagination.totalPages)}
                    className="w-8 h-8 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50"
                  >
                    {pagination.totalPages}
                  </button>
                </>
              )}
            </div>
            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
