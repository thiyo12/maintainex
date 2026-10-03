'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiShield, FiCheck, FiX, FiEye, FiFileText, FiClock, FiUser, FiExternalLink } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import {
  CrmBadge,
  CrmButton,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  CrmTabs,
  crmInputClass,
} from '@/components/crm/v2/CrmPrimitives'

interface KYCDocument {
  id: string
  userId: string
  docType: string
  side: string
  status: string
  reviewNote?: string
  reviewedBy?: string
  reviewedAt?: string
  createdAt: string
  user: {
    id: string
    mxId?: string
    name: string
    email: string
    phone?: string
    role: string
    taskerProfile?: {
      id: string
      mxId?: string
      verificationStatus: string
      bio?: string
      skills?: string
      experienceProofUrl?: string
      hasDrivingLicense: boolean
      drivingLicenseUrl?: string
      completedJobs: number
      rating: number
    }
    companyProfile?: {
      id: string
      mxId?: string
      companyName: string
      verificationStatus: string
      registrationNo?: string
      taxId?: string
      minStaffCount: number
      staffCount: number
      staffProofUrl?: string
      businessRegDocUrl?: string
      completedProjects: number
      rating: number
    }
  }
}

const TABS = [
  { key: 'PENDING', label: 'Pending', color: 'amber' },
  { key: 'APPROVED', label: 'Verified', color: 'green' },
  { key: 'REJECTED', label: 'Rejected', color: 'red' },
  { key: 'ALL', label: 'All', color: 'gray' },
] as const

type TabKey = typeof TABS[number]['key']

const DOC_TYPE_LABELS: Record<string, string> = {
  EXPERIENCE_CERT: 'Experience Proof',
  BUSINESS_REG: 'Business Registration',
  DRIVERS_LICENSE: 'Driving License',
  PASSPORT: 'Passport',
  NATIONAL_ID: 'Identity Document',
  STAFF_PROOF: 'Staff Proof',
}

