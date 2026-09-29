'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { FiAlertTriangle, FiCheck, FiX, FiArrowUp, FiRefreshCw, FiMinus } from 'react-icons/fi'

interface RiskEvent {
  id: string
  eventType: string
  severity: string
  resolution?: string
  reviewedAt?: string
  reviewedBy?: string
  metadata?: string
  actorUserId: string
  jobId?: string
  job?: { id: string; title: string; status: string }
  createdAt: string
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  LOW: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

const RESOLUTION_COLORS: Record<string, string> = {
  CONFIRMED: 'bg-red-500/20 text-red-400 border-red-500/30',
  DISMISSED: 'bg-green-500/20 text-green-400 border-green-500/30',
  ESCALATED: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  NO_ACTION: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

export default function RiskEventsPage() {
  return <><RiskEventsContent /></>
}

function RiskEventsContent() {
  const [events, setEvents] = useState<RiskEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [reviewModal, setReviewModal] = useState<{ event: RiskEvent; resolution: string } | null>(null)
  const [reviewReason, setReviewReason] = useState('')

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20', status: statusFilter })
      const res = await fetch(`/api/admin/risk-events?${params}`, { credentials: 'include' })
      if (res.status === 401) { window.location.href = '/admin/login'; return }
      const data = await res.json()
      setEvents(data.events || [])
      setTotal(data.total || 0)
    } catch { toast.error('Failed to load risk events') }
    finally { setLoading(false) }
  }, [page, statusFilter])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const handleReview = async (eventId: string, resolution: string, reason?: string) => {
    setActionLoading(eventId)
    try {
      const body: Record<string, string> = { resolution }
      if (reason) body.reason = reason
      const res = await fetch(`/api/admin/risk-events/${eventId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast.success(`Event ${resolution.toLowerCase()}`)
      fetchEvents()
    } catch (e: any) { toast.error(e.message || 'Action failed') }
    finally { setActionLoading(null); setReviewModal(null); setReviewReason('') }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FiAlertTriangle className="w-6 h-6 text-orange-500" />
          <h1 className="text-2xl font-bold text-white">Risk Events</h1>
        </div>
        <button onClick={fetchEvents} className="flex items-center space-x-2 px-3 py-2 bg-[#1A1B26] text-gray-300 rounded-lg hover:bg-[#24263a]">
          <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /><span>Refresh</span>
        </button>
      </div>

      <div className="flex space-x-1 bg-[#15161E] rounded-lg p-1">
        {[{ key: 'pending', label: 'Pending Review' }, { key: 'reviewed', label: 'Reviewed' }, { key: 'all', label: 'All' }].map(f => (
          <button key={f.key} onClick={() => { setStatusFilter(f.key); setPage(1) }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${statusFilter === f.key ? 'bg-amber-500 text-[#0B0C12]' : 'text-gray-400 hover:text-white'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-[#15161E] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-gray-800">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Severity</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actor</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Job</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Created</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                <div className="flex items-center justify-center space-x-2"><FiRefreshCw className="animate-spin" /><span>Loading...</span></div>
              </td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No risk events found</td></tr>
            ) : events.map(e => (
              <tr key={e.id} className="hover:bg-[#1A1B26]">
                <td className="px-4 py-3 text-sm text-white font-medium">{e.eventType}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${SEVERITY_COLORS[e.severity] || 'bg-gray-500/20 text-gray-400'}`}>{e.severity}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">{e.actorUserId.slice(0, 8)}...</td>
                <td className="px-4 py-3 text-sm text-gray-300">{e.job ? e.job.title : (e.jobId ? e.jobId.slice(0, 8) + '...' : '-')}</td>
                <td className="px-4 py-3">
                  {e.resolution ? (
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${RESOLUTION_COLORS[e.resolution] || ''}`}>{e.resolution}</span>
                  ) : (
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">PENDING</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">{new Date(e.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  {!e.reviewedAt && (
                    <div className="flex items-center space-x-1">
                      <button onClick={() => handleReview(e.id, 'CONFIRMED', 'Confirmed by admin')} disabled={actionLoading === e.id}
                        className="flex items-center space-x-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50 text-xs" title="Confirm">
                        <FiCheck className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleReview(e.id, 'DISMISSED')} disabled={actionLoading === e.id}
                        className="flex items-center space-x-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 disabled:opacity-50 text-xs" title="Dismiss">
                        <FiMinus className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleReview(e.id, 'ESCALATED', 'Escalated for review')} disabled={actionLoading === e.id}
                        className="flex items-center space-x-1 px-2 py-1 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 disabled:opacity-50 text-xs" title="Escalate">
                        <FiArrowUp className="w-3 h-3" />
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
    </div>
  )
}
