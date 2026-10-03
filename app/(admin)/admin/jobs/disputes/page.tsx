'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiEye, FiX, FiSearch } from 'react-icons/fi'
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

interface Dispute {
  id: string
  source?: 'MARKETPLACE' | 'LEGACY'
  escrowId?: string | null
  resolutionAction?: string | null
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
  { key: 'RESOLVING', label: 'Resolving' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'DISMISSED', label: 'Dismissed' },
] as const

type TabKey = typeof TABS[number]['key']

function disputeTone(status: string): CrmTone {
  if (status === 'OPEN') return 'danger'
  if (status === 'UNDER_REVIEW') return 'warning'
  if (status === 'RESOLVING') return 'info'
  if (status === 'RESOLVED') return 'success'
  return 'neutral'
}

export default function DisputesPage() {
  const { user: admin } = useAdminSession()
  const canResolveDisputes = Boolean(admin?.permissions?.includes('disputes:resolve'))
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

  const handleResolve = async (
    disputeId: string,
    resolutionAction?: 'RELEASE_PROVIDER' | 'REFUND_CUSTOMER'
  ) => {
    if (!canResolveDisputes) {
      toast.error('You do not have permission to resolve disputes')
      return
    }
    if (!resolveNotes.trim()) {
      toast.error('Please provide resolution notes')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/disputes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId,
          status: 'RESOLVED',
          resolution: resolveNotes,
          ...(resolutionAction ? { resolutionAction } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to resolve dispute')

      if (res.status === 202) {
        toast.success(data?.message || 'Refund queued for reconciliation')
      } else if (resolutionAction === 'RELEASE_PROVIDER') {
        toast.success('Dispute resolved — escrow released to provider')
      } else if (resolutionAction === 'REFUND_CUSTOMER') {
        toast.success('Dispute resolved — customer refund completed')
      } else {
        toast.success('Dispute resolved')
      }

      setDetailModal(null)
      setResolveNotes('')
      fetchDisputes()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resolve dispute')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDismiss = async (disputeId: string) => {
    if (!canResolveDisputes) {
      toast.error('You do not have permission to resolve disputes')
      return
    }
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
    if (!canResolveDisputes) {
      toast.error('You do not have permission to resolve disputes')
      return
    }
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
    <>
      <div className="space-y-4">
        <CrmPageHeader
          eyebrow="Trust & Safety"
          title="Disputes"
          description="Review job disputes, evidence and governed financial resolution outcomes."
          context={
            <>
              <CrmBadge tone={canResolveDisputes ? 'success' : 'neutral'} dot>
                {canResolveDisputes ? 'Resolution access' : 'Read-only access'}
              </CrmBadge>
              <CrmBadge tone="info">Market scoped</CrmBadge>
            </>
          }
        />

        <CrmTabs
          items={TABS.map(tab => ({ id: tab.key, label: tab.label }))}
          active={activeTab}
          onChange={id => setActiveTab(id as TabKey)}
        />

        {/* Disputes Table */}
        <CrmTableFrame title="Dispute queue" description="Scoped dispute workload">
          {loading ? (
            <div className="p-4">
              <CrmState
                type="loading"
                title="Loading dispute queue"
                description="Loading records allowed by your current market and staff scope."
              />
            </div>
          ) : disputes.length === 0 ? (
            <div className="p-4">
              <CrmState
                type="empty"
                title="No disputes found"
                description="No dispute records match the current status filter."
                action={<FiSearch size={18} className="text-slate-400" />}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={crmTableClass}>
                <thead>
                  <tr className="border-b border-[var(--crm-border)]">
                    <th className={crmThClass}>Job</th>
                    <th className={crmThClass}>Raised By</th>
                    <th className={crmThClass}>Reason</th>
                    <th className={crmThClass}>Status</th>
                    <th className={crmThClass}>Created</th>
                    <th className={crmThClass}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--crm-border)]">
                  {disputes.map((dispute) => (
                    <tr key={dispute.id} className="transition-colors hover:bg-[#fafbf9]">
                      <td className={crmTdClass}>
                        <div className="max-w-[180px] truncate font-semibold text-slate-900">{dispute.job.title}</div>
                        <div className="font-mono text-[10px] text-slate-400">{dispute.jobId.slice(0, 10)}...</div>
                        {dispute.source === 'MARKETPLACE' && (
                          <div className="mt-1">
                            <CrmBadge tone="info">Marketplace escrow</CrmBadge>
                          </div>
                        )}
                      </td>
                      <td className={crmTdClass}>
                        <div className="font-medium text-slate-800">{dispute.raisedBy.name}</div>
                        <div className="text-xs text-slate-400">{dispute.raisedBy.mxId || dispute.raisedBy.email}</div>
                      </td>
                      <td className={`${crmTdClass} max-w-[200px] truncate text-slate-700`}>{dispute.reason}</td>
                      <td className={crmTdClass}>
                        <CrmBadge tone={disputeTone(dispute.status)} dot>
                          {dispute.status.replaceAll('_', ' ')}
                        </CrmBadge>
                      </td>
                      <td className={`${crmTdClass} whitespace-nowrap text-xs text-slate-500`}>{formatDate(dispute.createdAt)}</td>
                      <td className={crmTdClass}>
                        <CrmButton
                          size="sm"
                          variant="secondary"
                          onClick={() => { setDetailModal(dispute); setResolveNotes('') }}
                        >
                          <FiEye size={13} />
                          Review
                        </CrmButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CrmTableFrame>

        {/* Detail Modal */}
        {detailModal && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
            onClick={() => setDetailModal(null)}
          >
            <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-[18px] border border-[var(--crm-border)] bg-white shadow-[var(--crm-shadow-float)]" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-[var(--crm-border)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Dispute Details</h3>
                  <button onClick={() => setDetailModal(null)} className="text-slate-500 hover:text-slate-900 transition">
                    <FiX size={20} />
                  </button>
                </div>
              </div>
              <div className="space-y-3.5 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Job</div>
                    <div className="text-slate-900 text-sm font-medium">{detailModal.job.title}</div>
                    <div className="text-slate-400 text-xs font-mono">{detailModal.jobId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Status</div>
                    <CrmBadge tone={disputeTone(detailModal.status)} dot>
                      {detailModal.status.replaceAll('_', ' ')}
                    </CrmBadge>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-1">Raised By</div>
                  <div className="text-slate-900 text-sm">{detailModal.raisedBy.name}</div>
                  <div className="text-slate-500 text-xs">{detailModal.raisedBy.email}</div>
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-1">Reason</div>
                  <div className="text-slate-900 text-sm">{detailModal.reason}</div>
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-1">Description</div>
                  <div className="text-slate-700 text-sm bg-[var(--crm-surface-soft)] rounded-lg p-3">{detailModal.description}</div>
                </div>

                {detailModal.resolution && (
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Resolution</div>
                    <div className="rounded-xl border border-emerald-200 bg-[var(--crm-success-soft)] p-3 text-sm text-[var(--crm-success)]">{detailModal.resolution}</div>
                  </div>
                )}

                {canResolveDisputes && detailModal.status !== 'RESOLVED' && detailModal.status !== 'DISMISSED' && detailModal.status !== 'RESOLVING' && (
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Resolution Notes</div>
                    <textarea
                      value={resolveNotes}
                      onChange={(e) => setResolveNotes(e.target.value)}
                      className={`${crmInputClass} h-auto min-h-[96px] resize-y py-2.5`}
                      rows={3}
                      placeholder="Enter resolution notes..."
                    />
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-[var(--crm-border)] flex flex-wrap gap-2">
                {!canResolveDisputes && <span className="text-xs text-slate-400 self-center mr-auto">Read-only access</span>}
                {canResolveDisputes && detailModal.status === 'OPEN' && (
                  <>
                    <CrmButton
                      variant="secondary"
                      onClick={() => handleUnderReview(detailModal.id)}
                      disabled={actionLoading}
                    >
                      Mark under review
                    </CrmButton>
                    {detailModal.source !== 'MARKETPLACE' && (
                      <CrmButton
                        variant="ghost"
                        onClick={() => handleDismiss(detailModal.id)}
                        disabled={actionLoading}
                      >
                        Dismiss
                      </CrmButton>
                    )}
                  </>
                )}
                {canResolveDisputes && detailModal.status === 'UNDER_REVIEW' && detailModal.source === 'MARKETPLACE' && (
                  <>
                    <CrmButton
                      variant="primary"
                      onClick={() => handleResolve(detailModal.id, 'RELEASE_PROVIDER')}
                      disabled={actionLoading || !resolveNotes.trim()}
                    >
                      {actionLoading ? 'Submitting…' : 'Release to provider'}
                    </CrmButton>
                    <CrmButton
                      variant="danger"
                      onClick={() => handleResolve(detailModal.id, 'REFUND_CUSTOMER')}
                      disabled={actionLoading || !resolveNotes.trim()}
                    >
                      {actionLoading ? 'Submitting…' : 'Refund customer'}
                    </CrmButton>
                  </>
                )}
                {canResolveDisputes && detailModal.status === 'UNDER_REVIEW' && detailModal.source !== 'MARKETPLACE' && (
                  <>
                    <CrmButton
                      variant="primary"
                      onClick={() => handleResolve(detailModal.id)}
                      disabled={actionLoading || !resolveNotes.trim()}
                    >
                      {actionLoading ? 'Resolving…' : 'Resolve'}
                    </CrmButton>
                    <button
                      onClick={() => handleDismiss(detailModal.id)}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-gray-500/10 text-slate-500 rounded-lg hover:bg-gray-500/20 disabled:opacity-50 transition font-medium text-sm"
                    >
                      Dismiss
                    </button>
                  </>
                )}
                {detailModal.status === 'RESOLVING' && (
                  <span className="text-xs text-blue-400 self-center mr-auto">
                    Financial action is being reconciled. Do not submit a second payout/refund.
                  </span>
                )}
                <CrmButton
                  variant="secondary"
                  onClick={() => setDetailModal(null)}
                  disabled={actionLoading}
                >
                  Close
                </CrmButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}