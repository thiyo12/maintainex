'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiArrowDown,
  FiArrowUp,
  FiCreditCard,
  FiDollarSign,
  FiLock,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUnlock,
  FiUser,
} from 'react-icons/fi'
import {
  CrmBadge,
  CrmButton,
  CrmFilterBar,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  CrmTableFrame,
  CrmTabs,
  crmInputClass,
  crmTableClass,
  crmTdClass,
  crmThClass,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmPagination } from '@/components/crm/v2/CrmOperational'
import { CrmStepUpModal } from '@/components/crm/v2/CrmStepUpModal'
import { crmApiError } from '@/lib/crm/api-error'

interface WalletUser {
  id?: string
  name?: string | null
  email?: string | null
  mxId?: string | null
  countryCode?: string | null
}

interface ProviderWallet {
  id: string
  userId: string
  availableBalance: number
  pendingBalance: number
  isFrozen: boolean
  currency: string
  user?: WalletUser | null
}

interface ProviderReceivable {
  id: string
  providerIdentityId: string
  identityType: string
  subjectId: string
  currentUserId?: string | null
  countryCode: string
  kycStatus: string
  standingStatus: string
  currency: string
  commissionDue: number
  commissionDueMinor: string
  status: string
  cashJobsAllowed: boolean
  onlineJobsAllowed: boolean
  manualReviewRequired: boolean
  oldestCommissionDueAt?: string | null
  updatedAt: string
  user?: WalletUser | null
}

interface CustomerWallet {
  id: string
  userId: string
  balance: number
  isFrozen: boolean
  currency: string
  user?: WalletUser | null
}

interface Transaction {
  id: string
  userId: string
  walletType: string
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  reference: string
  referenceType: string
  currency: string
  status: string
  createdAt: string
  user?: WalletUser | null
}

interface CurrencySummary {
  currency: string
  providerAvailable: number
  providerPending: number
  providerCount: number
  customerBalance: number
  customerCount: number
  frozenCount: number
}

