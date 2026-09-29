'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiAlertTriangle, FiEye, FiCheck, FiX, FiSearch } from 'react-icons/fi'
import AdminLayout from '@/components/admin/AdminLayout'

interface Dispute {
  id: string
  jobId: string
  raisedById: string
  reason: string
  description: string
  resolution?: string
  status: string
  createdAt: string
  job: {
    id: string
    title: string
    budget: number
    status: string
  }
  raisedBy: {
    id: string
    mxId?: string
    name: string
    email: string
  }
}

const TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'UNDER_REVIEW', label: 'Under Review' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'DISMISSED', label: 'Dismissed' },
] as const

type TabKey = typeof TABS[number]['key']

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-red-500/20 text-red-400 border-red-500/30',
  UNDER_REVIEW: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  RESOLVED: 'bg-green-500/20 text-green-400 border-green-500/30',
  DISMISSED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('ALL')
  const [detailModal, setDetailModal] = useState<Dispute | null>(null)
  const [resolveNotes, setResolveNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchDisputes()
  }, [activeTab])

  const fetchDisputes = async () => {
    setLoading(true)
    try {
      const statusParam = activeTab === 'ALL' ? '' : `&status=${activeTab}`
      const res = await fetch(`/api/admin/disputes?status=${activeTab === 'ALL' ? '' : activeTab}`, {
        headers: { },
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setDisputes(data.disputes || [])
    } catch {
      toast.error('Failed to load disputes')
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (disputeId: string) => {
    if (!resolveNotes.trim()) {
      toast.error('Please provide resolution notes')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/disputes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disputeId, status: 'RESOLVED', resolution: resolveNotes }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Dispute resolved')
      setDetailModal(null)
      setResolveNotes('')
      fetchDisputes()
    } catch {
      toast.error('Failed to resolve dispute')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDismiss = async (disputeId: string) => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/disputes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disputeId, status: 'DISMISSED' }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Dispute dismissed')
      setDetailModal(null)
      fetchDisputes()
    } catch {
      toast.error('Failed to dismiss dispute')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnderReview = async (disputeId: string) => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/disputes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disputeId, status: 'UNDER_REVIEW' }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Dispute marked as under review')
      setDetailModal(null)
      fetchDisputes()
    } catch {
      toast.error('Failed to update dispute')
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FiAlertTriangle className="text-amber-500" /> Disputes Management
          </h1>
          <p className="text-gray-400 text-sm mt-1">Review and resolve job disputes</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                activeTab === tab.key
                  ? 'bg-amber-500 text-[#0B0C12]'
                  : 'bg-[#15161E] text-gray-400 hover:text-white hover:bg-white/5 border border-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Disputes Table */}
        <div className="bg-[#15161E] border border-white/5 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : disputes.length === 0 ? (
            <div className="py-16 text-center">
              <FiSearch className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No disputes found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Job</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Raised By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {disputes.map((dispute) => (
                    <tr key={dispute.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3">
                        <div className="text-white font-medium max-w-[180px] truncate">{dispute.job.title}</div>
                        <div className="text-gray-500 text-xs font-mono">{dispute.jobId.slice(0, 10)}...</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-300">{dispute.raisedBy.name}</div>
                        <div className="text-gray-500 text-xs">{dispute.raisedBy.mxId || dispute.raisedBy.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate">{dispute.reason}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium border ${STATUS_STYLES[dispute.status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                          {dispute.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(dispute.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { setDetailModal(dispute); setResolveNotes('') }}
                          className="p-1.5 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white transition"
                          title="Review"
                        >
                          <FiEye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {detailModal && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setDetailModal(null)}
          >
            <div className="bg-[#15161E] border border-white/10 rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">Dispute Details</h3>
                  <button onClick={() => setDetailModal(null)} className="text-gray-400 hover:text-white transition">
                    <FiX size={20} />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Job</div>
                    <div className="text-white text-sm font-medium">{detailModal.job.title}</div>
                    <div className="text-gray-500 text-xs font-mono">{detailModal.jobId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Status</div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium border ${STATUS_STYLES[detailModal.status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                      {detailModal.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Raised By</div>
                  <div className="text-white text-sm">{detailModal.raisedBy.name}</div>
                  <div className="text-gray-400 text-xs">{detailModal.raisedBy.email}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Reason</div>
                  <div className="text-white text-sm">{detailModal.reason}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Description</div>
                  <div className="text-gray-300 text-sm bg-[#0B0C12] rounded-lg p-3">{detailModal.description}</div>
                </div>

                {detailModal.resolution && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Resolution</div>
                    <div className="text-green-400 text-sm bg-green-500/10 rounded-lg p-3">{detailModal.resolution}</div>
                  </div>
                )}

                {detailModal.status !== 'RESOLVED' && detailModal.status !== 'DISMISSED' && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Resolution Notes</div>
                    <textarea
                      value={resolveNotes}
                      onChange={(e) => setResolveNotes(e.target.value)}
                      className="w-full bg-[#0B0C12] border border-white/10 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-amber-500/50 resize-none"
                      rows={3}
                      placeholder="Enter resolution notes..."
                    />
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-white/5 flex flex-wrap gap-2">
                {detailModal.status === 'OPEN' && (
                  <>
                    <button
                      onClick={() => handleUnderReview(detailModal.id)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 disabled:opacity-50 transition font-medium text-sm"
                    >
                      Mark Under Review
                    </button>
                    <button
                      onClick={() => handleDismiss(detailModal.id)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-gray-500/10 text-gray-400 rounded-lg hover:bg-gray-500/20 disabled:opacity-50 transition font-medium text-sm"
                    >
                      Dismiss
                    </button>
                  </>
                )}
                {detailModal.status === 'UNDER_REVIEW' && (
                  <>
                    <button
                      onClick={() => handleResolve(detailModal.id)}
                      disabled={actionLoading || !resolveNotes.trim()}
                      className="px-4 py-2 bg-green-500 text-[#0B0C12] rounded-lg hover:bg-green-400 disabled:opacity-50 transition font-medium text-sm"
                    >
                      {actionLoading ? 'Resolving...' : 'Resolve'}
                    </button>
                    <button
                      onClick={() => handleDismiss(detailModal.id)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-gray-500/10 text-gray-400 rounded-lg hover:bg-gray-500/20 disabled:opacity-50 transition font-medium text-sm"
                    >
                      Dismiss
                    </button>
                  </>
                )}
                <button
                  onClick={() => setDetailModal(null)}
                  className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 transition text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}