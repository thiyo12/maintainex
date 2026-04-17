'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiEdit2, FiTrash2, FiMessageCircle, FiCalendar } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { 
  CustomerProfile, 
  ActivityTimeline, 
  CustomerNotes
} from '@/components/admin'
import type { CustomerProfileData } from '@/components/admin/CustomerProfile'
import type { Activity } from '@/components/admin/ActivityTimeline'
import type { Note } from '@/components/admin/CustomerNotes'
import { getAuthHeader } from '@/lib/auth-client'

interface Booking {
  id: string
  status: string
  date: string | null
  totalPrice: number
  service: { id: string; name: string }
}

interface CustomerDetail {
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
  tags: { id: string; name: string; color: string; slug: string }[]
  summary: string | null
  createdAt: string
  user: {
    id: string
    name: string
    email: string
    phone: string | null
    role: string
    isActive: boolean
    createdAt: string
    updatedAt: string
  }
  addresses: Array<{
    id: string
    label: string
    address: string
    district: string
    isDefault: boolean
  }>
  notes: Note[]
  activities: Activity[]
  recentBookings: Booking[]
  _count: {
    notes: number
    activities: number
    communications: number
    addresses: number
  }
}

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAdminSession()
  const customerId = params.id as string

  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'communications'>('overview')
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [action, setAction] = useState<'call' | 'whatsapp' | 'email'>('whatsapp')

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const fetchCustomer = useCallback(async () => {
    setLoading(true)
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/customers/${customerId}`, { headers: { ...authHeaders } })
      
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch customer')
      }
      
      const data = await res.json()
      setCustomer(data)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load customer')
      router.push('/admin/customers')
    } finally {
      setLoading(false)
    }
  }, [customerId, router])

  useEffect(() => {
    fetchCustomer()
  }, [fetchCustomer])

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this customer? This action can be reversed.')) return
    
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/customers/${customerId}`, { 
        method: 'DELETE',
        headers: { ...authHeaders }
      })
      
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete customer')
      }
      
      toast.success('Customer deleted successfully')
      router.push('/admin/customers')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete customer')
    }
  }

  const handleAction = (actionType: 'call' | 'whatsapp' | 'email', cust: CustomerProfileData) => {
    if (actionType === 'whatsapp') {
      if (cust.phone) {
        const cleanPhone = cust.phone.replace(/\D/g, '')
        const formattedPhone = cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone
        window.open(`https://wa.me/94${formattedPhone}`, '_blank')
      }
    } else if (actionType === 'call') {
      if (cust.phone) {
        window.location.href = `tel:${cust.phone}`
      }
    } else if (actionType === 'email') {
      if (cust.email) {
        window.location.href = `mailto:${cust.email}`
      }
    }
  }

  const getProfileData = (): CustomerProfileData | null => {
    if (!customer) return null
    return {
      id: customer.id,
      userId: customer.userId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      customerType: customer.customerType,
      status: customer.status,
      totalBookings: customer.totalBookings,
      totalSpent: customer.totalSpent,
      firstBooking: customer.firstBooking,
      lastBooking: customer.lastBooking,
      province: customer.province,
      preferredContact: customer.preferredContact,
      tags: customer.tags,
      summary: customer.summary,
      createdAt: customer.user?.createdAt || customer.createdAt
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!customer) {
    return null
  }

  const profileData = getProfileData()

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin/customers')}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <FiArrowLeft className="w-4 h-4 mr-2" />
          Back to Customers
        </button>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Details</h1>
          <p className="text-gray-600">View and manage customer information</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (profileData) {
                handleAction('whatsapp', profileData)
              }
            }}
            disabled={!customer.phone}
            className="btn-outline flex items-center"
          >
            <FiMessageCircle className="w-4 h-4 mr-2" />
            WhatsApp
          </button>
          <button
            onClick={() => toast.success('Edit feature coming soon')}
            className="btn-outline flex items-center"
          >
            <FiEdit2 className="w-4 h-4 mr-2" />
            Edit
          </button>
          {isSuperAdmin && (
            <button
              onClick={handleDelete}
              className="btn-danger flex items-center"
            >
              <FiTrash2 className="w-4 h-4 mr-2" />
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['overview', 'bookings', 'communications'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'overview' && customer._count && (
                <span className="ml-2 text-xs text-gray-400">
                  ({customer._count.notes + customer._count.activities})
                </span>
              )}
              {tab === 'bookings' && customer.recentBookings && (
                <span className="ml-2 text-xs text-gray-400">
                  ({customer.recentBookings.length})
                </span>
              )}
              {tab === 'communications' && customer._count && (
                <span className="ml-2 text-xs text-gray-400">
                  ({customer._count.communications})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          {profileData && (
            <CustomerProfile 
              customer={profileData} 
              onAction={handleAction}
            />
          )}
        </div>

        <div className="lg:col-span-2">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <ActivityTimeline activities={customer.activities} />
              <CustomerNotes 
                notes={customer.notes}
                onAdd={async () => {}}
              />
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Bookings</h2>
                <p className="text-sm text-gray-600">Customer booking history</p>
              </div>
              {customer.recentBookings && customer.recentBookings.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {customer.recentBookings.map((booking) => (
                    <div key={booking.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{booking.service.name}</div>
                          <div className="text-sm text-gray-500">
                            {booking.date ? new Date(booking.date).toLocaleDateString('en-LK') : 'No date'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-gray-900">
                            {new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(booking.totalPrice)}
                          </div>
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                            booking.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            booking.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-700' :
                            booking.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700' :
                            booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-gray-500">
                  <FiCalendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No bookings yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'communications' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Communications</h2>
                <p className="text-sm text-gray-600">Contact history and messages</p>
              </div>
              {customer._count && customer._count.communications > 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <p>Communication history will appear here</p>
                </div>
              ) : (
                <div className="p-12 text-center text-gray-500">
                  <FiMessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No communications yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showWhatsApp && customer.phone && (
        <WhatsAppModal
          isOpen={showWhatsApp}
          onClose={() => setShowWhatsApp(false)}
          phoneNumber={customer.phone}
          customerName={customer.name}
        />
      )}
    </div>
  )
}