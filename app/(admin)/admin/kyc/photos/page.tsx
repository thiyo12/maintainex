'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiCamera, FiCheck, FiExternalLink, FiRefreshCw, FiShield, FiX } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import {
  CrmBadge,
  CrmButton,
  CrmPageHeader,
  CrmState,
  CrmTabs,
  crmInputClass,
} from '@/components/crm/v2/CrmPrimitives'
import { crmApiError } from '@/lib/crm/api-error'

type PhotoRequest = {
  id: string
  requestedPhotoUrl: string
  requestReason?: string | null
  livenessStatus: string
  faceMatchStatus: string
  status: string
  reviewNote?: string | null
  createdAt: string
  providerIdentity: {
    id: string
    identityType: string
    countryCode: string
    kycStatus: string
    verifiedDisplayName?: string | null
    verifiedPhotoUrl?: string | null
    photoLocked: boolean
  }
  user?: {
    id: string
    mxId?: string | null
    name: string
    email: string
    identityStatus: string
    taskerProfile?: {
      id: string
      mxId?: string | null
      verificationStatus: string
      isVerified: boolean
      rating: number
      completedJobs: number
    } | null
  } | null
  documents: Array<{
    id: string
    docType: string
    side: string
    fullName?: string | null
    status: string
  }>
}

type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'

