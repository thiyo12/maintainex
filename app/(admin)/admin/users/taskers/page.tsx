'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowDown,
  FiArrowUp,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiStar,
  FiTool,
  FiUserCheck,
  FiUserX,
  FiUsers,
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

interface TaskerUser {
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
  taskerProfile?: {
    id: string
    mxId?: string | null
    verificationStatus: string
    rating: number
    completedJobs: number
    isVerified: boolean
    isOnline?: boolean
    compositeScore?: number
    completionRate?: number
    avgResponseMin?: number
    hourlyRate: number
  } | null
}

interface ApiResponse {
  users: TaskerUser[]
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
type TaskerAction =
  | 'verify_tasker'
  | 'reject_tasker'
  | 'suspend'
  | 'unsuspend'
  | 'ban'
  | 'unban'

function accountStatus(tasker: TaskerUser): { label: string; tone: CrmTone } {
  if (tasker.isBanned) return { label: 'Banned', tone: 'danger' }
  if (tasker.isSuspended) return { label: 'Suspended', tone: 'warning' }
  if (!tasker.isActive) return { label: 'Inactive', tone: 'neutral' }
  return { label: 'Active', tone: 'success' }
}

function verificationStatus(tasker: TaskerUser): { label: string; tone: CrmTone } {
  const status = tasker.taskerProfile?.verificationStatus || 'PENDING'
  if (status === 'VERIFIED') return { label: 'Verified', tone: 'success' }
  if (status === 'REJECTED') return { label: 'Rejected', tone: 'danger' }
  return { label: status === 'PENDING' ? 'Pending' : status, tone: 'warning' }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-LK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function TaskerManagementPage() {
  const [taskers, setTaskers] = useState<TaskerUser[]>([])
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
    tasker: TaskerUser
    action: TaskerAction
  } | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchTaskers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: 'tasker',
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
        crmApiError(body, 'Failed to load taskers')
      }

      const payload = body as ApiResponse
      setTaskers(payload.users || [])
      setTotal(Number(payload.total || 0))
      setPageSize(Number(payload.pageSize || 20))
      setTotalPages(Math.max(1, Number(payload.totalPages || 1)))
      setActions(payload.actions || { suspend: false, ban: false, verify: false })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load taskers')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, statusFilter])

  useEffect(() => {
    fetchTaskers()
  }, [fetchTaskers])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  const sortedTaskers = useMemo(() => {
    return [...taskers].sort((a, b) => {
      if (sortField === 'rating') {
        const left = Number(a.taskerProfile?.rating || 0)
        const right = Number(b.taskerProfile?.rating || 0)
        return sortDir === 'asc' ? left - right : right - left
      }

      const value = (item: TaskerUser) => {
        if (sortField === 'name') return item.name || ''
        if (sortField === 'email') return item.email || ''
        if (sortField === 'mxId') return item.taskerProfile?.mxId || item.mxId || ''
        return item.createdAt || ''
      }
      const comparison = value(a).localeCompare(value(b))
      return sortDir === 'asc' ? comparison : -comparison
    })
  }, [taskers, sortDir, sortField])

  const pageStats = useMemo(() => ({
    active: taskers.filter(item => !item.isBanned && !item.isSuspended && item.isActive).length,
    pending: taskers.filter(item => (item.taskerProfile?.verificationStatus || 'PENDING') === 'PENDING').length,
    verified: taskers.filter(item => item.taskerProfile?.verificationStatus === 'VERIFIED').length,
  }), [taskers])

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

  function openAction(tasker: TaskerUser, action: TaskerAction) {
    setPendingAction({ tasker, action })
    setReason('')
  }

  async function submitAction() {
    if (!pendingAction || submitting) return

    const needsReason =
      pendingAction.action === 'suspend' ||
      pendingAction.action === 'ban' ||
      pendingAction.action === 'reject_tasker'

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
          userId: pendingAction.tasker.id,
          action: pendingAction.action,
          reason: reason.trim() || undefined,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        crmApiError(body, 'Tasker action failed')
      }