interface WalletPayload {
  providerWallets: ProviderWallet[]
  providerReceivables: ProviderReceivable[]
  customerWallets: CustomerWallet[]
  transactions: Transaction[]
  summaryByCurrency: CurrencySummary[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  actions: {
    freeze: boolean
  }
}

type WalletTab = 'providers' | 'receivables' | 'customers' | 'transactions'

function formatCurrency(amount: number, currency = 'LKR') {
  return new Intl.NumberFormat(currency === 'CAD' ? 'en-CA' : 'en-LK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(Number(amount)) ? Number(amount) : 0)
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function WalletsPage() {
  const [activeTab, setActiveTab] = useState<WalletTab>('providers')
  const [payload, setPayload] = useState<WalletPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pendingFreeze, setPendingFreeze] = useState<{
    walletId: string
    currentlyFrozen: boolean
    label: string
  } | null>(null)
  const [freezeLoading, setFreezeLoading] = useState(false)

  const fetchWallets = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: activeTab,
        page: String(page),
        limit: '30',
      })
      const response = await fetch(`/api/admin/financial/wallets?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))

      if (response.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      if (!response.ok) {
        crmApiError(body, 'Failed to load wallet data')
      }

      setPayload(body)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load wallet data')
    } finally {
      setLoading(false)
    }
  }, [activeTab, page])

  useEffect(() => {
    fetchWallets()
  }, [fetchWallets])

  function changeTab(id: string) {
    setActiveTab(id as WalletTab)
    setSearchQuery('')
    setPage(1)
  }

  const query = searchQuery.trim().toLowerCase()
  const providers = useMemo(
    () => (payload?.providerWallets || []).filter(wallet =>
      !query ||
      wallet.user?.name?.toLowerCase().includes(query) ||
      wallet.user?.email?.toLowerCase().includes(query) ||
      wallet.user?.mxId?.toLowerCase().includes(query) ||
      wallet.userId.toLowerCase().includes(query)
    ),
    [payload, query]
  )
  const receivables = useMemo(
    () => (payload?.providerReceivables || []).filter(receivable =>
      !query ||
      receivable.user?.name?.toLowerCase().includes(query) ||
      receivable.user?.email?.toLowerCase().includes(query) ||
      receivable.user?.mxId?.toLowerCase().includes(query) ||
      receivable.providerIdentityId.toLowerCase().includes(query) ||
      receivable.identityType.toLowerCase().includes(query) ||
      receivable.status.toLowerCase().includes(query)
    ),
    [payload, query]
  )

  const customers = useMemo(
    () => (payload?.customerWallets || []).filter(wallet =>
      !query ||
      wallet.user?.name?.toLowerCase().includes(query) ||
      wallet.user?.email?.toLowerCase().includes(query) ||
      wallet.user?.mxId?.toLowerCase().includes(query) ||
      wallet.userId.toLowerCase().includes(query)
    ),
    [payload, query]
  )
  const transactions = useMemo(
    () => (payload?.transactions || []).filter(transaction =>
      !query ||
      transaction.user?.name?.toLowerCase().includes(query) ||
      transaction.user?.email?.toLowerCase().includes(query) ||
      transaction.reference.toLowerCase().includes(query) ||
      transaction.referenceType.toLowerCase().includes(query)
    ),
    [payload, query]
  )

  function requestFreeze(
    walletId: string,
    currentlyFrozen: boolean,
    label: string
  ) {
    if (!payload?.actions?.freeze) {
      toast.error('Your live staff permissions do not allow wallet freeze controls')
      return
    }
    setPendingFreeze({ walletId, currentlyFrozen, label })
  }

  async function applyFreeze(proof: string) {
    if (!pendingFreeze || freezeLoading) return
    setFreezeLoading(true)
    try {
      const response = await fetch('/api/admin/financial/wallets', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Step-Up': proof,
        },
        body: JSON.stringify({
          walletId: pendingFreeze.walletId,
          action: pendingFreeze.currentlyFrozen ? 'UNFREEZE' : 'FREEZE',
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        crmApiError(body, 'Wallet update failed')
      }

      toast.success(
        pendingFreeze.currentlyFrozen
          ? 'Wallet unfrozen'
          : 'Wallet frozen'
      )
      setPendingFreeze(null)
      await fetchWallets()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Wallet update failed')
    } finally {
      setFreezeLoading(false)
    }
  }

  const summaryRows = payload?.summaryByCurrency || []
  const currentRows =
    activeTab === 'providers'
      ? providers
      : activeTab === 'receivables'
        ? receivables
        : activeTab === 'customers'
          ? customers
          : transactions

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="Finance"
        title="Wallets & Ledger"
        description="Inspect provider/customer balances and transaction history. Wallet balances are never directly editable; freeze controls require a fresh one-time security proof."
        actions={
          <CrmButton variant="secondary" onClick={fetchWallets} disabled={loading}>
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </CrmButton>
        }
      />

      <section className="space-y-3">
        {summaryRows.length > 0 ? summaryRows.map(summary => (
          <div key={summary.currency} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <CrmMetricCard
              label={`Provider available · ${summary.currency}`}
              value={formatCurrency(summary.providerAvailable, summary.currency)}
              helper={`${summary.providerCount} provider wallets`}
              icon={<FiDollarSign size={16} />}
              tone="success"
            />
            <CrmMetricCard
              label={`Provider pending · ${summary.currency}`}
              value={formatCurrency(summary.providerPending, summary.currency)}
              helper="Reserved / awaiting clearing"
              icon={<FiClockIcon />}
              tone="warning"
            />
            <CrmMetricCard
              label={`Customer balances · ${summary.currency}`}
              value={formatCurrency(summary.customerBalance, summary.currency)}
              helper={`${summary.customerCount} customer wallets`}
              icon={<FiCreditCard size={16} />}
              tone="info"
            />
            <CrmMetricCard
              label={`Frozen wallets · ${summary.currency}`}
              value={summary.frozenCount}
              helper="Provider + customer"
              icon={<FiLock size={16} />}
              tone={summary.frozenCount > 0 ? 'danger' : 'neutral'}
            />
          </div>
        )) : (
          <CrmState
            type="empty"
            title="No wallet balances are available"
            description="No wallets are visible inside your current market scope."
          />
        )}
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <CrmTabs
          active={activeTab}
          onChange={changeTab}
          items={[
            { id: 'providers', label: 'Provider wallets' },
            { id: 'receivables', label: 'Provider receivables' },
            { id: 'customers', label: 'Customer wallets' },
            { id: 'transactions', label: 'Transactions' },
          ]}
        />

        <div className="relative w-full lg:max-w-sm">
          <FiSearch
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={15}
          />
          <input
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search this page…"
            className={`${crmInputClass} pl-9`}
          />
        </div>
      </div>

      {loading ? (
        <CrmState
          type="loading"
          title="Loading wallet operations"
          description="Loading scoped balances and ledger records."
        />
      ) : currentRows.length === 0 ? (
        <CrmState
          type="empty"
          title="No wallet records match this view"
          description="Change the tab, page or search query to inspect another record."
        />
      ) : activeTab === 'providers' ? (
        <CrmTableFrame
          title="Provider wallets"
          description="Available and pending balances are shown exactly as stored by the wallet engine."
        >
          <table className={`${crmTableClass} min-w-[1040px]`}>
            <thead>
              <tr>
                <th className={crmThClass}>Provider</th>
                <th className={crmThClass}>Market</th>
                <th className={crmThClass}>Available</th>
                <th className={crmThClass}>Pending</th>
                <th className={crmThClass}>Status</th>
                <th className={`${crmThClass} text-right`}>Control</th>
              </tr>
            </thead>
            <tbody>
              {providers.map(wallet => (
                <tr key={wallet.id} className="transition-colors hover:bg-[#fafbf9]">
                  <td className={crmTdClass}>
                    <Link
                      href={`/admin/users/${wallet.userId}`}
                      className="font-semibold text-slate-900 hover:text-amber-700"
                    >
                      {wallet.user?.name || 'Provider'}
                    </Link>
                    <div className="mt-1 text-xs text-slate-400">
                      {wallet.user?.mxId || wallet.user?.email || wallet.userId}
                    </div>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge>{wallet.user?.countryCode || '—'}</CrmBadge>
                  </td>
                  <td className={crmTdClass}>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(wallet.availableBalance, wallet.currency)}
                    </span>
                  </td>
                  <td className={crmTdClass}>
                    <span className="font-medium text-amber-700">
                      {formatCurrency(wallet.pendingBalance, wallet.currency)}
                    </span>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge tone={wallet.isFrozen ? 'danger' : 'success'} dot>
                      {wallet.isFrozen ? 'Frozen' : 'Active'}
                    </CrmBadge>
                  </td>
                  <td className={`${crmTdClass} text-right`}>
                    {payload?.actions?.freeze ? (
                      <CrmButton
                        variant={wallet.isFrozen ? 'secondary' : 'danger'}
                        size="sm"
                        onClick={() => requestFreeze(
                          wallet.id,
                          wallet.isFrozen,
                          wallet.user?.name || wallet.userId
                        )}
                      >
                        {wallet.isFrozen ? <FiUnlock size={13} /> : <FiLock size={13} />}
                        {wallet.isFrozen ? 'Unfreeze' : 'Freeze'}
                      </CrmButton>
                    ) : (
                      <CrmBadge>Read only</CrmBadge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <WalletPagination payload={payload} page={page} setPage={setPage} />
        </CrmTableFrame>
      ) : activeTab === 'receivables' ? (
        <CrmTableFrame
          title="Provider receivables"
          description="Cash-job commission and platform amounts owed to MaintainEX. These balances are ledger-backed and read only here."
        >
          <table className={`${crmTableClass} min-w-[1180px]`}>
            <thead>
              <tr>
                <th className={crmThClass}>Provider</th>
                <th className={crmThClass}>Type</th>
                <th className={crmThClass}>Market</th>
                <th className={crmThClass}>Commission due</th>
                <th className={crmThClass}>Standing</th>
                <th className={crmThClass}>Cash jobs</th>
                <th className={crmThClass}>Online jobs</th>
                <th className={crmThClass}>Oldest due</th>
              </tr>
            </thead>
            <tbody>
              {receivables.map(receivable => (
                <tr key={receivable.id} className="transition-colors hover:bg-[#fafbf9]">
                  <td className={crmTdClass}>
                    {receivable.currentUserId ? (
                      <Link
                        href={`/admin/users/${receivable.currentUserId}`}
                        className="font-semibold text-slate-900 hover:text-amber-700"
                      >
                        {receivable.user?.name || 'Provider'}
                      </Link>
                    ) : (
                      <span className="font-semibold text-slate-900">
                        {receivable.user?.name || 'Closed / detached identity'}
                      </span>
                    )}
                    <div className="mt-1 text-xs text-slate-400">
                      {receivable.user?.mxId || receivable.user?.email || receivable.providerIdentityId}
                    </div>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge>{receivable.identityType}</CrmBadge>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge>{receivable.countryCode}</CrmBadge>
                  </td>
                  <td className={crmTdClass}>
                    <span className={receivable.commissionDue > 0 ? 'font-semibold text-red-700' : 'font-semibold text-slate-900'}>
                      {formatCurrency(receivable.commissionDue, receivable.currency)}
                    </span>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge
                      tone={
                        receivable.status === 'REVIEW_REQUIRED'
                          ? 'danger'
                          : receivable.status === 'CASH_RESTRICTED'
                            ? 'warning'
                            : receivable.status === 'WARNING'
                              ? 'warning'
                              : 'success'
                      }
                      dot
                    >
                      {receivable.status.replaceAll('_', ' ')}
                    </CrmBadge>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge tone={receivable.cashJobsAllowed ? 'success' : 'danger'} dot>
                      {receivable.cashJobsAllowed ? 'Allowed' : 'Blocked'}
                    </CrmBadge>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge tone={receivable.onlineJobsAllowed ? 'success' : 'danger'} dot>
                      {receivable.onlineJobsAllowed ? 'Allowed' : 'Blocked'}
                    </CrmBadge>
                  </td>
                  <td className={crmTdClass}>
                    {receivable.oldestCommissionDueAt
                      ? formatDate(receivable.oldestCommissionDueAt)
                      : '—'}
                    {receivable.manualReviewRequired && (
                      <div className="mt-1 text-xs font-semibold text-red-700">
                        Manual review required
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <WalletPagination payload={payload} page={page} setPage={setPage} />
        </CrmTableFrame>
      ) : activeTab === 'customers' ? (
        <CrmTableFrame
          title="Customer wallets"
          description="Customer wallet balances remain ledger-controlled; CRM exposes freeze state only."
        >
          <table className={`${crmTableClass} min-w-[980px]`}>
            <thead>
              <tr>
                <th className={crmThClass}>Customer</th>
                <th className={crmThClass}>Market</th>
                <th className={crmThClass}>Balance</th>
                <th className={crmThClass}>Status</th>
                <th className={`${crmThClass} text-right`}>Control</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(wallet => (
                <tr key={wallet.id} className="transition-colors hover:bg-[#fafbf9]">
                  <td className={crmTdClass}>
                    <Link
                      href={`/admin/users/${wallet.userId}`}
                      className="font-semibold text-slate-900 hover:text-amber-700"
                    >
                      {wallet.user?.name || 'Customer'}
                    </Link>
                    <div className="mt-1 text-xs text-slate-400">
                      {wallet.user?.mxId || wallet.user?.email || wallet.userId}
                    </div>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge>{wallet.user?.countryCode || '—'}</CrmBadge>
                  </td>
                  <td className={crmTdClass}>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(wallet.balance, wallet.currency)}
                    </span>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge tone={wallet.isFrozen ? 'danger' : 'success'} dot>
                      {wallet.isFrozen ? 'Frozen' : 'Active'}
                    </CrmBadge>
                  </td>
                  <td className={`${crmTdClass} text-right`}>
                    {payload?.actions?.freeze ? (
                      <CrmButton
                        variant={wallet.isFrozen ? 'secondary' : 'danger'}
                        size="sm"
                        onClick={() => requestFreeze(
                          wallet.id,
                          wallet.isFrozen,
                          wallet.user?.name || wallet.userId
                        )}
                      >
                        {wallet.isFrozen ? <FiUnlock size={13} /> : <FiLock size={13} />}
                        {wallet.isFrozen ? 'Unfreeze' : 'Freeze'}
                      </CrmButton>
                    ) : (
                      <CrmBadge>Read only</CrmBadge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <WalletPagination payload={payload} page={page} setPage={setPage} />
        </CrmTableFrame>
      ) : (
        <CrmTableFrame
          title="Wallet transactions"
          description="Append-only operational history. CRM has no direct edit/delete action for historical ledger rows."
        >
          <table className={`${crmTableClass} min-w-[1160px]`}>
            <thead>
              <tr>
                <th className={crmThClass}>User</th>
                <th className={crmThClass}>Wallet</th>
                <th className={crmThClass}>Type</th>
                <th className={crmThClass}>Amount</th>
                <th className={crmThClass}>Balance after</th>
                <th className={crmThClass}>Reference</th>
                <th className={crmThClass}>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(transaction => (
                <tr key={transaction.id} className="transition-colors hover:bg-[#fafbf9]">
                  <td className={crmTdClass}>
                    <Link
                      href={`/admin/users/${transaction.userId}`}
                      className="font-semibold text-slate-900 hover:text-amber-700"
                    >
                      {transaction.user?.name || 'User'}
                    </Link>
                    <div className="mt-1 text-xs text-slate-400">
                      {transaction.user?.email || transaction.userId}
                    </div>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge>{transaction.walletType}</CrmBadge>
                  </td>
                  <td className={crmTdClass}>
                    <CrmBadge
                      tone={transaction.type === 'CREDIT' ? 'success' : 'danger'}
                    >
                      {transaction.type === 'CREDIT'
                        ? <FiArrowUp size={11} />
                        : <FiArrowDown size={11} />}
                      {transaction.type}
                    </CrmBadge>
                  </td>
                  <td className={crmTdClass}>
                    <span className={
                      transaction.type === 'CREDIT'
                        ? 'font-semibold text-emerald-700'
                        : 'font-semibold text-red-700'
                    }>
                      {transaction.type === 'CREDIT' ? '+' : '-'}
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </span>
                  </td>
                  <td className={crmTdClass}>
                    {formatCurrency(transaction.balanceAfter, transaction.currency)}
                  </td>
                  <td className={crmTdClass}>
                    <div className="font-mono text-xs text-slate-700">
                      {transaction.reference}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-slate-400">
                      {transaction.referenceType}
                    </div>
                  </td>
                  <td className={crmTdClass}>
                    <span className="text-xs text-slate-500">
                      {formatDate(transaction.createdAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <WalletPagination payload={payload} page={page} setPage={setPage} />
        </CrmTableFrame>
      )}

      <div className="rounded-[12px] border border-[var(--crm-border)] bg-white p-3.5 shadow-[var(--crm-shadow-card)]">
        <div className="flex items-start gap-3">
          <FiShield className="mt-0.5 shrink-0 text-amber-600" size={16} />
          <p className="text-xs leading-5 text-slate-500">
            Wallet freeze is a reversible safety control. Balance edits are not exposed.
            Any correction must use the governed compensating-ledger workflow, preserving immutable financial history.
          </p>
        </div>
      </div>

      <CrmStepUpModal
        open={Boolean(pendingFreeze)}
        actionId="finance.wallet.freeze"
        title={
          pendingFreeze?.currentlyFrozen
            ? 'Verify wallet unfreeze'
            : 'Verify wallet freeze'
        }
        description={
          pendingFreeze
            ? `${pendingFreeze.label} · this proof can only be used once for this exact wallet-control action.`
            : undefined
        }
        onClose={() => {
          if (!freezeLoading) setPendingFreeze(null)
        }}
        onVerified={applyFreeze}
      />
    </div>
  )
}

function WalletPagination({
  payload,
  page,
  setPage,
}: {
  payload: WalletPayload | null
  page: number
  setPage: (page: number) => void
}) {
  return (
    <CrmPagination
      page={payload?.pagination.page || page}
      totalPages={payload?.pagination.pages || 1}
      total={payload?.pagination.total || 0}
      pageSize={payload?.pagination.limit || 30}
      onPageChange={setPage}
    />
  )
}

function FiClockIcon() {
  return <span className="text-sm font-bold">⏳</span>
}
