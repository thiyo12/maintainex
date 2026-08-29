'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { FiAlertCircle, FiCheck, FiX, FiUserPlus, FiClock, FiFilter } from 'react-icons/fi'
import api from '@/lib/api'
import { useAuth } from '@/components/admin/AuthProvider'

interface Alert {
  id: string
  type: string
  severity: string
  title: string
  description: string | null
  status: string
  assignedTo: string | null
  assignedRole: string | null
  priority: string
  notes: string | null
  targetTable: string | null
  targetId: string | null
  createdAt: string
  assignee: { id: string; firstName: string; lastName: string; email: string; role: string } | null
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

const statusColors: Record<string, string> = {
  open: 'bg-red-500/20 text-red-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  resolved: 'bg-green-500/20 text-green-400',
  dismissed: 'bg-gray-500/20 text-gray-400',
}

const categoryLabels: Record<string, string> = {
  kyc: 'KYC Review',
  dispute: 'Disputes',
  settlement: 'Settlements',
  flagged_job: 'Flagged Jobs',
  fraud: 'Fraud',
  payout: 'Payouts',
  system: 'System',
}

const priorityColors: Record<string, string> = {
  urgent: 'text-red-400 font-bold',
  high: 'text-orange-400 font-semibold',
  medium: 'text-yellow-400',
  low: 'text-blue-400',
}

const SLA_MINUTES_MAP: Record<string, number> = {
  kyc: 1440,
  dispute: 2880,
  settlement: 4320,
  flagged_job: 1440,
  fraud: 720,
  payout: 2880,
  system: 10080,
}

function getSLAStatus(createdAt: string, type: string): { label: string; color: string } | null {
  const sla = SLA_MINUTES_MAP[type]
  if (!sla) return null
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 60000
  const remaining = sla - elapsed
  if (remaining < 0) return { label: 'Overdue', color: 'text-red-400' }
  if (remaining < sla * 0.25) return { label: `${Math.round(remaining)}m left`, color: 'text-orange-400' }
  return { label: `${Math.round(remaining / 60)}h left`, color: 'text-gray-400' }
}

export default function AlertsPage() {
  const { user } = useAuth()
  const isManager = user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER'

  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [resolveModalOpen, setResolveModalOpen] = useState(false)
  const [resolveNotes, setResolveNotes] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-alerts', statusFilter, categoryFilter, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      if (severityFilter) params.set('severity', severityFilter)
      const res = await api.get(`/api/admin/marketplace/alerts?${params}`)
      return res.data
    },
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      await api.patch(`/api/admin/marketplace/alerts/${id}`, { status, notes })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-alerts'] })
      toast.success('Alert updated')
      setSelectedAlert(null)
      setResolveModalOpen(false)
      setResolveNotes('')
    },
    onError: () => toast.error('Failed to update alert'),
  })

  const assignMutation = useMutation({
    mutationFn: async ({ id, assignedTo }: { id: string; assignedTo: string | null }) => {
      await api.patch(`/api/admin/marketplace/alerts/${id}`, { assignedTo })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-alerts'] })
      toast.success('Alert reassigned')
      setAssignModalOpen(false)
      setSelectedAlert(null)
    },
    onError: () => toast.error('Failed to reassign alert'),
  })

  const alerts = data?.alerts || []
  const summary = data?.summary || { openCount: 0, inProgressCount: 0, resolvedCount: 0 }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: '#F59E0B' }}>Work Queue</h1>
        <div className="flex gap-2">
          {[
            { label: 'Open', count: summary.openCount, color: 'text-red-400' },
            { label: 'In Progress', count: summary.inProgressCount, color: 'text-yellow-400' },
            { label: 'Resolved', count: summary.resolvedCount, color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="px-3 py-1.5 rounded-lg text-sm" style={{ backgroundColor: '#1B1D27', border: '1px solid #23252F' }}>
              <span className={`${s.color} font-bold`}>{s.count}</span>
              <span className="text-gray-400 ml-1">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border text-sm"
          style={{ backgroundColor: '#1B1D27', borderColor: '#23252F', color: '#FFFFFF' }}
        >
          <option value="">All Categories</option>
          {Object.entries(categoryLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border text-sm"
          style={{ backgroundColor: '#1B1D27', borderColor: '#23252F', color: '#FFFFFF' }}
        >
          <option value="">Active (Open + In Progress)</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
          <option value="ALL">All Status</option>
        </select>
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
      </div>

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1B1D27', border: '1px solid #23252F' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: '#23252F' }}>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Priority</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Category</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Title</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Severity</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Assigned To</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">SLA</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Created</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-400">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </td>
              </tr>
            ) : alerts.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-400">No alerts in queue</td>
              </tr>
            ) : (
              alerts.map((alert: Alert) => {
                const sla = getSLAStatus(alert.createdAt, alert.type)
                return (
                  <tr
                    key={alert.id}
                    className="border-b cursor-pointer transition-colors hover:bg-white/[0.02]"
                    style={{ borderColor: '#23252F' }}
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <td className="px-4 py-3">
                      <span className={`text-xs uppercase ${priorityColors[alert.priority] || priorityColors.medium}`}>
                        {alert.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-white/5 text-gray-300">
                        {categoryLabels[alert.type] || alert.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white max-w-xs truncate">{alert.title}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${severityColors[alert.severity] || severityColors.medium}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[alert.status] || statusColors.open}`}>
                        {alert.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {alert.assignee
                        ? `${alert.assignee.firstName} ${alert.assignee.lastName}`
                        : <span className="text-gray-500 italic">Unassigned</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {sla ? <span className={sla.color}>{sla.label}</span> : <span className="text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {alert.status === 'open' && (
                          <button
                            onClick={() => {
                              setSelectedAlert(alert)
                              setResolveModalOpen(true)
                            }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: '#22C55E' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            title="Resolve"
                          >
                            <FiCheck size={16} />
                          </button>
                        )}
                        {isManager && alert.status !== 'resolved' && alert.status !== 'dismissed' && (
                          <button
                            onClick={() => {
                              setSelectedAlert(alert)
                              setAssignModalOpen(true)
                            }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: '#F59E0B' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            title="Reassign"
                          >
                            <FiUserPlus size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Panel */}
      {selectedAlert && !resolveModalOpen && !assignModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAlert(null)}>
          <div className="rounded-xl w-full max-w-lg p-6" style={{ backgroundColor: '#1B1D27', border: '1px solid #23252F' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">{selectedAlert.title}</h3>
              <button onClick={() => setSelectedAlert(null)} className="text-gray-400 hover:text-white"><FiX size={20} /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex gap-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${severityColors[selectedAlert.severity]}`}>{selectedAlert.severity}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[selectedAlert.status]}`}>{selectedAlert.status.replace('_', ' ')}</span>
                <span className={`text-xs uppercase ${priorityColors[selectedAlert.priority]}`}>{selectedAlert.priority}</span>
              </div>
              <div className="text-gray-400"><span className="text-gray-500">Category:</span> {categoryLabels[selectedAlert.type] || selectedAlert.type}</div>
              <div className="text-gray-400"><span className="text-gray-500">Assigned to:</span> {selectedAlert.assignee ? `${selectedAlert.assignee.firstName} ${selectedAlert.assignee.lastName} (${selectedAlert.assignee.role})` : 'Unassigned'}</div>
              {selectedAlert.description && <div className="text-gray-300 whitespace-pre-wrap">{selectedAlert.description}</div>}
              {selectedAlert.notes && <div className="text-gray-400 italic"><span className="text-gray-500">Notes:</span> {selectedAlert.notes}</div>}
              <div className="text-gray-500 text-xs">Created: {new Date(selectedAlert.createdAt).toLocaleString()}</div>
              {selectedAlert.targetTable && <div className="text-gray-500 text-xs">Target: {selectedAlert.targetTable} / {selectedAlert.targetId}</div>}
            </div>
            <div className="flex gap-2 mt-6">
              {selectedAlert.status === 'open' && (
                <button onClick={() => setResolveModalOpen(true)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#22C55E', color: '#0B0C12' }}>Resolve</button>
              )}
              {selectedAlert.status === 'open' && (
                <button onClick={() => statusMutation.mutate({ id: selectedAlert.id, status: 'in_progress' })} className="px-4 py-2 rounded-lg text-sm font-medium border border-yellow-500/30 text-yellow-400" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)' }}>Start Working</button>
              )}
              {selectedAlert.status === 'in_progress' && (
                <button onClick={() => setResolveModalOpen(true)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#22C55E', color: '#0B0C12' }}>Resolve</button>
              )}
              {isManager && selectedAlert.status !== 'resolved' && selectedAlert.status !== 'dismissed' && (
                <button onClick={() => setAssignModalOpen(true)} className="px-4 py-2 rounded-lg text-sm font-medium border border-amber-500/30 text-amber-400" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>Reassign</button>
              )}
              {selectedAlert.status !== 'resolved' && selectedAlert.status !== 'dismissed' && (
                <button onClick={() => statusMutation.mutate({ id: selectedAlert.id, status: 'dismissed' })} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-500/30 text-gray-400">Dismiss</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModalOpen && selectedAlert && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setResolveModalOpen(false); setResolveNotes('') }}>
          <div className="rounded-xl w-full max-w-md p-6" style={{ backgroundColor: '#1B1D27', border: '1px solid #23252F' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Resolve Alert</h3>
            <textarea
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              placeholder="Resolution notes (optional)..."
              className="w-full px-4 py-3 rounded-lg border text-sm text-white placeholder-gray-500 resize-none h-24"
              style={{ backgroundColor: '#0B0C12', borderColor: '#23252F' }}
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => { setResolveModalOpen(false); setResolveNotes('') }} className="px-4 py-2 rounded-lg text-sm text-gray-400">Cancel</button>
              <button onClick={() => statusMutation.mutate({ id: selectedAlert.id, status: 'resolved', notes: resolveNotes || undefined })} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#22C55E', color: '#0B0C12' }}>Confirm Resolve</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignModalOpen && selectedAlert && isManager && (
        <AssignModal
          alert={selectedAlert}
          onAssign={(staffId) => assignMutation.mutate({ id: selectedAlert.id, assignedTo: staffId })}
          onClose={() => { setAssignModalOpen(false); setSelectedAlert(null) }}
        />
      )}
    </div>
  )
}

function AssignModal({ alert, onAssign, onClose }: { alert: Alert; onAssign: (staffId: string | null) => void; onClose: () => void }) {
  const { data: staffData, isLoading } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: async () => {
      const res = await api.get('/api/admin/admins')
      return res.data
    },
  })

  const staff = (staffData?.admins || []).filter((a: any) => a.isActive && a.role === alert.assignedRole)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-xl w-full max-w-md p-6" style={{ backgroundColor: '#1B1D27', border: '1px solid #23252F' }} onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-4">Reassign Alert</h3>
        <p className="text-sm text-gray-400 mb-4">Role: {alert.assignedRole}</p>
        {isLoading ? (
          <div className="py-8 text-center text-gray-400">Loading staff...</div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            <button
              onClick={() => onAssign(null)}
              className="w-full text-left px-4 py-3 rounded-lg border transition-colors hover:bg-white/5"
              style={{ borderColor: '#23252F', color: '#9CA3AF' }}
            >
              Unassigned
            </button>
            {staff.map((s: any) => (
              <button
                key={s.id}
                onClick={() => onAssign(s.id)}
                className="w-full text-left px-4 py-3 rounded-lg border transition-colors hover:bg-white/5"
                style={{ borderColor: '#23252F', color: '#FFFFFF' }}
              >
                <span className="font-medium">{s.firstName} {s.lastName}</span>
                <span className="text-gray-500 text-sm ml-2">{s.email}</span>
              </button>
            ))}
            {staff.length === 0 && (
              <div className="text-center text-gray-500 py-4">No staff with role {alert.assignedRole}</div>
            )}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400">Cancel</button>
        </div>
      </div>
    </div>
  )
}
