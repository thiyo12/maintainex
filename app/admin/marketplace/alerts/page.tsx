'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FiAlertCircle, FiCheck, FiX } from 'react-icons/fi'
import api from '@/lib/api'

interface Alert {
  id: string
  type: string
  severity: string
  title: string
  description: string | null
  status: string
  assignedTo: string | null
  createdAt: string
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-blue-500/20 text-blue-400',
}

const statusColors: Record<string, string> = {
  open: 'bg-red-500/20 text-red-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  resolved: 'bg-green-500/20 text-green-400',
  dismissed: 'bg-gray-500/20 text-gray-400',
}

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-alerts', statusFilter, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (severityFilter) params.set('severity', severityFilter)
      const res = await api.get(`/api/admin/marketplace/alerts?${params}`)
      return res.data
    },
  })

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/api/admin/marketplace/alerts/${id}`, { status: 'resolved' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-alerts'] })
      toast.success('Alert resolved')
    },
    onError: () => toast.error('Failed to resolve alert'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: '#F59E0B' }}>Alert Centre</h1>
        <div className="flex gap-3">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: '#1B1D27', borderColor: '#23252F', color: '#FFFFFF' }}
          >
            <option value="">All Severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: '#1B1D27', borderColor: '#23252F', color: '#FFFFFF' }}
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1B1D27', border: '1px solid #23252F' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: '#23252F' }}>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Severity</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Title</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Type</th>
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
            ) : data?.alerts?.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">No alerts found</td>
              </tr>
            ) : (
              (data?.alerts || []).map((alert: Alert) => (
                <tr key={alert.id} className="border-b" style={{ borderColor: '#23252F' }}>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${severityColors[alert.severity] || severityColors.medium}`}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-white">{alert.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{alert.type}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[alert.status] || statusColors.open}`}>
                      {alert.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {alert.status === 'open' && (
                      <button
                        onClick={() => resolveMutation.mutate(alert.id)}
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
