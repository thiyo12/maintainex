'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  FiCheck,
  FiEye,
  FiHome,
  FiMessageCircle,
  FiRefreshCw,
  FiSearch,
  FiStar,
  FiTrendingUp,
  FiX,
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { useCrmShell } from '@/components/crm/v2/CrmShellContext'
import {
  CrmBadge,
  CrmButton,
  CrmCard,
  CrmField,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  CrmTableFrame,
  crmInputClass,
  crmTableClass,
  crmTdClass,
  crmThClass,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmModal } from '@/components/crm/v2/CrmOverlays'
import { crmApiError } from '@/lib/crm/api-error'

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'amber'

interface Listing {
  id: string
  postedBy: string
  seller: {
    mxId?: string | null
    name: string
    countryCode: string
    accountState: string
    riskSignals: {
      fraudEvents: number
      openFlags: number
    }
  } | null
  title: string
  description?: string | null
  propertyType: string
  purpose: string
  price: number
  countryCode: string
  district?: string | null
  city?: string | null
  area?: string | null
  address?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  areaSqft?: number | null
  photos: string[]
  status: string
  rejectionReason?: string | null
  isFeatured: boolean
  boostTier?: string | null
  boostExpiresAt?: string | null
  views: number
  saves: number
  inquiries: number
  hasContact: boolean
  reviewedAt?: string | null
  createdAt: string
}

interface Inquiry {
  id: string
  listingId: string
  listingTitle: string
  countryCode?: string | null
  buyer: { mxId?: string | null; name: string } | null
  seller: { mxId?: string | null; name: string } | null
  type: string
  status: string
  hasMessage: boolean
  createdAt: string
}

interface Payload {
  metrics: {
    total: number
    pending: number
    approved: number
    rejected: number
    featured: number
    activeBoosts: number
  }
  listings: Listing[]
  inquiries: Inquiry[]
  canManage: boolean
}

const EMPTY: Payload = {
  metrics: { total: 0, pending: 0, approved: 0, rejected: 0, featured: 0, activeBoosts: 0 },
  listings: [],
  inquiries: [],
  canManage: false,
}

const STATUS_OPTIONS = ['ALL', 'pending', 'approved', 'published', 'rejected', 'draft']

