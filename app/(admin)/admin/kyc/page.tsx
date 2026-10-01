'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiShield, FiCheck, FiX, FiEye, FiFileText, FiClock, FiUser, FiExternalLink } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'

interface KYCDocument {
  id: string
  userId: string
  docType: string
  side: string
  imageUrl: string
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
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FiShield className="text-amber-500" /> KYC Verification Queue
          </h1>
          <p className="text-gray-400 text-sm mt-1">Review and manage identity verification documents</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#15161E] border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <FiClock className="text-amber-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{summary.pending}</div>
                <div className="text-sm text-gray-400">Pending</div>
              </div>
            </div>
          </div>
          <div className="bg-[#15161E] border border-green-500/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <FiCheck className="text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{summary.verified}</div>
                <div className="text-sm text-gray-400">Verified</div>
              </div>
            </div>
          </div>
          <div className="bg-[#15161E] border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                <FiX className="text-red-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{summary.rejected}</div>
                <div className="text-sm text-gray-400">Rejected</div>
              </div>
            </div>
          </div>
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
              {tab.key === 'PENDING' && summary.pending > 0 && (
                <span className="ml-2 bg-amber-500/20 text-amber-400 text-xs px-1.5 py-0.5 rounded-full">
                  {summary.pending}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Documents List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-[#15161E] border border-white/5 rounded-xl p-12 text-center">
            <FiFileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No documents found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-[#15161E] border border-white/5 rounded-xl p-5 hover:border-amber-500/20 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-amber-500 font-mono text-sm font-semibold">{getMXId(doc)}</span>
                      <span className="text-white font-medium">{doc.user.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        doc.user.role === 'COMPANY' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {getUserRole(doc)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        doc.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' :
                        doc.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {doc.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-400">
                        <span className="text-gray-500">Document:</span>{' '}
                        <span className="text-gray-300">{DOC_TYPE_LABELS[doc.docType] || doc.docType} ({doc.side})</span>
                      </div>
                      <div className="text-gray-400">
                        <span className="text-gray-500">Submitted:</span>{' '}
                        <span className="text-gray-300">{formatDate(doc.createdAt)}</span>
                      </div>
                      {doc.user.taskerProfile && (
                        <div className="text-gray-400">
                          <span className="text-gray-500">Rating:</span>{' '}
                          <span className="text-gray-300">{doc.user.taskerProfile.rating?.toFixed(1) || '0.0'} | {doc.user.taskerProfile.completedJobs} jobs</span>
                        </div>
                      )}
                      {doc.user.companyProfile && (
                        <div className="text-gray-400">
                          <span className="text-gray-500">Company:</span>{' '}
                          <span className="text-gray-300">{doc.user.companyProfile.companyName} | {doc.user.companyProfile.completedProjects} projects</span>
                        </div>
                      )}
                    </div>

                    {doc.reviewNote && (
                      <div className="mt-2 text-sm text-gray-500 italic">
                        Note: {doc.reviewNote}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setLightboxDoc(doc)}
                      className="p-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white transition"
                      title="View Document"
                    >
                      <FiEye size={16} />
                    </button>
                    <a
                      href={doc.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white transition"
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
                        {!canApprove && !canReject && <span className="text-xs text-gray-500">Read only</span>}
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
                className="absolute -top-10 right-0 text-white hover:text-amber-500 transition"
              >
                <FiX size={24} />
              </button>
              <div className="bg-[#15161E] rounded-xl overflow-hidden border border-white/10">
                <div className="p-4 border-b border-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-amber-500 font-mono text-sm">{getMXId(lightboxDoc)}</span>
                      <span className="text-white ml-2">{lightboxDoc.user.name}</span>
                    </div>
                    <span className="text-gray-400 text-sm">
                      {DOC_TYPE_LABELS[lightboxDoc.docType] || lightboxDoc.docType} - {lightboxDoc.side}
                    </span>
                  </div>
                </div>
                <div className="p-4 flex justify-center bg-black/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={lightboxDoc.imageUrl}
                    alt="KYC Document"
                    className="max-h-[70vh] max-w-full object-contain rounded"
                  />
                </div>
                <div className="p-4 border-t border-white/5 flex justify-end gap-2">
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
                          className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-400 disabled:opacity-50 transition"
                        >
                          Reject
                        </button>
                      )}
                      {!canApprove && !canReject && <span className="text-sm text-gray-500">Read-only review</span>}
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
            <div className="bg-[#15161E] border border-white/10 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white mb-2">Reject Document</h3>
              <p className="text-gray-400 text-sm mb-4">
                Provide a reason for rejecting {reviewModal.user.name}&apos;s document.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-[#0B0C12] border border-white/10 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-amber-500/50 resize-none"
                rows={4}
                placeholder="Enter rejection reason..."
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { setReviewModal(null); setRejectReason('') }}
                  className="flex-1 px-4 py-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(reviewModal.id)}
                  disabled={actionLoading || !rejectReason.trim()}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-400 disabled:opacity-50 transition"
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