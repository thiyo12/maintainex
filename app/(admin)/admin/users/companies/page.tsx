'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowDown,
  FiArrowUp,
  FiBriefcase,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiStar,
  FiUserCheck,
  FiUsers,
  FiUserX,
  FiXCircle,
} from 'react-icons/fi'
import {
  CrmBadge,
  CrmButton,
  CrmFilterBar,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  CrmTableFrame,
  crmInputClass,
  crmTableClass,
  crmTdClass,
  crmThClass,
  type CrmTone,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmModal } from '@/components/crm/v2/CrmOverlays'
import { CrmPagination } from '@/components/crm/v2/CrmOperational'
import { crmApiError } from '@/lib/crm/api-error'

interface CompanyUser {
  id: string
  mxId?: string | null
  name: string
  email: string
  phone?: string | null
  countryCode?: string | null
  isActive: boolean
  isSuspended: boolean
  isBanned: boolean
  createdAt: string
  companyProfile?: {
    id: string
    mxId?: string | null
    companyName: string
    verificationStatus: string
    rating: number
    completedProjects: number
    isVerified: boolean
    minStaffCount: number
    staffCount: number
    registrationNo?: string | null
    taxId?: string | null
    subscriptionStatus?: string | null
  } | null
}

interface ApiResponse {
  users: CompanyUser[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  actions: {
    suspend: boolean
    ban: boolean
    verify: boolean
  }
}

type SortField = 'name' | 'email' | 'createdAt' | 'mxId' | 'rating'
type SortDir = 'asc' | 'desc'
type CompanyAction =
  | 'verify_company'
  | 'reject_company'
  | 'suspend'
  | 'unsuspend'
  | 'ban'
  | 'unban'

function accountStatus(company: CompanyUser): { label: string; tone: CrmTone } {
  if (company.isBanned) return { label: 'Banned', tone: 'danger' }
  if (company.isSuspended) return { label: 'Suspended', tone: 'warning' }
  if (!company.isActive) return { label: 'Inactive', tone: 'neutral' }
  return { label: 'Active', tone: 'success' }
}

function verificationStatus(company: CompanyUser): { label: string; tone: CrmTone } {
  const status = company.companyProfile?.verificationStatus || 'PENDING'
  if (status === 'VERIFIED') return { label: 'Verified', tone: 'success' }
  if (status === 'REJECTED') return { label: 'Rejected', tone: 'danger' }
  if (status === 'SUSPENDED') return { label: 'Suspended', tone: 'warning' }
  return { label: status === 'PENDING' ? 'Pending' : status, tone: 'warning' }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-LK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function CompanyManagementPage() {
  const [companies, setCompanies] = useState<CompanyUser[]>([])
  const [actions, setActions] = useState<ApiResponse['actions']>({
    suspend: false,
    ban: false,
    verify: false,
  })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [pendingAction, setPendingAction] = useState<{
    company: CompanyUser
    action: CompanyAction
  } | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: 'company',
        page: String(page),
        pageSize: String(pageSize),
      })
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter) params.set('status', statusFilter)

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))

      if (response.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      if (!response.ok) {
        crmApiError(body, 'Failed to load companies')
      }

      const payload = body as ApiResponse
      setCompanies(payload.users || [])
      setTotal(Number(payload.total || 0))
      setPageSize(Number(payload.pageSize || 20))
      setTotalPages(Math.max(1, Number(payload.totalPages || 1)))
      setActions(payload.actions || { suspend: false, ban: false, verify: false })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, statusFilter])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  const sortedCompanies = useMemo(() => {
    return [...companies].sort((a, b) => {
      if (sortField === 'rating') {
        const left = Number(a.companyProfile?.rating || 0)
        const right = Number(b.companyProfile?.rating || 0)
        return sortDir === 'asc' ? left - right : right - left
      }

      const value = (item: CompanyUser) => {
        if (sortField === 'name') return item.companyProfile?.companyName || item.name || ''
        if (sortField === 'email') return item.email || ''
        if (sortField === 'mxId') return item.companyProfile?.mxId || item.mxId || ''
        return item.createdAt || ''
      }
      const comparison = value(a).localeCompare(value(b))
      return sortDir === 'asc' ? comparison : -comparison
    })
  }, [companies, sortDir, sortField])

  const pageStats = useMemo(() => ({
    active: companies.filter(item => !item.isBanned && !item.isSuspended && item.isActive).length,
    pending: companies.filter(item => (item.companyProfile?.verificationStatus || 'PENDING') === 'PENDING').length,
    verified: companies.filter(item => item.companyProfile?.verificationStatus === 'VERIFIED').length,
  }), [companies])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(current => current === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <FiArrowDown size={11} className="text-slate-300" />
    return sortDir === 'asc'
      ? <FiArrowUp size={11} className="text-amber-600" />
      : <FiArrowDown size={11} className="text-amber-600" />
  }

  function openAction(company: CompanyUser, action: CompanyAction) {
    setPendingAction({ company, action })
    setReason('')
  }

  async function submitAction() {
    if (!pendingAction || submitting) return

    const needsReason =
      pendingAction.action === 'suspend' ||
      pendingAction.action === 'ban' ||
      pendingAction.action === 'reject_company'

    if (needsReason && reason.trim().length < 3) {
      toast.error('Enter a reason of at least 3 characters')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pendingAction.company.id,
          action: pendingAction.action,
          reason: reason.trim() || undefined,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        crmApiError(body, 'Company action failed')
      }

      toast.success('Company account updated')
      setPendingAction(null)
      setReason('')
      await fetchCompanies()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Company action failed')
    } finally {
      setSubmitting(false)
    }
  }

  const actionLabel = pendingAction
    ? ({
        verify_company: 'Verify company',
        reject_company: 'Reject verification',
        suspend: 'Suspend company',
        unsuspend: 'Unsuspend company',
        ban: 'Ban company',
        unban: 'Remove ban',
      } satisfies Record<CompanyAction, string>)[pendingAction.action]
    : 'Company action'

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="People"
        title="Companies"
        description="Operate company identity, workforce readiness and account state using live permissions and the current market boundary."
        actions={
          <CrmButton variant="secondary" onClick={fetchCompanies} disabled={loading}>
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </CrmButton>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CrmMetricCard
          label="Companies"
          value={total.toLocaleString()}
          helper="Current market scope"
          icon={<FiBriefcase size={16} />}
          tone="neutral"
        />
        <CrmMetricCard
          label="Active on page"
          value={pageStats.active.toLocaleString()}
          helper="Operational accounts"
          icon={<FiUsers size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="Verification pending"
          value={pageStats.pending.toLocaleString()}
          helper="Needs company review"
          icon={<FiClock size={16} />}
          tone="warning"
        />
        <CrmMetricCard
          label="Verified on page"
          value={pageStats.verified.toLocaleString()}
          helper="Approved companies"
          icon={<FiShield size={16} />}
          tone="info"
        />
      </section>

      <CrmFilterBar>
        <div className="relative min-w-0 flex-1">
          <FiSearch
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={15}
          />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search company, owner, email, phone, MX ID or account ID..."
            className={`${crmInputClass} pl-9`}
          />
        </div>

        <div className="flex items-center gap-2 md:w-[220px]">
          <FiFilter className="shrink-0 text-slate-400" size={15} />
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
            className={crmInputClass}
            aria-label="Company account status"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
        </div>
      </CrmFilterBar>

      {loading ? (
        <CrmState
          type="loading"
          title="Loading companies"
          description="Loading company accounts inside your current market scope."
        />
      ) : sortedCompanies.length === 0 ? (
        <CrmState
          type="empty"
          title="No companies match this view"
          description="Change the search or status filter to find another company."
        />
      ) : (
        <CrmTableFrame
          title="Company directory"
          description={`${total.toLocaleString()} companies are visible inside the current market scope.`}
        >
          <table className={`${crmTableClass} min-w-[1280px]`}>
            <thead>
              <tr>
                <th className={crmThClass}>
                  <button type="button" onClick={() => toggleSort('mxId')} className="inline-flex items-center gap-1">
                    MX ID <SortIcon field="mxId" />
                  </button>
                </th>
                <th className={crmThClass}>
                  <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1">
                    Company <SortIcon field="name" />
                  </button>
                </th>
                <th className={crmThClass}>Owner</th>
                <th className={crmThClass}>Staff</th>
                <th className={crmThClass}>
                  <button type="button" onClick={() => toggleSort('rating')} className="inline-flex items-center gap-1">
                    Rating <SortIcon field="rating" />
                  </button>
                </th>
                <th className={crmThClass}>Verification</th>
                <th className={crmThClass}>Subscription</th>
                <th className={crmThClass}>Market</th>
                <th className={crmThClass}>Status</th>
                <th className={`${crmThClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedCompanies.map(company => {
                const status = accountStatus(company)
                const verification = verificationStatus(company)
                const staffCount = Number(company.companyProfile?.staffCount || 0)
                const minStaffCount = Number(company.companyProfile?.minStaffCount || 0)
                const staffReady = minStaffCount <= 0 || staffCount >= minStaffCount
                const pendingVerification =
                  (company.companyProfile?.verificationStatus || 'PENDING') === 'PENDING'
                const companyName = company.companyProfile?.companyName || company.name
                const companyHref = company.companyProfile?.id
                  ? `/admin/companies/${company.companyProfile.id}`
                  : `/admin/users/${company.id}`

                return (
                  <tr key={company.id} className="transition-colors hover:bg-[#fafbf9]">
                    <td className={crmTdClass}>
                      <span className="font-mono text-xs font-semibold text-amber-700">
                        {company.companyProfile?.mxId || company.mxId || '—'}
                      </span>
                    </td>

                    <td className={crmTdClass}>
                      <Link href={companyHref} className="flex items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--crm-accent-soft)] text-amber-800">
                          <FiBriefcase size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 hover:text-amber-700">
                            {companyName}
                          </div>
                          <div className="mt-0.5 max-w-[220px] truncate text-xs text-slate-400">
                            {company.email}
                          </div>
                        </div>
                      </Link>
                    </td>

                    <td className={crmTdClass}>
                      <div className="text-sm font-medium text-slate-700">{company.name}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{company.phone || '—'}</div>
                    </td>

                    <td className={crmTdClass}>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${staffReady ? 'text-slate-800' : 'text-amber-700'}`}>
                          {staffCount}
                        </span>
                        {minStaffCount > 0 && (
                          <span className="text-xs text-slate-400">/ {minStaffCount}</span>
                        )}
                        {!staffReady && <CrmBadge tone="warning">Below minimum</CrmBadge>}
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                        <FiStar size={13} className="text-amber-500" />
                        {Number(company.companyProfile?.rating || 0).toFixed(1)}
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        {Number(company.companyProfile?.completedProjects || 0).toLocaleString()} projects
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <CrmBadge tone={verification.tone} dot>{verification.label}</CrmBadge>
                    </td>

                    <td className={crmTdClass}>
                      <CrmBadge>
                        {company.companyProfile?.subscriptionStatus || 'Not configured'}
                      </CrmBadge>
                    </td>

                    <td className={crmTdClass}>
                      <CrmBadge>{company.countryCode || '—'}</CrmBadge>
                    </td>

                    <td className={crmTdClass}>
                      <CrmBadge tone={status.tone} dot>{status.label}</CrmBadge>
                    </td>

                    <td className={`${crmTdClass} text-right`}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={companyHref}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--crm-border)] bg-white text-slate-500 hover:border-amber-300 hover:text-amber-700"
                          title="Open Company 360"
                        >
                          <FiEye size={14} />
                        </Link>

                        {actions.verify && pendingVerification && (
                          <>
                            <button
                              type="button"
                              onClick={() => openAction(company, 'verify_company')}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              title="Verify company"
                            >
                              <FiCheckCircle size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openAction(company, 'reject_company')}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              title="Reject verification"
                            >
                              <FiXCircle size={14} />
                            </button>
                          </>
                        )}

                        {actions.suspend && !company.isBanned && (
                          company.isSuspended ? (
                            <button
                              type="button"
                              onClick={() => openAction(company, 'unsuspend')}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              title="Unsuspend"
                            >
                              <FiUserCheck size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openAction(company, 'suspend')}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                              title="Suspend"
                            >
                              <FiShield size={14} />
                            </button>
                          )
                        )}

                        {actions.ban && (
                          company.isBanned ? (
                            <button
                              type="button"
                              onClick={() => openAction(company, 'unban')}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              title="Remove ban"
                            >
                              <FiUserCheck size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openAction(company, 'ban')}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              title="Ban company"
                            >
                              <FiUserX size={14} />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <CrmPagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </CrmTableFrame>
      )}

      <CrmModal
        open={Boolean(pendingAction)}
        onClose={() => {
          if (!submitting) setPendingAction(null)
        }}
        title={actionLabel}
        description={
          pendingAction
            ? `${pendingAction.company.companyProfile?.companyName || pendingAction.company.name} · ${pendingAction.company.companyProfile?.mxId || pendingAction.company.mxId || pendingAction.company.id}`
            : undefined
        }
        maxWidth="max-w-lg"
        footer={
          <>
            <CrmButton
              variant="secondary"
              onClick={() => setPendingAction(null)}
              disabled={submitting}
            >
              Cancel
            </CrmButton>
            <CrmButton
              variant={
                pendingAction?.action === 'ban' ||
                pendingAction?.action === 'reject_company'
                  ? 'danger'
                  : 'primary'
              }
              onClick={submitAction}
              disabled={submitting}
            >
              {submitting ? 'Working…' : 'Confirm action'}
            </CrmButton>
          </>
        }
      >
        <div className="space-y-4">
          {pendingAction && (
            pendingAction.action === 'suspend' ||
            pendingAction.action === 'ban' ||
            pendingAction.action === 'reject_company'
          ) && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Reason
              </label>
              <textarea
                value={reason}
                onChange={event => setReason(event.target.value)}
                maxLength={1000}
                rows={4}
                className="w-full resize-none rounded-[11px] border border-[var(--crm-border)] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                placeholder="Explain why this company action is required…"
              />
            </div>
          )}

          <div className="rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-3 text-xs leading-5 text-slate-500">
            The server will re-check live staff permission, market scope and the company&apos;s current state before applying this action. Every privileged change is audited.
          </div>
        </div>
      </CrmModal>
    </div>
  )
}
