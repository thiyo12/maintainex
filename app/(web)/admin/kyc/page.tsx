'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/admin/AdminLayout'

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

export default function KYCPage() {
  const [documents, setDocuments] = useState<KYCDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('PENDING')
  const [selectedDoc, setSelectedDoc] = useState<KYCDocument | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [summary, setSummary] = useState({ pending: 0, verified: 0, rejected: 0 })

  useEffect(() => {
    fetchDocuments()
  }, [filter])

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/kyc?status=${filter}`)
      const data = await res.json()
      setDocuments(data.documents || [])
      setSummary(data.summary || { pending: 0, verified: 0, rejected: 0 })
    } catch (error) {
      console.error('Failed to fetch KYC documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (docId: string, status: 'APPROVED' | 'REJECTED') => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/kyc', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: docId,
          status,
          reviewNote,
          reviewedBy: 'admin' // TODO: Get from session
        })
      })

      if (res.ok) {
        setSelectedDoc(null)
        setReviewNote('')
        fetchDocuments()
      }
    } catch (error) {
      console.error('Failed to review document:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const getDocTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'PASSPORT': 'Passport',
      'NATIONAL_ID': 'National ID',
      'DRIVERS_LICENSE': 'Driving License',
      'EXPERIENCE_CERT': 'Experience Certificate',
      'BUSINESS_REG': 'Business Registration',
      'STAFF_PROOF': 'Staff Proof'
    }
    return labels[type] || type
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED': return 'bg-green-100 text-green-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">KYC Verification</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-yellow-600 text-sm font-medium">Pending</div>
            <div className="text-2xl font-bold text-yellow-700">{summary.pending}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-green-600 text-sm font-medium">Verified</div>
            <div className="text-2xl font-bold text-green-700">{summary.verified}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-600 text-sm font-medium">Rejected</div>
            <div className="text-2xl font-bold text-red-700">{summary.rejected}</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {['PENDING', 'APPROVED', 'REJECTED'].map((status) => (
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

        {/* Documents List */}
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No documents found</div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-sm text-gray-500">{doc.user.mxId}</span>
                      <span className="font-semibold">{doc.user.name}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Document:</span> {getDocTypeLabel(doc.docType)} ({doc.side})
                    </div>
                    <div className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Email:</span> {doc.user.email}
                    </div>
                    {doc.user.taskerProfile && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Role:</span> Tasker | 
                        <span className="font-medium"> Rating:</span> {doc.user.taskerProfile.rating} | 
                        <span className="font-medium"> Jobs:</span> {doc.user.taskerProfile.completedJobs}
                      </div>
                    )}
                    {doc.user.companyProfile && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Role:</span> Company ({doc.user.companyProfile.companyName}) | 
                        <span className="font-medium"> Staff:</span> {doc.user.companyProfile.staffCount}/{doc.user.companyProfile.minStaffCount} | 
                        <span className="font-medium"> Projects:</span> {doc.user.companyProfile.completedProjects}
                      </div>
                    )}
                    {doc.reviewNote && (
                      <div className="text-sm text-gray-500 mt-2">
                        <span className="font-medium">Note:</span> {doc.reviewNote}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedDoc(doc)}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Review
                    </button>
                    <a
                      href={doc.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      View Doc
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Review Modal */}
        {selectedDoc && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold mb-4">Review KYC Document</h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  <strong>User:</strong> {selectedDoc.user.name} ({selectedDoc.user.mxId})
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Document:</strong> {getDocTypeLabel(selectedDoc.docType)}
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Review Note (optional)
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  rows={3}
                  placeholder="Add a note about this review..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleReview(selectedDoc.id, 'APPROVED')}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Approve'}
                </button>
                <button
                  onClick={() => handleReview(selectedDoc.id, 'REJECTED')}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Reject'}
                </button>
                <button
                  onClick={() => { setSelectedDoc(null); setReviewNote('') }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
