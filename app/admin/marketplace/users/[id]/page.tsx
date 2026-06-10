'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiSlash, FiCheckCircle, FiXCircle, FiFileText, FiAlertCircle } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface UserDetail {
  id: string
  name: string | null
  email: string
  role: string
  identityStatus: string
  isActive: boolean
  isBanned: boolean
  country: string | null
  bio: string | null
  avatarUrl: string | null
  phone: string | null
  createdAt: string
  identityDocuments: Array<{
    id: string
    documentType: string
    status: string
    frontImageUrl: string | null
    backImageUrl: string | null
    createdAt: string
  }>
}

export default function MarketplaceUserDetail() {
  const params = useParams()
  const router = useRouter()
  const { user: currentUser } = useAdminSession()
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const canAct = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN' || currentUser?.role === 'MODERATOR'

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/admin/marketplace/users/${params.id}`, {
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const result = await res.json()

      if (result.error) {
        toast.error(result.error)
        setError(result.error)
        return
      }

      setUser(result.data)
    } catch (error) {
      console.error('User detail error:', error)
      toast.error('Failed to load user')
      setError('Failed to load user')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action: string) => {
    setActionLoading(action)
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/admin/marketplace/users/${params.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const result = await res.json()

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(`User ${action}ed successfully`)
      await fetchUser()
    } catch (error) {
      console.error('User action error:', error)
      toast.error('Failed to perform action')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <FiAlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-gray-600">{error}</p>
        <button onClick={fetchUser} className="btn-primary px-4 py-2 rounded-lg text-sm">Try Again</button>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <p className="text-gray-500">User not found</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
          <FiArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{user.name || 'Unnamed User'}</h1>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{user.role}</span>
        {user.isBanned && <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Banned</span>}
        {!user.isActive && !user.isBanned && <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Suspended</span>}
        {user.isActive && !user.isBanned && <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm">
          <div className="p-4 md:p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
          </div>
          <div className="p-4 md:p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Email</p>
                <p className="text-sm text-gray-900">{user.email}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Phone</p>
                <p className="text-sm text-gray-900">{user.phone || '\u2014'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Country</p>
                <p className="text-sm text-gray-900">{user.country || '\u2014'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Joined</p>
                <p className="text-sm text-gray-900">{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            {user.bio && (
              <div>
                <p className="text-xs font-medium text-gray-500">Bio</p>
                <p className="text-sm text-gray-700">{user.bio}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 md:p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
          </div>
          <div className="p-4 md:p-6 space-y-3">
            {canAct && user.isActive && !user.isBanned && (
              <button
                onClick={() => handleAction('suspend')}
                disabled={actionLoading === 'suspend'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 disabled:opacity-50"
              >
                <FiXCircle className="w-4 h-4" />
                Suspend Account
              </button>
            )}
            {canAct && !user.isActive && !user.isBanned && (
              <button
                onClick={() => handleAction('unsuspend')}
                disabled={actionLoading === 'unsuspend'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 disabled:opacity-50"
              >
                <FiCheckCircle className="w-4 h-4" />
                Unsuspend Account
              </button>
            )}
            {canAct && !user.isBanned && (
              <button
                onClick={() => handleAction('ban')}
                disabled={actionLoading === 'ban'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-sm font-medium disabled:opacity-50"
              >
                <FiSlash className="w-4 h-4" />
                Ban Account
              </button>
            )}
            {canAct && user.isBanned && (
              <button
                onClick={() => handleAction('unban')}
                disabled={actionLoading === 'unban'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 disabled:opacity-50"
              >
                <FiCheckCircle className="w-4 h-4" />
                Unban Account
              </button>
            )}
          </div>
        </div>
      </div>

      {user.identityDocuments.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 md:p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Identity Documents</h2>
          </div>
          <div className="p-4 md:p-6">
            <div className="space-y-3">
              {user.identityDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <FiFileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.documentType}</p>
                      <p className="text-xs text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    doc.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    doc.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