export default function RealEstateOperationsPage() {
  const { user } = useAdminSession()
  const { market } = useCrmShell()
  const canView = Boolean(user?.permissions?.includes('realestate:view'))
  const canManagePermission = Boolean(user?.permissions?.includes('realestate:manage'))

  const [data, setData] = useState<Payload>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [rejectTarget, setRejectTarget] = useState<Listing | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const canManage = canManagePermission && data.canManage

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (market !== 'ALL') params.set('country', market)
      if (status !== 'ALL') params.set('status', status)
      if (query) params.set('q', query)

      const response = await fetch(`/api/admin/real-estate?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Unable to load real-estate operations')
      setData({
        metrics: body.metrics || EMPTY.metrics,
        listings: body.listings || [],
        inquiries: body.inquiries || [],
        canManage: Boolean(body.canManage),
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load real estate')
    } finally {
      setLoading(false)
    }
  }, [canView, market, query, status])

  useEffect(() => {
    load()
  }, [load])

  function runSearch(event: React.FormEvent) {
    event.preventDefault()
    setQuery(search.trim())
  }

  async function moderate(listing: Listing, action: 'approve' | 'reject' | 'feature' | 'unfeature', reason?: string) {
    if (!canManage) return
    setBusy(listing.id)
    try {
      const response = await fetch('/api/admin/real-estate', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: listing.id, action, reason }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) crmApiError(body, 'Moderation action failed')
      toast.success(
        action === 'approve'
          ? 'Listing approved'
          : action === 'reject'
            ? 'Listing rejected'
            : action === 'feature'
              ? 'Listing featured'
              : 'Listing unfeatured'
      )
      if (action === 'reject') {
        setRejectTarget(null)
        setRejectReason('')
      }
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Moderation action failed')
    } finally {
      setBusy(null)
    }
  }

  const pendingRows = useMemo(
    () => data.listings.filter(item => item.status === 'pending'),
    [data.listings]
  )

  if (!canView && user) {
    return (
      <CrmState
        type="permission"
        title="Real-estate access required"
        description="Your current staff permissions do not allow the real-estate operations workspace."
      />
    )
  }

  if (loading && data.listings.length === 0) {
    return (
      <CrmState
        type="loading"
        title="Loading real-estate operations"
        description="Loading market-scoped listings, moderation state, boosts and inquiry metadata."
      />
    )
  }

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="Marketplace · Real Estate"
        title="Real-estate operations"
        description="Moderate the existing property marketplace with market scope, seller-state awareness, paid-boost visibility and audited approval decisions."
        actions={
          <CrmButton variant="secondary" onClick={load}>
            <FiRefreshCw size={14} />
            Refresh
          </CrmButton>
        }
        context={
          <>
            <CrmBadge tone="success" dot>3-layer protected</CrmBadge>
            <CrmBadge tone={canManage ? 'amber' : 'neutral'}>
              {canManage ? 'Moderation enabled' : 'Read-only'}
            </CrmBadge>
            <CrmBadge tone="info">{market === 'ALL' ? 'All permitted markets' : market}</CrmBadge>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <CrmMetricCard label="Listings" value={data.metrics.total.toLocaleString()} helper="In selected scope" icon={<FiHome size={16} />} tone="info" />
        <CrmMetricCard label="Pending review" value={data.metrics.pending.toLocaleString()} helper="Needs moderation" icon={<FiEye size={16} />} tone={data.metrics.pending > 0 ? 'warning' : 'neutral'} />
        <CrmMetricCard label="Public" value={data.metrics.approved.toLocaleString()} helper="Approved + published" icon={<FiCheck size={16} />} tone="success" />
        <CrmMetricCard label="Rejected" value={data.metrics.rejected.toLocaleString()} helper="Not discoverable" icon={<FiX size={16} />} tone="neutral" />
        <CrmMetricCard label="Featured" value={data.metrics.featured.toLocaleString()} helper="Editorial feature flag" icon={<FiStar size={16} />} tone="amber" />
        <CrmMetricCard label="Paid boosts" value={data.metrics.activeBoosts.toLocaleString()} helper="Unexpired boosts" icon={<FiTrendingUp size={16} />} tone="info" />
      </section>

      {pendingRows.length > 0 && (
        <CrmCard
          title="Review queue"
          description="Pending listings are private until an authorized moderator approves them."
          action={<CrmBadge tone="warning">{pendingRows.length} pending</CrmBadge>}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {pendingRows.slice(0, 6).map(listing => (
              <ListingReviewCard
                key={listing.id}
                listing={listing}
                canManage={canManage}
                busy={busy === listing.id}
                onApprove={() => moderate(listing, 'approve')}
                onReject={() => {
                  setRejectTarget(listing)
                  setRejectReason('')
                }}
              />
            ))}
          </div>
        </CrmCard>
      )}

      <CrmCard
        title="Listing control"
        description="Search and inspect canonical listing state. Moderation never edits seller contact data or fabricates boost entitlements."
        action={
          <form onSubmit={runSearch} className="flex items-center gap-2">
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                className={`${crmInputClass} w-[190px] pl-8`}
                placeholder="Title or location"
              />
            </div>
            <CrmButton size="sm" variant="secondary" type="submit">Search</CrmButton>
          </form>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {STATUS_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setStatus(option)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                status === option
                  ? 'border-[#17191b] bg-[#17191b] text-white'
                  : 'border-[var(--crm-border)] bg-white text-slate-500 hover:text-slate-900'
              }`}
            >
              {option === 'ALL' ? 'All states' : option.toUpperCase()}
            </button>
          ))}
        </div>

        {data.listings.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No listings match the current scope.</div>
        ) : (
          <CrmTableFrame>
            <table className={crmTableClass}>
              <thead>
                <tr>
                  <th className={crmThClass}>Listing</th>
                  <th className={crmThClass}>Seller</th>
                  <th className={crmThClass}>Market</th>
                  <th className={crmThClass}>Status</th>
                  <th className={crmThClass}>Signals</th>
                  <th className={crmThClass}>Created</th>
                  <th className={crmThClass}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.listings.map(listing => (
                  <tr key={listing.id}>
                    <td className={crmTdClass}>
                      <div className="max-w-[320px]">
                        <div className="truncate text-xs font-semibold text-slate-900">{listing.title}</div>
                        <div className="mt-1 text-[10px] text-slate-400">
                          {listing.propertyType} · {listing.purpose} · {formatMoney(listing)}
                        </div>
                        <div className="mt-1 truncate text-[10px] text-slate-400">
                          {[listing.area, listing.city, listing.district].filter(Boolean).join(', ') || 'Location not supplied'}
                        </div>
                      </div>
                    </td>
                    <td className={crmTdClass}>
                      <div className="text-xs font-medium text-slate-700">{listing.seller?.name || 'Unknown user'}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        {listing.seller?.mxId || listing.postedBy}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {listing.seller && listing.seller.accountState !== 'ACTIVE' && (
                          <CrmBadge tone="danger">{listing.seller.accountState}</CrmBadge>
                        )}
                        {listing.seller && (listing.seller.riskSignals.fraudEvents > 0 || listing.seller.riskSignals.openFlags > 0) && (
                          <CrmBadge tone="warning">
                            RISK · {listing.seller.riskSignals.fraudEvents} events · {listing.seller.riskSignals.openFlags} flags
                          </CrmBadge>
                        )}
                      </div>
                    </td>
                    <td className={crmTdClass}>
                      <CrmBadge tone="info">{listing.countryCode}</CrmBadge>
                    </td>
                    <td className={crmTdClass}>
                      <CrmBadge tone={statusTone(listing.status)} dot>{listing.status.toUpperCase()}</CrmBadge>
                      {listing.rejectionReason && (
                        <div className="mt-1 max-w-[180px] truncate text-[10px] text-red-500">{listing.rejectionReason}</div>
                      )}
                    </td>
                    <td className={crmTdClass}>
                      <div className="flex flex-wrap gap-1">
                        {listing.isFeatured && <CrmBadge tone="amber">FEATURED</CrmBadge>}
                        {listing.boostTier && <CrmBadge tone="info">BOOST · {listing.boostTier.toUpperCase()}</CrmBadge>}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">
                        {listing.views} views · {listing.saves} saves · {listing.inquiries} inquiries
                      </div>
                    </td>
                    <td className={crmTdClass}>
                      <div className="text-xs text-slate-600">{formatDate(listing.createdAt)}</div>
                    </td>
                    <td className={crmTdClass}>
                      <div className="flex flex-wrap gap-1.5">
                        {canManage && listing.status === 'pending' && (
                          <>
                            <CrmButton size="sm" variant="primary" disabled={busy === listing.id} onClick={() => moderate(listing, 'approve')}>
                              Approve
                            </CrmButton>
                            <CrmButton size="sm" variant="secondary" disabled={busy === listing.id} onClick={() => {
                              setRejectTarget(listing)
                              setRejectReason('')
                            }}>
                              Reject
                            </CrmButton>
                          </>
                        )}
                        {canManage && ['approved', 'published'].includes(listing.status) && (
                          <>
                            <CrmButton
                              size="sm"
                              variant="secondary"
                              disabled={busy === listing.id}
                              onClick={() => moderate(listing, listing.isFeatured ? 'unfeature' : 'feature')}
                            >
                              {listing.isFeatured ? 'Unfeature' : 'Feature'}
                            </CrmButton>
                            <CrmButton size="sm" variant="secondary" disabled={busy === listing.id} onClick={() => {
                              setRejectTarget(listing)
                              setRejectReason('')
                            }}>
                              Reject
                            </CrmButton>
                          </>
                        )}
                        {canManage && listing.status === 'rejected' && (
                          <CrmButton size="sm" variant="primary" disabled={busy === listing.id} onClick={() => moderate(listing, 'approve')}>
                            Re-approve
                          </CrmButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CrmTableFrame>
        )}
      </CrmCard>

      <CrmCard
        title="Inquiry activity"
        description="Operational metadata only. Message bodies, phone numbers and email addresses stay out of this overview."
        action={<CrmBadge tone="neutral">{data.inquiries.length} recent</CrmBadge>}
      >
        {data.inquiries.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">No recent inquiries in this listing scope.</div>
        ) : (
          <CrmTableFrame>
            <table className={crmTableClass}>
              <thead>
                <tr>
                  <th className={crmThClass}>Listing</th>
                  <th className={crmThClass}>Buyer</th>
                  <th className={crmThClass}>Seller</th>
                  <th className={crmThClass}>Type</th>
                  <th className={crmThClass}>State</th>
                  <th className={crmThClass}>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.inquiries.map(item => (
                  <tr key={item.id}>
                    <td className={crmTdClass}>
                      <div className="max-w-[260px] truncate text-xs font-medium text-slate-800">{item.listingTitle}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{item.countryCode || '—'}</div>
                    </td>
                    <td className={crmTdClass}>
                      <div className="text-xs text-slate-700">{item.buyer?.name || 'Unknown'}</div>
                      <div className="text-[10px] text-slate-400">{item.buyer?.mxId || '—'}</div>
                    </td>
                    <td className={crmTdClass}>
                      <div className="text-xs text-slate-700">{item.seller?.name || 'Unknown'}</div>
                      <div className="text-[10px] text-slate-400">{item.seller?.mxId || '—'}</div>
                    </td>
                    <td className={crmTdClass}>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <FiMessageCircle size={12} />
                        {item.type}
                        {item.hasMessage && <CrmBadge tone="neutral">message</CrmBadge>}
                      </div>
                    </td>
                    <td className={crmTdClass}><CrmBadge tone="neutral">{item.status}</CrmBadge></td>
                    <td className={crmTdClass}><span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CrmTableFrame>
        )}
      </CrmCard>

      <CrmModal
        open={Boolean(rejectTarget)}
        onClose={() => {
          if (!busy) {
            setRejectTarget(null)
            setRejectReason('')
          }
        }}
        title="Reject property listing"
        description="Rejection removes the listing from public discovery. The reason is retained for the seller and audit trail."
        footer={
          <>
            <CrmButton variant="secondary" disabled={Boolean(busy)} onClick={() => setRejectTarget(null)}>
              Cancel
            </CrmButton>
            <CrmButton
              variant="danger"
              disabled={Boolean(busy) || rejectReason.trim().length < 3}
              onClick={() => rejectTarget && moderate(rejectTarget, 'reject', rejectReason)}
            >
              Reject listing
            </CrmButton>
          </>
        }
      >
        <CrmField label="Reason" hint="Required. Do not include unnecessary personal information.">
          <textarea
            value={rejectReason}
            onChange={event => setRejectReason(event.target.value)}
            maxLength={1200}
            rows={5}
            className={`${crmInputClass} h-auto min-h-[120px] resize-y py-2.5`}
            placeholder="Explain why this listing cannot be approved."
          />
        </CrmField>
      </CrmModal>
    </div>
  )
}

function ListingReviewCard({
  listing,
  canManage,
  busy,
  onApprove,
  onReject,
}: {
  listing: Listing
  canManage: boolean
  busy: boolean
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div className="rounded-xl border border-[var(--crm-border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{listing.title}</div>
          <div className="mt-1 text-xs text-slate-500">{formatMoney(listing)}</div>
          <div className="mt-1 truncate text-[11px] text-slate-400">
            {[listing.area, listing.city, listing.district].filter(Boolean).join(', ') || listing.countryCode}
          </div>
        </div>
        <CrmBadge tone="warning">PENDING</CrmBadge>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
        <div>{listing.propertyType}</div>
        <div>{listing.bedrooms ?? '—'} beds</div>
        <div>{listing.bathrooms ?? '—'} baths</div>
      </div>
      {listing.description && (
        <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-500">{listing.description}</p>
      )}
      <div className="mt-3 border-t border-[var(--crm-border)] pt-3">
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
          <span>Seller · {listing.seller?.name || 'Unknown'} · {listing.seller?.mxId || listing.postedBy}</span>
          {listing.seller && (listing.seller.riskSignals.fraudEvents > 0 || listing.seller.riskSignals.openFlags > 0) && (
            <CrmBadge tone="warning">
              RISK · {listing.seller.riskSignals.fraudEvents} events · {listing.seller.riskSignals.openFlags} flags
            </CrmBadge>
          )}
        </div>
        {canManage && (
          <div className="mt-3 flex gap-2">
            <CrmButton size="sm" variant="primary" disabled={busy} onClick={onApprove}>Approve</CrmButton>
            <CrmButton size="sm" variant="secondary" disabled={busy} onClick={onReject}>Reject</CrmButton>
          </div>
        )}
      </div>
    </div>
  )
}

function statusTone(status: string): Tone {
  if (status === 'approved' || status === 'published') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'rejected') return 'danger'
  return 'neutral'
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-LK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatMoney(listing: Listing) {
  return `${listing.countryCode === 'CA' ? 'CAD' : 'LKR'} ${listing.price.toLocaleString()}`
}
