'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'

interface CheatingReport {
  id: string
  reporterId: string
  againstUserId: string
  againstUserType: string
  jobId?: string
  evidence: string
  evidenceUrls?: string
  status: string
  action?: string
  actionNote?: string
  reviewedBy?: string
  reviewedAt?: string
  createdAt: string
}

export default function CheatingPage() {
  const { user: admin } = useAdminSession()
  const role = (admin?.role || 'SUPPORT') as AdminRole
  const permissions = ROLE_PERMISSIONS[role] || []
  const canAction = permissions.includes('cheating:action')
  const [reports, setReports] = useState<CheatingReport[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('PENDING')
  const [summary, setSummary] = useState({ pending: 0, confirmed: 0, total: 0 })
  const [selectedReport, setSelectedReport] = useState<CheatingReport | null>(null)
  const [actionNote, setActionNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchReports()
  }, [filter])

  const fetchReports = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/cheating?status=${filter}`)
      const data = await res.json()
      setReports(data.reports || [])
      setSummary(data.summary || { pending: 0, confirmed: 0, total: 0 })
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (reportId: string, status: 'CONFIRMED' | 'DISMISSED', action?: string) => {
    if (!canAction) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/cheating', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId,
          status,
          action,
          actionNote
        })
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Review failed')
      setSelectedReport(null)
      setActionNote('')
      fetchReports()
      toast.success(status === 'CONFIRMED' ? 'Report confirmed' : 'Report dismissed')
    } catch (error) {
      console.error('Failed to review report:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to review report')
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'CONFIRMED': return 'bg-red-100 text-red-800'
      case 'DISMISSED': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const parseEvidenceUrls = (urls?: string) => {
    if (!urls) return []
    try {
      return JSON.parse(urls)
    } catch {
      return []
    }
  }

  return (
    <>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Off-Platform Deal Reports</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-yellow-600 text-sm font-medium">Pending Reports</div>
            <div className="text-2xl font-bold text-yellow-700">{summary.pending}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-600 text-sm font-medium">Confirmed (Banned)</div>
            <div className="text-2xl font-bold text-red-700">{summary.confirmed}</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-gray-600 text-sm font-medium">Total Reports</div>
            <div className="text-2xl font-bold text-gray-700">{summary.total}</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {['PENDING', 'CONFIRMED', 'DISMISSED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === status
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No reports found</div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                        {report.status}
                      </span>
                      <span className="text-sm text-gray-500">Report #{report.id.slice(0, 8)}</span>
                    </div>
                    <div className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Reported User:</span> {report.againstUserId.slice(0, 8)}... ({report.againstUserType})
                    </div>
                    <div className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Reporter:</span> {report.reporterId.slice(0, 8)}...
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Evidence:</span> {report.evidence}
                    </div>
                    {report.evidenceUrls && (
                      <div className="flex gap-2 mb-2">
                        {parseEvidenceUrls(report.evidenceUrls).map((url: string, idx: number) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200"
                          >
                            Evidence {idx + 1}
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      Reported: {formatDate(report.createdAt)}
                    </div>
                    {report.actionNote && (
                      <div className="text-sm text-gray-500 mt-2">
                        <span className="font-medium">Action Note:</span> {report.actionNote}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {report.status === 'PENDING' && canAction && (
                      <button
                        onClick={() => setSelectedReport(report)}
                        className="px-3 py-1 bg-amber-500 text-white rounded hover:bg-amber-600"
                      >
                        Review
                      </button>
                    )}
                    {report.status === 'PENDING' && !canAction && (
                      <span className="text-xs text-gray-400">Read only</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Review Modal */}
        {selectedReport && canAction && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold mb-4">Review Off-Platform Deal Report</h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  <strong>Reported User:</strong> {selectedReport.againstUserId.slice(0, 8)}... ({selectedReport.againstUserType})
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Evidence:</strong> {selectedReport.evidence}
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ban reason (required to confirm)
                </label>
                <textarea
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  rows={3}
                  placeholder="Explain why this report justifies an account ban..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleReview(selectedReport.id, 'CONFIRMED', 'BAN')}
                  disabled={actionLoading || !actionNote.trim()}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Confirm & Ban'}
                </button>
                <button
                  onClick={() => handleReview(selectedReport.id, 'DISMISSED')}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Dismiss'}
                </button>
                <button
                  onClick={() => { setSelectedReport(null); setActionNote('') }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}