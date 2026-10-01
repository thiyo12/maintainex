'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowDown,
  FiArrowUp,
  FiEye,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUserCheck,
  FiUsers,
  FiUserX,
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

interface CustomerUser {
  id: string
  mxId?: string | null
  name: string
  email: string
  phone?: string | null
  countryCode?: string | null
  isActive: boolean
  isSuspended: boolean
  isBanned: boolean
  banReason?: string | null
  suspensionReason?: string | null
  createdAt: string
  customerProfile?: {
    id: string
    customerType: string
    status: string
    totalBookings: number
    totalSpent: number
    lifetimeValue: number
    lastBooking?: string | null
    province?: string | null
  } | null
}

interface ApiResponse {
  users: CustomerUser[]
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

type SortField = 'name' | 'email' | 'createdAt' | 'mxId'
type SortDir = 'asc' | 'desc'

function statusFor(customer: CustomerUser): { label: string; tone: CrmTone } {
  if (customer.isBanned) return { label: 'Banned', tone: 'danger' }
  if (customer.isSuspended) return { label: 'Suspended', tone: 'warning' }
  if (!customer.isActive) return { label: 'Inactive', tone: 'neutral' }
  return { label: 'Active', tone: 'success' }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-LK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function CustomerManagementPage() {
  const [customers, setCustomers] = useState<CustomerUser[]>([])
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
    customer: CustomerUser
    action: 'suspend' | 'unsuspend' | 'ban' | 'unban'
  } | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: 'customer',
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
        throw new Error(body?.error || 'Failed to load customers')
      }

