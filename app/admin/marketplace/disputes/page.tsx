'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FiMessageSquare, FiCheck, FiX, FiSearch } from 'react-icons/fi'
import api from '@/lib/api'

interface Dispute {
  id: string
  title: string
  reason: string
  status: string
  jobId: string
  raisedBy: string
  raisedAgainst: string
  createdAt: string
}

export default function DisputesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-disputes', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      const res = await api.get(`/api/admin/marketplace/disputes?${params}`)
      return res.data
    },
  })

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/api/admin/marketplace/disputes/${id}`, { status: 'RESOLVED' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] })
      toast.success('Dispute resolved')
    },
    onError: () => toast.error('Failed to resolve dispute'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: '#F59E0B' }}>Disputes</h1>
        <div className="flex gap-3">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search disputes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: '#1B1D27', borderColor: '#23252F', color: '#FFFFFF' }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: '#1B1D27', borderColor: '#23252F', color: '#FFFFFF' }}
          >
            <option value="">All Status</option>
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Resolved</option>
            <option value="ESCALATED">Escalated</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1B1D27', border: '1px solid #23252F' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: '#23252F' }}>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">ID</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Title</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Reason</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Status</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Date</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </td>
              </tr>
            ) : data?.disputes?.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">No disputes found</td>
              </tr>
            ) : (
              (data?.disputes || []).map((dispute: Dispute) => (
                <tr key={dispute.id} className="border-b" style={{ borderColor: '#23252F' }}>
                  <td className="px-6 py-4 text-sm text-gray-300">#{dispute.id.slice(0, 8)}</td>
                  <td className="px-6 py-4 text-sm text-white">{dispute.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{dispute.reason}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      dispute.status === 'OPEN' ? 'bg-yellow-500/20 text-yellow-400' :
                      dispute.status === 'RESOLVED' ? 'bg-green-500/20 text-green-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {dispute.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {new Date(dispute.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {dispute.status === 'OPEN' && (
                      <button
                        onClick={() => resolveMutation.mutate(dispute.id)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: '#22C55E' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <FiCheck size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