      toast.success('Tasker account updated')
      setPendingAction(null)
      setReason('')
      await fetchTaskers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tasker action failed')
    } finally {
      setSubmitting(false)
    }
  }

  const actionLabel = pendingAction
    ? ({
        verify_tasker: 'Verify tasker',
        reject_tasker: 'Reject verification',
        suspend: 'Suspend tasker',
        unsuspend: 'Unsuspend tasker',
        ban: 'Ban tasker',
        unban: 'Remove ban',
      } satisfies Record<TaskerAction, string>)[pendingAction.action]
    : 'Tasker action'

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="People"
        title="Taskers"
        description="Operate provider accounts, verification and marketplace readiness using live server permissions and current market scope."
        actions={
          <CrmButton variant="secondary" onClick={fetchTaskers} disabled={loading}>
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </CrmButton>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CrmMetricCard
          label="Taskers"
          value={total.toLocaleString()}
          helper="Current market scope"
          icon={<FiUsers size={16} />}
          tone="neutral"
        />
        <CrmMetricCard
          label="Active on page"
          value={pageStats.active.toLocaleString()}
          helper="Available provider accounts"
          icon={<FiUserCheck size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="Verification pending"
          value={pageStats.pending.toLocaleString()}
          helper="Needs identity review"
          icon={<FiClock size={16} />}
          tone="warning"
        />
        <CrmMetricCard
          label="Verified on page"
          value={pageStats.verified.toLocaleString()}
          helper="Approved providers"
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
            placeholder="Search name, email, phone, MX ID or account ID..."
            className={`${crmInputClass} pl-9`}
          />
        </div>

        <div className="flex items-center gap-2 md:w-[220px]">
          <FiFilter className="shrink-0 text-slate-400" size={15} />
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
            className={crmInputClass}
            aria-label="Tasker account status"
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
          title="Loading taskers"
          description="Loading providers inside your current market scope."
        />
      ) : sortedTaskers.length === 0 ? (
        <CrmState
          type="empty"
          title="No taskers match this view"
          description="Change the search or status filter to find another provider."
        />
      ) : (
        <CrmTableFrame
          title="Tasker directory"
          description={`${total.toLocaleString()} taskers are visible inside the current market scope.`}
        >
          <table className={`${crmTableClass} min-w-[1240px]`}>
            <thead>
              <tr>
                <th className={crmThClass}>
                  <button type="button" onClick={() => toggleSort('mxId')} className="inline-flex items-center gap-1">
                    MX ID <SortIcon field="mxId" />
                  </button>
                </th>
                <th className={crmThClass}>
                  <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1">
                    Tasker <SortIcon field="name" />
                  </button>
                </th>
                <th className={crmThClass}>Verification</th>
                <th className={crmThClass}>
                  <button type="button" onClick={() => toggleSort('rating')} className="inline-flex items-center gap-1">
                    Rating <SortIcon field="rating" />
                  </button>
                </th>
                <th className={crmThClass}>Jobs</th>
                <th className={crmThClass}>Market</th>
                <th className={crmThClass}>Status</th>
                <th className={crmThClass}>
                  <button type="button" onClick={() => toggleSort('createdAt')} className="inline-flex items-center gap-1">
                    Joined <SortIcon field="createdAt" />
                  </button>
                </th>
                <th className={`${crmThClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedTaskers.map(tasker => {
                const status = accountStatus(tasker)
                const verification = verificationStatus(tasker)
                const pendingVerification =
                  (tasker.taskerProfile?.verificationStatus || 'PENDING') === 'PENDING'

                return (
                  <tr key={tasker.id} className="transition-colors hover:bg-[#fafbf9]">
                    <td className={crmTdClass}>
                      <span className="font-mono text-xs font-semibold text-amber-700">
                        {tasker.taskerProfile?.mxId || tasker.mxId || '—'}
                      </span>
                    </td>

                    <td className={crmTdClass}>
                      <Link href={`/admin/users/${tasker.id}`} className="flex items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--crm-accent-soft)] text-xs font-bold text-amber-800">
                          {(tasker.name?.[0] || 'T').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 hover:text-amber-700">
                            {tasker.name}
                          </div>
                          <div className="mt-0.5 max-w-[240px] truncate text-xs text-slate-400">
                            {tasker.email}
                          </div>
                        </div>
                      </Link>
                    </td>

                    <td className={crmTdClass}>
                      <CrmBadge tone={verification.tone} dot>
                        {verification.label}
                      </CrmBadge>
                    </td>

                    <td className={crmTdClass}>
                      <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                        <FiStar size={13} className="text-amber-500" />
                        {Number(tasker.taskerProfile?.rating || 0).toFixed(1)}
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <div className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                        <FiTool size={13} className="text-slate-400" />
                        {Number(tasker.taskerProfile?.completedJobs || 0).toLocaleString()}
                      </div>
                    </td>

                    <td className={crmTdClass}>
                      <CrmBadge>{tasker.countryCode || '—'}</CrmBadge>
                    </td>

                    <td className={crmTdClass}>
                      <CrmBadge tone={status.tone} dot>{status.label}</CrmBadge>
                    </td>

                    <td className={`${crmTdClass} whitespace-nowrap text-xs text-slate-400`}>
                      {formatDate(tasker.createdAt)}
                    </td>

                    <td className={`${crmTdClass} text-right`}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/users/${tasker.id}`}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--crm-border)] bg-white text-slate-500 hover:border-amber-300 hover:text-amber-700"
                          title="Open Tasker 360"
                        >
                          <FiEye size={14} />
                        </Link>

                        {actions.verify && pendingVerification && (
                          <>
                            <button
                              type="button"
                              onClick={() => openAction(tasker, 'verify_tasker')}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              title="Verify tasker"
                            >
                              <FiCheckCircle size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openAction(tasker, 'reject_tasker')}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              title="Reject verification"
                            >
                              <FiXCircle size={14} />
                            </button>
                          </>
                        )}

                        {actions.suspend && !tasker.isBanned && (
                          tasker.isSuspended ? (
                            <button
                              type="button"
                              onClick={() => openAction(tasker, 'unsuspend')}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              title="Unsuspend"
                            >
                              <FiUserCheck size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openAction(tasker, 'suspend')}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                              title="Suspend"
                            >
                              <FiShield size={14} />
                            </button>
                          )
                        )}

                        {actions.ban && (
                          tasker.isBanned ? (
                            <button
                              type="button"
                              onClick={() => openAction(tasker, 'unban')}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              title="Remove ban"
                            >
                              <FiUserCheck size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openAction(tasker, 'ban')}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              title="Ban tasker"
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
            ? `${pendingAction.tasker.name} · ${pendingAction.tasker.taskerProfile?.mxId || pendingAction.tasker.mxId || pendingAction.tasker.id}`
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
                pendingAction?.action === 'reject_tasker'
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
            pendingAction.action === 'reject_tasker'
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
                placeholder="Explain why this provider action is required…"
              />
            </div>
          )}

          <div className="rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-3 text-xs leading-5 text-slate-500">
            The server will re-check live staff permission, market scope and the tasker&apos;s current account state before applying this action. Every privileged change is audited.
          </div>
        </div>
      </CrmModal>
    </div>
  )
}