      const payload = body as ApiResponse
      setCustomers(payload.users || [])
      setTotal(Number(payload.total || 0))
      setPageSize(Number(payload.pageSize || 20))
      setTotalPages(Math.max(1, Number(payload.totalPages || 1)))
      setActions(payload.actions || { suspend: false, ban: false, verify: false })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, statusFilter])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter])

  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => {
      const value = (item: CustomerUser) => {
        if (sortField === 'name') return item.name || ''
        if (sortField === 'email') return item.email || ''
        if (sortField === 'mxId') return item.mxId || ''
        return item.createdAt || ''
      }
      const comparison = value(a).localeCompare(value(b))
      return sortDir === 'asc' ? comparison : -comparison
    })
  }, [customers, sortDir, sortField])

  const pageStats = useMemo(() => ({
    active: customers.filter(item => !item.isBanned && !item.isSuspended && item.isActive).length,
    suspended: customers.filter(item => item.isSuspended && !item.isBanned).length,
    banned: customers.filter(item => item.isBanned).length,
  }), [customers])

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

  function openAction(
    customer: CustomerUser,
    action: 'suspend' | 'unsuspend' | 'ban' | 'unban'
  ) {
    setPendingAction({ customer, action })
    setReason('')
  }

  async function submitAction() {
    if (!pendingAction || submitting) return

    const needsReason = pendingAction.action === 'suspend' || pendingAction.action === 'ban'
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
          userId: pendingAction.customer.id,
          action: pendingAction.action,
          reason: reason.trim() || undefined,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body?.error || 'Account action failed')
      }

      toast.success('Customer account updated')
      setPendingAction(null)
      setReason('')
      await fetchCustomers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Account action failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="People"
        title="Customers"
        description="Search customer accounts, inspect account health and open Customer 360 without exposing controls the current staff session cannot use."
        actions={
          <CrmButton variant="secondary" onClick={fetchCustomers} disabled={loading}>
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </CrmButton>
        }
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CrmMetricCard
          label="Customers"
          value={total.toLocaleString()}
          helper="Current market scope"
          icon={<FiUsers size={16} />}
          tone="neutral"
        />
        <CrmMetricCard
          label="Active on page"
          value={pageStats.active.toLocaleString()}
          helper="Available accounts"
          icon={<FiUserCheck size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="Suspended on page"
          value={pageStats.suspended.toLocaleString()}
          helper="Restricted accounts"
          icon={<FiShield size={16} />}
          tone="warning"
        />
        <CrmMetricCard
          label="Banned on page"
          value={pageStats.banned.toLocaleString()}
          helper="Blocked accounts"
          icon={<FiUserX size={16} />}
          tone="danger"
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
            aria-label="Customer account status"
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
          title="Loading customers"
          description="Loading accounts inside your current market scope."
        />
      ) : sortedCustomers.length === 0 ? (
        <CrmState
          type="empty"
          title="No customers match this view"
          description="Change the search or status filter to find another account."
        />
      ) : (
        <CrmTableFrame
          title="Customer directory"
          description={`${total.toLocaleString()} customers are visible inside the current market scope.`}
        >
          <table className={`${crmTableClass} min-w-[1040px]`}>
            <thead>
              <tr>
                <th className={crmThClass}>
                  <button type="button" onClick={() => toggleSort('mxId')} className="inline-flex items-center gap-1">
                    MX ID <SortIcon field="mxId" />
                  </button>
                </th>
                <th className={crmThClass}>
                  <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1">
                    Customer <SortIcon field="name" />
                  </button>
                </th>
                <th className={crmThClass}>
                  <button type="button" onClick={() => toggleSort('email')} className="inline-flex items-center gap-1">
                    Email <SortIcon field="email" />
                  </button>
                </th>
                <th className={crmThClass}>Phone</th>
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
              {sortedCustomers.map(customer => {
                const status = statusFor(customer)
                return (
                  <tr key={customer.id} className="transition-colors hover:bg-[#fafbf9]">
                    <td className={crmTdClass}>
                      <span className="font-mono text-xs font-semibold text-amber-700">
                        {customer.mxId || '—'}
                      </span>
                    </td>
                    <td className={crmTdClass}>
                      <Link
                        href={`/admin/users/${customer.id}`}
                        className="flex items-center gap-3"
                      >
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--crm-accent-soft)] text-xs font-bold text-amber-800">
                          {(customer.name?.[0] || 'C').toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 hover:text-amber-700">
                            {customer.name}
                          </div>
                          <div className="mt-0.5 max-w-[220px] truncate font-mono text-[10px] text-slate-400">
                            {customer.id}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className={`${crmTdClass} text-slate-500`}>{customer.email}</td>
                    <td className={`${crmTdClass} text-slate-500`}>{customer.phone || '—'}</td>
                    <td className={crmTdClass}>
                      <CrmBadge>{customer.countryCode || customer.customerProfile?.province || '—'}</CrmBadge>
                    </td>
                    <td className={crmTdClass}>
                      <CrmBadge tone={status.tone} dot>{status.label}</CrmBadge>
                    </td>
                    <td className={`${crmTdClass} whitespace-nowrap text-xs text-slate-400`}>
                      {formatDate(customer.createdAt)}
                    </td>
                    <td className={`${crmTdClass} text-right`}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/users/${customer.id}`}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--crm-border)] bg-white text-slate-500 hover:border-amber-300 hover:text-amber-700"
                          title="Open Customer 360"
                        >
                          <FiEye size={14} />
                        </Link>

                        {actions.suspend && !customer.isBanned && (
                          customer.isSuspended ? (
                            <button
                              type="button"
                              onClick={() => openAction(customer, 'unsuspend')}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              title="Unsuspend"
                            >
                              <FiUserCheck size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openAction(customer, 'suspend')}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                              title="Suspend"
                            >
                              <FiShield size={14} />
                            </button>
                          )
                        )}

                        {actions.ban && (
                          customer.isBanned ? (
                            <button
                              type="button"
                              onClick={() => openAction(customer, 'unban')}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              title="Remove ban"
                            >
                              <FiUserCheck size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openAction(customer, 'ban')}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              title="Ban"
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
        title={
          pendingAction
            ? `${pendingAction.action === 'unban' ? 'Remove ban' : pendingAction.action[0].toUpperCase() + pendingAction.action.slice(1)} customer`
            : 'Customer action'
        }
        description={
          pendingAction
            ? `${pendingAction.customer.name} · ${pendingAction.customer.mxId || pendingAction.customer.id}`
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
              variant={pendingAction?.action === 'ban' ? 'danger' : 'primary'}
              onClick={submitAction}
              disabled={submitting}
            >
              {submitting ? 'Working…' : 'Confirm action'}
            </CrmButton>
          </>
        }
      >
        <div className="space-y-4">
          {(pendingAction?.action === 'suspend' || pendingAction?.action === 'ban') && (
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
                placeholder="Explain why this account action is required…"
              />
            </div>
          )}

          <div className="rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-3 text-xs leading-5 text-slate-500">
            The server will re-check your current permission and market scope before changing the account. The action is audited.
          </div>
        </div>
      </CrmModal>
    </div>
  )
}
