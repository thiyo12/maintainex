'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { FiChevronLeft, FiChevronRight, FiDollarSign, FiAlertCircle } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface Escrow {
  id: string
  jobId: string
  status: string
  amountCents: number
  heldAt: string | null
  releasedAt: string | null
  refundedAt: string | null
  createdAt: string
}

interface Dispute {
  id: string
  job: { id: string; title: string }
  raisedBy: { id: string; name: string | null; email: string }
  reason: string
  status: string
  createdAt: string
}

interface PaginatedMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function MarketplaceEscrow() {
  const { user: currentUser } = useAdminSession()
  const [tab, setTab] = useState<'escrows' | 'disputes'>('escrows')
  const [escrows, setEscrows] = useState<Escrow[]>([])
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [meta, setMeta] = useState<PaginatedMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const canAct = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN'

  const formatMoney = (cents: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
  }

  const fetchEscrows = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(page))
      params.set('limit', '20')

      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/admin/marketplace/escrow?${params}`, {
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

      setEscrows(result.data)
      setMeta(result.meta)
    } catch (error) {
      console.error('Escrows fetch error:', error)
      toast.error('Failed to load escrows')
      setError('Failed to load escrows')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  const fetchDisputes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/admin/marketplace/escrow/disputes', {
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

      setDisputes(result.data)
    } catch (error) {
      console.error('Disputes fetch error:', error)
      toast.error('Failed to load disputes')
      setError('Failed to load disputes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'escrows') fetchEscrows()
    else fetchDisputes()
  }, [tab, fetchEscrows, fetchDisputes])

  const handleAction = async (id: string, action: 'release' | 'refund') => {
    setActionLoading(id)
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/admin/marketplace/escrow/${id}`, {
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

      toast.success(`Escrow ${action}ed successfully`)
      await fetchEscrows()
    } catch (error) {
      console.error('Escrow action error:', error)
      toast.error('Failed to process action')
    } finally {
      setActionLoading(null)
    }
  }

  const escrowStatusBadge = (s: string) => {
    const map: Record<string, string> = {
      ON_HOLD: 'bg-yellow-100 text-yellow-800',
      PROTECTED: 'bg-blue-100 text-blue-800',
      RELEASED: 'bg-green-100 text-green-800',
      REFUNDED: 'bg-gray-100 text-gray-800',
      CANCELLED: 'bg-red-100 text-red-800',
    }
    return <span className={`px-3 py-1 rounded-full text-xs font-medium ${map[s] || 'bg-gray-100 text-gray-800'}`}>{s}</span>
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Escrow & Disputes</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('escrows')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'escrows' ? 'bg-primary-500 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            Escrows
          </button>
          <button
            onClick={() => setTab('disputes')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'disputes' ? 'bg-primary-500 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            Disputes ({disputes.length})
          </button>
        </div>
      </div>

      {tab === 'escrows' && (
        <>
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-4 md:p-6 border-b">
              <div className="flex gap-3">
                <select
                  className="input-field w-40"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="PROTECTED">Protected</option>
                  <option value="RELEASED">Released</option>
                  <option value="REFUNDED">Refunded</option>
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
                  <button onClick={() => fetchEscrows()} className="btn-primary px-4 py-2 rounded-lg text-sm">Try Again</button>
                </div>
              ) : escrows.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-gray-500">No escrows found</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job ID</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Held</th>
                      <th className="px-4 md:px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {escrows.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 md:px-6 py-4 font-mono text-xs text-gray-600">{e.jobId}</td>
                        <td className="px-4 md:px-6 py-4 text-sm font-medium text-gray-900">{formatMoney(e.amountCents)}</td>
                        <td className="px-4 md:px-6 py-4">{escrowStatusBadge(e.status)}</td>
                        <td className="px-4 md:px-6 py-4 text-sm text-gray-500">{e.heldAt ? new Date(e.heldAt).toLocaleDateString() : '\u2014'}</td>
                        <td className="px-4 md:px-6 py-4">
                          {canAct && (e.status === 'ON_HOLD' || e.status === 'PROTECTED') && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAction(e.id, 'release')}
                                disabled={actionLoading === e.id}
                                className="btn-primary px-3 py-1.5 rounded text-xs disabled:opacity-50"
                              >
                                Release
                              </button>
                              <button
                                onClick={() => handleAction(e.id, 'refund')}
                                disabled={actionLoading === e.id}
                                className="px-3 py-1.5 rounded text-xs bg-red-50 text-red-700 hover:bg-red-100 font-medium disabled:opacity-50"
                              >
                                Refund
                              </button>
                            </div>
                          )}
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
                  onClick={() => fetchEscrows(meta.page - 1)}
                >
                  <FiChevronLeft className="w-4 h-4" />
                </button>
                <button
                  className="btn-outline px-3 py-2 rounded-lg text-sm disabled:opacity-50"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => fetchEscrows(meta.page + 1)}
                >
                  <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'disputes' && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <FiAlertCircle className="w-12 h-12 text-red-500" />
                <p className="text-gray-600">{error}</p>
                <button onClick={fetchDisputes} className="btn-primary px-4 py-2 rounded-lg text-sm">Try Again</button>
              </div>
            ) : disputes.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">No disputes</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job</th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Raised By</th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {disputes.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 md:px-6 py-4 text-sm text-gray-900">{d.job.title}</td>
                      <td className="px-4 md:px-6 py-4 text-sm text-gray-600">{d.raisedBy.name || d.raisedBy.email}</td>
                      <td className="px-4 md:px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{d.reason}</td>
                      <td className="px-4 md:px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          d.status === 'OPEN' ? 'bg-yellow-100 text-yellow-800' :
                          d.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>{d.status}</span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-sm text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
