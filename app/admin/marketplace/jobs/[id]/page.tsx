'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiAlertCircle } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface JobDetail {
  id: string
  title: string
  description: string | null
  status: string
  budgetCents: number | null
  currency: string
  categoryId: string | null
  client: { id: string; name: string | null; email: string }
  worker: { id: string; name: string | null; email: string } | null
  escrow: { id: string; status: string; amountCents: number } | null
  createdAt: string
}

export default function MarketplaceJobDetail() {
  const params = useParams()
  const router = useRouter()
  const { user: currentUser } = useAdminSession()
  const [job, setJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const canCancel = (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN')

  useEffect(() => {
    fetchJob()
  }, [])

  const fetchJob = async () => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/admin/marketplace/jobs/${params.id}`, {
        headers: { ...authHeaders }
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const result = await res.json()

      if (result.error) {
        toast.error(result.error)
        setError(result.error)
        return
      }

      setJob(result.data)
    } catch (error) {
      console.error('Job detail error:', error)
      toast.error('Failed to load job')
      setError('Failed to load job')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to force cancel this job?')) return
    setCancelling(true)
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/admin/marketplace/jobs/${params.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', reason: 'Admin force cancellation' })
      })

      if (res.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const result = await res.json()

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Job cancelled successfully')
      const refreshRes = await fetch(`/api/admin/marketplace/jobs/${params.id}`, {
        headers: { ...getAuthHeader() }
      })
      const refreshData = await refreshRes.json()
      setJob(refreshData.data)
    } catch (error) {
      console.error('Cancel error:', error)
      toast.error('Failed to cancel job')
    } finally {
      setCancelling(false)
    }
  }

  const formatMoney = (cents: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      OPEN: 'bg-green-100 text-green-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-gray-100 text-gray-800',
      CANCELLED: 'bg-red-100 text-red-800',
      ON_HOLD: 'bg-yellow-100 text-yellow-800',
    }
    return <span className={`px-3 py-1 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !job) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <FiAlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-gray-600">{error}</p>
        <button onClick={fetchJob} className="btn-primary px-4 py-2 rounded-lg text-sm">Try Again</button>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Job not found</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
          <FiArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
        {statusBadge(job.status)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm">
          <div className="p-4 md:p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Details</h2>
          </div>
          <div className="p-4 md:p-6 space-y-4">
            {job.description && (
              <div>
                <p className="text-xs font-medium text-gray-500">Description</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Budget</p>
                <p className="text-sm text-gray-900">{job.budgetCents ? formatMoney(job.budgetCents) : '\u2014'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Created</p>
                <p className="text-sm text-gray-900">{new Date(job.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Client</p>
                <p className="text-sm text-gray-900">{job.client.name || job.client.email}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Worker</p>
                <p className="text-sm text-gray-900">{job.worker?.name || job.worker?.email || 'Not assigned'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 md:p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
          </div>
          <div className="p-4 md:p-6 space-y-3">
            {canCancel && job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-sm font-medium disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Force Cancel Job'}
              </button>
            )}
          </div>
        </div>
      </div>

      {job.escrow && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 md:p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Escrow</h2>
          </div>
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Amount</p>
                <p className="text-sm text-gray-900">{formatMoney(job.escrow.amountCents)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Status</p>
                <p className="text-sm text-gray-900">{job.escrow.status}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Escrow ID</p>
                <p className="text-sm text-gray-900 font-mono text-xs">{job.escrow.id}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
