'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { FiAlertTriangle, FiCheck, FiX, FiArrowUp, FiRefreshCw, FiMinus } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import {
  CrmBadge,
  CrmButton,
  CrmPageHeader,
  CrmState,
  CrmTableFrame,
  CrmTabs,
  crmTableClass,
  crmTdClass,
  crmThClass,
  type CrmTone,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmPagination } from '@/components/crm/v2/CrmOperational'

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

function severityTone(value: string): CrmTone {
  if (value === 'CRITICAL' || value === 'HIGH') return 'danger'
  if (value === 'MEDIUM') return 'warning'
  if (value === 'LOW') return 'info'
  return 'neutral'
}

function resolutionTone(value?: string): CrmTone {
  if (value === 'CONFIRMED') return 'danger'
  if (value === 'DISMISSED' || value === 'NO_ACTION') return 'success'
  if (value === 'ESCALATED') return 'warning'
  return 'neutral'
}

export default function RiskEventsPage() {
  return <><RiskEventsContent /></>
}

function RiskEventsContent() {
  const { user: admin } = useAdminSession()
  const canResolve = Boolean(admin?.permissions?.includes('risk:resolve'))
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
    if (!canResolve) return
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
      <CrmPageHeader
        eyebrow="Trust & Safety"
        title="Risk events"
        description="Review marketplace risk signals, linked jobs and governed response outcomes."
        actions={
          <CrmButton variant="secondary" onClick={fetchEvents} disabled={loading}>
            <FiRefreshCw className={loading ? 'animate-spin' : ''} size={14} />
            Refresh
          </CrmButton>
        }
        context={
          <>
            <CrmBadge tone={canResolve ? 'success' : 'neutral'} dot>
              {canResolve ? 'Resolution access' : 'Read-only access'}
            </CrmBadge>
            <CrmBadge tone="info">{total.toLocaleString()} records</CrmBadge>
          </>
        }
      />

      <CrmTabs
        items={[
          { id: 'pending', label: 'Pending review' },
          { id: 'reviewed', label: 'Reviewed' },
          { id: 'all', label: 'All' },
        ]}
        active={statusFilter}
        onChange={id => { setStatusFilter(id); setPage(1) }}
      />

      <CrmTableFrame title="Risk event queue" description="Scoped marketplace and security signals">
        <table className={`${crmTableClass} min-w-[860px]`}>
          <thead><tr className="border-b border-gray-800">
            <th className={crmThClass}>Type</th>
            <th className={crmThClass}>Severity</th>
            <th className={crmThClass}>Actor</th>
            <th className={crmThClass}>Job</th>
            <th className={crmThClass}>Status</th>
            <th className={crmThClass}>Created</th>
            <th className={crmThClass}>Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-[var(--crm-border)]">
            {loading ? (
              <tr><td colSpan={7} className="p-4">
                <CrmState type="loading" title="Loading risk events" />
              </td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={7} className="p-4">
                <CrmState type="empty" title="No risk events found" />
              </td></tr>
            ) : events.map(e => (
              <tr key={e.id} className="hover:bg-[#fafbf9]">
                <td className={`${crmTdClass} font-semibold text-slate-900`}>{e.eventType}</td>
                <td className={crmTdClass}>
                  <CrmBadge tone={severityTone(e.severity)} dot>{e.severity}</CrmBadge>
                </td>
                <td className={crmTdClass}>{e.actorUserId.slice(0, 8)}...</td>
                <td className={crmTdClass}>{e.job ? e.job.title : (e.jobId ? e.jobId.slice(0, 8) + '...' : '-')}</td>
                <td className={crmTdClass}>
                  {e.resolution ? (
                    <CrmBadge tone={resolutionTone(e.resolution)} dot>{e.resolution}</CrmBadge>
                  ) : (
                    <CrmBadge tone="warning" dot>PENDING</CrmBadge>
                  )}
                </td>
                <td className={`${crmTdClass} text-xs text-slate-500`}>{new Date(e.createdAt).toLocaleDateString()}</td>
                <td className={crmTdClass}>
                  {!e.reviewedAt && canResolve && (
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
                  {!e.reviewedAt && !canResolve && <span className="text-xs text-gray-600">Read only</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CrmTableFrame>

      {totalPages > 1 && (
        <div className="crm-card overflow-hidden">
          <CrmPagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={20}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  )
}
