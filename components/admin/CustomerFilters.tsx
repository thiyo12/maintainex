'use client'

import { useState } from 'react'
import { FiSearch, FiX, FiFilter } from 'react-icons/fi'
import toast from 'react-hot-toast'

export interface CustomerFilters {
  search?: string
  status?: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED' | ''
  customerType?: 'REGULAR' | 'VIP' | 'CORPORATE' | 'POTENTIAL' | ''
  province?: string
  dateFrom?: string
  dateTo?: string
}

interface CustomerFiltersProps {
  filters: CustomerFilters
  onFilterChange: (filters: CustomerFilters) => void
  provinces?: string[]
  loading?: boolean
}

const defaultProvinces = [
  'Western',
  'Central',
  'Southern',
  'Northern',
  'Eastern',
  'North Western',
  'North Central',
  'Uva',
  'Sabaragamuwa',
]

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'BLACKLISTED', label: 'Blacklisted' },
]

const customerTypeOptions = [
  { value: '', label: 'All Types' },
  { value: 'REGULAR', label: 'Regular' },
  { value: 'VIP', label: 'VIP' },
  { value: 'CORPORATE', label: 'Corporate' },
  { value: 'POTENTIAL', label: 'Potential' },
]

export default function CustomerFilters({
  filters,
  onFilterChange,
  provinces = defaultProvinces,
  loading = false,
}: CustomerFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleChange = (key: keyof CustomerFilters, value: string) => {
    onFilterChange({ ...filters, [key]: value || undefined })
  }

  const handleReset = () => {
    onFilterChange({})
    toast.success('Filters reset')
  }

  const hasActiveFilters = Object.values(filters).some((v) => v && v !== '')

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={filters.search || ''}
              onChange={(e) => handleChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
            />
            {filters.search && (
              <button
                onClick={() => handleChange('search', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <FiX className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={filters.status || ''}
            onChange={(e) => handleChange('status', e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white min-w-[140px]"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={filters.customerType || ''}
            onChange={(e) => handleChange('customerType', e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white min-w-[140px]"
          >
            {customerTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={filters.province || ''}
            onChange={(e) => handleChange('province', e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white min-w-[140px]"
          >
            <option value="">All Provinces</option>
            {provinces.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg transition-colors ${
              showAdvanced
                ? 'bg-primary-50 border-primary-300 text-primary-700'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <FiFilter className="w-4 h-4" />
            <span>Date Range</span>
          </button>

          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-2.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
            >
              <FiX className="w-4 h-4" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleChange('dateFrom', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleChange('dateTo', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            {(filters.dateFrom || filters.dateTo) && (
              <button
                onClick={() => {
                  handleChange('dateFrom', '')
                  handleChange('dateTo', '')
                }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Clear dates
              </button>
            )}
          </div>
        </div>
      )}

      {hasActiveFilters && (
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.status && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded-full">
              Status: {filters.status}
              <button onClick={() => handleChange('status', '')} className="hover:text-primary-900">
                <FiX className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.customerType && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded-full">
              Type: {filters.customerType}
              <button onClick={() => handleChange('customerType', '')} className="hover:text-primary-900">
                <FiX className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.province && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded-full">
              Province: {filters.province}
              <button onClick={() => handleChange('province', '')} className="hover:text-primary-900">
                <FiX className="w-3 h-3" />
              </button>
            </span>
          )}
          {(filters.dateFrom || filters.dateTo) && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 text-xs rounded-full">
              Date: {filters.dateFrom || '...'} - {filters.dateTo || '...'}
              <button
                onClick={() => {
                  handleChange('dateFrom', '')
                  handleChange('dateTo', '')
                }}
                className="hover:text-primary-900"
              >
                <FiX className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
