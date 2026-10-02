'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { FiShield, FiCheck, FiX, FiRefreshCw, FiUser, FiSearch } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import {
  CrmBadge,
  CrmButton,
  CrmPageHeader,
  CrmState,
  CrmTableFrame,
  CrmTabs,
  crmInputClass,
  crmTableClass,
  crmTdClass,
  crmThClass,
  type CrmTone,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmModal } from '@/components/crm/v2/CrmOverlays'
import { CrmPagination } from '@/components/crm/v2/CrmOperational'

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

function credentialTone(value: string): CrmTone {
  if (value === 'VERIFIED') return 'success'
  if (value === 'REJECTED') return 'danger'
  if (value === 'PENDING') return 'warning'
  return 'neutral'
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
  const { user: admin } = useAdminSession()
  const canReviewCredentials = Boolean(admin?.permissions?.includes('credentials:manage'))
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
    if (!canReviewCredentials) {
      toast.error('You do not have permission to review credentials')
      return
    }
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
      <CrmPageHeader
        eyebrow="Trust & Safety"
        title="Credential review"
        description="Review provider and company credentials through the governed verification workflow."
        actions={
          <CrmButton variant="secondary" onClick={fetchCredentials} disabled={loading}>
            <FiRefreshCw className={loading ? 'animate-spin' : ''} size={14} />
            Refresh
          </CrmButton>
        }
        context={
          <>
            <CrmBadge tone={canReviewCredentials ? 'success' : 'neutral'} dot>
              {canReviewCredentials ? 'Review access' : 'Read-only access'}
            </CrmBadge>
            <CrmBadge tone="info">{total.toLocaleString()} records</CrmBadge>
          </>
        }
      />

      <CrmTabs
        items={STATUS_TABS.map(item => ({ id: item.key, label: item.label }))}
        active={tab}
        onChange={id => { setTab(id); setPage(1) }}
      />

      <CrmTableFrame title="Credential queue" description="Provider and company credential verification">
        <table className={`${crmTableClass} min-w-[760px]`}>
          <thead><tr className="border-b border-gray-800">
            <th className={crmThClass}>Name</th>
            <th className={crmThClass}>Type</th>
            <th className={crmThClass}>Holder</th>
            <th className={crmThClass}>Status</th>
            <th className={crmThClass}>Created</th>
            <th className={crmThClass}>Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-[var(--crm-border)]">
            {loading ? (
              <tr><td colSpan={6} className="p-4">
                <CrmState type="loading" title="Loading credentials" />
              </td></tr>
            ) : credentials.length === 0 ? (
              <tr><td colSpan={6} className="p-4">
                <CrmState type="empty" title="No credentials found" />
              </td></tr>
            ) : credentials.map(c => (
              <tr key={c.id} className="hover:bg-[#fafbf9]">
                <td className={`${crmTdClass} font-semibold text-slate-900`}>{c.name}</td>
                <td className={crmTdClass}>{c.certificationType}</td>
                <td className={crmTdClass}>{c.holderType}: {c.holderId.slice(0, 8)}...</td>
                <td className={crmTdClass}>
                  <CrmBadge tone={credentialTone(c.verificationStatus)} dot>
                    {c.verificationStatus}
                  </CrmBadge>
                </td>
                <td className={`${crmTdClass} text-xs text-slate-500`}>{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className={crmTdClass}>
                  {canReviewCredentials && c.verificationStatus === 'PENDING' && (
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
                  {!canReviewCredentials && c.verificationStatus === 'PENDING' && (
                    <span className="text-xs text-gray-600">Read only</span>
                  )}
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

      <CrmModal
        open={Boolean(canReviewCredentials && rejectModal)}
        onClose={() => { setRejectModal(null); setRejectReason('') }}
        title="Reject credential"
        description={rejectModal ? `Provide a reason for rejecting “${rejectModal.name}”.` : undefined}
        maxWidth="max-w-md"
        footer={
          <>
            <CrmButton
              variant="secondary"
              onClick={() => { setRejectModal(null); setRejectReason('') }}
              disabled={Boolean(actionLoading)}
            >
              Cancel
            </CrmButton>
            <CrmButton
              variant="danger"
              onClick={() => rejectModal && handleReview(rejectModal.id, 'REJECTED', rejectReason)}
              disabled={!rejectReason.trim() || Boolean(actionLoading)}
            >
              {actionLoading ? 'Rejecting…' : 'Reject'}
            </CrmButton>
          </>
        }
      >
        <textarea
          value={rejectReason}
          onChange={event => setRejectReason(event.target.value)}
          rows={4}
          maxLength={2000}
          className={`${crmInputClass} h-auto min-h-[108px] resize-y py-2.5`}
          placeholder="Rejection reason (required)…"
        />
      </CrmModal>
    </div>
  )
}