export default function KYCPage() {
  const { user: admin } = useAdminSession()
  const canApprove = Boolean(admin?.permissions?.includes('kyc:approve'))
  const canReject = Boolean(admin?.permissions?.includes('kyc:reject'))
  const [documents, setDocuments] = useState<KYCDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('PENDING')
  const [summary, setSummary] = useState({ pending: 0, verified: 0, rejected: 0 })
  const [lightboxDoc, setLightboxDoc] = useState<KYCDocument | null>(null)
  const [reviewModal, setReviewModal] = useState<KYCDocument | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchDocuments()
  }, [activeTab])

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const statusParam = activeTab === 'ALL' ? '' : `&status=${activeTab}`
      const res = await fetch(`/api/admin/kyc?page=1&limit=100${statusParam}`, {
        headers: { },
      })
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setDocuments(data.documents || [])
      setSummary(data.summary || { pending: 0, verified: 0, rejected: 0 })
    } catch {
      toast.error('Failed to load KYC documents')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (docId: string) => {
    if (!canApprove) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/kyc', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, status: 'APPROVED' }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Document approved')
      setReviewModal(null)
      fetchDocuments()
    } catch {
      toast.error('Failed to approve document')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (docId: string) => {
    if (!canReject) return
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/kyc', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, status: 'REJECTED', reviewNote: rejectReason }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Document rejected')
      setReviewModal(null)
      setRejectReason('')
      fetchDocuments()
    } catch {
      toast.error('Failed to reject document')
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const getMXId = (doc: KYCDocument) => {
    if (doc.user.taskerProfile?.mxId) return doc.user.taskerProfile.mxId
    if (doc.user.companyProfile?.mxId) return doc.user.companyProfile.mxId
    return doc.user.mxId || doc.user.id.slice(0, 12)
  }

  const getUserRole = (doc: KYCDocument) => {
    if (doc.user.companyProfile) return 'Company'
    if (doc.user.taskerProfile) return 'Tasker'
    return 'Customer'
  }

  return (
    <>
      <div className="space-y-4">
        <CrmPageHeader
          eyebrow="Trust & Safety"
          title="KYC verification"
          description="Review protected identity documents and move eligible users through the governed verification lifecycle."
          context={
            <>
              <CrmBadge tone={(canApprove || canReject) ? 'success' : 'neutral'} dot>
                {(canApprove || canReject) ? 'Review access' : 'Read-only access'}
              </CrmBadge>
              <CrmBadge tone="info">Protected document access</CrmBadge>
            </>
          }
        />

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CrmMetricCard
            label="Pending"
            value={summary.pending.toLocaleString()}
            helper="Awaiting operator review"
            icon={<FiClock size={16} />}
            tone="warning"
          />
          <CrmMetricCard
            label="Verified"
            value={summary.verified.toLocaleString()}
            helper="Approved identity documents"
            icon={<FiCheck size={16} />}
            tone="success"
          />
          <CrmMetricCard
            label="Rejected"
            value={summary.rejected.toLocaleString()}
            helper="Rejected identity documents"
            icon={<FiX size={16} />}
            tone="danger"
          />
        </section>

        <CrmTabs
          items={TABS.map(tab => ({
            id: tab.key,
            label: tab.label,
            count: tab.key === 'PENDING' ? summary.pending : undefined,
          }))}
          active={activeTab}
          onChange={id => setActiveTab(id as TabKey)}
        />

        {/* Documents List */}
        {loading ? (
          <CrmState
            type="loading"
            title="Loading KYC queue"
            description="Loading documents allowed by your current market and staff scope."
          />
        ) : documents.length === 0 ? (
          <CrmState
            type="empty"
            title="No documents found"
            description="No KYC submissions match the current status filter."
            action={<FiFileText size={18} className="text-slate-400" />}
          />
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="crm-card p-5 transition hover:border-[var(--crm-border-strong)]"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-amber-500 font-mono text-sm font-semibold">{getMXId(doc)}</span>
                      <span className="text-slate-900 font-medium">{doc.user.name}</span>
                      <CrmBadge tone="info">{getUserRole(doc)}</CrmBadge>
                      <CrmBadge
                        tone={doc.status === 'APPROVED' ? 'success' : doc.status === 'REJECTED' ? 'danger' : 'warning'}
                        dot
                      >
                        {doc.status}
                      </CrmBadge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="text-slate-500">
                        <span className="text-slate-400">Document:</span>{' '}
                        <span className="text-slate-700">{DOC_TYPE_LABELS[doc.docType] || doc.docType} ({doc.side})</span>
                      </div>
                      <div className="text-slate-500">
                        <span className="text-slate-400">Submitted:</span>{' '}
                        <span className="text-slate-700">{formatDate(doc.createdAt)}</span>
                      </div>
                      {doc.user.taskerProfile && (
                        <div className="text-slate-500">
                          <span className="text-slate-400">Rating:</span>{' '}
                          <span className="text-slate-700">{doc.user.taskerProfile.rating?.toFixed(1) || '0.0'} | {doc.user.taskerProfile.completedJobs} jobs</span>
                        </div>
                      )}
                      {doc.user.companyProfile && (
                        <div className="text-slate-500">
                          <span className="text-slate-400">Company:</span>{' '}
                          <span className="text-slate-700">{doc.user.companyProfile.companyName} | {doc.user.companyProfile.completedProjects} projects</span>
                        </div>
                      )}
                    </div>

                    {doc.reviewNote && (
                      <div className="mt-2 text-sm text-slate-400 italic">
                        Note: {doc.reviewNote}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setLightboxDoc(doc)}
                      className="p-2 bg-white/5 text-slate-500 rounded-lg hover:bg-white/10 hover:text-slate-900 transition"
                      title="View Document"
                    >
                      <FiEye size={16} />
                    </button>
                    <a
                      href={`/api/admin/kyc/${doc.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white/5 text-slate-500 rounded-lg hover:bg-white/10 hover:text-slate-900 transition"
                      title="Open in New Tab"
                    >
                      <FiExternalLink size={16} />
                    </a>
                    {doc.status === 'PENDING' && (
                      <>
                        {canApprove && (
                          <button
                            onClick={() => handleApprove(doc.id)}
                            disabled={actionLoading}
                            className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition disabled:opacity-50"
                            title="Approve"
                          >
                            <FiCheck size={16} />
                          </button>
                        )}
                        {canReject && (
                          <button
                            onClick={() => setReviewModal(doc)}
                            disabled={actionLoading}
                            className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition disabled:opacity-50"
                            title="Reject"
                          >
                            <FiX size={16} />
                          </button>
                        )}
                        {!canApprove && !canReject && <span className="text-xs text-slate-400">Read only</span>}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lightbox Modal */}
        {lightboxDoc && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setLightboxDoc(null)}
          >
            <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setLightboxDoc(null)}
                className="absolute -top-10 right-0 rounded-lg p-1 text-white/90 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <FiX size={24} />
              </button>
              <div className="bg-white rounded-xl overflow-hidden border border-[var(--crm-border)]">
                <div className="p-4 border-b border-[var(--crm-border)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-amber-500 font-mono text-sm">{getMXId(lightboxDoc)}</span>
                      <span className="text-slate-900 ml-2">{lightboxDoc.user.name}</span>
                    </div>
                    <span className="text-slate-500 text-sm">
                      {DOC_TYPE_LABELS[lightboxDoc.docType] || lightboxDoc.docType} - {lightboxDoc.side}
                    </span>
                  </div>
                </div>
                <div className="p-4 flex justify-center bg-black/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/admin/kyc/${lightboxDoc.id}/file`}
                    alt="KYC Document"
                    className="max-h-[70vh] max-w-full object-contain rounded"
                  />
                </div>
                <div className="p-4 border-t border-[var(--crm-border)] flex justify-end gap-2">
                  {lightboxDoc.status === 'PENDING' && (
                    <>
                      {canApprove && (
                        <button
                          onClick={() => { handleApprove(lightboxDoc.id); setLightboxDoc(null) }}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-green-500 text-[#0B0C12] rounded-lg font-medium hover:bg-green-400 disabled:opacity-50 transition"
                        >
                          Approve
                        </button>
                      )}
                      {canReject && (
                        <button
                          onClick={() => { setReviewModal(lightboxDoc); setLightboxDoc(null) }}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-red-500 text-slate-900 rounded-lg font-medium hover:bg-red-400 disabled:opacity-50 transition"
                        >
                          Reject
                        </button>
                      )}
                      {!canApprove && !canReject && <span className="text-sm text-slate-400">Read-only review</span>}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reject Reason Modal */}
        {reviewModal && canReject && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => { setReviewModal(null); setRejectReason('') }}
          >
            <div className="bg-white border border-[var(--crm-border)] rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Reject Document</h3>
              <p className="text-slate-500 text-sm mb-4">
                Provide a reason for rejecting {reviewModal.user.name}&apos;s document.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className={`${crmInputClass} h-auto min-h-[108px] resize-y py-2.5`}
                rows={4}
                placeholder="Enter rejection reason..."
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { setReviewModal(null); setRejectReason('') }}
                  className="flex-1 px-4 py-2 bg-white/5 text-slate-500 rounded-lg hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(reviewModal.id)}
                  disabled={actionLoading || !rejectReason.trim()}
                  className="flex-1 px-4 py-2 bg-red-500 text-slate-900 rounded-lg font-medium hover:bg-red-400 disabled:opacity-50 transition"
                >
                  {actionLoading ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}