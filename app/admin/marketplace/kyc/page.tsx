'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { FiSearch, FiChevronLeft, FiChevronRight, FiCheckCircle, FiXCircle, FiEye, FiAlertCircle } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface KycDoc {
  id: string
  userId: string
  user: { name: string | null; email: string }
  documentType: string
  status: string
  frontImageUrl: string | null
  backImageUrl: string | null
  createdAt: string
}

interface PaginatedMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function MarketplaceKyc() {
  const { user: currentUser } = useAdminSession()
  const [docs, setDocs] = useState<KycDoc[]>([])
  const [meta, setMeta] = useState<PaginatedMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [selectedDoc, setSelectedDoc] = useState<KycDoc | null>(null)

  const canReview = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN' || currentUser?.role === 'MODERATOR'

  const fetchKyc = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(page))
      params.set('limit', '20')

      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/admin/marketplace/kyc?${params}`, {
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

      setDocs(result.data)
      setMeta(result.meta)
    } catch (error) {
      console.error('KYC fetch error:', error)
      toast.error('Failed to load KYC documents')
      setError('Failed to load KYC documents')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchKyc() }, [fetchKyc])

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id)
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/admin/marketplace/kyc/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action === 'approve' ? 'APPROVE' : 'REJECT' })
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

      toast.success(`Document ${action === 'approve' ? 'approved' : 'rejected'} successfully`)
      setSelectedDoc(null)
      await fetchKyc()
    } catch (error) {
      console.error('KYC review error:', error)
      toast.error('Failed to process review')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KYC Review</h1>
          <p className="text-gray-600 mt-1">{meta.total} documents</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-4 md:p-6 border-b">
          <div className="flex gap-3">
            <select
              className="input-field w-44"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="">All</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <FiAlertCircle className="w-12 h-12 text-red-500" />
              <p className="text-gray-600">{error}</p>
              <button onClick={() => fetchKyc()} className="btn-primary px-4 py-2 rounded-lg text-sm">Try Again</button>
            </div>
          ) : docs.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">No documents found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document Type</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                  <th className="px-4 md:px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.user.name || '\u2014'}</p>
                        <p className="text-xs text-gray-500">{doc.user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm text-gray-600">{doc.documentType}</td>
                    <td className="px-4 md:px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        doc.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                        doc.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>{doc.status}</span>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 md:px-6 py-4">
                      <button
                        onClick={() => setSelectedDoc(doc)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        <FiEye className="w-4 h-4" /> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {meta.page} of {meta.totalPages}</p>
          <div className="flex gap-2">
            <button
              className="btn-outline px-3 py-2 rounded-lg text-sm disabled:opacity-50"
              disabled={meta.page <= 1}
              onClick={() => fetchKyc(meta.page - 1)}
            >
              <FiChevronLeft className="w-4 h-4" />
            </button>
            <button
              className="btn-outline px-3 py-2 rounded-lg text-sm disabled:opacity-50"
              disabled={meta.page >= meta.totalPages}
              onClick={() => fetchKyc(meta.page + 1)}
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedDoc(null)}>
          <div className="w-full max-w-lg rounded-lg bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold">Review Document</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500">User</p>
                <p className="text-sm">{selectedDoc.user.name} ({selectedDoc.user.email})</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Type</p>
                <p className="text-sm">{selectedDoc.documentType}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Submitted</p>
                <p className="text-sm">{new Date(selectedDoc.createdAt).toLocaleString()}</p>
              </div>
              {selectedDoc.frontImageUrl && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Front Image</p>
                  <img src={selectedDoc.frontImageUrl} alt="Front" className="mt-1 max-h-48 rounded border" />
                </div>
              )}
              {selectedDoc.backImageUrl && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Back Image</p>
                  <img src={selectedDoc.backImageUrl} alt="Back" className="mt-1 max-h-48 rounded border" />
                </div>
              )}
            </div>
            {canReview && selectedDoc.status === 'PENDING' && (
              <div className="mt-6 flex gap-3">
                <button
                  className="btn-primary flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm"
                  onClick={() => handleReview(selectedDoc.id, 'approve')}
                  disabled={actionLoading === selectedDoc.id}
                >
                  <FiCheckCircle className="w-4 h-4" /> Approve
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-sm font-medium disabled:opacity-50"
                  onClick={() => handleReview(selectedDoc.id, 'reject')}
                  disabled={actionLoading === selectedDoc.id}
                >
                  <FiXCircle className="w-4 h-4" /> Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
