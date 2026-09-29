'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { FiShield, FiCheck, FiX, FiRefreshCw, FiUser, FiSearch } from 'react-icons/fi'

interface Credential {
  id: string
  name: string
  certificationType: string
  verificationStatus: string
  verificationNote?: string
  verifiedBy?: string
  verifiedAt?: string
  expiryDate?: string
  holderType: string
  holderId: string
  createdAt: string
}

const STATUS_TABS = [
  { key: 'PENDING', label: 'Pending', color: 'amber' },
  { key: 'VERIFIED', label: 'Verified', color: 'green' },
  { key: 'REJECTED', label: 'Rejected', color: 'red' },
  { key: 'ALL', label: 'All', color: 'gray' },
] as const

export default function CredentialsPage() {
  return <><CredentialsContent /></>
}

function CredentialsContent() {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<string>('PENDING')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const fetchCredentials = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (tab !== 'ALL') params.set('status', tab)
      const res = await fetch(`/api/admin/credentials?${params}`, { credentials: 'include' })
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const data = await res.json()
      setCredentials(data.credentials || [])
      setTotal(data.total || 0)
    } catch { toast.error('Failed to load credentials') }
    finally { setLoading(false) }
  }, [page, tab])

  useEffect(() => { fetchCredentials() }, [fetchCredentials])

  const handleReview = async (id: string, status: string, reason?: string) => {
    setActionLoading(id)
    try {
      const body: Record<string, string> = { status }
      if (reason) body.reason = reason
      const res = await fetch(`/api/admin/credentials/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast.success(`Credential ${status.toLowerCase()}`)
      fetchCredentials()
    } catch (e: any) { toast.error(e.message || 'Action failed') }
    finally { setActionLoading(null); setRejectModal(null); setRejectReason('') }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FiShield className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-white">Credential Review</h1>
        </div>
        <button onClick={fetchCredentials} className="flex items-center space-x-2 px-3 py-2 bg-[#1A1B26] text-gray-300 rounded-lg hover:bg-[#24263a]">
          <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="flex space-x-1 bg-[#15161E] rounded-lg p-1">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1) }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-amber-500 text-[#0B0C12]' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-[#15161E] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-gray-800">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Holder</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Created</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                <div className="flex items-center justify-center space-x-2"><FiRefreshCw className="animate-spin" /><span>Loading...</span></div>
              </td></tr>
            ) : credentials.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No credentials found</td></tr>
            ) : credentials.map(c => (
              <tr key={c.id} className="hover:bg-[#1A1B26]">
                <td className="px-4 py-3 text-sm text-white font-medium">{c.name}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{c.certificationType}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{c.holderType}: {c.holderId.slice(0, 8)}...</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    c.verificationStatus === 'VERIFIED' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    c.verificationStatus === 'REJECTED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    c.verificationStatus === 'EXPIRED' ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30' :
                    'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>{c.verificationStatus}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  {c.verificationStatus === 'PENDING' && (
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleReview(c.id, 'VERIFIED')} disabled={actionLoading === c.id}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 disabled:opacity-50 text-xs">
                        <FiCheck className="w-3 h-3" /><span>Approve</span>
                      </button>
                      <button onClick={() => setRejectModal({ id: c.id, name: c.name })} disabled={actionLoading === c.id}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50 text-xs">
                        <FiX className="w-3 h-3" /><span>Reject</span>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">{total} total</span>
          <div className="flex items-center space-x-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 bg-[#1A1B26] text-gray-300 rounded-lg hover:bg-[#24263a] disabled:opacity-50 text-sm">Prev</button>
            <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 bg-[#1A1B26] text-gray-300 rounded-lg hover:bg-[#24263a] disabled:opacity-50 text-sm">Next</button>
          </div>
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#15161E] rounded-xl p-6 w-full max-w-md border border-gray-800">
            <h3 className="text-lg font-semibold text-white mb-4">Reject Credential</h3>
            <p className="text-sm text-gray-400 mb-4">Provide a reason for rejecting &ldquo;{rejectModal.name}&rdquo;:</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
              className="w-full bg-[#0B0C12] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" placeholder="Rejection reason (required)..." />
            <div className="flex justify-end space-x-3 mt-4">
              <button onClick={() => { setRejectModal(null); setRejectReason('') }} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
              <button onClick={() => handleReview(rejectModal.id, 'REJECTED', rejectReason)} disabled={!rejectReason.trim() || actionLoading === rejectModal.id}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 text-sm">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