export default function VerifiedPhotoReviewsPage() {
  const { user: admin } = useAdminSession()
  const canApprove = Boolean(admin?.permissions?.includes('kyc:approve'))
  const canReject = Boolean(admin?.permissions?.includes('kyc:reject'))
  const [status, setStatus] = useState<ReviewStatus>('PENDING')
  const [requests, setRequests] = useState<PhotoRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<PhotoRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/kyc/photo-changes?status=${status}`, {
        cache: 'no-store',
        credentials: 'include',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw crmApiError(body, 'Failed to load verified photo requests')
      setRequests(body.requests || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load verified photo requests')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  const review = async (requestId: string, decision: 'APPROVED' | 'REJECTED', reviewNote?: string) => {
    setActionId(requestId)
    try {
      const response = await fetch('/api/admin/kyc/photo-changes', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          status: decision,
          reviewNote: reviewNote || undefined,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw crmApiError(body, 'Photo review failed')

      toast.success(decision === 'APPROVED' ? 'Verified profile photo approved' : 'Photo request rejected')
      setRejecting(null)
      setRejectReason('')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Photo review failed')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="Trust & Safety · Identity"
        title="Verified photo reviews"
        description="Compare each tasker's requested public photo with protected KYC evidence. Approval updates the identity-controlled public photo; it does not claim automated liveness verification."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/kyc"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FiArrowLeft size={14} />
              KYC queue
            </Link>
            <CrmButton variant="secondary" onClick={load} disabled={loading}>
              <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </CrmButton>
          </div>
        }
        context={
          <>
            <CrmBadge tone="info">Photo locked after approval</CrmBadge>
            <CrmBadge tone={(canApprove || canReject) ? 'success' : 'neutral'} dot>
              {(canApprove || canReject) ? 'Review access' : 'Read-only'}
            </CrmBadge>
          </>
        }
      />

      <CrmTabs
        active={status}
        onChange={value => setStatus(value as ReviewStatus)}
        items={[
          { id: 'PENDING', label: 'Pending' },
          { id: 'APPROVED', label: 'Approved' },
          { id: 'REJECTED', label: 'Rejected' },
          { id: 'ALL', label: 'All' },
        ]}
      />

      {loading ? (
        <CrmState
          type="loading"
          title="Loading verified photo requests"
          description="Loading identity-controlled profile photo reviews inside your market scope."
        />
      ) : requests.length === 0 ? (
        <CrmState
          type="empty"
          title="No verified photo requests"
          description="No requests match the selected status."
          action={<FiCamera size={18} className="text-slate-400" />}
        />
      ) : (
        <div className="space-y-4">
          {requests.map(item => {
            const displayName =
              item.user?.name ||
              item.providerIdentity.verifiedDisplayName ||
              'Tasker'
            const mxId =
              item.user?.taskerProfile?.mxId ||
              item.user?.mxId ||
              item.providerIdentity.id

            return (
              <section key={item.id} className="crm-card overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-[var(--crm-border)] p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-amber-700">{mxId}</span>
                      <span className="font-semibold text-slate-900">{displayName}</span>
                      <CrmBadge tone="info">{item.providerIdentity.countryCode}</CrmBadge>
                      <CrmBadge
                        tone={
                          item.status === 'APPROVED'
                            ? 'success'
                            : item.status === 'REJECTED'
                              ? 'danger'
                              : 'warning'
                        }
                        dot
                      >
                        {item.status}
                      </CrmBadge>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      KYC: {item.providerIdentity.kycStatus} · Tasker verification: {item.user?.taskerProfile?.verificationStatus || '—'} · Submitted {new Date(item.createdAt).toLocaleString('en-LK')}
                    </div>
                  </div>
                  {item.status === 'PENDING' && (
                    <div className="flex items-center gap-2">
                      {canReject && (
                        <CrmButton
                          variant="danger"
                          size="sm"
                          disabled={actionId === item.id}
                          onClick={() => {
                            setRejecting(item)
                            setRejectReason('')
                          }}
                        >
                          <FiX size={14} />
                          Reject
                        </CrmButton>
                      )}
                      {canApprove && (
                        <CrmButton
                          size="sm"
                          disabled={actionId === item.id}
                          onClick={() => review(item.id, 'APPROVED')}
                        >
                          <FiCheck size={14} />
                          Approve verified photo
                        </CrmButton>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 p-5 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Current approved public photo
                    </div>
                    <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
                      {item.providerIdentity.verifiedPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.providerIdentity.verifiedPhotoUrl}
                          alt="Current verified tasker"
                          className="max-h-[320px] max-w-full rounded-xl object-contain"
                        />
                      ) : (
                        <div className="text-center text-sm text-slate-500">
                          <FiShield size={28} className="mx-auto mb-2 text-slate-400" />
                          No approved identity-controlled public photo yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Requested new photo
                    </div>
                    <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.requestedPhotoUrl}
                        alt="Requested verified tasker"
                        className="max-h-[320px] max-w-full rounded-xl object-contain"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-[var(--crm-border)] px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">Protected KYC evidence:</span>
                    {item.documents.length === 0 ? (
                      <CrmBadge tone="danger">No approved KYC document</CrmBadge>
                    ) : (
                      item.documents.map(doc => (
                        <a
                          key={doc.id}
                          href={`/api/admin/kyc/${doc.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <FiExternalLink size={12} />
                          {doc.docType} · {doc.side}
                        </a>
                      ))
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <CrmBadge tone={item.faceMatchStatus === 'MATCHED' ? 'success' : 'warning'}>
                      Face match: {item.faceMatchStatus.replaceAll('_', ' ')}
                    </CrmBadge>
                    <CrmBadge tone="neutral">
                      Liveness: {item.livenessStatus.replaceAll('_', ' ')}
                    </CrmBadge>
                  </div>
                  <p className="mt-3 max-w-4xl text-xs leading-5 text-slate-500">
                    This workflow currently uses governed human review. Do not mark automated liveness as passed until a real liveness provider is integrated. Approve only when the requested public photo clearly matches the verified identity evidence.
                  </p>
                  {item.reviewNote && (
                    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Review note: {item.reviewNote}
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {rejecting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setRejecting(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[var(--crm-border)] bg-white p-6 shadow-xl"
            onClick={event => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900">Reject verified photo request</h3>
            <p className="mt-1 text-sm text-slate-500">
              Explain what the tasker must correct before submitting another identity photo.
            </p>
            <textarea
              value={rejectReason}
              onChange={event => setRejectReason(event.target.value)}
              rows={4}
              className={`${crmInputClass} mt-4 h-auto min-h-[112px] resize-y py-2.5`}
              placeholder="Reason for rejection…"
            />
            <div className="mt-4 flex gap-2">
              <CrmButton variant="secondary" className="flex-1" onClick={() => setRejecting(null)}>
                Cancel
              </CrmButton>
              <CrmButton
                variant="danger"
                className="flex-1"
                disabled={!rejectReason.trim() || actionId === rejecting.id}
                onClick={() => review(rejecting.id, 'REJECTED', rejectReason.trim())}
              >
                Reject request
              </CrmButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
