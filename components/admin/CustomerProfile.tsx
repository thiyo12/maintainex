'use client'

import { FiPhone, FiMail, FiMessageCircle, FiCalendar, FiDollarSign, FiClock, FiMapPin } from 'react-icons/fi'
import toast from 'react-hot-toast'

export interface CustomerProfileData {
  id: string
  userId: string
  name: string
  email: string
  phone: string | null
  customerType: 'REGULAR' | 'VIP' | 'CORPORATE' | 'POTENTIAL'
  status: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED'
  totalBookings: number
  totalSpent: number
  firstBooking: string | null
  lastBooking: string | null
  province: string | null
  preferredContact: string | null
  tags: Array<{ id: string; name: string; color: string; slug: string }>
  summary: string | null
  createdAt: string
}

interface CustomerProfileProps {
  customer: CustomerProfileData
  onAction?: (action: 'call' | 'whatsapp' | 'email', customer: CustomerProfileData) => void
}

const statusConfig = {
  ACTIVE: { color: 'bg-green-500', label: 'Active', textColor: 'text-green-600' },
  INACTIVE: { color: 'bg-gray-400', label: 'Inactive', textColor: 'text-gray-500' },
  BLACKLISTED: { color: 'bg-red-500', label: 'Blacklisted', textColor: 'text-red-600' },
}

const customerTypeConfig = {
  VIP: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  CORPORATE: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  REGULAR: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  POTENTIAL: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
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
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-LK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatRelativeDate = (date: string | null) => {
  if (!date) return 'Never'
  
  const now = new Date()
  const then = new Date(date)
  const diffTime = Math.abs(now.getTime() - then.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

export default function CustomerProfile({ customer, onAction }: CustomerProfileProps) {
  const initials = customer.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const status = statusConfig[customer.status]
  const typeConfig = customerTypeConfig[customer.customerType]

  const handleCall = () => {
    if (!customer.phone) {
      toast.error('No phone number available')
      return
    }
    onAction?.('call', customer)
  }

  const handleWhatsApp = () => {
    if (!customer.phone) {
      toast.error('No phone number available')
      return
    }
    onAction?.('whatsapp', customer)
  }

  const handleEmail = () => {
    onAction?.('email', customer)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="relative">
        <div className="h-24 bg-gradient-to-r from-primary-500 to-primary-600" />
        <div className="absolute -bottom-10 left-6">
          <div className="w-20 h-20 bg-white rounded-xl shadow-lg border-4 border-white flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-600">{initials}</span>
          </div>
        </div>
        <div className="absolute top-2 right-4 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
              typeConfig.bg
            } ${typeConfig.text} border ${typeConfig.border}`}
          >
            {customer.customerType}
          </span>
        </div>
      </div>

      <div className="pt-12 px-6 pb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{customer.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${status.color}`} />
              <span className={`text-sm ${status.textColor}`}>{status.label}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-gray-600">
            <FiMail className="w-4 h-4" />
            <a href={`mailto:${customer.email}`} className="hover:text-primary-600 transition-colors">
              {customer.email}
            </a>
          </div>
          {customer.phone && (
            <div className="flex items-center gap-3 text-gray-600">
              <FiPhone className="w-4 h-4" />
              <a href={`tel:${customer.phone}`} className="hover:text-primary-600 transition-colors">
                {customer.phone}
              </a>
            </div>
          )}
          {customer.province && (
            <div className="flex items-center gap-3 text-gray-600">
              <FiMapPin className="w-4 h-4" />
              <span>{customer.province}</span>
            </div>
          )}
        </div>

        {customer.tags && customer.tags.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {customer.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="px-2 py-1 text-xs font-medium rounded-full"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {customer.summary && (
          <div className="mb-6 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">{customer.summary}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <FiCalendar className="w-5 h-5 text-gray-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-gray-900">{customer.totalBookings}</div>
            <div className="text-xs text-gray-500">Bookings</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <FiDollarSign className="w-5 h-5 text-gray-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-gray-900">{formatCurrency(customer.totalSpent)}</div>
            <div className="text-xs text-gray-500">Total Spent</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <FiClock className="w-5 h-5 text-gray-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-gray-900">{formatRelativeDate(customer.lastBooking)}</div>
            <div className="text-xs text-gray-500">Last Booking</div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Quick Actions</h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={handleCall}
              disabled={!customer.phone}
              className="flex flex-col items-center gap-1 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiPhone className="w-5 h-5 text-primary-600" />
              <span className="text-xs font-medium text-gray-700">Call</span>
            </button>
            <button
              onClick={handleWhatsApp}
              disabled={!customer.phone}
              className="flex flex-col items-center gap-1 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiMessageCircle className="w-5 h-5 text-green-600" />
              <span className="text-xs font-medium text-gray-700">WhatsApp</span>
            </button>
            <button
              onClick={handleEmail}
              className="flex flex-col items-center gap-1 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiMail className="w-5 h-5 text-blue-600" />
              <span className="text-xs font-medium text-gray-700">Email</span>
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Customer since {formatDate(customer.createdAt)}</span>
            {customer.preferredContact && (
              <span>Prefers {customer.preferredContact.toLowerCase()}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
