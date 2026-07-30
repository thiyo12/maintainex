'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiCreditCard, FiUser, FiDollarSign, FiRefreshCw, FiLock, FiUnlock, FiArrowUp, FiArrowDown, FiSearch } from 'react-icons/fi'
import AdminLayout from '@/components/admin/AdminLayout'
import { getAuthHeader } from '@/lib/auth-client'

interface ProviderWallet {
  id: string
  userId: string
  availableBalance: number
  pendingBalance: number
  isFrozen: boolean
  user?: { name: string; email: string; mxId?: string }
}

interface CustomerWallet {
  id: string
  userId: string
  balance: number
  isFrozen: boolean
  user?: { name: string; email: string }
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
  status: string
  createdAt: string
  user?: { name: string; email: string }
}

export default function WalletsPage() {
  const [activeTab, setActiveTab] = useState<'providers' | 'customers' | 'transactions'>('providers')
  const [providerWallets, setProviderWallets] = useState<ProviderWallet[]>([])
  const [customerWallets, setCustomerWallets] = useState<CustomerWallet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [freezeLoading, setFreezeLoading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchWallets()
  }, [activeTab])

  const fetchWallets = async () => {
    setLoading(true)
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/admin/financial/wallets?type=${activeTab}`, {
        headers: { ...authHeaders }
      })
      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
        return
      }
      setProviderWallets(data.providerWallets || [])
      setCustomerWallets(data.customerWallets || [])
      setTransactions(data.transactions || [])
    } catch (error) {
      console.error('Failed to fetch wallets:', error)
      toast.error('Failed to load wallet data')
    } finally {
      setLoading(false)
    }
  }

  const handleFreezeToggle = async (walletId: string, currentlyFrozen: boolean) => {
    setFreezeLoading(walletId)
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/admin/financial/wallets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ walletId, action: currentlyFrozen ? 'UNFREEZE' : 'FREEZE' })
      })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success(`Wallet ${currentlyFrozen ? 'unfrozen' : 'frozen'}`)
        fetchWallets()
      }
    } catch (error) {
      toast.error('Failed to update wallet')
    } finally {
      setFreezeLoading(null)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const tabs = [
    { id: 'providers' as const, label: 'Provider Wallets', icon: FiUser },
    { id: 'customers' as const, label: 'Customer Wallets', icon: FiCreditCard },
    { id: 'transactions' as const, label: 'Transactions', icon: FiDollarSign },
  ]

  const totalProviderBalance = providerWallets.reduce((sum, w) => sum + w.availableBalance, 0)
  const totalCustomerBalance = customerWallets.reduce((sum, w) => sum + w.balance, 0)
  const frozenCount = [...providerWallets, ...customerWallets].filter(w => w.isFrozen).length

  const filteredProviders = providerWallets.filter(w =>
    !searchQuery || w.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.user?.mxId?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredCustomers = customerWallets.filter(w =>
    !searchQuery || w.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.user?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredTransactions = transactions.filter(t =>
    !searchQuery || t.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.reference.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Wallets & Payouts</h1>
          <p className="text-gray-400 mt-1">Manage provider and customer wallet balances</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#15161E] border border-white/5 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <FiDollarSign className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-sm text-gray-400">Provider Balances</span>
            </div>
            <div className="text-2xl font-bold text-white">{formatCurrency(totalProviderBalance)}</div>
          </div>
          <div className="bg-[#15161E] border border-white/5 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <FiCreditCard className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm text-gray-400">Customer Balances</span>
            </div>
            <div className="text-2xl font-bold text-white">{formatCurrency(totalCustomerBalance)}</div>
          </div>
          <div className="bg-[#15161E] border border-white/5 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <FiLock className="w-5 h-5 text-red-400" />
              </div>
              <span className="text-sm text-gray-400">Frozen Wallets</span>
            </div>
            <div className="text-2xl font-bold text-white">{frozenCount}</div>
          </div>
        </div>

        <div className="bg-[#15161E] border border-white/5 rounded-xl p-1.5">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSearchQuery('') }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex-1 justify-center ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-[#0B0C12]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <FiSearch className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or ID..."
            className="w-full bg-[#15161E] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === 'providers' ? (
          filteredProviders.length === 0 ? (
            <div className="bg-[#15161E] border border-white/5 rounded-xl py-16 text-center">
              <FiUser className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No provider wallets found</p>
            </div>
          ) : (
            <div className="bg-[#15161E] border border-white/5 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Available Balance</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending Balance</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredProviders.map((w) => (
                      <tr key={w.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-white">{w.user?.name || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">{w.user?.mxId || w.userId.slice(0, 12)}</div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-emerald-400">{formatCurrency(w.availableBalance)}</td>
                        <td className="px-4 py-3 text-sm text-amber-400">{formatCurrency(w.pendingBalance)}</td>
                        <td className="px-4 py-3">
                          {w.isFrozen ? (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-medium">Frozen</span>
                          ) : (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">Active</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleFreezeToggle(w.id, w.isFrozen)}
                            disabled={freezeLoading === w.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors disabled:opacity-50 ${
                              w.isFrozen
                                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            }`}
                          >
                            {freezeLoading === w.id ? '...' : w.isFrozen ? <><FiUnlock className="w-3 h-3" /> Unfreeze</> : <><FiLock className="w-3 h-3" /> Freeze</>}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : activeTab === 'customers' ? (
          filteredCustomers.length === 0 ? (
            <div className="bg-[#15161E] border border-white/5 rounded-xl py-16 text-center">
              <FiCreditCard className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No customer wallets found</p>
            </div>
          ) : (
            <div className="bg-[#15161E] border border-white/5 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Balance</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredCustomers.map((w) => (
                      <tr key={w.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-white">{w.user?.name || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">{w.userId.slice(0, 12)}</div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-emerald-400">{formatCurrency(w.balance)}</td>
                        <td className="px-4 py-3">
                          {w.isFrozen ? (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-medium">Frozen</span>
                          ) : (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">Active</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleFreezeToggle(w.id, w.isFrozen)}
                            disabled={freezeLoading === w.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors disabled:opacity-50 ${
                              w.isFrozen
                                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            }`}
                          >
                            {freezeLoading === w.id ? '...' : w.isFrozen ? <><FiUnlock className="w-3 h-3" /> Unfreeze</> : <><FiLock className="w-3 h-3" /> Freeze</>}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          filteredTransactions.length === 0 ? (
            <div className="bg-[#15161E] border border-white/5 rounded-xl py-16 text-center">
              <FiDollarSign className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No transactions found</p>
            </div>
          ) : (
            <div className="bg-[#15161E] border border-white/5 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Reference</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredTransactions.map((t) => (
                      <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-white">{t.user?.name || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">{t.walletType}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${
                            t.type === 'CREDIT'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {t.type === 'CREDIT' ? <FiArrowUp className="w-3 h-3" /> : <FiArrowDown className="w-3 h-3" />}
                            {t.type}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm font-medium ${t.type === 'CREDIT' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.type === 'CREDIT' ? '+' : '-'}{formatCurrency(t.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded">{t.reference}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">{formatDate(t.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>
    </AdminLayout>
  )
}
