'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiTool, FiEye, FiXCircle, FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import AdminLayout from '@/components/admin/AdminLayout'
import { getAuthHeader } from '@/lib/auth-client'

interface Job {
  id: string
  title: string
  description: string
  category: string
  budget: number
  budgetType?: string
  location: string
  status: string
  urgency?: string
  source: 'V1' | 'V2'
  createdAt: string
  customer: {
    id: string
    mxId?: string
    name: string
    email: string
  }
}

const TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'DISPUTED', label: 'Disputed' },
  { key: 'CANCELLED', label: 'Cancelled' },
] as const

type TabKey = typeof TABS[number]['key']

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-green-500/20 text-green-400 border-green-500/30',
  ASSIGNED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  IN_PROGRESS: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  COMPLETED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  CANCELLED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  DISPUTED: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const SOURCE_STYLES: Record<string, string> = {
  V1: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  V2: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

const SOURCE_LABELS: Record<string, string> = {
  V1: 'Classic',
  V2: 'Marketplace',
}

const URGENCY_STYLES: Record<string, string> = {
  normal: 'text-gray-400',
  urgent: 'text-amber-400',
  emergency: 'text-red-400',
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('ALL')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalV1, setTotalV1] = useState(0)
  const [totalV2, setTotalV2] = useState(0)
  const [detailModal, setDetailModal] = useState<Job | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    setPage(1)
    fetchJobs()
  }, [activeTab])

  useEffect(() => {
    fetchJobs()
  }, [page])

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const statusParam = activeTab === 'ALL' ? '' : `&status=${activeTab}`
      const res = await fetch(`/api/admin/jobs?page=${page}&limit=15${statusParam}`, {
        headers: { ...getAuthHeader() },
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setJobs(data.jobs || [])
      setTotalPages(data.pagination?.pages || 1)
      setTotal(data.pagination?.total || 0)
      setTotalV1(data.summary?.totalV1 || 0)
      setTotalV2(data.summary?.totalV2 || 0)
    } catch {
      toast.error('Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelJob = async (jobId: string, source: string) => {
    setActionLoading(jobId)
    try {
      const res = await fetch(`/api/admin/jobs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ jobId, status: 'CANCELLED', source }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Job cancelled')
      setDetailModal(null)
      fetchJobs()
    } catch {
      toast.error('Failed to cancel job')
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 0 }).format(amount)

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FiTool className="text-amber-500" /> Jobs Management
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {total} total jobs &middot;{' '}
              <span className="text-blue-400">{totalV1} Classic</span> &middot;{' '}
              <span className="text-purple-400">{totalV2} Marketplace</span>
            </p>
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
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-[#15161E] border border-white/5 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-16 text-center">
              <FiSearch className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No jobs found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Job ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Budget</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Posted</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-white/[0.02] transition">
                        <td className="px-4 py-3 font-mono text-xs text-amber-500">{job.id.slice(0, 10)}...</td>
                        <td className="px-4 py-3 text-white font-medium max-w-[200px] truncate">{job.title}</td>
                        <td className="px-4 py-3 text-gray-300">{job.customer.name}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{job.category}</td>
                        <td className="px-4 py-3 text-white font-medium">
                          {formatCurrency(job.budget)}
                          {job.budgetType && job.budgetType !== 'FIXED' && (
                            <span className="ml-1 text-xs text-gray-500">({job.budgetType})</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium border ${SOURCE_STYLES[job.source] || ''}`}>
                            {SOURCE_LABELS[job.source] || job.source}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium border ${STATUS_STYLES[job.status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                            {job.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(job.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => setDetailModal(job)}
                              className="p-1.5 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white transition"
                              title="View Details"
                            >
                              <FiEye size={14} />
                            </button>
                            {job.status !== 'CANCELLED' && job.status !== 'COMPLETED' && (
                              <button
                                onClick={() => handleCancelJob(job.id, job.source)}
                                disabled={actionLoading === job.id}
                                className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition disabled:opacity-50"
                                title="Cancel Job"
                              >
                                <FiXCircle size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                  <span className="text-sm text-gray-400">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white disabled:opacity-30 transition"
                    >
                      <FiChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 hover:text-white disabled:opacity-30 transition"
                    >
                      <FiChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail Modal */}
        {detailModal && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setDetailModal(null)}
          >
            <div className="bg-[#15161E] border border-white/10 rounded-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">Job Details</h3>
                  <button onClick={() => setDetailModal(null)} className="text-gray-400 hover:text-white transition">
                    <FiXCircle size={20} />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Job ID</div>
                  <div className="font-mono text-amber-500 text-sm">{detailModal.id}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Title</div>
                  <div className="text-white">{detailModal.title}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Description</div>
                  <div className="text-gray-300 text-sm">{detailModal.description}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Customer</div>
                    <div className="text-white text-sm">{detailModal.customer.name}</div>
                    <div className="text-gray-400 text-xs">{detailModal.customer.email}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Category</div>
                    <div className="text-white text-sm">{detailModal.category}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Budget</div>
                    <div className="text-white text-sm font-medium">
                      {formatCurrency(detailModal.budget)}
                      {detailModal.budgetType && detailModal.budgetType !== 'FIXED' && (
                        <span className="ml-1 text-xs text-gray-500">({detailModal.budgetType})</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Source</div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium border ${SOURCE_STYLES[detailModal.source] || ''}`}>
                      {SOURCE_LABELS[detailModal.source] || detailModal.source}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Status</div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium border ${STATUS_STYLES[detailModal.status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                      {detailModal.status.replace('_', ' ')}
                    </span>
                  </div>
                  {detailModal.urgency && detailModal.urgency !== 'NORMAL' && detailModal.urgency !== 'normal' && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Urgency</div>
                      <div className={`text-sm font-medium capitalize ${URGENCY_STYLES[detailModal.urgency] || 'text-gray-400'}`}>
                        {detailModal.urgency}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Location</div>
                    <div className="text-white text-sm">{detailModal.location}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Posted</div>
                    <div className="text-white text-sm">{formatDate(detailModal.createdAt)}</div>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-white/5 flex justify-end gap-2">
                {detailModal.status !== 'CANCELLED' && detailModal.status !== 'COMPLETED' && (
                  <button
                    onClick={() => handleCancelJob(detailModal.id, detailModal.source)}
                    disabled={actionLoading === detailModal.id}
                    className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 disabled:opacity-50 transition font-medium"
                  >
                    {actionLoading === detailModal.id ? 'Cancelling...' : 'Cancel Job'}
                  </button>
                )}
                <button
                  onClick={() => setDetailModal(null)}
                  className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
